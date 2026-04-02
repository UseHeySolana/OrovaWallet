# AI agent thinking — source reference (snapshot)

This file embeds the **actual TypeScript** that implements the planner / vision / executor / critic loop so you can copy or diff it in another project.

**Canonical files in the repo** (line numbers drift over time; grep the symbol names if needed):

| Area | File |
|------|------|
| Zod schemas, main loop, executor/critic prompts | `test-executor.service.ts` |
| Vision-only prompts (pre-action + critic evidence) | `testing-agents.service.ts` |
| Model routing, `invoke`, structured output, vision API | `langchain.service.ts` |

Companion conceptual doc: `AI_AGENT_THINKING_ARCHITECTURE.md`.

---

## 1. `langchain.service.ts` (full)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

/** Routes text LLM calls by agent responsibility (separate models via env). */
export type TextModelRole = 'planner' | 'executor' | 'critic';

@Injectable()
export class LangChainService {
    private readonly logger = new Logger(LangChainService.name);
    private readonly apiKey: string | null;
    private readonly defaultTemperature = 0.3;

    private readonly visionModelName: string;
    /** HTTP timeout for OpenAI vision calls (large images + structured output can be slow). */
    private readonly visionTimeoutMs: number;
    private readonly textModelByRole: Record<TextModelRole, string>;

    constructor(private configService: ConfigService) {
        const trim = (v: string | undefined): string | undefined =>
            typeof v === 'string' ? v.trim() || undefined : undefined;

        this.apiKey =
            trim(this.configService.get<string>('OPEN_AI_KEY')) ||
            trim(this.configService.get<string>('OPENAI_API_KEY')) ||
            null;

        this.visionModelName =
            trim(this.configService.get<string>('OPENAI_VISION_MODEL')) ||
            trim(this.configService.get<string>('OPENAI_IMAGE_MODEL')) ||
            'gpt-4o';

        const visionTimeoutRaw = this.configService.get<string | number>('OPENAI_VISION_TIMEOUT_MS');
        const parsed =
            typeof visionTimeoutRaw === 'number'
                ? visionTimeoutRaw
                : parseInt(String(visionTimeoutRaw ?? ''), 10);
        this.visionTimeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;

        const defaultText = trim(this.configService.get<string>('OPENAI_TEXT_MODEL')) || 'gpt-4o-mini';
        this.textModelByRole = {
            planner:
                trim(this.configService.get<string>('OPENAI_TEXT_MODEL_PLANNER')) ||
                trim(this.configService.get<string>('OPENAI_PLANNER_MODEL')) ||
                defaultText,
            executor:
                trim(this.configService.get<string>('OPENAI_TEXT_MODEL_EXECUTOR')) ||
                trim(this.configService.get<string>('OPENAI_EXECUTOR_MODEL')) ||
                defaultText,
            critic:
                trim(this.configService.get<string>('OPENAI_TEXT_MODEL_CRITIC')) ||
                trim(this.configService.get<string>('OPENAI_CRITIC_MODEL')) ||
                defaultText,
        };

        if (this.apiKey) {
            const keyPreview = this.apiKey.substring(0, 7) + '...';
            this.logger.log(`LangChain service initialized with API key: ${keyPreview}`);
            this.logger.log(
                `Model routing: vision=${this.visionModelName}, text planner=${this.textModelByRole.planner}, executor=${this.textModelByRole.executor}, critic=${this.textModelByRole.critic}`,
            );
        } else {
            this.logger.warn('OPEN_AI_KEY or OPENAI_API_KEY not found. LangChain service will be disabled.');
        }
    }

    private ensureApiKey(): void {
        if (!this.apiKey) {
            this.logger.error('Cannot create ChatOpenAI model: API key is null or undefined');
        }
        if (!process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = this.apiKey!;
        }
    }

    /**
     * Text chat model for Planner / Executor / Critic agents (no image).
     */
    private createTextModelForRole(
        role: TextModelRole,
        options?: { temperature?: number; maxTokens?: number },
    ): ChatOpenAI | null {
        if (!this.apiKey) {
            return null;
        }
        this.ensureApiKey();
        const modelName = this.textModelByRole[role];
        try {
            return new ChatOpenAI({
                modelName,
                temperature: options?.temperature ?? this.defaultTemperature,
                maxTokens: options?.maxTokens,
                apiKey: this.apiKey!,
            });
        } catch (error) {
            this.logger.error(`Error creating text model for role ${role}:`, error);
            throw error;
        }
    }

    /**
     * Vision (multimodal) model — only for image/screenshot understanding.
     */
    private createVisionModel(options?: { temperature?: number; maxTokens?: number }): ChatOpenAI | null {
        if (!this.apiKey) {
            return null;
        }
        this.ensureApiKey();
        try {
            return new ChatOpenAI({
                modelName: this.visionModelName,
                temperature: options?.temperature ?? this.defaultTemperature,
                maxTokens: options?.maxTokens,
                apiKey: this.apiKey!,
                timeout: this.visionTimeoutMs,
                maxRetries: 1,
            });
        } catch (error) {
            this.logger.error('Error creating vision model:', error);
            throw error;
        }
    }

