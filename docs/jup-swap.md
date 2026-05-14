> ## Documentation Index
>
> Fetch the complete documentation index at: https://dev.jup.ag/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Order & Execute

> Best price across all routers with managed transaction landing

The Meta-Aggregator is the recommended way to swap on Jupiter. All routing engines compete for the best price (Metis, JupiterZ RFQ, Dflow, OKX), and Jupiter handles transaction landing for you via `/order` + `/execute`.

## Quick start

Three steps: get an order, sign it, execute it.

### Prerequisites

<Accordion title="Loading a wallet for testing">
  There are several ways to load a wallet for testing. All examples on this page use `BS58_PRIVATE_KEY` from your `.env` file.

  <CodeGroup>
    ```typescript title="From base58 secret key (.env)" theme={null}
    // .env: BS58_PRIVATE_KEY=your_base58_secret_key

    // @solana/kit
    import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";
    const signer = await createKeyPairSignerFromBytes(
      getBase58Encoder().encode(process.env.BS58_PRIVATE_KEY!),
    );

    // @solana/web3.js
    import { Keypair } from "@solana/web3.js";
    import bs58 from "bs58";
    const signer = Keypair.fromSecretKey(bs58.decode(process.env.BS58_PRIVATE_KEY!));
    ```

    ```typescript title="From Solana CLI keypair file" theme={null}
    import fs from "fs";

    // @solana/kit
    import { createKeyPairSignerFromBytes } from "@solana/kit";
    const keyfileBytes = JSON.parse(
      fs.readFileSync("/path/to/.config/solana/id.json", "utf8"),
    );
    const signer = await createKeyPairSignerFromBytes(
      new Uint8Array(keyfileBytes),
    );

    // @solana/web3.js
    import { Keypair } from "@solana/web3.js";
    const keyfileBytes = JSON.parse(
      fs.readFileSync("/path/to/.config/solana/id.json", "utf8"),
    );
    const signer = Keypair.fromSecretKey(new Uint8Array(keyfileBytes));
    ```

    ```typescript title="From raw byte array" theme={null}
    // @solana/kit
    import { createKeyPairSignerFromBytes } from "@solana/kit";
    const signer = await createKeyPairSignerFromBytes(
      new Uint8Array([/* 64 bytes */]),
    );

    // @solana/web3.js
    import { Keypair } from "@solana/web3.js";
    const signer = Keypair.fromSecretKey(new Uint8Array([/* 64 bytes */]));
    ```

  </CodeGroup>

  <Warning>
    Never commit private keys to source control. Use environment variables or the Solana CLI keyfile for testing. In production, use a proper key management solution.
  </Warning>
</Accordion>

<Accordion title="Imports, types, and constants">
  <CodeGroup>
    ```typescript title="@solana/kit" theme={null}
    import {
      createKeyPairSignerFromBytes,
      getBase58Encoder,
      getTransactionDecoder,
      getTransactionEncoder,
      partiallySignTransaction,
    } from "@solana/kit";

    type OrderResponse = {
      transaction: string;       // base64-encoded transaction
      requestId: string;
      outAmount: string;
      router: string;            // "iris" | "jupiterz" | "dflow" | "okx"
      mode: string;              // "ultra" | "manual"
      feeBps: number;
      feeMint: string;
    };

    type ExecuteResponse = {
      status: "Success" | "Failed";
      signature: string;
      code: number;
      inputAmountResult: string;
      outputAmountResult: string;
      error?: string;
    };

    const API_KEY = process.env.JUPITER_API_KEY;
    if (!API_KEY) throw new Error("Missing JUPITER_API_KEY");
    const BASE_URL = "https://api.jup.ag/swap/v2";

    // Load wallet from base58 secret key in .env
    const signer = await createKeyPairSignerFromBytes(
      getBase58Encoder().encode(process.env.BS58_PRIVATE_KEY!),
    );
    ```

    ```typescript title="@solana/web3.js" theme={null}
    import { Keypair, VersionedTransaction } from "@solana/web3.js";
    import bs58 from "bs58";

    type OrderResponse = {
      transaction: string;       // base64-encoded transaction
      requestId: string;
      outAmount: string;
      router: string;            // "iris" | "jupiterz" | "dflow" | "okx"
      mode: string;              // "ultra" | "manual"
      feeBps: number;
      feeMint: string;
    };

    type ExecuteResponse = {
      status: "Success" | "Failed";
      signature: string;
      code: number;
      inputAmountResult: string;
      outputAmountResult: string;
      error?: string;
    };

    const API_KEY = process.env.JUPITER_API_KEY;
    if (!API_KEY) throw new Error("Missing JUPITER_API_KEY");
    const BASE_URL = "https://api.jup.ag/swap/v2";

    // Load wallet from base58 secret key in .env
    const signer = Keypair.fromSecretKey(
      bs58.decode(process.env.BS58_PRIVATE_KEY!),
    );
    ```

  </CodeGroup>
