# Dextopus Deposit API

> Cross-chain crypto deposit API with instant settlement. Send crypto on any chain, receive on any chain — powered by deposit addresses.

Dextopus provides a simple deposit-based cross-chain routing API. Users send crypto to a unique deposit address, and Dextopus automatically bridges and settles to the destination chain and token. No wallet signatures or frontend interactions required.

**Key Features:**

- **One-time deposit addresses** for single transactions
- **Static deposit addresses** for reusable wallets (save once, use forever)
- **Multi-chain support** including Ethereum, Solana, Base, Arbitrum, Polygon, Optimism, BSC, Avalanche, NEAR, Tron, Bitcoin
- **Automatic bridging** and settlement to any supported destination
- **Webhook notifications** for real-time deposit tracking
- **Partner fees** for monetizing integrations

**Production API:** `https://swap-api.dextopus.com`

## Recent Improvements (June 2026)

### 🔄 Provider-Agnostic Field Names (Breaking Change)

**Field name changes in webhooks and API responses:**

- **Renamed**: `relayRequestId` → `requestId`
- **Removed**: `relayStatus` field (use `status` instead)

This change abstracts away the underlying provider and makes the API more generic.

**What changed:**

- Webhook payloads now use `requestId` instead of `relayRequestId`
- API endpoint: `GET /deposit/static/deposits/:requestId` (was `:relayRequestId`)
- Query deposits by request ID without knowing the provider

**Example webhook payload (new):**

```json
{
  "event": "deposit.completed",
  "data": {
    "depositId": "dep_123",
    "userId": "user_456",
    "status": "COMPLETED",
    "requestId": "0x1234567890abcdef...",
    "settlementAmount": "990000"
  }
}
```

**Example webhook payload (old):**

```json
{
  "event": "deposit.completed",
  "data": {
    "depositId": "dep_123",
    "userId": "user_456",
    "status": "COMPLETED",
    "relayStatus": "success",
    "relayRequestId": "0x1234567890abcdef...",
    "settlementAmount": "990000"
  }
}
```

**Migration guide:**

- Update webhook handlers to use `requestId` instead of `relayRequestId`
- Use `status` field instead of `relayStatus`
- Update queries to use `/deposits/:requestId` endpoint

### 🔍 Query Deposits by Request ID

**New endpoint:** `GET /deposit/static/deposits/:requestId`

Query complete deposit details using the request ID from webhook payloads. Especially useful when:

- Webhook shows `settlementAmount: null` for a COMPLETED deposit
- You need to verify final settlement amounts
- You're debugging deposit issues

**Example usage:**

