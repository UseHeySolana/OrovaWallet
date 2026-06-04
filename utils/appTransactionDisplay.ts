import type { AppTransaction } from "@/services/appTransactions";
import { shortenPub } from "@/utils/functions/extrafunctions";

export function formatAppTxType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAppTxAmount(
  value: AppTransaction["amount"],
  token?: string | null
) {
  if (value == null || value === "") return "";
  const amount = Number(value);
  const display = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : String(value);
  return token ? `${display} ${token}` : display;
}

/** One-line summary for app-wide wallet activity. */
export function appTxRowSummary(tx: AppTransaction) {
  const type = String(tx.transaction_type ?? "other");
  const inputToken = tx.input_token_symbol ?? tx.token;
  const outputToken = tx.output_token_symbol;
  const input = formatAppTxAmount(tx.input_amount ?? tx.amount, inputToken);
  const output = formatAppTxAmount(tx.output_amount, outputToken);
  const title = formatAppTxType(type);
  const app = tx.app_called || tx.provider || "HeySolana";
  const recipient = tx.recipient_address
    ? `to ${shortenPub(tx.recipient_address)}`
    : null;

  if (type === "swap" && input && output) {
    return {
      title,
      subtitle: `${app} • ${input} to ${output}`,
      amount: output,
      sent: false,
    };
  }

  if (type === "deposit") {
    return {
      title,
      subtitle: app,
      amount: input ? `+ ${input}` : "",
      sent: false,
    };
  }

  if (
    type === "airtime" ||
    type === "electricity" ||
    type === "commerce" ||
    type === "offramp" ||
    type === "withdraw" ||
    type === "transfer" ||
    type === "private_transfer"
  ) {
    return {
      title,
      subtitle: [app, recipient].filter(Boolean).join(" • "),
      amount: input ? `- ${input}` : "",
      sent: true,
    };
  }

  return {
    title,
    subtitle: app,
    amount: input,
    sent: true,
  };
}