    /**
     * @deprecated Use textModelRole or vision model explicitly; kept for backward compatibility.
     * useVision=true selects the vision model name (same as image-only stack).
     */
    private createChatModel(options: {
        useVision?: boolean;
        textModelRole?: TextModelRole;
        temperature?: number;
        maxTokens?: number;
    }): ChatOpenAI | null {
        if (options.useVision) {
            return this.createVisionModel({
                temperature: options.temperature,
                maxTokens: options.maxTokens,
            });
        }
        const role = options.textModelRole ?? 'executor';
        return this.createTextModelForRole(role, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
        });
    }

    isAvailable(): boolean {
        return this.apiKey !== null;
    }

    createPromptTemplate(template: string): PromptTemplate {
        return PromptTemplate.fromTemplate(template);
    }

    async invokeWithStructuredOutput<T>(
        prompt: string,
        schema: z.ZodTypeAny,
        options?: {
            /** Prefer over useVision for text agents */
            textModelRole?: TextModelRole;
            useVision?: boolean;
            temperature?: number;
            maxTokens?: number;
            systemMessage?: string;
            /** Override LangChain default (json_schema when supported). Use functionCalling for broader model compatibility. */
            structuredOutputMethod?: 'jsonSchema' | 'functionCalling' | 'jsonMode';
        },
    ): Promise<T> {
        if (!this.isAvailable()) {
            throw new Error('LangChain service is not available. OPEN_AI_KEY not configured.');
        }

        const model = this.createChatModel({
            useVision: options?.useVision,
            textModelRole: options?.textModelRole ?? 'executor',
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
        });

        if (!model) {
            throw new Error('Model not available');
        }

        const structuredModel = model.withStructuredOutput(schema, {
            name: 'structured_output',
            ...(options?.structuredOutputMethod
                ? { method: options.structuredOutputMethod }
                : {}),
        });

        const messages: any[] = [];
        if (options?.systemMessage) {
            messages.push({ role: 'system', content: options.systemMessage });
        }
        messages.push({ role: 'user', content: prompt });

        try {
            const result = await structuredModel.invoke(messages);
            return result as T;
        } catch (error) {
            this.logger.error('Error invoking LangChain with structured output:', error);
            throw error;
        }
    }

    async invoke(
        prompt: string,
        options?: {
            textModelRole?: TextModelRole;
            useVision?: boolean;
            temperature?: number;
            maxTokens?: number;
            systemMessage?: string;
        },
    ): Promise<string> {
        if (!this.isAvailable()) {
            throw new Error('LangChain service is not available. OPEN_AI_KEY not configured.');
        }

        const model = this.createChatModel({
            useVision: options?.useVision,
            textModelRole: options?.textModelRole ?? 'planner',
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
        });

        if (!model) {
            throw new Error('Model not available');
        }

        const messages: any[] = [];
        if (options?.systemMessage) {
            messages.push({ role: 'system', content: options.systemMessage });
        }
        messages.push({ role: 'user', content: prompt });

        try {
            const response = await model.invoke(messages);
            return response.content as string;
        } catch (error) {
            this.logger.error('Error invoking LangChain:', error);
            throw error;
        }
    }

    /**
     * Free-text response from the vision model only (screenshot + prompt).
     */
    async invokeWithVision(
        textPrompt: string,
        imageUrl: string,
        options?: {
            temperature?: number;
            maxTokens?: number;
            systemMessage?: string;
            imageDetail?: 'low' | 'high' | 'auto';
        },
    ): Promise<string> {
        if (!this.isAvailable()) {
            throw new Error('LangChain service is not available. OPEN_AI_KEY not configured.');
        }

        const model = this.createVisionModel({
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
        });

        if (!model) {
            throw new Error('Vision model not available');
        }

        const messages: any[] = [];
        if (options?.systemMessage) {
            messages.push({ role: 'system', content: options.systemMessage });
        }

        const detail = options?.imageDetail ?? 'low';
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: textPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        detail,
                    },
                },
            ],
        });

        try {
            const response = await model.invoke(messages);
            return response.content as string;
        } catch (error) {
            this.logger.error('Error invoking LangChain with vision:', error);
            throw error;
        }
    }

    /**
     * Structured output from the vision model (screenshot + prompt → Zod-validated object).
     */
    async invokeWithVisionStructuredOutput<T>(
        textPrompt: string,
        imageUrl: string,
        schema: z.ZodTypeAny,
        options?: {
            temperature?: number;
            maxTokens?: number;
            systemMessage?: string;
            imageDetail?: 'low' | 'high' | 'auto';
        },
    ): Promise<T> {
        if (!this.isAvailable()) {
            throw new Error('LangChain service is not available. OPEN_AI_KEY not configured.');
        }

        const model = this.createVisionModel({
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
        });

        if (!model) {
            throw new Error('Vision model not available');
        }

        const structuredModel = model.withStructuredOutput(schema, {
            name: 'vision_structured_output',
        });

        const messages: any[] = [];
        if (options?.systemMessage) {
            messages.push({ role: 'system', content: options.systemMessage });
        }

        const detail = options?.imageDetail ?? 'low';
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: textPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        detail,
                    },
                },
            ],
        });

        try {
            const result = await structuredModel.invoke(messages);
            return result as T;
        } catch (error) {
            this.logger.error('Error invoking vision model with structured output:', error);
            throw error;
        }
    }
}
```

---

## 2. `testing-agents.service.ts` (full)

```typescript
import { Injectable } from '@nestjs/common';
import { LangChainService } from './langchain.service';

/**
 * Distinct “agents” as separate calls: vision-only summaries feed the executor text model
 * in multi-agent orchestration mode.
 */
@Injectable()
export class TestingAgentsService {
    constructor(private readonly langChain: LangChainService) {}

