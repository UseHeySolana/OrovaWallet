# Purchase source, Crossmint orders, processing fee & exchange rate

## 1. Product details & purchase by source (DONE)

- **Problem**: Clicking "Product details" or "Purchase" on a Jumia product was using Crossmint (Amazon) tools and failing.
- **Solution**:
  - **Source on message**: Search results already set `source: "jumia"` or `source: "crossmint"` on the message (in `conversation.store`).
  - **ProductDetails** now receives `source` from `ToolItem` (`item?.source ?? "crossmint"`):
    - **Purchase button**: If `source === "jumia"` it sends: *"Place Jumia order for this product: link …, name …, quantity 1, unit price … NGN."* so the AI calls `place-jumia-order`. Otherwise it sends *"Create Amazon order for product [asin]"* for `create-order`.
  - **Jumia product details**: A separate tool **`get-jumia-product-details`** was added so the AI can fetch Jumia details when the user says "fetch the details from jumia". It uses `product_link`, calls your backend `/jumia/scrape/product-details`, then updates the same message with `updateProductDetails` so the UI shows details and the Purchase button uses Jumia.
  - **Products "Select"** already sends *"Select product … and fetch the details from ${source}"*, so the AI picks:
    - `get-jumia-product-details` when `source` is jumia,
    - `product-details` (Crossmint) when source is crossmint.
- **Display**: Price/currency/rating in `ProductDetails` support both shapes (object or number) for Jumia vs Crossmint.

## 2. Crossmint orders to DB and admin (DONE)

- **Backend**:
  - **Table**: `crossmint_orders` (wallet_address, crossmint_order_id, asin, order_number, status, total_amount, currency, order_date, raw_response).
  - **Record order**: `POST /crossmint/wallet/orders` (no auth) with `wallet_address`, `crossmint_order_id`, `asin`, `total_amount`, `currency`, `raw_response`.
  - **Admin**: Under **`/admin/crossmint`** (auth required): `GET /orders`, `GET /orders/stats`, `GET /orders/{orderId}`. So you have:
    - **Jumia**: `admin/jumia/orders`
    - **Crossmint**: `admin/crossmint/orders`
- **Wallet app**: After a successful Crossmint `createOrder`, the app calls `POST {BASE_URL}/crossmint/wallet/orders` with the payload above so every Amazon order is stored and visible in admin.

## 3. Processing fee (DONE – backend; admin UI for you)

- **Backend**:
  - **Settings table**: `settings` with keys `processing_fee_percent`, `processing_fee_fixed_ngn`, `processing_fee_fixed_usd`.
  - **Admin API** (auth required):
    - `GET /admin/settings/processing-fee` – returns current values.
    - `POST /admin/settings/processing-fee` – body: `processing_fee_percent`, `processing_fee_fixed_ngn`, `processing_fee_fixed_usd` (all optional).
- **Admin dashboard**: Add a “Settings” or “Processing fee” section that calls these two endpoints so you can set and display the processing fee. When you implement deduction (e.g. for Jumia), use `Setting::getValue('processing_fee_percent', '0')` (and fixed fees) and add them to the amount to deduct.

## 4. Exchange rate for NGN/USD (DONE)

- **Use case**: When deducting from user accounts for Jumia (NGN), you need to convert NGN → USD (or apply fee in NGN). The API provides the rate and a conversion helper.
- **Backend**:
  - **Service**: `App\Services\ExchangeRateService`:
    - Uses **https://open.er-api.com/v6/latest/USD** (no API key).
    - Caches rate for 1 hour.
    - `ngnPerUsd()`, `usdPerNgn()`, `ngnToUsd(float $amountNgn)`.
  - **Config**: Optional `EXCHANGE_RATE_API_URL` in `.env` to override.
  - **Public endpoints** (no auth):
    - `GET /exchange-rate` – returns `ngn_per_usd`, `usd_per_ngn`, `source`.
    - `GET /exchange-rate/convert?amount=1000` – converts NGN amount to USD.
- **Deduction flow (when you implement it)**:
  - Jumia: order total in NGN → add processing fee (fixed NGN + percent) → convert to USD with `ExchangeRateService::ngnToUsd()` (or call `/exchange-rate/convert`) → deduct in USD (or your settlement currency).
  - Crossmint: already USD; add processing fee (fixed USD + percent) and deduct.

## Files touched

**HeySolanaWallet**
- `components/ChatItems/ProductDetails.tsx` – source prop, purchase message by source, price/rating display.
- `components/ChatItems/ToolItem.tsx` – pass `source` to ProductDetails; show “Jumia” for jumia tool actions.
- `components/ChatItems/Products.tsx` – already had `source` and “fetch the details from ${source}”.
- `libs/tools/jumia/jumia.tool.ts` – `getJumiaProductDetails` tool; handler calls backend, maps to UI shape, `updateProductDetails`, `completeConversation`.
- `libs/tools/crossmint/crossmint.tool.ts` – after successful order, `POST /crossmint/wallet/orders`.
- `libs/tool-implemetation/toolsregistry.ts` – registered `getJumiaProductDetails`.
- `services/jumiaApi.ts` – `getJumiaProductDetails` return type fixed to `Promise<JumiaProductDetails>`.

**heysolanabackend**
- `database/migrations/2025_03_05_000001_create_crossmint_orders_table.php`
- `database/migrations/2025_03_05_000002_create_settings_table.php`
- `app/Models/CrossmintOrder.php`, `app/Models/Setting.php`
- `app/Http/Controllers/CrossmintWalletController.php`, `AdminCrossmintController.php`
- `app/Http/Controllers/AdminSettingsController.php`, `ExchangeRateController.php`
- `app/Services/ExchangeRateService.php`
- `config/services.php` – `exchange_rate.url`
- `routes/api.php` – crossmint wallet + admin crossmint + admin processing-fee + exchange-rate routes.

Run migrations on the backend:
```bash
php artisan migrate
```