```typescript
// When webhook has null settlementAmount
const { requestId, settlementAmount, status } = webhookPayload;

if (!settlementAmount && status === "COMPLETED") {
  const response = await fetch(
    `https://swap-api.dextopus.com/api/deposit/static/deposits/${requestId}`,
    { headers: { "x-api-key": apiKey } },
  );
  const { data } = await response.json();
  console.log("Settlement:", data.settlementAmount);
}
```

See [GET /deposit/static/deposits/:requestId](#get-depositstaticdepositsrequestid) for full documentation.

### 🛡️ Settlement Amount Reliability Improvements

Enhanced logging and retry logic to prevent null settlement amounts in webhooks:

**Retry logic:**

- Automatically retries failed API calls once (with 1s delay)
- Handles 5xx server errors, 429 rate limits, and network timeouts
- Re-extracts amounts after successful retry

**Enhanced logging:**

- Detailed diagnostics when settlement amount is missing
- Tracks which fields are missing from provider response
- CRITICAL error when COMPLETED deposit has null settlement amount
- Helps identify root cause of missing data

**When settlement amount can be null:**

1. **PENDING deposits** (expected) - Swap not yet completed
2. **Transient API failures** (now retried automatically)
3. **Missing route data** (logged for investigation)

**For integrators:**

- Use the new `GET /deposits/:requestId` endpoint to query missing amounts
- COMPLETED deposits should never have null settlement amounts
- If you receive null amounts for COMPLETED status, query the endpoint or contact support

### 🔐 Address Format Validation

Added early validation to catch common integration errors:

**Origin asset validation:**

- Detects when EVM addresses (0x...) are used for Bitcoin/Solana deposits
- Detects when Bitcoin/Solana addresses are used for EVM deposits
- Returns clear error messages before calling provider API

**Refund address validation:**

- Validates refund address format matches origin chain type
- Catches EVM addresses used for Solana refunds (and vice versa)
- Provides examples of correct address formats in error messages

**Example error:**

```json
{
  "success": false,
  "error": "InvalidOriginAsset",
  "message": "The origin asset '0x833...' is an EVM address, but you're trying to use it on Bitcoin (chain 8253038). For Bitcoin deposits, the originAsset must be a Bitcoin address (e.g., 'bc1qqq...' for native BTC). If you want to deposit USDC, you should use a chain that supports USDC tokens like Base (8453), Ethereum (1), or other EVM chains.",
  "details": {
    "originChainId": 8253038,
    "providedAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "expectedFormat": "Bitcoin address (bc1... or 1... or 3...)"
  }
}
```

### 🔒 Integration ID Isolation

**CRITICAL FIX:** Webhook logs and configurations are now properly isolated by `integrationId` instead of `merchantId`. This ensures that:

- Multiple integrations from the same merchant see only their own data
- Webhook delivery logs are filtered by integration
- Each integration has its own webhook configuration
- No data leakage between integrations

**Impact:** If you have multiple integrations, you'll now see only the data relevant to each specific API key.

### 💰 Enhanced Webhook Payloads with USD Amounts

Webhook payloads now include comprehensive amount information extracted from Relay API v2:

**New fields in webhook payloads:**

- `originAmountFormatted`: Human-readable deposit amount (e.g., "3.5" instead of "3500000")
- `originAmountUsd`: USD value of deposit (e.g., "3.498681")
- `settlementAmountFormatted`: Human-readable settlement amount (e.g., "3.471289")
- `settlementAmountUsd`: USD value received after fees (e.g., "3.469980")

**Example webhook payload:**

```json
{
  "event": "deposit.completed",
  "data": {
    "originAmount": "3500000",
    "originAmountFormatted": "3.5",
    "originAmountUsd": "3.498681",
    "settlementAmount": "3471289",
    "settlementAmountFormatted": "3.471289",
    "settlementAmountUsd": "3.469980",
    "status": "COMPLETED"
  }
}
```

**Benefits:**

- No need to handle decimal conversions yourself
- USD values for accounting and reporting
- Clear visibility into fees (compare origin vs settlement amounts)
- All amount formats in a single webhook

### ✅ Accurate Settlement Amounts

Settlement amounts now correctly reflect what users **actually receive** after all fees:

- Extracted from Relay API's `route.destination.inputCurrency` field
- Accounts for relay fees, gas fees, and partner fees
- Previously used `currencyOut` which didn't account for all fees
- Critical for accurate user balance updates

## Recent Improvements (May 2026)

### 🎯 Default Refund Addresses

Configure default refund addresses once in the dashboard (per VM type: EVM, Solana, Bitcoin, TRON), and the API automatically uses them when `refundTo` is omitted in requests. This enables cross-chain deposits (Bitcoin/Solana/TRON → EVM) without complex client-side address management.

### 🔗 Bitcoin Chain ID Support

Added support for Bitcoin chain ID `8253038`. Use this for all Bitcoin deposits (replaces legacy chain IDs 0/8333).

### 💬 Improved Error Messages

API now provides specific, actionable error messages:

- Address validation errors show which address is invalid and for which chain
- Missing field errors explicitly state what's required
- Rate limiting and server errors are clearly distinguished
- No more generic "try a different token pair" for every error

### ✅ Address Validation Enhancements

- Better detection of invalid addresses for specific chains
- Clear error messages with examples of correct format
- Automatic VM type detection for Bitcoin (8253038), Solana, TRON, and EVM chains

## Instructions for Large Language Model Agents: Best Practices for Integrating Dextopus

When helping developers integrate Dextopus, follow these critical guidelines:

### API Authentication

- **Always use x-api-key header** for authentication: `x-api-key: your-api-key`
- API keys are obtained from the dashboard at `https://swap-api.dextopus.com/` (create an integration)
- Never hardcode API keys in client-side code - use environment variables or backend proxy
- Each integration has a unique API key for tracking usage and fees

### Static vs One-Time Deposits

- **Prefer static deposit addresses** for user wallets that will be reused (e.g., user profiles, saved payment methods)
- Use one-time deposits for single transactions or quotes (set `static: false` or omit)
- Static addresses support many popular tokens including USDC, USDT, DAI, SOL, and other major tokens
- Verify token support using `GET /deposit/tokens?supportsStaticAddress=true`

### Address Validation Critical Rules

