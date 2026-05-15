# Seedless MPC Wallet Architecture (Passkey + Non-Custodial Design)

## 1. Overview
This document defines a self-custodial wallet system using Multi-Party Computation (MPC) combined with passkey authentication. The goal is to eliminate seed phrases entirely while maintaining true non-custodial ownership and enabling instant wallet access across sessions and devices.

---

## 2. Core Principles
- No seed phrases exposed to users
- No single party ever holds a full private key
- Wallet ownership is distributed via cryptographic shares
- Authentication is handled via passkeys (WebAuthn)
- Wallet state is reconstructable from secure shares

---

## 3. System Components

### 3.1 Client (React Native / Expo App)
Responsibilities:
- Passkey authentication (FaceID / TouchID)
- Secure storage of Device Share (Share A)
- Transaction creation and signing orchestration
- MPC client coordination

Stores:
- Share A (device-secured via Secure Enclave / Keychain)
- Session metadata

---

### 3.2 Backend Server
Responsibilities:
- User authentication verification
- Storage of encrypted Server Share (Share B)
- MPC coordination during signing sessions
- Recovery orchestration

Stores:
- Share B (encrypted)
- User identity mapping
- Session and challenge data

---

### 3.3 Recovery Channel (Optional)
Responsibilities:
- Account recovery support
- Secondary authentication factor

Stores:
- Share C (optional, recovery-based)

---

## 4. Key Model (MPC Structure)

The wallet private key is never stored in full. Instead:

- Share A → Device
- Share B → Backend
- Share C → Recovery (optional)

A valid signature requires threshold collaboration (e.g., 2-of-2 or 2-of-3).

---

## 5. Wallet Lifecycle

### 5.1 Wallet Creation
1. User registers via username/email
2. Passkey is created (WebAuthn)
3. MPC key shares are generated:
   - Share A assigned to device
   - Share B stored on backend
   - Optional Share C created for recovery
4. Wallet address is derived and returned

---

### 5.2 Login Flow
1. User enters username
2. Passkey authentication verifies identity
3. Backend validates session
4. Device retrieves Share A
5. Backend releases Share B (session-based)
6. Wallet becomes active instantly in memory

---

### 5.3 Transaction Signing Flow
1. User initiates transaction
2. Client sends signing request to backend
3. Backend verifies authenticated session
4. Device and backend each compute partial signature
5. MPC protocol combines partial signatures
6. Final signature is produced and broadcast

---

## 6. Security Model
- No full private key reconstruction at any point
- Shares are useless individually
- Backend share is encrypted at rest
- Device share is hardware-protected
- Passkey protects identity and session authorization

---

## 7. Recovery Model
If device is lost:
- Recovery triggered via Share C or re-authentication
- New Share A generated and bound to new device
- Old device share invalidated

Recovery options:
- Email-based verification
- Secondary device approval
- Social recovery (future extension)

---

## 8. Recommended MPC Configuration

### Option A (MVP)
- 2-of-2 system
  - Device Share (A)
  - Backend Share (B)

### Option B (Production Recommended)
- 2-of-3 system
  - Device Share (A)
  - Backend Share (B)
  - Recovery Share (C)

---

## 9. Technical Stack

### Client (Expo / React Native)
- react-native-passkeys (or native WebAuthn module)
- expo-secure-store / Keychain
- crypto libs (tweetnacl / ethers / solana/web3.js)

### Backend
- Node.js / TypeScript
- MPC orchestration service
- Secure key shard storage
- Session authentication service

### Cryptography Layer
- Threshold Signature Scheme (TSS)
- FROST / GG18 compatible libraries (depending on chain)

---

## 10. Wallet Behavior Summary
- Wallet is not stored locally
- Wallet is reconstructed during authenticated sessions
- User experience is identical to Web2 login
- Ownership remains cryptographically non-custodial

---

## 11. Key Advantages
- No seed phrase UX burden
- Instant wallet recovery after reinstall
- Strong cryptographic ownership model
- Scalable to mass consumer applications

---

## 12. Future Enhancements
- Smart account abstraction (ERC-4337 style)
- Session keys for gasless transactions
- Multi-device approval flows
- Biometric continuous authentication

---

## End of Document