</Accordion>

### Code example

<CodeGroup>
  ```typescript expandable title="@solana/kit" theme={null}
  // Step 1: Get an order
  const orderResponse = await fetch(
    `${BASE_URL}/order?` +
      new URLSearchParams({
        inputMint: "So11111111111111111111111111111111111111112", // SOL
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        amount: "100000000",
        taker: signer.address,
      }),
    { headers: { "x-api-key": API_KEY } },
  );
  if (!orderResponse.ok) {
    console.error(`/order failed: ${orderResponse.status}`, await orderResponse.text());
    process.exit(1);
  }
  const order: OrderResponse = await orderResponse.json();

if (!order.transaction) {
console.error("No transaction in response:", JSON.stringify(order, null, 2));
process.exit(1);
}

// Step 2: Sign the transaction
// Use partiallySignTransaction because JupiterZ quotes require an additional
// market maker signature, which is added during /execute
const transactionBytes = Buffer.from(order.transaction, "base64");
const transaction = getTransactionDecoder().decode(transactionBytes);
const signedTransaction = await partiallySignTransaction(
[signer.keyPair],
transaction,
);

// Step 3: Execute
const signedTxBytes = getTransactionEncoder().encode(signedTransaction);
const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");

const executeResponse = await fetch(`${BASE_URL}/execute`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": API_KEY,
},
body: JSON.stringify({
signedTransaction: signedTxBase64,
requestId: order.requestId,
}),
});
if (!executeResponse.ok) {
console.error(`/execute failed: ${executeResponse.status}`, await executeResponse.text());
process.exit(1);
}
const result: ExecuteResponse = await executeResponse.json();

console.log(`https://solscan.io/tx/${result.signature}`);
if (result.status === "Success") {
console.log("Swap successful:", JSON.stringify(result, null, 2));
} else {
console.error("Swap failed:", JSON.stringify(result, null, 2));
}

````

```typescript expandable title="@solana/web3.js" theme={null}
// Step 1: Get an order
const orderResponse = await fetch(
  `${BASE_URL}/order?` +
    new URLSearchParams({
      inputMint: "So11111111111111111111111111111111111111112", // SOL
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      amount: "100000000",
      taker: signer.publicKey.toString(),
    }),
  { headers: { "x-api-key": API_KEY } },
);
if (!orderResponse.ok) {
  console.error(`/order failed: ${orderResponse.status}`, await orderResponse.text());
  process.exit(1);
}
const order: OrderResponse = await orderResponse.json();

if (!order.transaction) {
  console.error("No transaction in response:", JSON.stringify(order, null, 2));
  process.exit(1);
}

// Step 2: Sign the transaction
const transaction = VersionedTransaction.deserialize(
  Buffer.from(order.transaction, "base64"),
);
transaction.sign([signer]);

// Step 3: Execute
const signedTransaction = Buffer.from(transaction.serialize()).toString("base64");

const executeResponse = await fetch(`${BASE_URL}/execute`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
  body: JSON.stringify({
    signedTransaction,
    requestId: order.requestId,
  }),
});
if (!executeResponse.ok) {
  console.error(`/execute failed: ${executeResponse.status}`, await executeResponse.text());
  process.exit(1);
}
const result: ExecuteResponse = await executeResponse.json();

console.log(`https://solscan.io/tx/${result.signature}`);
if (result.status === "Success") {
  console.log("Swap successful:", JSON.stringify(result, null, 2));
} else {
  console.error("Swap failed:", JSON.stringify(result, null, 2));
}
````

</CodeGroup>

## How it works

### 1. Get an order

`GET /order` returns a quote and an assembled transaction in a single call. All routers compete for the best price: Metis, JupiterZ, Dflow, and OKX.