    /**
     * Vision-only: page / screen understanding before any automation — not form-specific.
     * Executor reads this, then chooses Playwright actions (click, fill, navigate, wait).
     */
    async visionSummarizeUiForExecution(
        screenshotDataUrl: string,
        testCaseTitle: string,
        options?: {
            stepAction?: string;
            stepExpected?: string;
            /** Emails / URLs / values extracted from the test case text */
            instructionHints?: string;
        },
    ): Promise<string> {
        const ctx =
            `${options?.stepAction ? `Current scripted step — action:\n${options.stepAction}\n\n` : ''}` +
            `${options?.stepExpected ? `Current scripted step — expected:\n${options.stepExpected}\n\n` : ''}` +
            `${options?.instructionHints ? `Author / test hints:\n${options.instructionHints}\n\n` : ''}`;

        return this.langChain.invokeWithVision(
            `Overall test title: "${testCaseTitle}"\n\n${ctx}` +
                `You only **see** the screenshot. The next model cannot see pixels — report facts so it can decide **one** browser action.\n\n` +
                `### 1) Screen / page type\n` +
                `One or two lines: what kind of UI is this? (Examples: marketing landing, login, signup/register, app dashboard, settings, data table/list, detail view, modal/dialog, error/empty state, wizard step, other.) Be specific.\n\n` +
                `### 2) Layout & salient UI (not only forms)\n` +
                `Bullets: main regions (header, sidebar, main content), obvious headings, primary navigation, tables/cards/lists if any, **visible buttons and links** (name what they say), ` +
                `modals/toasts, **form fields** if any (label — empty/filled/unknown), charts or media if relevant.\n\n` +
                `### 3) Fit for the current step\n` +
                `Does this screen look like the right place to perform the scripted step? If wrong page, say what’s missing (e.g. need login page, need different URL).\n\n` +
                `### 4) What automation likely needs next\n` +
                `List briefly: interactions or data needed before the step can succeed (e.g. must navigate, must click X, must fill several fields, must dismiss modal). ` +
                `If values are required (emails, text), say which field labels — do not invent passwords/emails unless the test hints say so.\n\n` +
                `### 5) NEXT (mandatory single line)\n` +
                `Exactly one line starting with \`NEXT:\` describing the **single** next Playwright-level intent in plain language ` +
                `(e.g. NEXT: click the blue "Get started" button — or NEXT: fill the Email field with the test email — or NEXT: open the user menu). ` +
                `Do not output CSS selectors.`,
            screenshotDataUrl,
            {
                systemMessage:
                    'Vision analyst for autonomous browser QA. Factual, structured. Any page type — not only forms.',
                temperature: 0.15,
                maxTokens: 950,
                imageDetail: 'high',
            },
        );
    }

    /**
     * Post-action: factual pixel-grounded evidence for the Critic (pass/fail/continue).
     * Complements DOM text (SPA/minified bundles often hide meaning from HTML alone).
     */
    async visionEvidenceForCriticStep(
        screenshotDataUrl: string,
        ctx: {
            url: string;
            title: string;
            scriptedStepSummary: string;
            stepExpected: string;
        },
    ): Promise<string> {
        return this.langChain.invokeWithVision(
            `Autonomous QA agent (browser under Playwright control) — you only **see** the screenshot.\n` +
                `URL: ${ctx.url}\nPage title: ${ctx.title}\nScripted step: ${ctx.scriptedStepSummary}\nStep expected result: ${ctx.stepExpected}\n\n` +
                `List **only observable facts** from the screenshot (max 10 short bullets): visible headings/text, primary buttons/links, inputs, errors/toasts/modals, ` +
                `whether the UI looks like login vs signup vs dashboard vs marketing, anything that proves or disproves the expected result.\n` +
                `If something is ambiguous, add one bullet "Unclear: …". Do not suggest Playwright actions.`,
            screenshotDataUrl,
            {
                systemMessage:
                    'Vision-only factual reporter for a Cursor-like testing agent. No automation commands. No speculation beyond the image.',
                temperature: 0.15,
                maxTokens: 550,
                imageDetail: 'high',
            },
        );
    }
}
```

---

## 3. `test-executor.service.ts` (excerpts)

**Note:** The service is large (~2700+ lines). Below: Zod schemas, session memory helpers, the **verbatim** main iteration loop (from `executeTestCase`), then **verbatim** `aiDecideNextAction` through `analyzeTestCase`. Planner seed, auth, navigate, and `executeTestCase` setup/teardown live in the same file earlier (lines ~691–848 and after the loop). Imports, `getPageState`, `extractFormFieldsFromHtml`, telemetry, and summaries are not duplicated here.

### 3.1 Zod schemas (top of file, after imports)

```typescript
const ActionDecisionSchema = z.object({
  action: z.string(),
  actionType: z.enum(['fill', 'click', 'navigate', 'wait', 'verify', 'complete']),
  selector: z.union([z.string(), z.null()]),
  value: z.union([z.string(), z.null()]),
  reason: z.string(),
});

const ResultAnalysisSchema = z.object({
  status: z.enum(['PASSED', 'FAILED', 'CONTINUE']),
  reason: z.string(),
  /** True when the current scripted step's expected outcome is satisfied and the run should focus the next step */
  advanceScriptedStep: z.boolean(),
});

const ErrorAnalysisSchema = z.object({
  shouldRetry: z.boolean(),
  reason: z.string(),
  suggestedAction: z.union([z.string(), z.null()]),
});
```

(Additional schemas in the same file: `TestDataGenerationSchema`, `StepAdaptationSchema`, `FailureAnalysisSchema` — used elsewhere in the service.)

### 3.2 Session memory + instruction hints

```typescript
  /** Rolling factual memory for the autonomous agent (executor + critic prompts). */
  private appendAgentMemory(memory: string[], line: string, maxEntries = 26) {
    const trimmed = line.length > 550 ? `${line.slice(0, 547)}…` : line;
    memory.push(trimmed);
    while (memory.length > maxEntries) memory.shift();
  }

  /** Pull emails, URLs, and intent from test title/steps so the executor does not ignore explicit credentials. */
  private extractInstructionHints(testCase: any, focusedStep: any): string {
    const parts = [
      testCase?.title,
      testCase?.description,
      testCase?.preconditions,
      testCase?.postconditions,
      focusedStep?.action,
      focusedStep?.expected,
    ].filter(Boolean);
    const blob = parts.join('\n');
    const lines: string[] = [];
    const emails = blob.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi);
    if (emails?.length) {
      lines.push(
        `Email(s) to use exactly as written: ${[...new Set(emails.map((e) => e.trim()))].join(', ')}`,
      );
    }
    const urls = blob.match(/https?:\/\/[^\s)\]}>]+/gi);
    if (urls?.length) {
      lines.push(`URL(s) from instructions: ${[...new Set(urls)].join(', ')}`);
    }
    if (/existing email|already registered|already in use|duplicate/i.test(blob)) {
      lines.push(
        'Negative signup: fill EVERY visible required field with valid-looking data, use the specified email for the email field, submit, then expect an inline or toast error — not success.',
      );
    }
    return lines.join('\n');
  }