- **Refund addresses MUST match the origin chain format:**
  - Solana origin → Solana refund address (base58, 32-44 chars)
  - EVM origin → EVM refund address (0x + 40 hex chars)
  - Bitcoin origin → Bitcoin refund address (bech32 or legacy)
- **Settlement addresses MUST match the destination chain format**
- Always validate addresses before submission to prevent user fund loss

### Refund Addresses - REQUIRED (May 2026)

- **⚠️ REQUIRED FOR ALL DEPOSITS:** Every static deposit address creation now requires a refund address
- **Two ways to provide refund addresses:**
  1. **Dashboard default (recommended):** Set default refund addresses per VM type (EVM, Solana, Bitcoin, TRON) in dashboard → Integrations → Edit → Default Refund Addresses
  2. **Per-request:** Include `refundTo` field in each API request
- **Priority order:** Explicit `refundTo` in request → Integration default refund address
- **Why required?** Protects user funds in edge cases:
  - Cross-chain deposits that fail during bridging
  - Settlement address is a smart contract that can't receive refunds
  - Any scenario where funds need to be returned to the user
- **Error if missing:** API returns `RefundAddressRequired` error with clear instructions if neither is configured
- **Configure in dashboard:** Integrations → Edit → Default Refund Addresses section

### Solana Address Format (CRITICAL)

