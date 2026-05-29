PAJ Ramp SDK
A comprehensive SDK for PAJ Ramp onramp and offramp operations with real-time transaction updates using webhooks.

Installation
npm install paj_ramp
yarn add paj_ramp
Getting Started
Initialize SDK
import { initializeSDK, Environment } from 'paj_ramp';

// Select the environment you want to work with
initializeSDK(Environment.Production); // or Environment.Staging
Initiate Session
import { initiate } from 'paj_ramp';

// You can use either an email address or a phone number (with country code)
const initiated = await initiate(
  'your_email@gmail.com', // or '+2349053231563'
  'business_api_key'
);
// Response: { email?: string, phone?: string }
Verify Session
import { verify } from 'paj_ramp';

const verified = await verify(
  'your_email@gmail.com', // or '+2349053231563'
  'otp',
  {
    uuid: 'device-uuid',
    device: 'Desktop',
    // optional fields:
    os: 'MacOS',
    browser: 'Chrome',
    ip: '127.0.0.1',
  },
  'business_api_key'
);
/* Response: {
  recipient: string,
  isActive: string,
  expiresAt: string,
  token: string
} */
📚 Examples
Check out our examples directory for complete, runnable examples:

Onramp - Complete onramp flow: buy crypto with fiat
Offramp - Complete offramp flow: sell crypto for fiat
Utility - Utility functions: rates, banks, value conversions
Webhook Integration - Express server with real-time webhook handling
cd examples/onramp
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
Utility Endpoints
Handle Rate
Get All Rates

import { getAllRate } from 'paj_ramp';

const rate = await getAllRate();
/*
Response:
{
  "onRampRate": {
    "baseCurrency": "USD",
    "targetCurrency": "NGN",
    "isActive": true,
    "rate": 1510,
    "type": "onRamp"
  },
  "offRampRate": {
    "baseCurrency": "USD",
    "targetCurrency": "NGN",
    "isActive": true,
    "rate": 1525,
    "type": "offRamp"
  }
}
*/
Get Rate by Amount

import { getRateByAmount } from 'paj_ramp';

const rate = await getRateByAmount(50000);
/*
Response:
{
  rate: {
    baseCurrency: string,
    targetCurrency: string,
    rate: number
  },
  amounts: {
    userTax: number,
    merchantTax: number,
    amountUSD: number,
    userAmountFiat: number
  }
}
*/
Get Rate by Type

import { getRateByType, RateType } from 'paj_ramp';

const rate = await getRateByType(RateType.offRamp); // or RateType.onRamp
/*
Response:
{
  "baseCurrency": "USD",
  "targetCurrency": "NGN",
  "isActive": true,
  "rate": 1525,
  "type": "offRamp"
}
*/
Get Token Value (fiat → token amount)

import { getTokenValue, Currency } from 'paj_ramp';

const tokenValue = await getTokenValue(
  {
    amount: 50000,              // fiat amount
    mint: 'token_mint_address',
    currency: Currency.NGN,
  },
  sessionToken
);
/*
Response:
{
  amount: number,   // token amount
  mint: string,
  currency: string
}
*/
Get Fiat Value (token amount → fiat)

import { getFiatValue, Currency } from 'paj_ramp';

const fiatValue = await getFiatValue(
  {
    amount: 100,                // token amount
    mint: 'token_mint_address',
    currency: Currency.NGN,
  },
  sessionToken
);
/*
Response:
{
  amount: number,
  mint: string,
  currency: string,
  fiatAmount: number  // equivalent fiat amount
}
*/
Handle Banks
Get Banks

import { getBanks } from 'paj_ramp';

const banks = await getBanks(sessionToken);
// Response: [ { id: string, code: string, name: string, logo: string, country: string } ]
Resolve Bank Account

import { resolveBankAccount } from 'paj_ramp';

const resolved = await resolveBankAccount(
  sessionToken,
  'bank_id',
  'account_number'
);
// Response: { accountName: string, accountNumber: string, bank: { id: string, name: string, code: string, country: string } }
Add Bank Account

import { addBankAccount } from 'paj_ramp';

const added = await addBankAccount(
  sessionToken,
  'bank_id',
  'account_number'
);
// Response: { id: string, accountName: string, accountNumber: string, bank: string }
Get Bank Accounts

import { getBankAccounts } from 'paj_ramp';