<Note>
  Adding optional parameters to `/order` (such as fee or slippage overrides) may restrict routing. See the [routing impact matrix](#routing-impact-matrix) below for details.
</Note>

**Required parameters:**

| Parameter    | Description                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputMint`  | Mint address of the token you are selling                                                                                                                     |
| `outputMint` | Mint address of the token you are buying                                                                                                                      |
| `amount`     | Amount in the smallest unit of the input token                                                                                                                |
| `taker`      | Your wallet address. Required to receive an assembled transaction.<br />Without `taker`, you get a quote but no transaction. This is useful for price checks. |

**Key response fields:**

| Field         | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| `transaction` | Base64-encoded transaction to sign. Null if `taker` is not set.  |
| `requestId`   | Pass this to `/execute`.                                         |
| `outAmount`   | Expected output amount before slippage.                          |
| `router`      | Which router won the quote (iris, jupiterz, dflow, okx).         |
| `mode`        | "ultra" (no optional params) or "manual" (optional params used). |

For the full parameter reference, see the [API reference](/api-reference/swap/order). For how each parameter affects routing, see the [routing impact matrix](#routing-impact-matrix) below.

### 2. Sign the transaction

- The transaction returned by `/order` is unsigned. Sign it with your wallet's private key. The example above uses `@solana/kit`. The transaction is a versioned transaction (v0).
- Note: we use the `partiallySignTransaction` for partial signing because when JupiterZ routing is provided, there is an additional signer which is the MM that will be required after sending the transaction to `/execute` request.

### 3. Execute the transaction

`POST /execute` takes the signed transaction and the `requestId` from the order response.

<Tip>
  `/execute` has its own dedicated rate limit bucket (Keyless 20, Free 50, Paid 100 RPS), separate from your general API limit. See [Rate Limits](/portal/rate-limits#dedicated-rate-limit-buckets).
</Tip>

Jupiter handles:

- Optimised slippage via [RTSE](/swap/advanced/slippage) (Real-Time Slippage Estimator), applied at order time to balance trade success and price protection
- Optimised priority fee strategy for current network conditions
- Jupiter Beam (our own proprietary transaction execution pipeline) for accelerated transaction sending and landing across multiple RPC providers
- Confirmation polling
- Parses both successful and failed transactions

**Request body:**

| Field                  | Required | Description                                |
| ---------------------- | -------- | ------------------------------------------ |
| `signedTransaction`    | Yes      | Base64-encoded signed transaction          |
| `requestId`            | Yes      | The `requestId` from the `/order` response |
| `lastValidBlockHeight` | No       | Block height for nonce validation          |

**Response:**

| Field                | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `status`             | "Success" or "Failed"                                             |
| `signature`          | Transaction signature (present on both success and some failures) |
| `code`               | Error code. 0 = success. See [error codes](#error-codes) below.   |
| `inputAmountResult`  | Amount of input token used for the swap                           |
| `outputAmountResult` | Amount of output token received                                   |

## Error codes

| Code    | Category   | Meaning                                               |
| ------- | ---------- | ----------------------------------------------------- |
| `0`     | Success    | Transaction confirmed                                 |
| `-1`    | Execute    | Missing cached order (requestId not found or expired) |
| `-2`    | Execute    | Invalid signed transaction                            |
| `-3`    | Execute    | Invalid message bytes                                 |
| `-1000` | Aggregator | Failed to land                                        |
| `-1001` | Aggregator | Unknown error                                         |
| `-1002` | Aggregator | Invalid transaction                                   |
| `-1003` | Aggregator | Transaction not fully signed                          |
| `-1004` | Aggregator | Invalid block height                                  |
| `-2000` | RFQ        | Failed to land                                        |
| `-2001` | RFQ        | Unknown error                                         |
| `-2002` | RFQ        | Invalid payload                                       |
| `-2003` | RFQ        | Quote expired                                         |
| `-2004` | RFQ        | Swap rejected                                         |

## Routing impact matrix

Adding optional parameters to `/order` can restrict which routers are eligible:

| Parameter                         | Metis | JupiterZ (RFQ) | Dflow  | OKX    |
| --------------------------------- | ----- | -------------- | ------ | ------ |
| **(no optional params)**          | Yes   | Yes            | Yes    | Yes    |
| `receiver`                        | Yes   | **No**         | Yes    | Yes    |
| `referralAccount` & `referralFee` | Yes   | **No**         | Yes    | Yes    |
| `payer` (integrator gasless)      | Yes   | **No**         | **No** | **No** |
| `excludeRouters: jupiterz`        | Yes   | **No**         | Yes    | Yes    |

**Key takeaway:** adding `receiver`, `referralAccount`, `referralFee` or `payer` disables JupiterZ (RFQ), which may result in worse pricing on major pairs where market makers often beat onchain routing by 5-20bps.

For the full parameter reference, see the [API reference](/api-reference/swap/order).

## Order mode

The `/order` response includes a `mode` field that indicates whether optional parameters were applied that may affect routing or swap behaviour:

| Mode       | Meaning                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **ultra**  | No optional params used. Default behaviour with all routers eligible.                                                                         |
| **manual** | Optional params detected (e.g. `slippageBps`, `referralAccount`, `payer`). These modifications may restrict routing or change swap behaviour. |

`mode` does not indicate which router was used for the swap. It signals whether you adjusted parameters that could affect price or swap success. This is useful for debugging: if a swap fails in `manual` mode, the parameter modifications you applied may be the cause.

<Note>
  This is similar to how the jup.ag frontend behaves: when you use custom settings like slippage, priority fee strategy, or dex/router exclusions, the swap is handled differently. Since you opted into custom parameters, you take responsibility for the impact on swap outcomes.
</Note>

## Fees

### Jupiter platform fee

Jupiter charges a platform fee on `/order` swaps. This fee is included in the quote and deducted automatically. The `platformFee` field in the response shows the fee amount and rate:

```json theme={null}
{
  "platformFee": {
    "amount": "8529",
    "feeBps": 5,
    "feeMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
}
```

#### Fee breakdown

The platform fee varies by token pair:

| Token Pair                                           | Fee (bps) |
| ---------------------------------------------------- | --------- |
| Buying Jupiter tokens (SOL/Stable to JUP/JLP/jupSOL) | 0         |
| Pegged assets (LST-LST, Stable-Stable)               | 0         |
| SOL-Stable                                           | 2         |
| LST-Stable                                           | 5         |
| Everything else                                      | 10        |
| New tokens (within 24 hours of token age)            | 50        |

#### Fee mint priority

Jupiter determines which token to collect fees in based on a priority list:

1. **SOL**
2. **Stablecoins** (USDC, USDT, etc.)
3. **Liquid staked tokens** (jupSOL, etc.)
4. **Bluechips** (large market cap tokens)
5. **Others**

Check the `feeBps` and `feeMint` fields in the `/order` response to see which token and rate apply to your swap.

### Referral fees

Use the [Jupiter Referral Program](/tool-kits/referral-program) to earn fees on `/order` swaps. This requires setting up referral accounts before you can collect fees.

#### How it works

- Jupiter takes 20% of your integrator fee (no separate platform fee when referral is active)
- Jupiter decides which token mint to collect fees in based on the [fee mint priority](#fee-mint-priority) list
- You must create a `referralTokenAccount` for each mint you expect to receive fees in
- If the `referralTokenAccount` for the `feeMint` is not initialised, the order still returns but executes without your fees (the user still gets their swap)
- Fee range: 50 to 255 bps
- Supports SPL and Token2022 tokens

#### Setup

Three one-time steps before you can collect fees:

1. **Install the Referral SDK**

```bash theme={null}
npm install @jup-ag/referral-sdk
```

2. **Create a `referralAccount`** (once)

```typescript expandable theme={null}
import { ReferralProvider } from "@jup-ag/referral-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = Keypair.fromSecretKey(
  bs58.decode(process.env.BS58_PRIVATE_KEY!),
);
const provider = new ReferralProvider(connection);

// Jupiter Ultra Referral Project
const projectPubKey = new PublicKey(
  "DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc",
);

const transaction = await provider.initializeReferralAccountWithName({
  payerPubKey: wallet.publicKey,
  partnerPubKey: wallet.publicKey,
  projectPubKey: projectPubKey,
  name: "your-app-name",
});

const signature = await sendAndConfirmTransaction(connection, transaction.tx, [
  wallet,
]);
console.log("referralAccount:", transaction.referralAccountPubKey.toBase58());
```

3. **Create `referralTokenAccount` for each fee mint**

Create a token account for each mint you expect to collect fees in. Start with SOL and USDC. You can add more later.

```typescript expandable theme={null}
const mint = new PublicKey("So11111111111111111111111111111111111111112"); // SOL

const transaction = await provider.initializeReferralTokenAccountV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: new PublicKey("YOUR_REFERRAL_ACCOUNT"),
  mint,
});