```

### 3.3 Main iteration loop (verbatim `test-executor.service.ts` lines 849–1052)

```typescript
      while (testStatus === 'IN_PROGRESS' && iteration < maxIterations) {
        iteration++;
        this.logger.log(`AI Execution Iteration ${iteration}`);

        this.emitTel(sessionId, {
          agent: 'system',
          phase: 'iteration',
          label: `Iteration ${iteration} · step ${scriptedStepsList.length ? scriptedStepCursor + 1 : '—'}/${scriptedStepsList.length || '—'}`,
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          iteration,
        });

        // Get current page state (HTML and optionally screenshot)
        const pageState = await this.getPageState(page, dto.takeScreenshots !== false);

        // AI analyzes current page and decides next action
        const aiDecision = await this.aiDecideNextAction(
          pageState,
          testCase,
          executionHistory,
          lastActionResult,
          dto,
          iteration,
          sessionId,
          scriptedStepCursor,
          agentMemory,
        );

        if (!aiDecision) {
          this.logger.warn('AI could not decide next action, stopping');
          testStatus = 'FAILED';
          break;
        }

        // Record the decision
        executionHistory.push({
          step: iteration,
          action: aiDecision.action || 'Unknown',
          result: aiDecision.reason || '',
          html: pageState.html?.substring(0, 1000), // Store truncated HTML
        });

        // Execute the AI-decided action
        try {
          this.emitTel(sessionId, {
            agent: 'browser',
            phase: 'browser_action',
            label: `${aiDecision.actionType}`,
            detail: aiDecision.action,
            testCaseId: testCase.id,
            testCaseTitle: testCase.title,
            iteration,
            meta: { selector: aiDecision.selector, value: aiDecision.value },
          });
          lastActionResult = await this.executeAiAction(page, aiDecision, dto);

          if (aiDecision.actionType === 'fill' && aiDecision.selector) {
            const v = aiDecision.value ? String(aiDecision.value).slice(0, 40) : '';
            this.appendAgentMemory(
              agentMemory,
              `[filled] ${aiDecision.selector}${v ? ` ← ${v}${String(aiDecision.value).length > 40 ? '…' : ''}` : ''}`,
            );
          }

          // Take screenshot after action
          if (dto.takeScreenshots !== false) {
            const screenshot = await this.takeScreenshot(
              page,
              testCase.id,
              `ai-step-${iteration}`,
            );
            if (screenshot) {
              screenshots.push(screenshot);
            }
          }

          // Record step result for the active scripted step (upsert — multiple iterations may target the same step)
          const actualStep =
            scriptedStepsList.length > 0 && scriptedStepCursor < scriptedStepsList.length
              ? scriptedStepsList[scriptedStepCursor]
              : null;

          if (actualStep) {
            const row = {
              stepId: actualStep.id,
              status: 'PASSED' as TestResultStatus,
              comment: aiDecision.action,
              screenshotUrl: screenshots[screenshots.length - 1],
            };
            const existingIdx = stepResults.findIndex((s) => s.stepId === actualStep.id);
            if (existingIdx >= 0) stepResults[existingIdx] = row;
            else stepResults.push(row);
          }

          // Wait for page to settle
          await page.waitForTimeout(1000);

          // AI analyzes result to determine if test passed, failed, or should continue
          const resultAnalysis = await this.aiAnalyzeResult(
            page,
            testCase,
            aiDecision,
            executionHistory,
            sessionId,
            testCase.id,
            testCase.title,
            iteration,
            scriptedStepCursor,
            dto,
            agentMemory,
          );

          if (resultAnalysis.visionDigest) {
            this.appendAgentMemory(agentMemory, `[vision ${iteration}] ${resultAnalysis.visionDigest}`);
          }
          this.appendAgentMemory(
            agentMemory,
            `[critic ${iteration}] ${resultAnalysis.status}: ${resultAnalysis.reason}`,
          );

          if (resultAnalysis.status === 'PASSED') {
            testStatus = 'PASSED';
            this.logger.log('AI determined test PASSED');
            break;
          } else if (resultAnalysis.status === 'FAILED') {
            testStatus = 'FAILED';
            this.logger.log(`AI determined test FAILED: ${resultAnalysis.reason}`);

            if (actualStep) {
              const failIdx = stepResults.findIndex((s) => s.stepId === actualStep.id);
              const failRow = {
                stepId: actualStep.id,
                status: 'FAILED' as TestResultStatus,
                comment: resultAnalysis.reason || 'Test failed',
                screenshotUrl: screenshots[screenshots.length - 1],
              };
              if (failIdx >= 0) stepResults[failIdx] = failRow;
              else stepResults.push(failRow);
            }
            break;
          } else {
            if (
              resultAnalysis.advanceScriptedStep &&
              scriptedStepsList.length > 0 &&
              scriptedStepCursor < scriptedStepsList.length - 1
            ) {
              scriptedStepCursor++;
              this.logger.log(`Advanced to scripted step ${scriptedStepCursor + 1}/${scriptedStepsList.length}`);
              this.appendAgentMemory(
                agentMemory,
                `[state] Scripted step focus → ${scriptedStepCursor + 1}/${scriptedStepsList.length}`,
              );
            }
            lastActionResult = resultAnalysis;
            this.logger.log(`AI determined to continue: ${resultAnalysis.reason || 'Next step needed'}`);
          }
        } catch (error: any) {
          this.logger.error(`Error executing AI action: ${error.message}`);

          // AI analyzes the error and decides if we should retry or fail
          const errorAnalysis = await this.aiAnalyzeError(
            page,
            testCase,
            aiDecision,
            error.message,
            executionHistory,
            sessionId,
            testCase.id,
            testCase.title,
            iteration,
          );

          if (errorAnalysis.shouldRetry && iteration < maxIterations) {
            this.logger.log(`AI suggests retry: ${errorAnalysis.reason}`);
            aiAnalysis.adaptations?.push({
              step: iteration,
              reason: errorAnalysis.reason || 'Error occurred, retrying',
              action: errorAnalysis.suggestedAction || 'Retry with adaptation',
            });
            // Don't increment iteration, retry current step
            continue;
          } else {
            testStatus = 'FAILED';
            const errStep =
              scriptedStepsList.length > 0 && scriptedStepCursor < scriptedStepsList.length
                ? scriptedStepsList[scriptedStepCursor]
                : null;

            if (errStep) {
              const failRow = {
                stepId: errStep.id,
                status: 'FAILED' as TestResultStatus,
                comment: error.message,
                screenshotUrl: screenshots[screenshots.length - 1],
              };
              const ei = stepResults.findIndex((s) => s.stepId === errStep.id);
              if (ei >= 0) stepResults[ei] = failRow;
              else stepResults.push(failRow);
            }
            break;
          }
        }
      }
