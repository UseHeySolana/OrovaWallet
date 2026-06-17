export function formatQvacDelegateError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

    if (
    message.includes("HOLEPUNCH") ||
    message.includes("Holepunch") ||
    message.includes("holepunch")
  ) {
    return (
      "Could not reach your laptop over P2P. In AI Settings, paste the local " +
      "address from HeySolana Voice Host (e.g. 192.168.1.129:8787) instead of " +
      "relying on the provider key alone."
    );
  }

  if (
    message.includes("PEER_NOT_FOUND") ||
    message.includes("not found on the DHT") ||
    message.includes("provider public key")
  ) {
    return (
      "Laptop host not found. Open HeySolana Voice Host, wait until it shows Ready, " +
      "then paste the provider key again in AI Settings."
    );
  }

  if (message.includes("DELEGATE_CONNECTION_FAILED") || message.includes("RPC connection failed")) {
    return (
      "Connection to your laptop failed. Confirm Voice Host is running, the provider " +
      "key is correct, and both devices share the same network."
    );
  }

  if (message.includes("Add your laptop provider public key")) {
    return message;
  }

  if (message.includes("MODEL_LOAD_FAILED")) {
    return `Private voice could not start: ${message.replace(/^MODEL_LOAD_FAILED:\s*/i, "")}`;
  }

  return message;
}
