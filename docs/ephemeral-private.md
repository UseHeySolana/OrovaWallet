Private Payments API
Introduction
Private Payments API documentation

Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Ephemeral SPL Token Program
Reference program for private SPL token flows
Private Payment Example
Explore the example private payments application and API flow
​
Overview
The Private Payments API builds unsigned SPL token transactions for deposits, transfers, withdrawals, swaps, and mint initialization across Solana and MagicBlock ephemeral rollups. It also exposes balance queries, mint-initialization status, and a wallet challenge/login flow that issues bearer tokens for reading private data. The canonical public reference is available at payments.magicblock.app/reference.
​
Meta
Health - Check API health and availability
​
Auth
Challenge - Generate a challenge string for the wallet to sign
Login - Exchange a signed challenge for a bearer token
​
SPL
Deposit SPL Tokens - Build an unsigned deposit transaction from Solana into an ephemeral rollup
Transfer SPL Tokens - Build an unsigned public or private SPL transfer
Withdraw SPL Tokens - Build an unsigned withdrawal transaction back to Solana
Initialize Mint - Build an unsigned transaction that initializes a validator-scoped transfer queue for a mint
Balance - Get the base-chain SPL token balance for an address
Private Balance - Get the ephemeral-rollup SPL token balance for an address (auth required)
Is Mint Initialized - Check whether a mint has a validator-scoped transfer queue on the ephemeral RPC
​
Swap
Swap Quote - Get a swap quote between two SPL mints
Swap - Build an unsigned swap transaction (public pass-through or private with scheduled transfer)
​
MCP
MCP - Access the stateless Streamable HTTP MCP endpoint
┌────────────────────────────────────────────┐
│ 1. Deposit                                │
├────────────────────────────────────────────┤
│ • Build an unsigned deposit transaction   │
│ • Solana base balance → ephemeral rollup  │
└────────────────────────────────────────────┘
                     ↓
┌────────────────────────────────────────────┐
│ 2. Transfer / Swap                        │
├────────────────────────────────────────────┤
│ • Build SPL transfer or swap              │
│ • base/ephemeral → base/ephemeral         │
│ • public or private (delayed + split)     │
└────────────────────────────────────────────┘
                     ↓
┌────────────────────────────────────────────┐
│ 3. Withdraw                               │
├────────────────────────────────────────────┤
│ • Build an unsigned withdrawal            │
│ • ephemeral rollup → Solana base balance  │
└────────────────────────────────────────────┘
​
Auth Flow
Endpoints that read private data inside the Private Ephemeral Rollup require a bearer token:
GET /v1/spl/challenge?pubkey=<wallet> returns a challenge string
The wallet signs the challenge
POST /v1/spl/login with { pubkey, challenge, signature } returns a token
Pass Authorization: Bearer <token> on /v1/spl/private-balance (required) and on /v1/spl/transfer requests that need to connect to the Private Ephemeral Rollup (optional)
​
Response Format
Successful transaction-building endpoints return an unsigned transaction payload:
{
  "kind": "deposit",
  "version": "legacy",
  "transactionBase64": "base64-encoded-transaction",
  "sendTo": "base",
  "recentBlockhash": "blockhash",
  "lastValidBlockHeight": 284512337,
  "instructionCount": 3,
  "requiredSigners": ["3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"]
}
The expected client flow is:
Call the API
Decode transactionBase64
Optionally adjust the transaction if the client needs to
Sign with the required wallet(s)
Send to the RPC indicated by sendTo ("base" or "ephemeral")


Health
GET
/
health

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Response
200 - application/json
Health check

​
status
enum<string>required
Available options: ok 
Health

curl --request GET \
  --url https://payments.magicblock.app/health

200
{
  "status": "ok"
}


Private Payments API
Challenge
Returns a challenge string that the wallet must sign. The signature is then submitted to /v1/spl/login in exchange for a bearer token used to read private data.

GET
/
v1
/
spl
/
challenge

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Query Parameters
​
pubkey
stringrequired
The public key of the wallet that will read private data.

Example:
"Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L"

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

​
mock
boolean
Optional. When true, the API uses a mock challenge for testing. Defaults to false.

Example:
false

Response

200

application/json
Challenge string

​
challenge
stringrequired
The challenge string generated by the Private Ephemeral Rollup.

const options = {method: 'GET'};