```

### 3.4 `aiDecideNextAction` through `analyzeTestCase` (verbatim lines 1861–2433)

```typescript
  private async aiDecideNextAction(
    pageState: { html: string; url: string; title: string; screenshot?: string },
    testCase: any,
    executionHistory: Array<{ step: number; action: string; result: string }>,
    lastActionResult: any,
    dto: ExecuteTestsDto,
    iteration: number,
    sessionId: string | undefined,
    scriptedStepCursor: number,
    agentMemory: string[],
  ): Promise<{
    action: string;
    actionType: 'fill' | 'click' | 'navigate' | 'wait' | 'verify' | 'complete';
    selector?: string;
    value?: string;
    reason: string;
  } | null> {
    if (!this.langChainService.isAvailable()) {
      return null;
    }

    try {
      // Extract key information from HTML (simplified structure)
      const htmlSummary = pageState.html.substring(0, 10000); // Limit HTML size

      // Try to extract form fields from HTML
      const formFields = await this.extractFormFieldsFromHtml(pageState.html);

      const scriptedSteps = testCase.steps || [];
      const stepCount = scriptedSteps.length;
      const focusIdx = stepCount > 0 ? Math.min(Math.max(scriptedStepCursor, 0), stepCount - 1) : 0;
      const focusedStep = stepCount > 0 ? scriptedSteps[focusIdx] : null;
      const stepsBlock =
        stepCount > 0
          ? scriptedSteps
              .map(
                (s: any, i: number) =>
                  `${i + 1}. Action: ${s.action || 'N/A'}\n   Expected: ${s.expected || 'N/A'}${i === focusIdx ? '  ← **WORK ON THIS STEP NOW**' : ''}`,
              )
              .join('\n')
          : '(No scripted steps — infer from title/description.)';

      const memoryBlock =
        agentMemory.length > 0
          ? agentMemory.slice(-14).join('\n')
          : '(none yet — first iteration)';

      const instructionHints = this.extractInstructionHints(testCase, focusedStep);

      const prompt = `You are the **Executor** in an autonomous browser-testing agent (same idea as Cursor for code: reason from context, remember what you learned, decide the next concrete step). Playwright will run your action; vision (when enabled) sees real pixels — the DOM snippet may be incomplete on SPAs.

Test Case: ${testCase.title}
Description: ${testCase.description || 'N/A'}

### Values from test instructions (non-optional if present)
${instructionHints.trim() || '(none extracted — use realistic consistent test data)'}

### Session memory (your run so far — use it; update mentally as you act)
${memoryBlock}

### Field coverage
- Lines starting with \`[prefill]\` or \`[filled]\` list what Playwright already set. **Do not re-fill those same fields** unless fixing a mistake; advance to the next empty control or click submit.

### Scripted steps (follow in order; primary focus is the marked step)
${stepsBlock}

### Focus for this iteration
- Scripted step index: ${stepCount > 0 ? focusIdx + 1 : 'N/A'} of ${stepCount || 'N/A'}
- Current step action: ${focusedStep?.action || 'N/A'}
- Current step expected result (satisfy this before the run advances to the next scripted step): ${focusedStep?.expected || 'N/A'}

### Current page — DOM snapshot (HTML may miss canvas, shadow DOM, or real layout; vision block below is sight)
- URL: ${pageState.url}
- Title: ${pageState.title}
- HTML (first 10000 chars): ${htmlSummary}
${formFields.length > 0 ? `\n- Inputs detected in HTML fragment: ${JSON.stringify(formFields, null, 2)}` : ''}
${pageState.screenshot ? '\n- Screenshot available — the **Vision** block below is recomputed **every iteration** from the current viewport; trust it over stale DOM for empty/filled fields.' : ''}

### What happened so far (last 5 iterations)
${executionHistory.slice(-5).map(h => `Iteration ${h.step}: ${h.action} — ${h.result}`).join('\n')}

Last structured result: ${lastActionResult ? JSON.stringify(lastActionResult).substring(0, 500) : 'None'}

### Decision process (always follow this order)
1. **Situate:** What page/screen is this? (dashboard, auth, marketing, table, settings, modal, etc.) — use DOM + vision + URL + memory.
2. **Align:** Is this the right place for the **current scripted step**? If not, **navigate** or open the right area first (menu, tab, link).
3. **Identify work:** What does this step require — clicks, navigation, typing, waiting, reading? What **test data** must you invent (only for fields the step implies; use instruction hints when provided)?
4. **Act:** Output **exactly ONE** Playwright-mapped action (fill, click, navigate, wait, verify, complete).

Available action types:
- "fill": Fill an input field with a value
- "click": Click a button, link, or element
- "navigate": Navigate to a URL
- "wait": Wait for something to appear
- "verify": Check if expected result is present
- "complete": Test is complete

### Rules
- **Observe before act:** Do not click or fill random controls until you know what screen you are on and how it relates to the step.
- One browser action per iteration; chain iterations to complete a multi-part step.
- **Forms:** If multiple inputs are required, fill them in sensible order (often top-to-bottom); generate only the values the step needs (e.g. email from test text, realistic passwords for password fields).
- **Non-form UIs:** Use clicks, navigation, or keyboard as appropriate — lists, dashboards, dialogs, not only forms.
- Follow the vision **NEXT:** line when present; it reflects what’s on screen.
- Use stable selectors. Prefer "wait" after route changes or heavy loads.
- Do not mark "complete" until the **current step’s expected result** is plausibly achieved.
- Security / redirect tests: gated login page often means success — not failure.

### Parsed DOM — inputs only (optional; many UIs have no inputs)
${formFields.length > 0 ? JSON.stringify(formFields, null, 2) : '(no <input>/<textarea>/<select> parsed in this HTML slice)'}`;

      const systemMessage =
        'Autonomous browser QA executor: understand page context first, then one structured action. Use vision + DOM + memory. Output only schema fields. The reason field must briefly reflect page awareness then the chosen action.';

      // Always run vision when we have a fresh screenshot. Compact-mode heuristics used to skip
      // vision when HTML was large / forms existed / iteration grew — the executor then decided
      // from DOM-only text and could not see empty vs filled fields on SPAs (same bug as "first
      // vision only"). Critic already re-screenshots each pass; executor must match.
      const needsVision = !!pageState.screenshot;

      const visionOpts = {
        stepAction: focusedStep?.action,
        stepExpected: focusedStep?.expected,
        instructionHints: instructionHints.trim() || undefined,
      };

      let decision: z.infer<typeof ActionDecisionSchema>;

      if (needsVision && pageState.screenshot) {
        this.emitTel(sessionId, {
          agent: 'vision',
          phase: 'decide_action',
          label: 'Vision — page & UI context',
          detail: 'Screen type, interactions, NEXT',
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          iteration,
        });
        try {
          const visionSummary = await this.testingAgentsService.visionSummarizeUiForExecution(
            pageState.screenshot,
            testCase.title,
            visionOpts,
          );
          this.emitTel(sessionId, {
            agent: 'executor',
            phase: 'decide_action',
            label: 'Executor — decide (text + vision)',
            detail: 'Structured action after sight',
            testCaseId: testCase.id,
            testCaseTitle: testCase.title,
            iteration,
          });
          const augmentedPrompt =
            `${prompt}\n\n### Vision — page & UI context (read first; then map **one** action to Playwright)\n${visionSummary}`;
          decision = await this.langChainService.invokeWithStructuredOutput<z.infer<typeof ActionDecisionSchema>>(
            augmentedPrompt,
            ActionDecisionSchema,
            {
              temperature: 0.25,
              maxTokens: 1100,
              systemMessage,
              textModelRole: 'executor',
            },
          );
        } catch (visionErr) {
          this.logger.warn('Vision page context failed; DOM-only executor', visionErr);
          this.emitTel(sessionId, {
            agent: 'executor',
            phase: 'decide_action',
            label: 'Executor — DOM only (vision failed)',
            detail: String((visionErr as Error)?.message || visionErr).slice(0, 120),
            testCaseId: testCase.id,
            testCaseTitle: testCase.title,
            iteration,
          });
          decision = await this.langChainService.invokeWithStructuredOutput<z.infer<typeof ActionDecisionSchema>>(
            prompt,
            ActionDecisionSchema,
            {
              temperature: 0.28,
              maxTokens: 1100,
              systemMessage,
              textModelRole: 'executor',
            },
          );
        }
      } else {
        this.emitTel(sessionId, {
          agent: 'executor',
          phase: 'decide_action',
          label: 'Executor — next action',
          detail: 'DOM-only decision',
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          iteration,
        });
        decision = await this.langChainService.invokeWithStructuredOutput<z.infer<typeof ActionDecisionSchema>>(
          prompt,
          ActionDecisionSchema,
          {
            temperature: 0.3,
            maxTokens: 800,
            systemMessage,
            textModelRole: 'executor',
          },
        );
      }

      if (decision.actionType === 'complete') {
        return decision;
      }

      // Handle null values from schema
      const selector = decision.selector || null;
      const value = decision.value || null;

      if (!decision.action || !decision.actionType) {
        this.logger.warn('AI decision incomplete, using fallback');
        return null;
      }

      // Some action types don't require selector (like 'wait' or 'complete')
      if ((decision.actionType === 'fill' || decision.actionType === 'click' || decision.actionType === 'navigate') && !selector) {
        this.logger.warn('AI decision missing required selector, using fallback');
        return null;
      }

      // Return decision with null-safe values
      return {
        ...decision,
        selector: selector || undefined,
        value: value || undefined,
      };
    } catch (error) {
      this.logger.error('AI decision failed:', error);
      return null;
    }
  }

  /**
   * Execute AI-decided action
   */
  private async executeAiAction(
    page: any,
    decision: { action: string; actionType: string; selector?: string; value?: string },
    dto: ExecuteTestsDto,
  ): Promise<any> {
    const timeout = dto.stepTimeout || 30000;

    try {
      switch (decision.actionType) {
        case 'fill':
          if (!decision.selector || !decision.value) {
            throw new Error('Fill action requires selector and value');
          }
          await page.fill(decision.selector, decision.value, { timeout });
          return { success: true, action: 'filled', field: decision.selector };

        case 'click':
          if (!decision.selector) {
            throw new Error('Click action requires selector');
          }
          await page.click(decision.selector, { timeout });
          // Wait for navigation or state change
          await page.waitForTimeout(1000);
          return { success: true, action: 'clicked', element: decision.selector };

        case 'navigate':
          const url = decision.value || decision.selector;
          if (!url) {
            throw new Error('Navigate action requires URL');
          }
          await page.goto(url, { waitUntil: 'networkidle', timeout });
          return { success: true, action: 'navigated', url };

        case 'wait':
          await page.waitForTimeout(parseInt(decision.value || '2000'));
          return { success: true, action: 'waited' };

        case 'verify':
          // Verification is handled in analyzeResult
          return { success: true, action: 'verified' };

        case 'complete':
          return { success: true, action: 'complete', testComplete: true };

        default:
          throw new Error(`Unknown action type: ${decision.actionType}`);
      }
    } catch (error: any) {
      this.logger.error(`Error executing AI action ${decision.actionType}:`, error);
      throw error;
    }
  }

  /**
   * AI analyzes result to determine if test passed, failed, or should continue
   */
  private async aiAnalyzeResult(
    page: any,
    testCase: any,
    lastDecision: any,
    executionHistory: Array<{ step: number; action: string; result: string }>,
    sessionId: string | undefined,
    testCaseId: string | undefined,
    testCaseTitle: string | undefined,
    iteration: number | undefined,
    scriptedStepCursor: number,
    dto: ExecuteTestsDto,
    agentMemory: string[],
  ): Promise<{
    status: 'PASSED' | 'FAILED' | 'CONTINUE';
    reason: string;
    advanceScriptedStep: boolean;
    /** Short vision summary for session memory (post-action) */
    visionDigest?: string;
  }> {
    if (!this.langChainService.isAvailable()) {
      return { status: 'CONTINUE', reason: 'AI not available', advanceScriptedStep: false };
    }

    try {
      const captureShot = dto.takeScreenshots !== false;
      const pageState = await this.getPageState(page, captureShot);
      const pageText = await page.textContent('body') || '';
      const steps = testCase.steps || [];
      const idx = steps.length > 0 ? Math.min(Math.max(scriptedStepCursor, 0), steps.length - 1) : 0;
      const currentStep = steps.length > 0 ? steps[idx] : null;

      const stepsOverview =
        steps.length > 0
          ? steps
              .map(
                (s: any, i: number) =>
                  `${i + 1}. ${s.action || ''} → Expected: ${s.expected || 'N/A'}${i === idx ? '  [CURRENT]' : ''}`,
              )
              .join('\n')
          : '(No discrete steps — use description.)';

      const currentExpected =
        currentStep?.expected ||
        testCase.description ||
        'Test should complete successfully';

      const preconditions = testCase.preconditions ? String(testCase.preconditions).trim() : '';
      const postconditions = testCase.postconditions ? String(testCase.postconditions).trim() : '';

      let visionDigest: string | undefined;
      let visionBlock = '(no screenshot for this check — rely on URL/title/DOM text)';
      if (captureShot && pageState.screenshot) {
        try {
          this.emitTel(sessionId, {
            agent: 'vision',
            phase: 'critic_look',
            label: 'Vision — post-action evidence',
            detail: `Step ${idx + 1}: ${(currentStep?.action || '').slice(0, 80)}`,
            testCaseId,
            testCaseTitle,
            iteration,
          });
          const ve = await this.testingAgentsService.visionEvidenceForCriticStep(pageState.screenshot, {
            url: pageState.url,
            title: pageState.title,
            scriptedStepSummary: currentStep?.action || testCase.title,
            stepExpected: currentExpected,
          });
          visionDigest = ve.replace(/\s+/g, ' ').trim().slice(0, 480);
          visionBlock = ve;
        } catch (e) {
          this.logger.warn('Vision critic evidence failed; falling back to DOM-only', e);
          visionBlock = '(vision unavailable — rely on DOM text)';
        }
      }

      const memoryBlock =
        agentMemory.length > 0 ? agentMemory.slice(-12).join('\n') : '(none yet)';

      const prompt = `You are the **Critic** in an autonomous browser-testing agent (Cursor-like: grounded judgment, uses memory + pixels + DOM). After the last Playwright action, decide pass / fail / continue.

Test Case: ${testCase.title}
${preconditions ? `Pre-conditions: ${preconditions}\n` : ''}${postconditions ? `Post-conditions (overall): ${postconditions}\n` : ''}
### Session memory (prior judgments — do not contradict without new evidence)
${memoryBlock}

### All scripted steps
${stepsOverview}

### Current step only (index ${steps.length ? idx + 1 : 'N/A'} of ${steps.length || 'N/A'})
- Action: ${currentStep?.action || 'N/A'}
- Expected for THIS step: ${currentExpected}

### Vision (post-action screenshot — primary ground truth for what the user sees)
${visionBlock}

### Page after last action (DOM text — may be incomplete on SPAs)
- URL: ${pageState.url}
- Title: ${pageState.title}
- Visible text (excerpt): ${pageText.substring(0, 4000)}

Last browser action: ${lastDecision.action || 'N/A'} (${lastDecision.actionType || ''})

### Rules
1. FAILED: blocking error, wrong app state with no reasonable path forward, or this step's expected result is clearly impossible (e.g. success page required but server error).
2. CONTINUE: this step's expected result is **not** fully met yet (still loading, wrong page, form incomplete, need more clicks) — set advanceScriptedStep false.
3. CONTINUE + advanceScriptedStep **true**: this step's expected result **is** clearly met on the page, and there are more scripted steps — move focus to the next step.
4. PASSED: **only** if this step's expected is met AND there are no remaining scripted steps (you are on the last step), OR the overall test goal is fully achieved.

### Negative / security / redirect tests (avoid false FAIL)
- If the expected result says the user should be **redirected to login**, **blocked**, **not authorized**, or kept on a **login** page: **PASSED** when the URL path suggests login/auth OR the visible UI is clearly a **login gate** (password field + sign-in), even if the exact words "warning message" do not appear. Toasts, query params like ?error= or ?next=, or subtle alerts count.
- **Do not FAIL** that scenario just because you also see marketing text or a logo — focus on whether **unauthenticated access to the protected destination succeeded**. If the user is **not** inside an authenticated app shell (no session-specific dashboard content without logging in), treat gating as success.
- **Signup / email flows:** Browser-native "please fill out this field" or empty-field validation is **CONTINUE**, not FAILED. Only FAILED if the step expected success and the UI shows a **hard** block (e.g. server 500, definitive "email already taken" when the step required a new signup, or stuck error state).
- **Incomplete registration form:** If the step expects an error after submit (e.g. duplicate email) but vision still shows an **intact signup form with no server error**, assume the form was **not submitted or not fully filled** — CONTINUE and say the executor must **fill remaining fields and/or click the submit button**. Do **not** say "wait for server response" unless a submit clearly occurred (loading spinner, disabled button, or form replaced).

Short, concrete "reason" (one or two sentences). When vision and DOM disagree, prefer **vision** for layout and visible messages.`;

      const systemMessage =
        'Critic for a Cursor-like autonomous QA agent: weigh session memory + vision + DOM. Do not fail security/redirect tests when access was correctly gated. You must always set advanceScriptedStep (boolean): false unless rule 3 in the user prompt applies.';

      this.emitTel(sessionId, {
        agent: 'critic',
        phase: 'analyze_result',
        label: 'Critic — pass/fail/continue',
        testCaseId,
        testCaseTitle,
        iteration,
      });

      const analysis = await this.langChainService.invokeWithStructuredOutput<z.infer<typeof ResultAnalysisSchema>>(
        prompt,
        ResultAnalysisSchema,
        {
          temperature: 0.2,
          maxTokens: 680,
          systemMessage,
          textModelRole: 'critic',
        },
      );

      return {
        status: analysis.status || 'CONTINUE',
        reason: analysis.reason || 'Analysis incomplete',
        advanceScriptedStep: analysis.advanceScriptedStep === true,
        visionDigest,
      };
    } catch (error) {
      this.logger.warn('AI result analysis failed:', error);
      return { status: 'CONTINUE', reason: 'Analysis failed, continuing', advanceScriptedStep: false };
    }
  }

  /**
   * AI analyzes errors and decides if we should retry or fail
   */
  private async aiAnalyzeError(
    page: any,
    testCase: any,
    failedDecision: any,
    errorMessage: string,
    executionHistory: Array<{ step: number; action: string; result: string }>,
    sessionId?: string,
    testCaseId?: string,
    testCaseTitle?: string,
    iteration?: number,
  ): Promise<{
    shouldRetry: boolean;
    reason: string;
    suggestedAction?: string;
  }> {
    if (!this.langChainService.isAvailable()) {
      return { shouldRetry: false, reason: 'AI not available' };
    }

    try {
      const pageState = await this.getPageState(page, false);
      const pageText = await page.textContent('body') || '';

      const prompt = `An error occurred during test execution. Analyze if we should retry with a different approach or fail the test.

Test Case: ${testCase.title}
Failed Action: ${failedDecision.action || 'N/A'}
Error: ${errorMessage}

Current Page:
- URL: ${pageState.url}
- Page Text: ${pageText.substring(0, 1000)}

Execution History: ${executionHistory.length} steps

Determine:
1. Is this error recoverable? (e.g., wrong selector, timing issue, element not ready)
2. Should we retry with a different selector or approach?
3. Or should we fail the test?`;

      const systemMessage = 'You are an error analysis assistant. Determine if test errors are recoverable.';

      this.emitTel(sessionId, {
        agent: 'critic',
        phase: 'analyze_error',
        label: 'Critic — error recovery',
        detail: errorMessage?.slice(0, 200),
        testCaseId,
        testCaseTitle,
        iteration,
      });

      return await this.langChainService.invokeWithStructuredOutput(
        prompt,
        ErrorAnalysisSchema,
        {
          temperature: 0.3,
          maxTokens: 300,
          systemMessage,
          textModelRole: 'critic',
        },
      );
    } catch (error) {
      this.logger.warn('AI error analysis failed:', error);
      return { shouldRetry: false, reason: 'Analysis failed' };
    }
  }

  /**
   * AI Method: Analyze test case to understand what needs to be tested
   */
  private async analyzeTestCase(testCase: any, sessionId?: string): Promise<string> {
    if (!this.langChainService.isAvailable()) {
      throw new Error('LangChain service not initialized');
    }

    const prompt = `Analyze this test case and provide a brief understanding of what it's testing:

Test Case Title: ${testCase.title}
Description: ${testCase.description || 'N/A'}
Type: ${testCase.type || 'N/A'}
Behavior: ${testCase.behavior || 'N/A'}

Steps:
${testCase.steps?.map((s: any, i: number) => `${i + 1}. ${s.action} (Expected: ${s.expected || 'N/A'})`).join('\n') || 'No steps defined'}

Provide a concise analysis (2-3 sentences) of:
1. What functionality is being tested
2. What the expected outcome should be
3. Any special considerations or edge cases`;

    const systemMessage =
      'Planner for an autonomous Cursor-like QA agent: concise intent the executor will follow across the session.';

    this.emitTel(sessionId, {
      agent: 'planner',
      phase: 'understand_case',
      label: 'Planner — understand test case',
      detail: testCase.title,
      testCaseId: testCase.id,
      testCaseTitle: testCase.title,
    });

    const out = await this.langChainService.invoke(prompt, {
      temperature: 0.3,
      maxTokens: 300,
      systemMessage,
      textModelRole: 'planner',
    });

    this.emitTel(sessionId, {
      agent: 'planner',
      phase: 'understand_case',
      label: 'Planner — done',
      testCaseId: testCase.id,
      testCaseTitle: testCase.title,
    });

    return out;
  }