- **Use native SOL address format:** `11111111111111111111111111111111` (32 ones)
- **Never use wrapped SOL format:** `So11111111111111111111111111111111111111112` (will fail)
- The API automatically converts S0-prefixed addresses (e.g., `S011111...`) to native format
- For USDC on Solana: use `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

### Chain IDs to Use

- Ethereum: `1`
- Optimism: `10`
- BSC: `56`
- Polygon: `137`
- Base: `8453`
- Arbitrum: `42161`
- Avalanche: `43114`
- Solana: `792703809`
- Bitcoin: `8253038` (NEW - recommended for Bitcoin deposits)
- TRON: `728126428`

### Webhook Best Practices

- **Always configure webhooks** for production integrations to track deposit status
- Webhook URLs must be HTTPS in production
- Verify webhook signatures using the provided secret
- Handle all webhook events: `deposit.created`, `deposit.completed`, `deposit.failed`, `deposit.refunded`
- Set up webhook endpoint BEFORE generating static addresses

### Amount Formatting

- All amounts are in **smallest unit** (wei, lamports, satoshis)
- USDC has 6 decimals: `1000000` = 1 USDC
- ETH has 18 decimals: `1000000000000000000` = 1 ETH
- SOL has 9 decimals: `1000000000` = 1 SOL

**NEW (June 2026):** Webhook payloads now include formatted and USD amounts:

- `originAmountFormatted` / `settlementAmountFormatted`: Human-readable amounts with decimals (e.g., "3.5")
- `originAmountUsd` / `settlementAmountUsd`: USD value of amounts (e.g., "3.498681")
- No manual decimal conversion needed - use formatted amounts directly in your UI

### Error Handling (Improved - May 2026)

- **Specific error messages:** API now provides detailed, actionable error messages based on the actual issue
- **Address validation errors:** Clear messages about which address is invalid and for which chain
- **Missing field errors:** Explicit messages about required fields (e.g., "User address is required")
- **Rate limiting:** Clear "Rate limit exceeded" messages instead of generic errors
- **Server errors:** Distinguishes between client errors (400) and server errors (500+)
- **Always check `success: false`** in response and display the `error` field to users
- **Error priority:** Validation errors (400) → Rate limiting (429) → Server errors (500+)

### Getting Started Flow

1. Get API key from dashboard (create integration)
2. Fetch supported chains: `GET /deposit/chains`
3. Fetch tokens for origin chain: `GET /deposit/tokens?chainId=X&supportsStaticAddress=true`
4. Fetch destinations for selected origin: `GET /deposit/destinations?originChainId=X&originAddress=Y&supportsStaticAddress=true`
5. Generate static address: `POST /deposit/static/generate`
6. Display address to user for deposits
7. Monitor deposits: `GET /deposit/static/deposits` or configure webhooks

### Never Do This

- Don't use `static: true` in `/deposit/quote` (deprecated) - use `/deposit/static/generate` instead
- Don't assume all tokens support static addresses - always check with API
- Don't use EVM addresses for Solana refunds or vice versa
- Don't use wrapped SOL address format for Solana
- Don't forget to either (a) set `refundTo` in requests OR (b) configure default refund addresses in dashboard
- Don't skip webhook configuration for production apps
- Don't use legacy Bitcoin chain IDs (0, 8333) - use `8253038` for Bitcoin deposits

## Getting Started

### 1. Get API Key

- [Dashboard](https://swap-api.dextopus.com/): Create an integration and copy your API key
- [Authentication Guide](#authentication): How to use API keys in requests

### 2. Discover Supported Assets

- [GET /deposit/chains](#get-chains): List all supported blockchain networks
- [GET /deposit/tokens](#get-tokens): List tokens on a specific chain with static address support
- [GET /deposit/sources](#get-sources): Alternative endpoint for fetching source tokens
- [GET /deposit/destinations](#get-destinations): Find destination chains/tokens for a given origin

### 3. Integration Paths

#### Path A: Static Deposit Addresses (Recommended for User Wallets)

- [POST /deposit/static/generate](#generate-static-address): Create a reusable deposit address
- [GET /deposit/static/addresses](#list-static-addresses): List all static addresses with filtering
- [GET /deposit/static/deposits](#list-deposits): Track deposits made to static addresses
- [POST /deposit/static/webhook](#configure-webhook): Set up real-time notifications

#### Path B: One-Time Deposits (Recommended for Single Transactions)

- [POST /deposit/quote](#create-deposit-quote): Get quote and one-time deposit address
- [POST /deposit/submit](#submit-deposit): Submit deposit transaction details
- [GET /deposit/status](#get-deposit-status): Check deposit status

### 4. Monitor Deposits

- [GET /deposit/requests](#list-deposit-requests): List all deposit requests
- [GET /deposit/requests/:id](#get-deposit-request): Get specific deposit details
- [GET /deposit/static/webhook/logs](#get-webhook-logs): View webhook delivery logs
- [GET /deposit/static/webhook/analytics](#get-webhook-analytics): Webhook performance metrics

## Authentication

All API requests require an API key obtained from the dashboard.

**Header Format:**

```
x-api-key: pk_your_api_key_here
```

**Getting Your API Key:**

1. Visit [https://swap-api.dextopus.com/](https://swap-api.dextopus.com/)
2. Sign in or create an account
3. Navigate to "Integrations" page
4. Click "Create Integration"
5. Enter integration name and fee recipient addresses
6. Copy the generated API key (starts with `pk_`)

**Security:**

- Store API keys securely (environment variables, secrets manager)
- Never commit API keys to version control
- Never expose API keys in client-side code
- Use backend proxy for client applications
- Rotate keys if compromised using dashboard

## Core Endpoints

### Discovery & Metadata

#### GET /deposit/chains

List all supported blockchain networks.

**Response:**

```json
{
  "success": true,
  "chains": [
    {
      "chainId": 1,
      "name": "Ethereum",
      "nativeToken": {
        "symbol": "ETH",
        "decimals": 18
      }
    }
  ]
}
```

#### GET /deposit/tokens

List all tokens on a specific chain. Use `supportsStaticAddress=true` to filter for tokens that support static deposit addresses.

**Query Parameters:**

- `chainId` (number, required): Chain ID to query
- `supportsStaticAddress` (boolean, optional): Filter for static address support

**Example:**

```
GET /deposit/tokens?chainId=792703809&supportsStaticAddress=true
```

**Response:**

```json
{
  "success": true,
  "chainId": 792703809,
  "tokens": [
    {
      "chainId": 792703809,
      "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoUrl": "https://...",
      "supportsStaticAddress": true
    }
  ]
}
```

#### GET /deposit/sources

Alternative endpoint for fetching source tokens (same as /deposit/tokens).

#### GET /deposit/destinations

Find available destination chains and tokens for a given origin chain and token.

**Query Parameters:**

- `originChainId` (number, required): Origin chain ID
- `originAddress` (string, required): Origin token address
- `supportsStaticAddress` (boolean, optional): Filter for static address support

**Example:**

```
GET /deposit/destinations?originChainId=792703809&originAddress=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&supportsStaticAddress=true
```

**Response:**

```json
{
  "success": true,
  "destinations": [
    {
      "destinationChainId": 8453,
      "blockchain": "base",
      "currency": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "symbol": "USDC",
      "decimals": 6,
      "supportsStaticAddress": true
    }
  ]
}
```

### Static Deposit Addresses (Reusable)

#### POST /deposit/static/generate

Generate a reusable static deposit address. Users can save this address and send multiple deposits to it.

**Aliases:**

- `POST /deposit/static/addresses` (same endpoint)

**Request Body:**

```json
{
  "userId": "user123",
  "originChainId": 792703809,
  "originAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "settlementChainId": 8453,
  "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "settlementAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "refundTo": "5LrznMTXfDBK4A7mzzZuGzwMVEu3nv2MLbtBE4dMsmc1",
  "metadata": {
    "custom": "data"
  }
}
```

**Fields:**

- `userId` (string, required): Your internal user identifier for tracking (can be UUID or email)
- `originChainId` (number, required): Source chain ID
- `originAsset` (string, required): Source token address
- `settlementChainId` (number, required): Destination chain ID
- `settlementAsset` (string, required): Destination token address
- `settlementAddress` (string, required): Final recipient address on destination chain
- `refundTo` (string, **required**): Refund address on origin chain if swap fails. **MUST match origin chain format.** If omitted from request, the API uses your integration's default refund address for that chain type (configured in dashboard → Integrations → Edit). **Either provide this field OR configure default refund addresses in dashboard - at least one is required.**
- `metadata` (object, optional): Custom JSON data for your tracking

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "addr_123abc",
    "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
    "originChainId": 792703809,
    "originAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "settlementChainId": 8453,
    "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "settlementAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "userId": "user123",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### GET /deposit/static/addresses

List all static deposit addresses for your integration, with optional filtering.

**Query Parameters:**

- `userId` (string, optional): Filter by user ID

**Example:**

```
GET /deposit/static/addresses?userId=user123
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "addr_123abc",
      "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
      "userId": "user123",
      "originChainId": 792703809,
      "settlementChainId": 8453,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

