const LAN_PAIRING_PREFIX = "heysolana-lan://";

export function normalizeLaptopHostAddress(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith(LAN_PAIRING_PREFIX)) {
    return trimmed.slice(LAN_PAIRING_PREFIX.length).trim();
  }

  return trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function buildLanHttpBase(address: string): string {
  const host = normalizeLaptopHostAddress(address);
  if (!host) return "";
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host.replace(/\/$/, "");
  }
  return `http://${host}`;
}

export function buildLanWsBase(address: string): string {
  const httpBase = buildLanHttpBase(address);
  return httpBase.replace(/^http/, "ws");
}

export { LAN_PAIRING_PREFIX };