const accounts = await getBankAccounts(sessionToken);
// Response: [ { id: string, accountName: string, accountNumber: string, bank: string } ]
Token Info
Get Token Info

import { getTokenInfo, Chain } from 'paj_ramp';

const tokenInfo = await getTokenInfo('token_mint_address', Chain.SOLANA);
/*
Response:
{
  name: string,
  symbol: string,
  logo: string,
  mint: string,
  decimals: number,
  chain: Chain
}
*/
Transaction History
Get All Transactions

import { getAllTransactions } from 'paj_ramp';

const transactions = await getAllTransactions(sessionToken);
/* Response: [{
  id: string;
  address: string;
  mint: string;
  currency: Currency;
  amount: number;
  usdcAmount: number;
  fiatAmount: number;
  sender: string;
  recipient: string;
  rate: number;
  status: TransactionStatus;
  transactionType: TransactionType;
  createdAt: string | Date;
}] */
Get Transaction

import { getTransaction } from 'paj_ramp';

const transaction = await getTransaction(sessionToken, 'transaction_id');
/* Response: {
  id: string;
  address: string;
  mint: string;
  currency: Currency;
  amount: number;
  usdcAmount: number;
  fiatAmount: number;
  sender: string;
  recipient: string;
  rate: number;
  status: TransactionStatus;
  transactionType: TransactionType;
  createdAt: string | Date;
} */
Offramp (Direct Offramp)
Usage Example
import { createOfframpOrder, Currency, Chain } from 'paj_ramp';

const order = await createOfframpOrder(
  {
    bank: 'bank_id',
    accountNumber: 'account_number',
    currency: Currency.NGN,
    amount: 10000,           // token amount (optional if fiatAmount provided)
    fiatAmount: 10000,       // fiat amount (optional if amount provided)
    mint: 'token_mint_address',
    chain: Chain.SOLANA,     // Chain.SOLANA or Chain.MONAD
    webhookURL: 'https://your-domain.com/webhook',
  },
  sessionToken
);
/* Response: {
  id: string,
  address: string,
  mint: string,
  currency: Currency,
  amount: number,
  fiatAmount: number,
  rate: number,
  fee: number
} */
Onramp: Creates a new onramp order and sends status to the webhook URL.
Usage Example
import { createOnrampOrder, Currency, Chain } from 'paj_ramp';

const order = await createOnrampOrder(
  {
    fiatAmount: 10000,
    currency: Currency.NGN,
    recipient: 'wallet_address_here',
    mint: 'token_mint_address_here',
    chain: Chain.SOLANA,     // Chain.SOLANA or Chain.MONAD
    webhookURL: 'https://your-domain.com/webhook',
  },
  sessionToken
);
/* Response: {
  id: string,
  accountNumber: string,
  accountName: string,
  fiatAmount: number,
  bank: string
} */
Webhook Response Data Structure
For both onramp and offramp
{
  id: string;
  address: string;
  signature?: string;
  mint: string;
  currency: Currency;
  amount: number;
  usdcAmount: number;
  fiatAmount: number;
  sender: string;
  recipient: string;
  rate: number;
  status: TransactionStatus;  // INIT, PAID, COMPLETED, etc.
  transactionType: TransactionType;  // ON_RAMP or OFF_RAMP
}
Exported Types
Enums
import {
  Chain,             // SOLANA, MONAD
  TransactionStatus, // INIT, PAID, COMPLETED, etc.
  TransactionType,   // ON_RAMP, OFF_RAMP
  Currency,          // NGN, USD, etc.
  Environment,       // Staging, Production, Local
  RateType,          // onRamp, offRamp
  OnRampStatus,
} from 'paj_ramp';
Interfaces
import type {
  // Session
  InitiateResponse,
  Verify,
  DeviceSignature,
  // Banks
  Bank,
  ResolveBankAccount,
  AddBankAccount,
  GetBankAccounts,
  // Rates
  RateByAmount,
  RateBy,
  // Token
  TokenInfo,
  // Orders
  CreateOnrampOrder,
  OnrampOrder,
  CreateOfframpOrder,
  OfframpOrder,
  // Observe Order
  ObserveOrderOptions,
  ObserveOrderReturn,
  OnRampOrderUpdate,
  OnRampSocketOptions,
  OnRampSocketInstance,
} from 'paj_ramp';