#### GET /deposit/static/deposits

List deposits made to your static addresses with filtering options.

**Query Parameters:**

- `userId` (string, optional): Filter by user ID
- `depositAddress` (string, optional): Filter by specific deposit address
- `status` (string, optional): Filter by status (pending, completed, failed, refunded)
- `limit` (number, optional): Max results to return (default: 50)
- `offset` (number, optional): Pagination offset

**Example:**

```
GET /deposit/static/deposits?userId=user123&status=completed
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "dep_456xyz",
      "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
      "status": "COMPLETED",
      "originAmount": "1000000",
      "originAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "settlementAmount": "990000",
      "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "originTxHash": "abc123...",
      "settlementTxHash": "def456...",
      "createdAt": "2024-01-15T10:35:00Z",
      "completedAt": "2024-01-15T10:37:00Z"
    }
  ],
  "count": 1
}
```

#### GET /deposit/static/deposits/:requestId

Get detailed information about a specific deposit by its request ID. Useful when settlement amounts are missing in webhooks.

**Use Cases:**

- Query complete deposit details when webhook shows null `settlementAmount`
- Verify final settlement amounts after deposit completion
- Debug deposit issues with support team

**Path Parameters:**

- `requestId` (string, required): The request ID from webhook payload

**Example:**

```
GET /deposit/static/deposits/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "dep_456xyz",
    "userId": "user123",
    "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
    "originChainId": 792703809,
    "originAmount": "1000000",
    "originAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "originTxHash": "abc123...",
    "settlementChainId": 8453,
    "settlementAmount": "990000",
    "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "settlementTxHash": "def456...",
    "status": "COMPLETED",
    "requestId": "0x1234567890abcdef...",
    "completedAt": "2024-01-15T10:37:00Z",
    "createdAt": "2024-01-15T10:35:00Z",
    "updatedAt": "2024-01-15T10:37:00Z",
    "merchantId": "merchant_789",
    "staticAddress": {
      "id": "addr_123abc",
      "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
      "originChainId": 792703809,
      "originAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "settlementChainId": 8453,
      "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "settlementAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "integrationId": "int_xyz"
    }
  }
}
```

**Error Responses:**

404 Not Found - Deposit doesn't exist:

```json
{
  "success": false,
  "error": "Deposit not found",
  "message": "No deposit found with relay request ID: 0x123..."
}
```

403 Forbidden - Deposit belongs to different integration:

```json
{
  "success": false,
  "error": "Forbidden",
  "message": "You do not have access to this deposit"
}
```

**When to Use:**

- Your webhook received `settlementAmount: null` for a `COMPLETED` deposit
- You need to verify the final amounts after a deposit completes
- You're debugging why a deposit shows unexpected values
- You want to fetch the most up-to-date deposit information

**Example Usage:**

