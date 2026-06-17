import {
  heartbeatQvacProvider,
  registerQvacProvider,
  routeQvacInference,
  submitQvacReceipt,
  type QvacRouteResponse,
} from "@/services/qvacComputeApi";
import {
  QVAC_HEARTBEAT_INTERVAL_MS,
  QVAC_LLM_MODEL_ID,
  isQvacP2pEnabled,
} from "./constants";

type HeartbeatTimer = ReturnType<typeof setInterval>;

/**
 * Coordinates Laravel registration/heartbeat for devices sharing inference.
 */
export class QvacP2pManager {
  private walletAddress: string | null = null;
  private providerPublicKey: string | null = null;
  private shareCompute = false;
  private heartbeatTimer: HeartbeatTimer | null = null;
  private registered = false;

  getProviderPublicKey() {
    return this.providerPublicKey;
  }

  isSharing() {
    return this.shareCompute && !!this.providerPublicKey && this.registered;
  }

  async start(walletAddress: string, shareCompute: boolean, providerPublicKey: string) {
    this.walletAddress = walletAddress;
    this.shareCompute = shareCompute && isQvacP2pEnabled();
    this.providerPublicKey = providerPublicKey;

    this.stopHeartbeat();

    if (!this.shareCompute || !this.walletAddress || !this.providerPublicKey) {
      return;
    }

    await this.registerIfNeeded();
    this.startHeartbeat();
  }

  async updateShareCompute(shareCompute: boolean) {
    this.shareCompute = shareCompute && isQvacP2pEnabled();
    if (!this.walletAddress || !this.providerPublicKey) return;

    if (this.shareCompute) {
      await this.registerIfNeeded();
      this.startHeartbeat();
      await heartbeatQvacProvider({
        wallet_address: this.walletAddress,
        provider_public_key: this.providerPublicKey,
        is_active: true,
      }).catch(() => {});
    } else {
      this.stopHeartbeat();
      await heartbeatQvacProvider({
        wallet_address: this.walletAddress,
        provider_public_key: this.providerPublicKey,
        is_active: false,
      }).catch(() => {});
    }
  }

  stop() {
    this.stopHeartbeat();
    if (this.walletAddress && this.providerPublicKey && this.registered) {
      void heartbeatQvacProvider({
        wallet_address: this.walletAddress,
        provider_public_key: this.providerPublicKey,
        is_active: false,
      }).catch(() => {});
    }
    this.walletAddress = null;
    this.providerPublicKey = null;
    this.registered = false;
    this.shareCompute = false;
  }

  async routeForModel(model: string = QVAC_LLM_MODEL_ID): Promise<QvacRouteResponse> {
    if (!this.walletAddress) {
      throw new Error("Wallet not ready for QVAC routing");
    }
    return routeQvacInference({
      wallet_address: this.walletAddress,
      model,
      consumer_public_key: this.providerPublicKey ?? undefined,
      max_output_tokens: 2048,
    });
  }

  async submitReceipt(input: {
    job_id: string;
    job_ticket: string;
    provider_public_key: string;
    tokens_in?: number;
    tokens_out: number;
    duration_ms?: number;
  }) {
    if (!this.walletAddress) return;
    await submitQvacReceipt({
      wallet_address: this.walletAddress,
      ...input,
    });
  }

  private async registerIfNeeded() {
    if (!this.walletAddress || !this.providerPublicKey || this.registered) return;

    await registerQvacProvider({
      wallet_address: this.walletAddress,
      provider_public_key: this.providerPublicKey,
      models: [QVAC_LLM_MODEL_ID],
      max_concurrency: 1,
      price_points_per_output_token: 1,
    });

    this.registered = true;
  }

  private startHeartbeat() {
    if (this.heartbeatTimer || !this.walletAddress || !this.providerPublicKey) return;

    const tick = () => {
      if (!this.walletAddress || !this.providerPublicKey) return;
      void heartbeatQvacProvider({
        wallet_address: this.walletAddress,
        provider_public_key: this.providerPublicKey,
        is_active: true,
      }).catch(() => {});
    };

    tick();
    this.heartbeatTimer = setInterval(tick, QVAC_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

let singleton: QvacP2pManager | null = null;

export function getQvacP2pManager(): QvacP2pManager {
  if (!singleton) singleton = new QvacP2pManager();
  return singleton;
}
