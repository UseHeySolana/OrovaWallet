import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";

const JUPITER_SWAP_V2 = "https://api.jup.ag/swap/v2";

const jupSwapV2Headers = (): HeadersInit => ({
  Accept: "application/json",
  "x-api-key": (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim(),
});

export type JupiterSwapV2Order = {
  transaction?: string | null;
  requestId?: string;
  lastValidBlockHeight?: string;
  inAmount?: string;
  outAmount?: string;
  /** Minimum output after slippage (smallest units). */
  otherAmountThreshold?: string;
  priceImpact?: number;
  feeBps?: number;
  errorCode?: number;
  errorMessage?: string;
  error?: string;
};

export type JupiterSwapV2ExecuteResult = {
  status?: string;
  signature?: string;
  slot?: string;
  error?: string;
  code?: number;
};

async function readJsonBody(
  res: Response,
  log?: {
    label: string;
    method: string;
    url: string;
    requestSummary?: string;
    startedAt: number;
  }
): Promise<{
  ok: boolean;
  data: JupiterSwapV2Order | null;
  message: string;
}> {
  const text = await res.text();
  if (__DEV__ && log) {
    pushDevNetworkLog({
      label: log.label,
      method: log.method,
      url: log.url,
      status: res.status,
      durationMs: Date.now() - log.startedAt,
      requestSummary: log.requestSummary,
      responseBody: text,
    });
  }
  try {
    const data = text ? (JSON.parse(text) as JupiterSwapV2Order) : null;
    if (!res.ok) {
      const err =
        (data as { error?: string; message?: string } | null)?.error ||
        (data as { message?: string } | null)?.message ||
        text.slice(0, 240) ||
        `HTTP ${res.status}`;
      return { ok: false, data: null, message: err };
    }
    return { ok: true, data, message: "" };
  } catch {
    return {
      ok: false,
      data: null,
      message: text.slice(0, 240) || `HTTP ${res.status}`,
    };
  }
}

/** Jupiter Swap API v2 GET /order. Amount is smallest units of input (ExactIn). */
export async function getSwapV2Order(params: {
  inputMint: string;
  outputMint: string;
  amountSmallestInput: string;
  taker?: string;
  slippageBps?: number;
  referralAccount?: string;
  referralFeeBps?: number;
}): Promise<{ status: boolean; data?: JupiterSwapV2Order; message: string }> {
  const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
  if (!key) {
    return {
      status: false,
      message: "Set EXPO_PUBLIC_JUP_API_KEY for Jupiter Swap API v2.",
    };
  }

  if (!params.inputMint || !params.outputMint || !params.amountSmallestInput) {
    return { status: false, message: "Invalid swap parameters" };
  }

  const search = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountSmallestInput,
    swapMode: "ExactIn",
  });
  if (params.taker) search.set("taker", params.taker);
  if (params.slippageBps != null && params.slippageBps >= 0) {
    search.set("slippageBps", String(params.slippageBps));
  }
  const refAccount = (params.referralAccount ?? "").trim();
  const refFee = params.referralFeeBps;
  if (refAccount && refFee != null && refFee >= 50 && refFee <= 255) {
    search.set("referralAccount", refAccount);
    search.set("referralFee", String(Math.floor(refFee)));
  }

  try {
    const orderUrl = `${JUPITER_SWAP_V2}/order?${search.toString()}`;
    const startedAt = Date.now();
    const res = await fetch(orderUrl, {
      method: "GET",
      headers: jupSwapV2Headers(),
    });
    const parsed = await readJsonBody(res, {
      label: "Jupiter swap v2 /order",
      method: "GET",
      url: orderUrl,
      requestSummary: search.toString(),
      startedAt,
    });
    if (!parsed.ok || !parsed.data) {
      return { status: false, message: parsed.message || "Swap order failed" };
    }
    const d = parsed.data;
    if (params.taker) {
      if (d.errorCode != null && d.errorCode !== 0) {
        return {
          status: false,
          message:
            d.errorMessage || d.error || "Could not build swap transaction",
        };
      }
      if (!d.transaction || d.transaction.length === 0) {
        return {
          status: false,
          message:
            d.errorMessage || d.error || "No transaction in Jupiter response",
        };
      }
    }
    return { status: true, data: d };
  } catch (e) {
    console.error("Jupiter swap v2 /order error:", e);
    return {
      status: false,
      message: (e as Error).message || "Failed to reach Jupiter Swap API",
    };
  }
}

/** Jupiter Swap API v2 POST /execute */
export async function postSwapV2Execute(params: {
  signedTransaction: string;
  requestId: string;
  lastValidBlockHeight?: string;
}): Promise<{ status: boolean; data?: JupiterSwapV2ExecuteResult; message: string }> {
  const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
  if (!key) {
    return {
      status: false,
      message: "Set EXPO_PUBLIC_JUP_API_KEY for Jupiter Swap API v2.",
    };
  }

  const url = `${JUPITER_SWAP_V2}/execute`;
  const body: Record<string, string> = {
    signedTransaction: params.signedTransaction,
    requestId: params.requestId,
  };
  if (params.lastValidBlockHeight) {
    body.lastValidBlockHeight = params.lastValidBlockHeight;
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...jupSwapV2Headers(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (__DEV__) {
      pushDevNetworkLog({
        label: "Jupiter swap v2 /execute",
        method: "POST",
        url,
        status: res.status,
        durationMs: Date.now() - startedAt,
        requestSummary: `requestId=${params.requestId}`,
        responseBody: text,
      });
    }

    let data: JupiterSwapV2ExecuteResult | null = null;
    try {
      data = text ? (JSON.parse(text) as JupiterSwapV2ExecuteResult) : null;
    } catch {
      return {
        status: false,
        message: text.slice(0, 280) || "Invalid JSON from Jupiter /execute",
      };
    }

    if (!res.ok) {
      return {
        status: false,
        message: data?.error || text.slice(0, 240) || `HTTP ${res.status}`,
      };
    }

    if (data?.status === "Failed" || !data?.signature) {
      return {
        status: false,
        message:
          data?.error ||
          (data?.code != null
            ? `Execute failed (code ${data.code})`
            : "Execute failed"),
      };
    }

    return { status: true, data };
  } catch (e) {
    console.error("Jupiter swap v2 /execute error:", e);
    return {
      status: false,
      message: (e as Error).message || "Failed to reach Jupiter /execute",
    };
  }
}

export function smallestUnitsFromHuman(
  amount: number,
  decimals: number
): string | null {
  const amt = Math.round(amount * Math.pow(10, decimals));
  if (!Number.isFinite(amt) || amt <= 0) return null;
  return String(amt);
}

export function humanFromSmallestUnits(
  raw: string | undefined,
  decimals: number
): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / Math.pow(10, decimals);
}

export function formatSwapAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toFixed(6).replace(/\.?0+$/, "");
  return n.toPrecision(4);
}