```typescript
// From webhook payload
const { requestId, settlementAmount } = webhookPayload;

if (!settlementAmount && webhookPayload.status === "COMPLETED") {
  // Query the full deposit details
  const response = await fetch(
    `https://swap-api.dextopus.com/api/deposit/static/deposits/${requestId}`,
    {
      headers: {
        "x-api-key": process.env.DEXTOPUS_API_KEY,
      },
    },
  );

  const { data } = await response.json();
  console.log("Settlement amount:", data.settlementAmount);
}
```

### One-Time Deposits

#### POST /deposit/quote

Create a one-time deposit request and get a unique deposit address. Optionally get a quote without creating a request using `dry: true`.

**Request Body:**

```json
{
  "originChainId": 792703809,
  "destinationChainId": 8453,
  "originAsset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "destinationAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "1000000",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "refundTo": "5LrznMTXfDBK4A7mzzZuGzwMVEu3nv2MLbtBE4dMsmc1",
  "user": "user123",
  "slippageBps": 50,
  "dry": false,
  "partnerFees": [
    {
      "recipient": "0x1234...",
      "fee": 50
    }
  ]
}
```

**Fields:**

- `originChainId` (number, required): Source chain ID
- `destinationChainId` (number, required): Destination chain ID
- `originAsset` (string, required): Source token address
- `destinationAsset` (string, required): Destination token address
- `amount` (string, required): Amount in smallest unit
- `recipient` (string, required): Final recipient address
- `refundTo` (string, optional): Refund address on origin chain
- `user` (string, optional): User identifier
- `slippageBps` (number, optional): Slippage tolerance (100 = 1%, max 10000)
- `dry` (boolean, optional): Get quote without creating request
- `partnerFees` (array, optional): Partner fee configuration (EVM addresses only)

**Response:**

```json
{
  "success": true,
  "depositAddress": "5a3B8c9D2e1F4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V",
  "requestId": "req_789def",
  "estimatedOutput": "990000",
  "estimatedTime": "2-5 minutes",
  "expiresAt": "2024-01-15T11:00:00Z"
}
```

#### POST /deposit/submit

Submit deposit transaction details after user sends funds to the deposit address.

**Request Body:**

```json
{
  "requestId": "req_789def",
  "txHash": "abc123def456..."
}
```

#### GET /deposit/status

Check the status of a deposit request.

**Query Parameters:**

- `requestId` (string, required): Request ID from quote

**Example:**

```
GET /deposit/status?requestId=req_789def
```

**Response:**

```json
{
  "success": true,
  "status": "completed",
  "originTxHash": "abc123...",
  "destinationTxHash": "def456...",
  "progress": {
    "deposited": true,
    "bridged": true,
    "settled": true
  }
}
```

### Deposit Tracking

#### GET /deposit/requests

List all deposit requests for your integration.

**Query Parameters:**

- `limit` (number, optional): Max results (default: 50)
- `offset` (number, optional): Pagination offset
- `status` (string, optional): Filter by status

#### GET /deposit/requests/:id

Get detailed information about a specific deposit request.

**Example:**

```
GET /deposit/requests/req_789def
```

### Webhooks

#### POST /deposit/static/webhook

Configure webhook URL and events for real-time deposit notifications.

**Request Body:**

```json
{
  "webhookUrl": "https://your-app.com/webhooks/dextopus",
  "events": ["deposit.created", "deposit.completed", "deposit.failed"]
}
```

**Available Events:**

- `deposit.created`: New deposit detected
- `deposit.completed`: Deposit successfully settled
- `deposit.failed`: Deposit failed
- `deposit.refunded`: Deposit refunded to user

**Response:**

```json
{
  "success": true,
  "data": {
    "webhookUrl": "https://your-app.com/webhooks/dextopus",
    "events": ["deposit.created", "deposit.completed", "deposit.failed"],
    "secret": "whsec_abc123..."
  }
}
```

**Webhook Payload:**

```json
{
  "event": "deposit.completed",
  "timestamp": 1780528148295,
  "data": {
    "userId": "user123",
    "depositId": "dep_456xyz",
    "staticAddressId": "addr_123abc",
    "depositAddress": "5a3B8c9D...",
    "originChainId": 8453,
    "originAmount": "1000000",
    "originAmountFormatted": "1.0",
    "originAmountUsd": "0.999500",
    "originAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "originTxHash": "abc123...",
    "settlementChainId": 8453,
    "settlementAmount": "990000",
    "settlementAmountFormatted": "0.99",
    "settlementAmountUsd": "0.989505",
    "settlementAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "settlementTxHash": "def456...",
    "status": "COMPLETED",
    "requestId": "0x...",
    "metadata": {},
    "completedAt": "2024-01-15T10:37:00Z",
    "createdAt": "2024-01-15T10:35:00Z",
    "updatedAt": "2024-01-15T10:37:00Z"
  }
}
```

**Verifying Webhooks:**
Use the `secret` to verify webhook signatures in the `X-Webhook-Signature` header.

#### GET /deposit/static/webhook

Retrieve current webhook configuration.

#### POST /deposit/static/webhook/rotate-secret

Rotate webhook secret for security (rate limited to 5 per hour).

#### GET /deposit/static/webhook/logs

View webhook delivery logs and debug failed deliveries.

#### GET /deposit/static/webhook/analytics

Get webhook performance metrics and delivery statistics.

### Utilities

#### POST /deposit/validate-address

Validate an address format for a specific chain.

**Request Body:**

```json
{
  "chainId": 792703809,
  "address": "5LrznMTXfDBK4A7mzzZuGzwMVEu3nv2MLbtBE4dMsmc1"
}
```

**Response:**

```json
{
  "success": true,
  "valid": true,
  "chainId": 792703809,
  "addressType": "solana"
}
```

## Code Examples

### Example 1: Create Static USDC Deposit Address (Solana → Base)

**With explicit refundTo:**

```typescript
const response = await fetch(
  "https://swap-api.dextopus.com/api/deposit/static/generate",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.DEXTOPUS_API_KEY,
    },
    body: JSON.stringify({
      userId: "user_abc123",
      originChainId: 792703809, // Solana
      originAsset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      settlementChainId: 8453, // Base
      settlementAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      settlementAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // User's Base wallet
      refundTo: "5LrznMTXfDBK4A7mzzZuGzwMVEu3nv2MLbtBE4dMsmc1", // User's Solana wallet
    }),
  },
);