const signature = await sendAndConfirmTransaction(connection, transaction.tx, [
  wallet,
]);
console.log("referralTokenAccount:", transaction.tokenAccount.toBase58());
```

You can also use the [Referral Dashboard](https://referral.jup.ag/) to create accounts via a web interface.

#### Usage

Pass `referralAccount` and `referralFee` to `/order`:

```typescript theme={null}
const params = new URLSearchParams({
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  amount: "1000000000",
  taker: walletAddress,
  referralAccount: "YOUR_REFERRAL_ACCOUNT",
  referralFee: "50", // 50 bps = 0.5%
});

const response = await fetch(`https://api.jup.ag/swap/v2/order?${params}`, {
  headers: { "x-api-key": API_KEY },
});
```

Verify your fees are applied by checking the `feeBps` field in the response matches your `referralFee` value. If it falls back to the default platform fee, the `referralTokenAccount` for that `feeMint` is likely not initialised.

<Warning>
  Adding `referralAccount` disables RFQ routing. You will only get Metis quotes. See the [routing impact matrix](#routing-impact-matrix) above.
</Warning>

### Fee response fields

The `/order` response includes these fee-related fields:

| Field                | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `feeBps`             | Total fees including platform and other fees (basis points) |
| `feeMint`            | Token fees are collected in                                 |
| `platformFee.amount` | Jupiter platform fee amount                                 |
| `platformFee.feeBps` | Jupiter platform fee rate                                   |
| `referralAccount`    | Referral account used (if set)                              |

## Related

- [Jupiter Referral Program](/tool-kits/referral-program) for the full referral program documentation
- [Advanced Techniques](/swap/advanced) for gasless swaps, priority fees, and CU optimisation
- [API Reference: GET /order](/api-reference/swap/order) for the full OpenAPI specification
- [API Reference: POST /execute](/api-reference/swap/execute) for the full OpenAPI specification

> ## Documentation Index
>
> Fetch the complete documentation index at: https://dev.jup.ag/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Order

> Get a swap quote and assembled transaction

## OpenAPI

```yaml /openapi-spec/swap/v2/swap.yaml get /order
openapi: 3.0.3
info:
  title: Swap API V2
  version: 2.0.0
  description: >
    Jupiter Swap API V2. Three endpoints: `/order` (default happy path with
    managed execution),

    `/build` (advanced path returning raw swap instructions), and `/execute`
    (managed transaction execution for `/order`).