fetch('https://payments.magicblock.app/v1/spl/challenge', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

200
{
  "challenge": "1234567890"
}


Login
Verifies the wallet’s signature over the challenge issued by /v1/spl/challenge and returns an authentication token. Pass the token as Authorization: Bearer <token> on /v1/spl/private-balance and on /v1/spl/transfer requests that need to connect to the Private Ephemeral Rollup.

POST
/
v1
/
spl
/
login

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Body
application/json
​
pubkey
stringrequired
The public key of the wallet that will read private data.

Example:
"Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L"

​
challenge
stringrequired
The challenge string returned by /v1/spl/challenge.

Example:
"1234567890"

​
signature
stringrequired
The wallet's signature over the challenge string.

Example:
"1234567890"

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

​
mock
boolean
Optional. When true, the API uses a mock login flow for testing. Defaults to false.

Example:
false

Response

200

application/json
Authentication token

​
token
stringrequired
The authentication token provided by the Private Ephemeral Rollup.


onst options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    pubkey: 'Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L',
    challenge: '1234567890',
    signature: '1234567890'
  })
};

fetch('https://payments.magicblock.app/v1/spl/login', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

200
{
  "token": "1234567890"
}




Deposit SPL Tokens
Wraps the SDK delegateSpl(...) flow. The API generates shuttleId server-side and pins escrowIndex to 0.

POST
/
v1
/
spl
/
deposit

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Body
application/json
​
owner
stringrequired
Example:
"3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"

​
amount
integerrequired
Base-unit amount as an integer JSON value with minimum 1.

Required range: x >= 1
Example:
1

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

​
mint
string
Optional. Defaults to Solana USDC on mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. On devnet it defaults to devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
validator
string
Optional. Defaults to the selected ephemeral RPC identity resolved via getIdentity.

Example:
"MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"

​
initIfMissing
boolean
Optional. Initialize the transfer queue if missing.

​
initVaultIfMissing
boolean
Optional. Initialize the vault if missing.

​
initAtasIfMissing
boolean
Optional. Initialize associated token accounts if missing.

​
idempotent
boolean
Optional. When true, the API uses idempotent variants for any preparatory init instructions.

Response

200

application/json
Unsigned serialized transaction

​
kind
enum<string>required
Available options: deposit 
​
version
enum<string>required
Available options: legacy, v0 
​
transactionBase64
stringrequired
​
sendTo
enum<string>required
Available options: base, ephemeral 
​
recentBlockhash
stringrequired
​
lastValidBlockHeight
integerrequired
​
instructionCount
integerrequired
Required range: x >= 0
​
requiredSigners
string[]required
​
validator
string

const options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    owner: '3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE',
    amount: 1,
    initIfMissing: true,
    initVaultIfMissing: true,
    initAtasIfMissing: true,
    idempotent: true
  })
};