const data = await response.json();
console.log("Deposit Address:", data.data.depositAddress);
// User can now send USDC to this address on Solana anytime
```

**NEW: Using default refund addresses (no refundTo needed):**

```typescript
// First, configure default Solana refund address in dashboard:
// Dashboard → Integrations → Edit → Default Refund Addresses → Solana: 5Lrzn...

const response = await fetch(
  "https://swap-api.dextopus.com/api/deposit/static/generate",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.DEXTOPUS_API_KEY,
    },
    body: JSON.stringify({
      userId: "user_abc123",
      originChainId: 792703809, // Solana
      originAsset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      settlementChainId: 8453, // Base
      settlementAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      settlementAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      // refundTo omitted - API uses integration's default Solana address automatically
    }),
  },
);

const data = await response.json();
console.log("Deposit Address:", data.data.depositAddress);
// Refunds will go to the default Solana address configured in dashboard
```

### Example 2: Fetch Supported Tokens with Static Address Support

```typescript
const response = await fetch(
  "https://swap-api.dextopus.com/api/deposit/tokens?chainId=792703809&supportsStaticAddress=true",
  {
    headers: {
      "x-api-key": process.env.DEXTOPUS_API_KEY,
    },
  },
);

const data = await response.json();
console.log("Tokens:", data.tokens);
```

### Example 3: Configure Webhooks

```typescript
const response = await fetch(
  "https://swap-api.dextopus.com/api/deposit/static/webhook",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.DEXTOPUS_API_KEY,
    },
    body: JSON.stringify({
      webhookUrl: "https://your-app.com/api/webhooks/dextopus",
      events: ["deposit.created", "deposit.completed", "deposit.failed"],
    }),
  },
);

const data = await response.json();
console.log("Webhook Secret:", data.data.secret);
// Save this secret to verify webhook signatures
```

### Example 4: List User's Deposits

```typescript
const response = await fetch(
  "https://swap-api.dextopus.com/api/deposit/static/deposits?userId=user_abc123&status=completed",
  {
    headers: {
      "x-api-key": process.env.DEXTOPUS_API_KEY,
    },
  },
);

