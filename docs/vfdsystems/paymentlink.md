Payment Link
info
The Payment Link API allows developers to generate secure, shareable payment links for collecting payments from customers. Merchants can set up their profile with custom branding and generate time-bound payment links with flexible amount validation.

1.0 AUTHORIZATION
Authorization to the APIs below requires an access token. To get more info on how to generate this access token, click on Generating Access Token

2.0 BASE URL
All requests to the Payment Link API must be done using the web API URL below.

Test Environment: https://api-devapps.vfdbank.systems/vtech-payment/api/v2/payments

LIVE Environment: https://api-apps.vfdbank.systems/vtech-payment-link/api/v2/payments

3.0 HOW TO USE THE APIS
Below are the steps involved to generate and use payment links:

The merchant first calls the MERCHANT SETUP endpoint to configure their merchant profile with name and logo
The merchant then calls the GENERATE PAYMENT LINK endpoint to create a payment link with specified amount, description, and validity period
The generated payment link can be shared with customers via any channel (email, SMS, WhatsApp, etc.)
Customers use the payment link to complete their payment
The merchant receives a notification when payment is completed
3.1 MERCHANT SETUP
API Context: /merchant/setup

Description: This endpoint allows you to set up or update merchant information including merchant name, ID, and logo. The merchant logo is uploaded to secure storage and can be displayed on the payment page for branding purposes.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
  "merchantName": "MyStore Limited",
  "merchantId": "12345",
  "merchantLogo": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgIC..."
}

Field	Description	Status
merchantName	The name of the merchant/business. This will be displayed on the payment page	Mandatory
merchantId	Unique identifier for the merchant. If updating an existing merchant, use the existing ID	Optional
merchantLogo	Base64 encoded merchant logo image (JPEG format). This will be displayed on the payment page	Optional

Sample Response

{
  "status": "00",
  "message": "Merchant setup successful",
  "merchantId": "12346",
  "merchantLogo": "wallet-name-a1b2c3d4e5f6g7h.jpeg"
}

Field	Description
status	Response status code ("00" indicates success)
message	Response message
merchantId	The merchant ID (newly generated or existing)
merchantLogo	The filename reference for the uploaded merchant logo

Error Response

{
  "status": "99",
  "message": "merchantName is mandatory"
}

3.2 GENERATE PAYMENT LINK
API Context: /generate-link

Description: This endpoint generates a unique payment link for collecting payments from customers. The link can have a fixed or flexible amount, include merchant charges, and has an expiration time for security.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
  "amount": "5000.00",
  "amountValidation": "A0",
  "description": "Payment for Order #12345",
  "paymentReference": "WalletName-12345",
  "merchantId": "12346",
  "merchantName": "MyStore Limited",
  "merchantCharge": "50.00",
  "validityTime": "1440"
}

Field	Description	Status
amount	The payment amount in naira	Mandatory
amountValidation	Amount validation type. Options: "A0" (exact amount), "A1" (less than), "A2" (greater than)	Mandatory
description	Description of the payment purpose. This will be displayed to the customer	Mandatory
paymentReference	Unique reference for this payment. Should be prefixed with your wallet name (e.g., "WalletName-12345")	Mandatory
merchantId	The merchant ID obtained from the merchant setup endpoint	Mandatory
merchantName	The merchant name to be displayed on the payment page	Mandatory
merchantCharge	Optional charge amount to be added by the merchant (in naira)	Optional
validityTime	Number of minutes the payment link will remain valid (e.g., "120" for 120 minutes/2 hours). Maximum is 4320 minutes (72 hours). Default is 120 minutes if not provided	Optional

Sample Response

{
  "status": "00",
  "message": "Successful",
  "data": {
    "merchantName": "MyStore Limited",
    "paymentReference": "WalletName-12345",
    "paymentLink": "https://payment.vfdbank.systems/pay/abc123xyz456",
    "expireAt": "2026-01-09T10:30:00Z"
  }
}

Field	Description
status	Response status code ("00" indicates success)
message	Response message
merchantName	The merchant name associated with this payment
paymentReference	The unique payment reference provided in the request
paymentLink	The generated payment link URL to be shared with the customer
expireAt	The date and time when the payment link will expire (ISO 8601 format)

Error Response - Missing Required Field

{
  "status": "99",
  "message": "amount is mandatory"
}

Error Response - Invalid Merchant

{
  "status": "99",
  "message": "Invalid merchant ID"
}