fetch('https://payments.magicblock.app/v1/spl/deposit', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


{
  "kind": "deposit",
  "version": "legacy",
  "transactionBase64": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAIDKmcfsS5XfSOLaLlaBHJry50iH2Ufk2TMz4STC2fHzIcFKkerg3q2DD3Yn8TISmGeKoxSLz+BiP7iQ4pYqXYXsgu8D8C7R8ovdMQRLpSrE8+jxjTl3BfqywPNGiPNfnh8eS+smowIxqKDcCjw5liNXQkkCbBSDCBDFwtrgCKqoQ0DAgEBBAECAwQCAQEEAgIDBAIBAQQDAgME",
  "sendTo": "base",
  "recentBlockhash": "9A4VhP8M8fQZxP4h7rB6mP6eM8w2pJkYh7QdZk7V4r2x",
  "lastValidBlockHeight": 284512337,
  "instructionCount": 3,
  "requiredSigners": [
    "3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"
  ],
  "validator": "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"
}


Transfer SPL Tokens
Transfer SPL tokens publicly or privately through an ephemeral rollup. Accepts an optional Authorization: Bearer <token> header obtained from the /v1/spl/login flow when the request needs to read or write data inside the Private Ephemeral Rollup.

POST
/
v1
/
spl
/
transfer

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Headers
​
authorization
string
Optional. Authentication token for requests that need to connect to the Private Ephemeral Rollup. Format: Bearer <token>.

Example:
"Bearer 1234567890"

Body
application/json
​
from
stringrequired
Sender wallet pubkey.

Example:
"3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"

​
to
stringrequired
Recipient wallet pubkey.

Example:
"Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L"

​
mint
stringrequired
SPL mint pubkey.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
amount
integerrequired
Base-unit amount as an integer JSON value with minimum 1.

Required range: x >= 1
Example:
1000000

​
visibility
enum<string>required
Use public for a transparent SPL transfer or private to route through the Private Ephemeral Rollup.

Available options: public, private 
​
fromBalance
enum<string>required
Where the sender's balance is held. Drives which RPC the API uses for blockhash and where the client should submit.

Available options: base, ephemeral 
​
toBalance
enum<string>required
Where the recipient should receive the funds.

Available options: base, ephemeral 
​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

​
validator
string
Optional. When this transfer route needs a validator and none is provided, the API resolves it from the selected ephemeral RPC via getIdentity.

Example:
"MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"

​
initIfMissing
boolean
Optional. Initialize the transfer queue if missing.

​
initAtasIfMissing
boolean
Optional. Initialize associated token accounts if missing.

​
initVaultIfMissing
boolean
Optional. Initialize the vault if missing. Defaults to false.

​
memo
string
Optional. Appends a final Memo Program instruction with this UTF-8 message.

Example:
"Order #1042"

​
minDelayMs
string
Optional. Private transfer only. Defaults to 0. Earliest (ms) the queued transfer may settle.

Pattern: ^\d+$
Example:
"0"

​
maxDelayMs
string
Optional. Private transfer only. Defaults to 0 when omitted, or to minDelayMs when only minDelayMs is set. Must be >= minDelayMs.

Pattern: ^\d+$
Example:
"0"

​
clientRefId
string
Optional. Private transfer only. Encrypted client reference ID that can be used to confirm a payment.

Pattern: ^\d+$
Example:
"42"

​
split
integer
Optional. Private transfer only. Defaults to 1. Number of queue entries to split the transfer across. Must be between 1 and 15 and cannot exceed amount.

Required range: x <= 15
Example:
1

​
gasless
boolean
Optional. When true, the API uses the configured sponsor as transaction fee payer and prepends a relay-fee token transfer to the sponsor ATA.

Example:
true

​
legacy
boolean
Optional. Defaults to false. When true, skips lookup-table compilation and returns a legacy transaction. Private base -> base transfers may otherwise return a v0 transaction when a useful lookup table is configured.

Response

200

application/json
Unsigned serialized transaction

​
kind
enum<string>required
Available options: transfer 
​
version
enum<string>required
Available options: legacy, v0 
​
transactionBase64
stringrequired
​
sendTo
enum<string>required
Available options: base, ephemeral 
​
recentBlockhash
stringrequired
​
lastValidBlockHeight
integerrequired
​
instructionCount
integerrequired
Required range: x >= 0
​
requiredSigners
string[]required
​
validator
string

const options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    from: '3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE',
    to: 'Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: 1000000,
    visibility: 'private',
    fromBalance: 'base',
    toBalance: 'base',
    initIfMissing: true,
    initAtasIfMissing: true,
    initVaultIfMissing: false,
    memo: 'Order #1042',
    minDelayMs: '0',
    maxDelayMs: '0',
    clientRefId: '42',
    split: 1,
    gasless: true
  })
};

fetch('https://payments.magicblock.app/v1/spl/transfer', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

  {
  "kind": "transfer",
  "version": "legacy",
  "transactionBase64": "<string>",
  "sendTo": "base",
  "recentBlockhash": "<string>",
  "lastValidBlockHeight": 123,
  "instructionCount": 1,
  "requiredSigners": [
    "<string>"
  ],
  "validator": "<string>"
}



Private Payments API
Withdraw SPL Tokens
Wraps the SDK withdrawSpl(...) flow. The API generates shuttleId server-side.

POST
/
v1
/
spl
/
withdraw

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Body
application/json
​
owner
stringrequired
Example:
"3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"

​
mint
stringrequired
SPL mint on Solana.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
amount
integerrequired
Base-unit amount as an integer JSON value with minimum 1.

Required range: x >= 1
Example:
1000000

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

​
validator
string
Optional. Defaults to the selected ephemeral RPC identity resolved via getIdentity.

Example:
"MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"

​
initIfMissing
boolean
Optional. Initialize the transfer queue if missing.

​
initAtasIfMissing
boolean
Optional. Initialize associated token accounts if missing.

​
escrowIndex
integer
Optional. Escrow index for the withdrawal.

Required range: x >= 0
​
idempotent
boolean
Optional. When true, the API uses idempotent variants for any preparatory init instructions.

Response

200

application/json
Unsigned serialized transaction

​
kind
enum<string>required
Available options: withdraw 
​
version
enum<string>required
Available options: legacy, v0 
​
transactionBase64
stringrequired
​
sendTo
enum<string>required
Available options: base, ephemeral 
​
recentBlockhash
stringrequired
​
lastValidBlockHeight
integerrequired
​
instructionCount
integerrequired
Required range: x >= 0
​
requiredSigners
string[]required
​
validator
string

const options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    owner: '3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: 1000000,
    idempotent: true
  })
};

