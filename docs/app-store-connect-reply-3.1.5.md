# App Store Connect Reply — Orova

Copy into the App Review response after the new iOS build (with Sign in with Apple entitlement and fiat on/off-ramp removed) is uploaded.

---

Dear App Review Team,

Thank you for the feedback on Submission 2792ed12-b478-4e59-b866-82b5909734a8. We have addressed each guideline as follows.

## Guideline 4.8 — Login Services

The app offers Sign in with Apple as an equivalent login option alongside Google Sign-In and email/phone OTP.

Sign in with Apple meets the Guideline 4.8 requirements because:
- It limits data collection to the user’s name and email address.
- It allows users to keep their email private via Hide My Email.
- It does not collect interactions with the app for advertising purposes without consent.

How to verify: On the Login and Register screens, tap **Sign in with Apple** (shown above Google Sign-In on iOS).

## Guideline 5.1.1(ii) — Photo Library Purpose String

We updated the photo library purpose string to clearly describe use and include a specific example:

“Orova needs access to your photo library so you can set a profile picture (for example, choosing a photo from Camera Roll) and attach screenshots or ID photos when contacting support or completing account verification.”

## Guideline 3.1.5(iii) — Cryptocurrencies

Our iOS app is a **non-custodial wallet** under Guideline 3.1.5(i), not a cryptocurrency exchange or financial institution. It does not hold, clear, or settle user funds, does not maintain an order book, and does not execute trades on a proprietary matching engine.

**Fiat on-ramp and off-ramp are not offered in the iOS app.** Users cannot buy crypto with card/bank transfer or cash out to a bank account from this iOS binary.

Token swapping (when used) works as follows:
1. **Who executes transactions:** The end user, using their own non-custodial keys.
2. **Where transactions take place:** On-chain via public Solana smart contracts / decentralized routing (Jupiter). Our servers do not custody or move the user’s assets.

We have also updated App Store Connect Availability so the app is only distributed in storefronts appropriate for a non-custodial cryptographic wallet utility.

Thank you for your review.

---

## ASC checklist (manual)

- [ ] New iOS build uploaded (native rebuild required for `usesAppleSignIn` + purpose strings)
- [ ] Availability storefronts reviewed/restricted as intended
- [ ] Screenshots updated if login UI changed
- [ ] Paste the reply above into Resolution Center