servers:
  - url: https://api.jup.ag/swap/v2
    description: Swap API V2 Endpoint
security: []
paths:
  /order:
    get:
      tags:
        - Swap
      summary: Get Order
      description: >
        Get a swap quote and assembled transaction. This is the default happy
        path with all Ultra benefits

        (predictive execution, RTSE, Jupiter Beam, gasless, multi-router
        competition).


        Without optional parameters, all routers compete for the best price
        (Metis, JupiterZ RFQ, Dflow, OKX).

        Adding fee or swap modification parameters may restrict routing to Metis
        only.
      operationId: GetOrder
      parameters:
        - $ref: "#/components/parameters/InputMintParameter"
        - $ref: "#/components/parameters/OutputMintParameter"
        - $ref: "#/components/parameters/AmountParameter"
        - name: taker
          in: query
          schema:
            type: string
          description: >
            - The public key of the wallet that will sign the transaction

            - If not provided, the response will contain a quote but no
            transaction

            - Must be present if you intend to sign and execute the transaction
            via `/execute`
          example: GkwFnmMDvn3HGMpJpWBg8tgJxr3NxNvg3AXxvXVPbRGJ
        - name: receiver
          in: query
          schema:
            type: string
          description: >
            - The public key of the account that will receive the output tokens

            - Must differ from `taker`

            - Expects a wallet address, not a token account

            - For non-SOL output: tokens are sent to the receiver's associated
            token account (ATA). If the ATA is not initialised, a create ATA
            instruction is added to the transaction

            - For SOL output: native SOL is transferred directly to the receiver

            - Does not support destination wSOL token accounts

            - Disables RFQ routing (JupiterZ)
        - name: swapMode
          in: query
          schema:
            type: string
            enum:
              - ExactIn
          description: |
            - Swap mode. Currently only `ExactIn` is supported.
        - name: slippageBps
          in: query
          schema:
            type: integer
            minimum: 0
            maximum: 10000
          description: >
            - Slippage tolerance in basis points (0-10000)

            - If not set, Jupiter automatically determines an appropriate
            slippage
          example: 50
        - name: referralAccount
          in: query
          schema:
            type: string
          description: |
            - Address of your referral account for the Jupiter referral project
            - Must be used together with `referralFee`
            - Disables RFQ routing (JupiterZ)
            - See the [Referral Program](/tool-kits/referral-program) for setup
        - name: referralFee
          in: query
          schema:
            type: number
            minimum: 50
            maximum: 255
          description: |
            - Referral fee in basis points (50-255)
            - Must be used together with `referralAccount`
          example: 50
        - name: payer
          in: query
          schema:
            type: string
          description: >
            - The public key of an account that will cover gas-related fees
            (signature fees, priority fees, and rent) on behalf of the taker

            - Enabling this changes routing behaviour: Jupiter may route through
            a dedicated gasless flow if the taker lacks sufficient SOL for gas
          example: gasTzr94Pmp4Gf8vknQnqxeYxdgwFjbgdJa4msYRpnB
        - name: priorityFeeLamports
          in: query
          schema:
            type: number
          description: >
            - Priority fee in lamports

            - If not set, Jupiter automatically determines an appropriate
            priority fee

            - Setting this overrides the automatic optimisation
        - name: jitoTipLamports
          in: query
          schema:
            type: number
          description: |
            - Jito MEV tip in lamports for faster block inclusion
        - name: broadcastFeeType
          in: query
          schema:
            type: string
            enum:
              - maxCap
              - exactFee
          description: >
            - Fee cap strategy: `maxCap` treats the fee as a maximum, `exactFee`
            uses the exact amount

            - Ignored if neither `priorityFeeLamports` nor `jitoTipLamports` are
            set
        - name: excludeRouters
          in: query
          schema:
            type: string
          description: >
            - Comma-separated list of routers to exclude

            - Available routers: `iris` (Metis), `jupiterz` (JupiterZ), `dflow`,
            `okx`
          example: jupiterz,dflow
        - name: excludeDexes
          in: query
          schema:
            type: string
          description: >
            - Comma-separated list of DEXes to exclude from the Metis router

            - **Important**: This only affects the Metis router, not other
            routers

            - For example: `excludeDexes=Raydium,Orca+V2,Meteora+DLMM`
      responses:
        "200":
          description: Quote with optional assembled transaction
          content:
            application/json:
              schema:
                type: object
                properties:
                  mode:
                    type: string
                    description: '"ultra" or "manual" based on parameters used'
                  inputMint:
                    type: string
                  outputMint:
                    type: string
                  inAmount:
                    type: string
                  outAmount:
                    type: string
                  inUsdValue:
                    type: number
                  outUsdValue:
                    type: number
                  priceImpact:
                    type: number
                    description: Price impact as a decimal (e.g. -0.001 = -0.1%)
                  swapUsdValue:
                    type: number
                  otherAmountThreshold:
                    type: string
                    description: Minimum output amount after slippage
                  swapMode:
                    type: string
                  slippageBps:
                    type: number
                  priceImpactPct:
                    type: string
                    description: "Deprecated: use priceImpact instead"
                    deprecated: true
                  routePlan:
                    type: array
                    items:
                      $ref: "#/components/schemas/RoutePlanStep"
                  referralAccount:
                    type: string
                  feeMint:
                    type: string
                  feeBps:
                    type: number
                    description: Total fees including platform fee and other fees
                  platformFee:
                    $ref: "#/components/schemas/PlatformFee"
                  signatureFeeLamports:
                    type: number
                  signatureFeePayer:
                    type: string
                    nullable: true
                  prioritizationFeeLamports:
                    type: number
                    description: Includes priority fees and tips (Jito, Nozomi)
                  prioritizationFeePayer:
                    type: string
                    nullable: true
                  rentFeeLamports:
                    type: number
                    description: Estimated rent fee
                  rentFeePayer:
                    type: string
                    nullable: true
                  swapType:
                    type: string
                    description: "Deprecated: use router instead"
                    deprecated: true
                    enum:
                      - aggregator
                      - rfq
                      - aggregator+rfq
                      - dflow
                      - okx
                  router:
                    type: string
                    enum:
                      - iris
                      - jupiterz
                      - dflow
                      - okx
                    description: Which router won the quote
                  transaction:
                    type: string
                    nullable: true
                    description: >
                      - Base64-encoded transaction. Null if taker is not
                      provided.

                      - Empty string if taker is provided but transaction could
                      not be built (check errorCode).
                  lastValidBlockHeight:
                    type: string
                  gasless:
                    type: boolean
                  requestId:
                    type: string
                    description: Unique request ID. Pass this to /execute.
                  totalTime:
                    type: number
                    description: Response time in milliseconds
                  taker:
                    type: string
                    nullable: true
                  quoteId:
                    type: string
                    description: Quote ID for RFQ swaps
                  maker:
                    type: string
                    description: Market maker address for RFQ swaps
                  expireAt:
                    type: string
                    description: Quote expiration timestamp for RFQ swaps
                  errorCode:
                    type: number
                    description: >-
                      Present when taker is defined but transaction is empty
                      string
                  errorMessage:
                    type: string
                    description: Human-readable error description
                  error:
                    type: string
                    description: Duplicate of errorMessage for backwards compatibility
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                type: object
                properties:
                  requestId:
                    type: string
                  error:
                    type: string
      security:
        - ApiKeyAuth: []