fetch('https://payments.magicblock.app/v1/spl/withdraw', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


  {
  "kind": "withdraw",
  "version": "legacy",
  "transactionBase64": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAIDKmcfsS5XfSOLaLlaBHJry50iH2Ufk2TMz4STC2fHzIcFKkerg3q2DD3Yn8TISmGeKoxSLz+BiP7iQ4pYqXYXsgu8D8C7R8ovdMQRLpSrE8+jxjTl3BfqywPNGiPNfnh8AazZ0ixOauLjpxaRgDCv6MChaoMAZAJg8BnPbZl31jECAgEBBAECAwQCAQEEAgIDBA==",
  "sendTo": "base",
  "recentBlockhash": "7YH7nE6qj8vH3L9pR5uM2cD1xK4sT8wQ6bN3fJ2mP9z",
  "lastValidBlockHeight": 284512451,
  "instructionCount": 2,
  "requiredSigners": [
    "3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"
  ],
  "validator": "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"
}



Swap
Build an unsigned swap transaction from a quote.

Visibility modes:

visibility: "public" (default) — pure pass-through to the Jupiter/Metis upstream. The returned transaction is whatever the upstream produces.
visibility: "private" — the server forces Jupiter’s output into a program-owned stash ATA (deterministically derived from (userPublicKey, quoteResponse.outputMint)), prepends an idempotent ATA-create, and appends a schedule_private_transfer instruction that registers a one-shot Hydra crank. When the crank fires, it self-CPIs into the on-chain private-transfer flow to deliver the swapped tokens to destination with the requested delay/split policy. The returned transaction is a v0 VersionedTransaction that is still unsigned — the client signs and submits.
When visibility = "private", the fields destination, minDelayMs, maxDelayMs, and split are required. clientRefId and validator are optional. Explicitly setting destinationTokenAccount to anything other than the server-derived stash ATA returns 400.

POST
/
v1
/
swap
/
swap

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Body
application/json
​
userPublicKey
stringrequired
Public key of the wallet that will sign the swap transaction.

Example:
"3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"

​
quoteResponse
objectrequired
Quote response from GET /v1/swap/quote.

​
payer
string
Optional fee payer for transaction fees and rent.

Example:
"3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE"

​
wrapAndUnwrapSol
boolean
Automatically wrap and unwrap native SOL when needed.

Example:
true

​
useSharedAccounts
boolean
Allow shared accounts for intermediate routing state.

Example:
true

​
feeAccount
string
Optional initialized token account used to collect platform fees.

​
trackingAccount
string
Optional public key used for downstream transaction tracking.

​
prioritizationFeeLamports

integer
integer
Optional priority fee configuration or fixed lamport amount.

Required range: x >= 0
​
asLegacyTransaction
boolean
Build a legacy transaction instead of a versioned one. Not allowed when visibility = "private".

​
destinationTokenAccount
string
Optional destination token account for the output mint. When visibility = "private", this is server-controlled and must match the derived stash ATA.

​
nativeDestinationAccount
string
Optional destination account for native SOL output. Not supported when visibility = "private".

​
dynamicComputeUnitLimit
boolean
Estimate compute usage and set the compute unit limit automatically.

​
skipUserAccountsRpcCalls
boolean
Skip extra RPC checks for required user accounts.

​
dynamicSlippage
boolean
Let the upstream swap builder overwrite slippage on the transaction.

​
computeUnitPriceMicroLamports
integer
Optional exact compute unit price in micro-lamports.

Required range: x >= 0
​
blockhashSlotsToExpiry
integer
Optional transaction expiry window in slots.

Required range: x >= 0
​
positiveSlippage
object
Optional positive slippage collection settings.

​
visibility
enum<string>
public (default) proxies Jupiter/Metis as-is. private routes the output through a scheduled private transfer.

Available options: public, private 
Example:
"public"

​
destination
string
Final private-transfer recipient (wallet pubkey). Required when visibility = "private".

​
minDelayMs
string
Earliest (ms) the queued transfer may settle. Required when visibility = "private".

Pattern: ^\d+$
Example:
"0"

​
maxDelayMs
string
Latest (ms) the queued transfer may settle. Required when visibility = "private". Must be >= minDelayMs and <= 600000 (10 minutes).

Pattern: ^\d+$
Example:
"60000"

​
split
integer
Number of queue entries to split the transfer across. Required when visibility = "private". Must be between 1 and 14.

Required range: 1 <= x <= 14
​
clientRefId
string
Optional u64 client correlation id attached to each queued split.

Pattern: ^\d+$
​
validator
string
Optional validator pubkey for the transfer-queue PDA. Defaults to the well-known MagicBlock validator (MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57).

Response

200

application/json
Swap transaction

​
swapTransaction
stringrequired
Base64-encoded unsigned transaction.

​
lastValidBlockHeight
integer
Required range: x >= 0
​
prioritizationFeeLamports
integer
Required range: x >= 0
​
privateTransfer
object
Present only when visibility = "private". Diagnostic metadata about the appended schedule_private_transfer instruction.

Hide child attributes

​
privateTransfer.stashAta
stringrequired
​
privateTransfer.hydraCrankPda
stringrequired
​
privateTransfer.shuttleId
integerrequired
Required range: x >= 0


curl --request POST \
  --url https://payments.magicblock.app/v1/swap/swap \
  --header 'Content-Type: application/json' \
  --data '
{
  "userPublicKey": "3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE",
  "quoteResponse": {
    "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inAmount": "1000000",
    "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    "outAmount": "999519",
    "otherAmountThreshold": "994522",
    "swapMode": "ExactIn",
    "slippageBps": 50,
    "priceImpactPct": "0",
    "routePlan": []
  }
}
'


{
  "swapTransaction": "AQABA...base64...",
  "lastValidBlockHeight": 318120000
}



Swap Quote
Returns a swap quote between two SPL mints. The quote response can be passed as-is into POST /v1/swap/swap to build the swap transaction.

GET
/
v1
/
swap
/
quote

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Query Parameters
​
inputMint
stringrequired
Input token mint address.

Example:
"So11111111111111111111111111111111111111112"

​
outputMint
stringrequired
Output token mint address.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
amount
stringrequired
Raw amount to swap before decimals are applied, as an unsigned integer string.

Pattern: ^\d+$
Example:
"1000000"

​
slippageBps
integer
Slippage threshold in basis points.

Required range: x >= 0
Example:
50

​
swapMode
enum<string>
Use ExactIn for fixed input amount or ExactOut for fixed output amount.

Available options: ExactIn, ExactOut 
Example:
"ExactIn"

​
dexes
string
Optional comma-separated list of DEX labels to include.

Example:
"Raydium,Orca+V2"

​
excludeDexes
string
Optional comma-separated list of DEX labels to exclude.

Example:
"Meteora+DLMM"

​
restrictIntermediateTokens
boolean
Restrict intermediate tokens to a more stable set.

Example:
true

​
onlyDirectRoutes
boolean
Limit routing to a single hop.

Example:
false

​
asLegacyTransaction
boolean
Request a legacy transaction-compatible route.

Example:
false

​
platformFeeBps
integer
Optional platform fee in basis points.

Required range: x >= 0
Example:
20

​
maxAccounts
integer
Approximate maximum account budget for the route.

Required range: x >= 0
Example:
64

​
instructionVersion
enum<string>
Instruction format to target.

Available options: V1, V2 
Example:
"V1"

​
dynamicSlippage
boolean
Keep for compatibility with upstream quote parameters.

Example:
false

​
forJitoBundle
boolean
Exclude routes that are incompatible with Jito bundles.

Example:
false

​
supportDynamicIntermediateTokens
boolean
Allow dynamic selection of intermediate tokens.

Example:
false

Response

200

application/json
Swap quote

​
inputMint
stringrequired
​
inAmount
stringrequired
​
outputMint
stringrequired
​
outAmount
stringrequired
​
otherAmountThreshold
stringrequired
​
swapMode
enum<string>required
Available options: ExactIn, ExactOut 
​
slippageBps
integerrequired
Required range: x >= 0
​
priceImpactPct
stringrequired
​
routePlan
object[]required
Show child attributes

​
instructionVersion
enum<string> | null
Available options: V1, V2, null 
​
platformFee
object
​
contextSlot
integer
Required range: x >= 0
​
timeTaken
number


const options = {method: 'GET'};

fetch('https://payments.magicblock.app/v1/swap/quote', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


  {
  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inAmount": "1000000",
  "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "outAmount": "999519",
  "otherAmountThreshold": "994522",
  "swapMode": "ExactIn",
  "slippageBps": 50,
  "priceImpactPct": "0",
  "routePlan": [
    {
      "swapInfo": {
        "ammKey": "DB3sUCP2H4icbeKmK6yb6nUxU5ogbcRHtGuq7W2RoRwW",
        "label": "HumidiFi",
        "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "outputMint": "So11111111111111111111111111111111111111112",
        "inAmount": "1000000",
        "outAmount": "11687625"
      },
      "percent": 100,
      "bps": null
    },
    {
      "swapInfo": {
        "ammKey": "4rJggoVMajEUtipev1XhSMjESYk8Zibz6CDHPtUe1mem",
        "label": "GoonFi V2",
        "inputMint": "So11111111111111111111111111111111111111112",
        "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "inAmount": "11687625",
        "outAmount": "999519"
      },
      "percent": 100,
      "bps": null
    }
  ],
  "contextSlot": 414697033,
  "timeTaken": 0.001218
}



Balance
Reads the owner’s associated token account on the base RPC.

GET
/
v1
/
spl
/
balance

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Query Parameters
​
address
stringrequired
Owner wallet pubkey.

Example:
"Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L"

​
mint
stringrequired
SPL mint pubkey.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

Response

200

application/json
Base-chain token balance

​
address
stringrequired
​
mint
stringrequired
​
ata
stringrequired
​
location
enum<string>required
Available options: base, ephemeral 
​
balance
stringrequired
Base-unit balance as a string.



const options = {method: 'GET'};

fetch('https://payments.magicblock.app/v1/spl/balance', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


  {
  "address": "Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L",
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "ata": "3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE",
  "location": "base",
  "balance": "1000000"
}


Reads the owner’s associated token account on the ephemeral RPC. Requires an Authorization: Bearer <token> header obtained from /v1/spl/login.

GET
/
v1
/
spl
/
private-balance

Try it
Documentation Index
Fetch the complete documentation index at: https://docs.magicblock.gg/llms.txt

Use this file to discover all available pages before exploring further.

Headers
​
authorization
stringrequired
Required. Authentication token issued by /v1/spl/login. Format: Bearer <token>.

Example:
"Bearer 1234567890"

Query Parameters
​
address
stringrequired
Owner wallet pubkey.

Example:
"Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L"

​
mint
stringrequired
SPL mint pubkey.

Example:
"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

​
cluster

enum<string>
enum<string>
Optional. Use mainnet for BASE_RPC_URL and EPHEMERAL_RPC_URL, devnet for BASE_DEVNET_RPC_URL and EPHEMERAL_DEVNET_RPC_URL, or provide a custom http(s) RPC URL to override the base RPC while keeping the configured ephemeral RPC.

Available options: mainnet, devnet 
Example:
"mainnet"

Response

200

application/json
Ephemeral token balance

​
address
stringrequired
​
mint
stringrequired
​
ata
stringrequired
​
location
enum<string>required
Available options: base, ephemeral 
​
balance
stringrequired
Base-unit balance as a string.


const options = {method: 'GET', headers: {authorization: '<authorization>'}};

fetch('https://payments.magicblock.app/v1/spl/private-balance', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


  {
  "address": "Bt9oNR5cCtnfuMmXgWELd6q5i974PdEMQDUE55nBC57L",
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "ata": "3rXKwQ1kpjBd5tdcco32qsvqUh1BnZjcYnS5kYrP7AYE",
  "location": "ephemeral",
  "balance": "1000000"
}