```

---

## 4. Refreshing this document from git

**Full files:** copy `langchain.service.ts` and `testing-agents.service.ts` from the repo (they are embedded in full in sections 1–2).

**Verbatim `test-executor` blocks (sections 3.3–3.4):** after edits to `test-executor.service.ts`, re-run from the `betafi-backend` repo root:

```bash
python3 << 'PY'
from pathlib import Path
root = Path("src/modules/ai-testing")
lines = (root / "test-executor.service.ts").read_text().splitlines(keepends=True)
md = (root / "AI_AGENT_THINKING_SOURCE.md").read_text()
loop = "".join(lines[848:1052])
methods = "".join(lines[1860:2433])
import re
md = re.sub(
    r"(### 3\.3 Main iteration loop[^\n]*\n\n```typescript\n)(.*?)(```\n\n### 3\.4)",
    r"\1" + loop + r"\3",
    md,
    count=1,
    flags=re.DOTALL,
)
md = re.sub(
    r"(### 3\.4 `aiDecideNextAction`[^\n]*\n\n```typescript\n)(.*?)(```\n\n---\n\n## 4\.)",
    r"\1" + methods + r"\3",
    md,
    count=1,
    flags=re.DOTALL,
)
(root / "AI_AGENT_THINKING_SOURCE.md").write_text(md)
print("patched AI_AGENT_THINKING_SOURCE.md")
PY
```

Adjust slice indices if you rename methods or move the loop. Quick peek:

```bash
sed -n '849,1052p' src/modules/ai-testing/test-executor.service.ts
sed -n '1861,2433p' src/modules/ai-testing/test-executor.service.ts
```