components:
  parameters:
    InputMintParameter:
      name: inputMint
      in: query
      required: true
      schema:
        type: string
      description: The mint address of the input token
      example: So11111111111111111111111111111111111111112
    OutputMintParameter:
      name: outputMint
      in: query
      required: true
      schema:
        type: string
      description: The mint address of the output token
      example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    AmountParameter:
      name: amount
      in: query
      required: true
      schema:
        type: string
      description: The amount to swap in the smallest unit of the input token
      example: "1000000000"
  schemas:
    RoutePlanStep:
      type: object
      properties:
        swapInfo:
          $ref: "#/components/schemas/SwapInfo"
        percent:
          type: number
          description: Percentage of total swap routed through this step
        bps:
          type: number
          description: Basis points of total swap routed through this step
        usdValue:
          type: number
          description: USD value of this step
      required:
        - swapInfo
        - percent
        - bps
    PlatformFee:
      type: object
      properties:
        amount:
          type: string
        feeBps:
          type: number
          description: Platform fee in basis points
        feeMint:
          type: string
    SwapInfo:
      type: object
      properties:
        ammKey:
          type: string
        label:
          type: string
        inputMint:
          type: string
        outputMint:
          type: string
        inAmount:
          type: string
        outAmount:
          type: string
      required:
        - ammKey
        - label
        - inputMint
        - outputMint
        - inAmount
        - outAmount
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-api-key
      description: Get API key via https://developers.jup.ag/portal
