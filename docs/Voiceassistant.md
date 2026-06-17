# Voice assistant (/ai-capabilities/voice-assistant)



## Overview

A voice assistant chains three AI capabilities into a continuous conversation loop:

<Mermaid
  chart="flowchart LR
    Mic([Microphone]) -->|PCM audio| ASR[ASR<br/>Whisper + Silero VAD]
    ASR -->|utterance| LLM[LLM<br/>text generation]
    LLM -->|response text| TTS[TTS<br/>Supertonic]
    TTS -->|audio| Spk([Speakers])
    Spk -.conversation loop.-> Mic"
/>

Each stage maps to a QVAC capability — [Transcription](/ai-capabilities/transcription) (ASR), [Text generation](/ai-capabilities/text-generation) (LLM), and [Text-to-Speech](/ai-capabilities/text-to-speech) (TTS).

Compared to using each capability individually, the key differences are:

* You need to coordinate **three model loads** simultaneously (Whisper + VAD, LLM, and TTS bundle) — they all stay loaded for the duration of the session.
* VAD parameters need **conservative tuning** to avoid the assistant transcribing its own TTS output (self-hearing feedback loop).
* You should **gate the microphone during TTS playback** and apply a short post-playback cooldown so room reverb doesn't bleed into the next utterance.
* You should **filter short or non-linguistic transcripts** (e.g. `"."`, `"[BLANK_AUDIO]"`) since Whisper hallucinates them from near-silent audio.

## Functions

Use the following sequence of function calls:

1. [`loadModel()`](/reference/api#loadmodel) three times — once per `modelType` (`"whisper"`, `"llm"`, `"tts"`).
2. [`transcribeStream()`](/reference/api#transcribestream) — open a streaming session that emits utterances on VAD-detected pauses.
3. [`completion()`](/reference/api#completion) — generate a response from the rolling conversation history (streamed).
4. [`textToSpeech()`](/reference/api#texttospeech) — synthesize the response into a PCM buffer.
5. [`unloadModel()`](/reference/api#unloadmodel) for each loaded model on shutdown.

For how to use each function, see [SDK — API reference](/reference/api/).

## Models

You load four model bundles in total:

* A `qvac-ext-lib-whisper.cpp`-compatible model for transcription, plus a Silero VAD model.
* A `llama.cpp`-compatible LLM for response generation.
* A Supertonic TTS bundle (text encoder, duration predictor, vector estimator, vocoder, unicode indexer, config, and voice style).

Recommended defaults (used in the example below):

| Stage | Model                    |
| ----- | ------------------------ |
| ASR   | `WHISPER_TINY`           |
| VAD   | `VAD_SILERO_5_1_2`       |
| LLM   | `LLAMA_3_2_1B_INST_Q4_0` |
| TTS   | Supertonic2 (English)    |

For models available as constants, see [SDK — Models](/introduction#models).

## Example

This example is **desktop-only**. Mobile (React Native / Expo) needs a different audio path and isn't covered here.

### Requirements

* **FFmpeg** (with `ffplay`) on `PATH` — `ffmpeg` captures mic audio, `ffplay` plays back TTS output.
* **Microphone** access (on macOS, the running shell needs mic permission in *System Settings → Privacy & Security → Microphone*).
* **Speakers** connected and selected as the default output device.

<Accordions type="multiple">
  <Accordion title="Installing FFmpeg">
    | Platform         | Command                                                                                              |
    | ---------------- | ---------------------------------------------------------------------------------------------------- |
    | macOS (Homebrew) | `brew install ffmpeg`                                                                                |
    | Debian / Ubuntu  | `sudo apt update && sudo apt install ffmpeg`                                                         |
    | Fedora / RHEL    | `sudo dnf install ffmpeg` (enable [RPM Fusion](https://rpmfusion.org/Configuration) first if needed) |
    | Arch Linux       | `sudo pacman -S ffmpeg`                                                                              |

    Verify the install with:

    ```bash
    ffmpeg -version
    ```
  </Accordion>

  <Accordion title="Selecting a microphone">
    By default the example uses the system default mic on each OS:

    * **macOS:** AVFoundation audio device `:0`.
    * **Linux:** PulseAudio source `default`.

    To use a different mic, set the `MIC_DEVICE` environment variable:

    ```bash
    # macOS — pick by index (list with `ffmpeg -f avfoundation -list_devices true -i ""`)
    MIC_DEVICE=":1" bun run examples/voice-assistant/voice-assistant.ts

    # Linux — pick a PulseAudio source (list with `pactl list short sources`)
    MIC_DEVICE="alsa_input.usb-Blue_Microphones_Yeti-00" \
      bun run examples/voice-assistant/voice-assistant.ts
    ```
  </Accordion>
</Accordions>

### Running it

The following script implements the full loop with VAD tuning, mic gating during playback, and short-utterance filtering:

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/voice-assistant/voice-assistant.js title="voice-assistant.js" lineNumbers
      /**
       * Real-time Voice Assistant: mic → Whisper (with Silero VAD) → Llama → Supertonic TTS.
       *
       * Usage: bun run examples/voice-assistant/voice-assistant.ts
       *
       * Speak a question; the VAD detects when you pause, the utterance is
       * transcribed, sent to the LLM, and the response is spoken back. The loop
       * continues until you press Ctrl+C. While the assistant is speaking, mic
       * audio is dropped so it does not hear itself.
       *
       * Requirements: FFmpeg installed, microphone access, speakers.
       */
      import { loadModel, unloadModel, transcribeStream, completion, textToSpeech, WHISPER_TINY, VAD_SILERO_5_1_2, LLAMA_3_2_1B_INST_Q4_0, TTS_EN_SUPERTONIC_Q8_0, } from "@qvac/sdk";
      import { spawnSync } from "child_process";
      import { startMicrophone } from "../audio/mic-input";
      import { createWavHeader, int16ArrayToBuffer, playAudio } from "../tts/utils";
      const MIC_SAMPLE_RATE = 16000;
      const TTS_SAMPLE_RATE = 44100;
      const SYSTEM_PROMPT = "You are a concise, friendly voice assistant. Keep responses under two sentences. " +
          "Never use markdown, lists, or code blocks — your output will be spoken aloud.";
      // VAD parameters tuned for conversational speech without the assistant looping
      // on its own echo. These defaults are deliberately conservative:
      //   - threshold 0.6: less sensitive than Silero's default; avoids triggering
      //     on TTS reverb bleeding into the mic or low-level background noise.
      //   - min_speech_duration_ms 300: drops short clicks/breaths and stray words.
      //   - min_silence_duration_ms 700: requires a longer quiet tail before
      //     committing a segment. Crucial for preventing self-hearing feedback loops
      //     where Whisper hallucinates content from near-silent audio.
      //   - max_speech_duration_s 15: caps runaway utterances.
      //   - speech_pad_ms 200: padding improves accuracy on utterance edges.
      // If the assistant cuts you off mid-sentence, raise min_silence_duration_ms.
      // If it keeps hallucinating / talking to itself, raise threshold to 0.7 and/or
      // min_silence_duration_ms to 900.
      const VAD_PARAMS = {
          threshold: 0.6,
          min_speech_duration_ms: 300,
          min_silence_duration_ms: 700,
          max_speech_duration_s: 15.0,
          speech_pad_ms: 200,
      };
      // Short grace period after TTS playback before we start listening again.
      // Gives the speaker amp / room reverb a moment to fully settle so the first
      // post-playback mic frames don't get transcribed as the tail of our own voice.
      const POST_PLAYBACK_COOLDOWN_MS = 300;
      // Minimum characters for an utterance to be considered meaningful. Whisper
      // frequently hallucinates single words like "you", ".", or "Thanks." from
      // silence or faint noise; these short phantoms are the main driver of the
      // self-hearing feedback loop, so we drop them.
      const MIN_UTTERANCE_CHARS = 3;
      function isMeaningfulTranscript(text) {
          const trimmed = text.trim();
          if (trimmed.length === 0)
              return false;
          if (trimmed.includes("[No speech detected]"))
              return false;
          // Whisper sometimes emits non-linguistic cues on silence, e.g. "[BLANK_AUDIO]".
          if (/^\[[^\]]+\]$/.test(trimmed))
              return false;
          // Strip punctuation/whitespace for the length check so ". . ." is rejected.
          const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
          if (letters.length < MIN_UTTERANCE_CHARS)
              return false;
          return true;
      }
      function sleep(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
      }
      // ── Main ──
      for (const tool of ["ffmpeg", "ffplay"]) {
          const r = spawnSync(tool, ["-version"], { stdio: "ignore" });
          if (r.error || r.status !== 0) {
              console.error(`${tool} not found on PATH. Install ffmpeg (ffplay ships with it) and retry.`);
              process.exit(1);
          }
      }
      console.log("Loading whisper-tiny + Silero VAD...");
      const asrModelId = await loadModel({
          modelSrc: WHISPER_TINY,
          modelConfig: {
              vadModelSrc: VAD_SILERO_5_1_2,
              audio_format: "f32le",
              strategy: "greedy",
              n_threads: 4,
              language: "en",
              no_timestamps: true,
              suppress_blank: true,
              suppress_nst: true,
              temperature: 0.0,
              vad_params: VAD_PARAMS,
          },
      });
      console.log("Loading Llama 3.2 1B...");
      const llmModelId = await loadModel({
          modelSrc: LLAMA_3_2_1B_INST_Q4_0,
          modelConfig: {
              ctx_size: 4096,
          },
      });
      console.log("Loading Supertonic TTS...");
      const ttsModelId = await loadModel({
          modelSrc: TTS_EN_SUPERTONIC_Q8_0,
          modelConfig: {
              ttsEngine: "supertonic",
              language: "en",
              voice: "F1",
              ttsSpeed: 1.05,
              ttsNumInferenceSteps: 5,
          },
      });
      console.log("All models loaded.\n");
      const ffmpeg = startMicrophone({
          sampleRate: MIC_SAMPLE_RATE,
          format: "f32le",
      });
      const session = await transcribeStream({ modelId: asrModelId });
      const history = [{ role: "system", content: SYSTEM_PROMPT }];
      // Dropped-chunk gate: while the assistant is speaking we stop feeding the mic
      // stream into the ASR session. Using a flag (rather than pausing the ffmpeg
      // pipe) keeps the pipe drained so we never accumulate stale audio, and the
      // VAD starts fresh on the next user turn.
      let isSpeaking = false;
      ffmpeg.stdout.on("data", (chunk) => {
          if (isSpeaking)
              return;
          session.write(chunk);
      });
      let shuttingDown = false;
      async function cleanup() {
          if (shuttingDown)
              return;
          shuttingDown = true;
          console.log("\n\nStopping...");
          ffmpeg.kill();
          try {
              session.end();
          }
          catch {
              // session may already be closed
          }
          await unloadModel({ modelId: ttsModelId }).catch(() => { });
          await unloadModel({ modelId: llmModelId }).catch(() => { });
          await unloadModel({ modelId: asrModelId }).catch(() => { });
          console.log("Done.");
          process.exit(0);
      }
      process.on("SIGINT", () => void cleanup());
      process.on("SIGTERM", () => void cleanup());
      console.log("🎙️  Listening. Speak a question and pause. Ctrl+C to quit.\n");
      for await (const rawText of session) {
          if (!isMeaningfulTranscript(rawText))
              continue;
          const userText = rawText.trim();
          console.log(`🗣️  You: ${userText}`);
          history.push({ role: "user", content: userText });
          isSpeaking = true;
          try {
              process.stdout.write("🤖 Assistant: ");
              const llmResult = completion({
                  modelId: llmModelId,
                  history,
                  stream: true,
              });
              let assistantText = "";
              for await (const token of llmResult.tokenStream) {
                  process.stdout.write(token);
                  assistantText += token;
              }
              process.stdout.write("\n");
              history.push({ role: "assistant", content: assistantText });
              const spoken = assistantText.trim();
              if (spoken.length > 0) {
                  const ttsResult = textToSpeech({
                      modelId: ttsModelId,
                      text: spoken,
                      inputType: "text",
                      stream: false,
                  });
                  const samples = await ttsResult.buffer;
                  const audioData = int16ArrayToBuffer(samples);
                  const wavBuffer = Buffer.concat([
                      createWavHeader(audioData.length, TTS_SAMPLE_RATE),
                      audioData,
                  ]);
                  playAudio(wavBuffer);
                  // Cooldown keeps the mic gated briefly so speaker tail / room reverb
                  // doesn't feed into the next VAD segment.
                  await sleep(POST_PLAYBACK_COOLDOWN_MS);
              }
          }
          catch (turnError) {
              console.error("\n⚠️  Turn failed:", turnError instanceof Error ? turnError.message : turnError);
          }
          finally {
              isSpeaking = false;
              console.log("\n🎙️  Listening...\n");
          }
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/voice-assistant/voice-assistant.ts title="voice-assistant.ts" lineNumbers
      /**
       * Real-time Voice Assistant: mic → Whisper (with Silero VAD) → Llama → Supertonic TTS.
       *
       * Usage: bun run examples/voice-assistant/voice-assistant.ts
       *
       * Speak a question; the VAD detects when you pause, the utterance is
       * transcribed, sent to the LLM, and the response is spoken back. The loop
       * continues until you press Ctrl+C. While the assistant is speaking, mic
       * audio is dropped so it does not hear itself.
       *
       * Requirements: FFmpeg installed, microphone access, speakers.
       */
      import {
        loadModel,
        unloadModel,
        transcribeStream,
        completion,
        textToSpeech,
        WHISPER_TINY,
        VAD_SILERO_5_1_2,
        LLAMA_3_2_1B_INST_Q4_0,
        TTS_EN_SUPERTONIC_Q8_0,
      } from "@qvac/sdk";
      import { spawnSync } from "child_process";
      import { startMicrophone } from "../audio/mic-input";
      import { createWavHeader, int16ArrayToBuffer, playAudio } from "../tts/utils";

      const MIC_SAMPLE_RATE = 16000;
      const TTS_SAMPLE_RATE = 44100;

      const SYSTEM_PROMPT =
        "You are a concise, friendly voice assistant. Keep responses under two sentences. " +
        "Never use markdown, lists, or code blocks — your output will be spoken aloud.";

      // VAD parameters tuned for conversational speech without the assistant looping
      // on its own echo. These defaults are deliberately conservative:
      //   - threshold 0.6: less sensitive than Silero's default; avoids triggering
      //     on TTS reverb bleeding into the mic or low-level background noise.
      //   - min_speech_duration_ms 300: drops short clicks/breaths and stray words.
      //   - min_silence_duration_ms 700: requires a longer quiet tail before
      //     committing a segment. Crucial for preventing self-hearing feedback loops
      //     where Whisper hallucinates content from near-silent audio.
      //   - max_speech_duration_s 15: caps runaway utterances.
      //   - speech_pad_ms 200: padding improves accuracy on utterance edges.
      // If the assistant cuts you off mid-sentence, raise min_silence_duration_ms.
      // If it keeps hallucinating / talking to itself, raise threshold to 0.7 and/or
      // min_silence_duration_ms to 900.
      const VAD_PARAMS = {
        threshold: 0.6,
        min_speech_duration_ms: 300,
        min_silence_duration_ms: 700,
        max_speech_duration_s: 15.0,
        speech_pad_ms: 200,
      };

      // Short grace period after TTS playback before we start listening again.
      // Gives the speaker amp / room reverb a moment to fully settle so the first
      // post-playback mic frames don't get transcribed as the tail of our own voice.
      const POST_PLAYBACK_COOLDOWN_MS = 300;

      // Minimum characters for an utterance to be considered meaningful. Whisper
      // frequently hallucinates single words like "you", ".", or "Thanks." from
      // silence or faint noise; these short phantoms are the main driver of the
      // self-hearing feedback loop, so we drop them.
      const MIN_UTTERANCE_CHARS = 3;

      function isMeaningfulTranscript(text: string): boolean {
        const trimmed = text.trim();
        if (trimmed.length === 0) return false;
        if (trimmed.includes("[No speech detected]")) return false;
        // Whisper sometimes emits non-linguistic cues on silence, e.g. "[BLANK_AUDIO]".
        if (/^\[[^\]]+\]$/.test(trimmed)) return false;
        // Strip punctuation/whitespace for the length check so ". . ." is rejected.
        const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
        if (letters.length < MIN_UTTERANCE_CHARS) return false;
        return true;
      }

      function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      // ── Main ──

      for (const tool of ["ffmpeg", "ffplay"]) {
        const r = spawnSync(tool, ["-version"], { stdio: "ignore" });
        if (r.error || r.status !== 0) {
          console.error(
            `${tool} not found on PATH. Install ffmpeg (ffplay ships with it) and retry.`,
          );
          process.exit(1);
        }
      }

      console.log("Loading whisper-tiny + Silero VAD...");
      const asrModelId = await loadModel({
        modelSrc: WHISPER_TINY,
        modelConfig: {
          vadModelSrc: VAD_SILERO_5_1_2,
          audio_format: "f32le",
          strategy: "greedy",
          n_threads: 4,
          language: "en",
          no_timestamps: true,
          suppress_blank: true,
          suppress_nst: true,
          temperature: 0.0,
          vad_params: VAD_PARAMS,
        },
      });

      console.log("Loading Llama 3.2 1B...");
      const llmModelId = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        modelConfig: {
          ctx_size: 4096,
        },
      });

      console.log("Loading Supertonic TTS...");
      const ttsModelId = await loadModel({
        modelSrc: TTS_EN_SUPERTONIC_Q8_0,
        modelConfig: {
          ttsEngine: "supertonic",
          language: "en",
          voice: "F1",
          ttsSpeed: 1.05,
          ttsNumInferenceSteps: 5,
        },
      });

      console.log("All models loaded.\n");

      const ffmpeg = startMicrophone({
        sampleRate: MIC_SAMPLE_RATE,
        format: "f32le",
      });
      const session = await transcribeStream({ modelId: asrModelId });

      const history: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = [{ role: "system", content: SYSTEM_PROMPT }];

      // Dropped-chunk gate: while the assistant is speaking we stop feeding the mic
      // stream into the ASR session. Using a flag (rather than pausing the ffmpeg
      // pipe) keeps the pipe drained so we never accumulate stale audio, and the
      // VAD starts fresh on the next user turn.
      let isSpeaking = false;

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        if (isSpeaking) return;
        session.write(chunk);
      });

      let shuttingDown = false;
      async function cleanup() {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log("\n\nStopping...");
        ffmpeg.kill();
        try {
          session.end();
        } catch {
          // session may already be closed
        }
        await unloadModel({ modelId: ttsModelId }).catch(() => {});
        await unloadModel({ modelId: llmModelId }).catch(() => {});
        await unloadModel({ modelId: asrModelId }).catch(() => {});
        console.log("Done.");
        process.exit(0);
      }

      process.on("SIGINT", () => void cleanup());
      process.on("SIGTERM", () => void cleanup());

      console.log("🎙️  Listening. Speak a question and pause. Ctrl+C to quit.\n");

      for await (const rawText of session) {
        if (!isMeaningfulTranscript(rawText)) continue;
        const userText = rawText.trim();

        console.log(`🗣️  You: ${userText}`);
        history.push({ role: "user", content: userText });

        isSpeaking = true;
        try {
          process.stdout.write("🤖 Assistant: ");
          const llmResult = completion({
            modelId: llmModelId,
            history,
            stream: true,
          });
          let assistantText = "";
          for await (const token of llmResult.tokenStream) {
            process.stdout.write(token);
            assistantText += token;
          }
          process.stdout.write("\n");
          history.push({ role: "assistant", content: assistantText });

          const spoken = assistantText.trim();
          if (spoken.length > 0) {
            const ttsResult = textToSpeech({
              modelId: ttsModelId,
              text: spoken,
              inputType: "text",
              stream: false,
            });
            const samples = await ttsResult.buffer;
            const audioData = int16ArrayToBuffer(samples);
            const wavBuffer = Buffer.concat([
              createWavHeader(audioData.length, TTS_SAMPLE_RATE),
              audioData,
            ]);
            playAudio(wavBuffer);
            // Cooldown keeps the mic gated briefly so speaker tail / room reverb
            // doesn't feed into the next VAD segment.
            await sleep(POST_PLAYBACK_COOLDOWN_MS);
          }
        } catch (turnError) {
          console.error(
            "\n⚠️  Turn failed:",
            turnError instanceof Error ? turnError.message : turnError,
          );
        } finally {
          isSpeaking = false;
          console.log("\n🎙️  Listening...\n");
        }
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

Speak into the mic; transcriptions and the assistant's spoken responses will follow. Press `Ctrl+C` to quit. Models are downloaded on first run (\~1 GB total) and cached locally; subsequent runs work fully offline.

### Tuning

The defaults are deliberately conservative to prevent the assistant from hearing its own TTS output and looping on itself (a classic failure mode when mic and speakers share the same room). The relevant VAD parameters in the script:

```ts
{
  threshold: 0.6,              // less sensitive than Silero's default
  min_speech_duration_ms: 300, // drops short clicks / breaths / stray words
  min_silence_duration_ms: 700,// long quiet tail before committing a segment
  max_speech_duration_s: 15.0, // caps runaway utterances
  speech_pad_ms: 200,          // edge padding improves accuracy
}
```

Plus three additional safeguards:

* **Mic gate during TTS:** incoming audio is dropped while the assistant speaks, so it cannot transcribe its own output.
* **Post-playback cooldown** (`POST_PLAYBACK_COOLDOWN_MS = 300`): keeps the mic gated for a moment after playback so speaker/room reverb doesn't bleed into the next VAD segment.
* **Minimum utterance length** (`MIN_UTTERANCE_CHARS = 3`): drops single-character or two-letter phantom transcripts like `"you"` or `"."` that Whisper hallucinates from near-silent audio.

### Troubleshooting

If you run into common issues, adjust the values above:

| Symptom                                     | Fix                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Assistant cuts you off mid-sentence         | Raise `min_silence_duration_ms` to `900-1000`                                                                    |
| Assistant talks over itself / loops forever | Raise `threshold` to `0.7`; raise `min_silence_duration_ms` to `900`; raise `POST_PLAYBACK_COOLDOWN_MS` to `500` |
| Slow to respond after you stop talking      | Lower `min_silence_duration_ms` to `500`                                                                         |
| Picks up background typing / keyboard       | Raise `threshold` to `0.7` and `min_speech_duration_ms` to `400`                                                 |
| Short commands ("yes", "no") are ignored    | Lower `MIN_UTTERANCE_CHARS` to `2`                                                                               |

If you're running with headphones (mic cannot hear the speaker), you can loosen everything: `threshold: 0.5`, `min_silence_duration_ms: 500`, `POST_PLAYBACK_COOLDOWN_MS: 0`.

### Customizing

* **Different ASR model:** swap `WHISPER_TINY` for a larger Whisper model for better transcription accuracy (e.g. `WHISPER_BASE_Q8_0`, `WHISPER_SMALL_Q8_0`, `WHISPER_LARGE_V3_TURBO`, etc.).
* **Different LLM:** swap `LLAMA_3_2_1B_INST_Q4_0` for any LLM constant from `@qvac/sdk`. Larger models give better answers at the cost of latency.
* **Different voice:** replace the Supertonic constants with another TTS model (e.g. Chatterbox — see [Text-to-Speech](/ai-capabilities/text-to-speech)).
* **System prompt:** edit `SYSTEM_PROMPT` at the top of the script. The default instructs the LLM to be concise and avoid markdown so responses are pleasant to listen to.

<Callout type="success">
  **Tip:** all examples throughout this documentation are self-contained and runnable. For instructions on how to run them, see [SDK quickstart](/quickstart).
</Callout>