const data = await response.json();
console.log("Deposits:", data.data);
```

## Common Integration Patterns

### Pattern 1: User Wallet with Saved Deposit Address

1. Fetch supported tokens: `GET /deposit/tokens?supportsStaticAddress=true`
2. Generate static address: `POST /deposit/static/generate`
3. Save depositAddress in your database linked to user
4. Display address to user in their wallet/profile
5. Monitor deposits: `GET /deposit/static/deposits?userId=X` or webhooks

### Pattern 2: Payment Checkout Flow

1. User selects payment method and amount
2. Fetch destinations: `GET /deposit/destinations?originChainId=X&originAddress=Y`
3. Generate one-time quote: `POST /deposit/quote`
4. Display QR code with depositAddress
5. Monitor status: `GET /deposit/status?requestId=X`

### Pattern 3: Cross-Chain Swap Widget

1. Fetch chains: `GET /deposit/chains`
2. User selects origin chain → fetch tokens: `GET /deposit/tokens?chainId=X`
3. User selects token → fetch destinations: `GET /deposit/destinations`
4. User enters amount → get quote: `POST /deposit/quote?dry=true`
5. User confirms → create deposit: `POST /deposit/quote`

## Error Reference

**400 Bad Request:**

- `RefundAddressRequired`: No refund address provided and no default configured in dashboard (see "Refund Addresses - REQUIRED" section)
- Invalid token combination (not supported by routing layer)
- Invalid address format (wrong chain type)
- Token doesn't support static addresses
- Missing required fields
- Invalid amount (too low or too high)

**Example RefundAddressRequired Error:**

```json
{
  "success": false,
  "error": "RefundAddressRequired",
  "message": "Refund address is required for all deposits. Please either:\n1. Add a default EVM refund address in your dashboard (Settings > Integrations > Edit > Default Refund Addresses)\n2. Or provide a 'refundTo' address in this request",
  "details": {
    "isCrossChain": true,
    "originChainId": 792703809,
    "settlementChainId": 8453,
    "originVMType": "svm",
    "hasDefaultRefundAddresses": false,
    "defaultRefundAddressesConfigured": []
  }
}
```

**401 Unauthorized:**

- Missing x-api-key header
- Invalid API key
- API key revoked or expired

**429 Too Many Requests:**

- Rate limit exceeded
- Webhook rotation limit exceeded (max 5/hour)
- Quote limit exceeded (default: 100/minute)

**500 Internal Server Error:**

- Database connection issues
- Upstream service timeout
- Unexpected system error

## Support & Resources

- **Dashboard:** [https://swap-api.dextopus.com/](https://swap-api.dextopus.com/)
- **OpenAPI/Swagger Docs:** [https://swap-api.dextopus.com/api/docs](https://swap-api.dextopus.com/api/docs)
- **Status Page:** Monitor API uptime and incidents

## Optional

### Chain ID Reference

Complete list of supported chain IDs:

- Ethereum Mainnet: 1
- Optimism: 10
- BSC (Binance Smart Chain): 56
- Polygon: 137
- Base: 8453
- Arbitrum One: 42161
- Avalanche C-Chain: 43114
- Fantom: 250
- Cronos: 25
- Aurora: 1313161554
- Gnosis Chain: 100
- Celo: 42220
- Moonbeam: 1284
- Moonriver: 1285
- HECO: 128
- KCC: 321
- Solana: 792703809
- Bitcoin: 8253038 ⭐ **NEW - Recommended for Bitcoin deposits**
- Bitcoin (Legacy): 0 or 8333
- TRON: 728126428 or 195

### Token Address Formats

- **EVM chains:** `0x` followed by 40 hexadecimal characters (e.g., `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Solana:** Base58 encoded, 32-44 characters (e.g., `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- **Native tokens:** Use special formats like `11111111111111111111111111111111` for SOL

### Rate Limits

- Quote endpoint: 100 requests/minute per API key
- Static address generation: 50 requests/minute
- Webhook configuration: 10 requests/minute
- Webhook secret rotation: 5 requests/hour
- General endpoints: 1000 requests/minute

### Webhook Signature Verification

```typescript
import crypto from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// In your webhook handler:
const signature = request.headers["x-webhook-signature"];
const isValid = verifyWebhookSignature(
  JSON.stringify(request.body),
  signature,
  process.env.WEBHOOK_SECRET,
);
```

### Partner Fees Configuration

Partner fees allow you to monetize your integration by collecting a percentage fee on each transaction.

**Setup in Dashboard:**

1. Navigate to Integrations page
2. Create or edit integration
3. Set fee recipient addresses for each chain type (EVM, SVM, BTC, etc.)
4. Fees are automatically collected based on your API key

**Fee Structure:**

- Fees specified in basis points (100 = 1%)
- Maximum fee: 10% (1000 bps)
- Fees deducted from output amount before settlement
- Each fee must have an EVM address recipient

### Migration from Legacy Endpoints

If you're using the old `static: true` parameter in `/deposit/quote`:

- **Deprecated:** `POST /deposit/quote` with `static: true`
- **Recommended:** `POST /deposit/static/generate`

The new endpoint provides better control, filtering, and tracking of static addresses.