```

> ## Documentation Index
>
> Fetch the complete documentation index at: https://dev.jup.ag/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Execute Transaction

> Execute a signed transaction from /order with managed landing

## OpenAPI

```yaml /openapi-spec/swap/v2/swap.yaml post /execute
openapi: 3.0.3
info:
  title: Swap API V2
  version: 2.0.0
  description: >
    Jupiter Swap API V2. Three endpoints: `/order` (default happy path with
    managed execution),

    `/build` (advanced path returning raw swap instructions), and `/execute`
    (managed transaction execution for `/order`).
servers:
  - url: https://api.jup.ag/swap/v2
    description: Swap API V2 Endpoint
security: []
paths:
  /execute:
    post:
      tags:
        - Swap
      summary: Execute Transaction
      description: >
        Execute a signed transaction from `/order`. Handles transaction landing,
        confirmation, and retry.


        Only available for transactions obtained via `/order`. Transactions
        built via `/build` must be

        sent through your own RPC.
      operationId: PostExecute
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - signedTransaction
                - requestId
              properties:
                signedTransaction:
                  type: string
                  description: Base64-encoded signed transaction
                requestId:
                  type: string
                  description: The requestId from the /order response
                lastValidBlockHeight:
                  type: string
                  description: Optional block height for nonce validation
      responses:
        "200":
          description: Execution result
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum:
                      - Success
                      - Failed
                  signature:
                    type: string
                    description: Transaction signature
                  slot:
                    type: string
                    description: Confirmed slot
                  error:
                    type: string
                    description: Error message (present if Failed)
                  code:
                    type: number
                    description: >
                      - Error code. 0 = success.

                      - Ultra: -1 (missing cached order), -2 (invalid signed
                      tx), -3 (invalid message bytes).

                      - Aggregator: -1000 (failed to land), -1001 (unknown),
                      -1002 (invalid tx), -1003 (not fully signed), -1004
                      (invalid block height).

                      - RFQ: -2000 (failed to land), -2001 (unknown), -2002
                      (invalid payload), -2003 (quote expired), -2004 (swap
                      rejected).
                  totalInputAmount:
                    type: string
                    description: Total input token amount before fees
                  totalOutputAmount:
                    type: string
                    description: Total output token amount after fees
                  inputAmountResult:
                    type: string
                    description: Amount of input token used for the swap
                  outputAmountResult:
                    type: string
                    description: Amount of output token received from the swap
                  swapEvents:
                    type: array
                    items:
                      $ref: "#/components/schemas/SwapEvent"
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: number
        "500":
          description: Internal server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  signature:
                    type: string
                  error:
                    type: string
      security:
        - ApiKeyAuth: []
components:
  schemas:
    SwapEvent:
      type: object
      properties:
        inputMint:
          type: string
        inputAmount:
          type: string
        outputMint:
          type: string
        outputAmount:
          type: string
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-api-key
      description: Get API key via https://developers.jup.ag/portal
