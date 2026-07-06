import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

const DEFAULT_FEE_LAMPORTS = 5_000;

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function formatSolAmount(sol: number, maxDecimals = 9): string {
  if (!Number.isFinite(sol) || sol <= 0) return "0";
  return sol.toFixed(maxDecimals).replace(/\.?0+$/, "") || "0";
}

export function formatSolFee(lamports: number): string {
  const sol = lamportsToSol(lamports);
  if (sol < 0.000001) return "<0.000001";
  return formatSolAmount(sol, 9);
}

export async function estimateSolTransferFeeLamports(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  lamports: number
): Promise<number> {
  const transferLamports = Math.max(1, lamports);
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: transferLamports,
    })
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const fee = await connection.getFeeForMessage(tx.compileMessage());
  return fee.value ?? DEFAULT_FEE_LAMPORTS;
}

export async function getMaxSendableSol(
  connection: Connection,
  from: PublicKey,
  to: PublicKey
): Promise<{ maxSol: number; feeLamports: number }> {
  const balanceLamports = await connection.getBalance(from);
  if (balanceLamports <= DEFAULT_FEE_LAMPORTS) {
    return { maxSol: 0, feeLamports: DEFAULT_FEE_LAMPORTS };
  }

  const provisionalLamports = balanceLamports - DEFAULT_FEE_LAMPORTS;
  const feeLamports = await estimateSolTransferFeeLamports(
    connection,
    from,
    to,
    provisionalLamports
  );

  const maxLamports = Math.max(0, balanceLamports - feeLamports);
  return {
    maxSol: lamportsToSol(maxLamports),
    feeLamports,
  };
}

export async function solTransferFitsBalance(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  amountSol: number
): Promise<{ ok: boolean; feeLamports: number; maxSol: number }> {
  const lamports = solToLamports(amountSol);
  const balanceLamports = await connection.getBalance(from);
  const feeLamports = await estimateSolTransferFeeLamports(
    connection,
    from,
    to,
    lamports
  );
  const maxLamports = Math.max(0, balanceLamports - feeLamports);

  return {
    ok: lamports > 0 && lamports + feeLamports <= balanceLamports,
    feeLamports,
    maxSol: lamportsToSol(maxLamports),
  };
}