```




> ## Documentation Index
> Fetch the complete documentation index at: https://dev.jup.ag/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Token Information

> Guide on Tokens V2 API endpoints to query for mint information in specific searches, tags or categories.

<Tip>
  **USEFUL MINT INFORMATION**

  * Token Metadata like name, symbol, icon to display token information to users
  * [Organic Score](/tokens), Holder count, Market cap, etc can be useful to help make a better trading decision
  * And much more!

  Do note that the response is subject to changes as we continue to improve.

  Refer to [Tokens API V2 Reference](/api-reference/tokens) for full schema.
</Tip>

## Query by Mint

The Tokens API V2 provides an endpoint to search tokens in the background for you and returns you the search results, along with the mint information.

This is useful in most user applications, as users need to choose which tokens they want to swap. This also provides a seamless developer experience as integrating this allows us to handle and abstract the token search mechanism, allowing you to focus on other user features.

<Tip>
  **SEARCH**

  * Search for a token and its information by its **symbol, name or mint address**.
  * Comma-separate to search for multiple.
  * Limit to 100 mint addresses in query.
  * Default to 20 mints in response when searching via symbol or name.
</Tip>

```js theme={null}
const searchResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/search?query=So11111111111111111111111111111111111111112`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Query by Tag

The Tokens API V2 provides an endpoint to query by tags. This is useful to help users distinguish between verified vs non-verified or specific groups of tokens like liquid-staked tokens (LSTs) or tokenized stocks.

<Tip>
  **TAGS**

  * Supported tags: `lst`, `verified`, `stocks`.
  * `stocks` returns tokenized equities (e.g. Ondo, Remora).
  * Note that this will return the entire array of existing mints that belongs to the tag.
</Tip>

```js theme={null}
const tagResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/tag?query=verified`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Get Category

The Tokens API V2 provides an endpoint to get mints and their mint information by categories. These categories are useful for identifying tokens in specific trading scenarios, providing users with more information to trade with.

<Tip>
  **CATEGORY**

  * Only `toporganicscore`, `toptraded` or `toptrending` category.
  * Added query by interval for more accuracy, using `5m`, `1h`, `6h`, `24h`.
  * The result filters out generic top tokens like SOL, USDC, etc (since those tokens are likely always top of the categories).
  * Default to 50 mints in response (use `limit` to increase or decrease number of results).
</Tip>

```js theme={null}
const categoryResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/toporganicscore/5m?limit=100`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Get Recent

The Tokens API V2 provides an endpoint to get mints and their mint information by their recency. This is helpful to display to users a list of tokens that just had their first pool created, providing more information to trade with.

<Tip>
  **RECENT**

  * Do note that the definition of RECENT is the **token's first pool creation time** (and not token's mint/creation timestamp).
  * Default to 30 mints in response.
</Tip>

```js theme={null}
const recentResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/recent`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Example Response

All endpoints will return an array of mints, along with their information.

**Successful example response:**

```js expandable theme={null}
[
  {
    id: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    symbol: 'SOL',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    circSupply: 531207433.3986673,
    totalSupply: 603724547.3627878,
    tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    firstPool: {
      id: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      createdAt: '2021-03-29T10:05:48Z'
    },
    holderCount: 2342610,
    audit: {
      mintAuthorityDisabled: true,
      freezeAuthorityDisabled: true,
      topHoldersPercentage: 1.2422471238911812
    },
    organicScore: 98.92390784896082,
    organicScoreLabel: 'high',
    isVerified: true,
    tags: [ 'community', 'strict', 'verified' ],
    fdv: 87824499429.22047,
    mcap: 77275352037.79674,
    usdPrice: 145.47114211747515,
    priceBlockId: 349038717,
    liquidity: 89970631.83880953,
    stats5m: {
      priceChange: 0.021175445311831707,
      liquidityChange: -0.01230267453174984,
      volumeChange: 4.855149318222242,
      buyVolume: 14644327.188370818,
      sellVolume: 14743625.023908526,
      buyOrganicVolume: 269570.2345543641,
      sellOrganicVolume: 204114.37436445671,
      numBuys: 49281,
      numSells: 54483,
      numTraders: 18155,
      numOrganicBuyers: 981,
      numNetBuyers: 3503
    },
    stats1h: {
      priceChange: -0.145099593531635,
      liquidityChange: -0.13450589635262783,
      volumeChange: -15.928930753985316,
      buyVolume: 171520842.22567528,
      sellVolume: 174057197.5207193,
      buyOrganicVolume: 3099405.8562825476,
      sellOrganicVolume: 2975660.0383528043,
      numBuys: 586069,
      numSells: 649275,
      numTraders: 78145,
      numOrganicBuyers: 2716,
      numNetBuyers: 14442
    },
    stats6h: {
      priceChange: 0.3790495974473589,
      liquidityChange: 0.1659230330014905,
      volumeChange: 14.571340846647542,
      buyVolume: 1084625651.9256022,
      sellVolume: 1094488293.656417,
      buyOrganicVolume: 31145072.655369382,
      sellOrganicVolume: 31647431.25353508,
      numBuys: 3789847,
      numSells: 4363909,
      numTraders: 272131,
      numOrganicBuyers: 10849,
      numNetBuyers: 37155
    },
    stats24h: {
      priceChange: 1.5076363979360274,
      liquidityChange: 2.417364079880319,
      volumeChange: -2.1516094834673254,
      buyVolume: 4273248565.256824,
      sellVolume: 4306065610.69747,
      buyOrganicVolume: 109007133.8196669,
      sellOrganicVolume: 118085567.17983335,
      numBuys: 15125444,
      numSells: 17582713,
      numTraders: 754618,
      numOrganicBuyers: 28590,
      numNetBuyers: 80961
    },
    updatedAt: '2025-06-25T05:02:21.034234634Z'
  }
]
```

**Docs:** [Tokens API V2 reference](https://dev.jup.ag/docs/api-reference/tokens) (search, tag, categories, recent mints).