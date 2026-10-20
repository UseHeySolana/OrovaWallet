Wallets
1.0 Authorization
Authorization to the APIs below requires an access token. To get more info on how to generate this access token, click on Generating Access Token

2.0 Base Url
All requests to the Wallet API must be done using the web API URL below.

Test Environment: https://api-devapps.vfdbank.systems/vtech-wallet/api/v2/wallet2

Live Environment: https://api-apps.vfdbank.systems/vtech-wallet/api/v2/wallet2

3.0 Wallet Implementations and description
1. POOL
In this implementation, funds entering sub accounts are swept automatically to your corporate account. Also inward and outward charges are deducted from your corporate account.

2. 1-1
In this implementation, funds entering sub accounts remain there and are not swept to your corporate account. Also outward charges are deducted from the customer's account directly while inward charges are deducted from your corporate account.

4.0 Allowed Operations
The following operation types are supported.

Transfer Services - Allows outward transactions from accounts.

/account/enquiry - This endpoint allows you to get your pool, or 1-1 account information needed to initiate a transfer request
/bank – This endpoint retrieves all banks
/transfer/recipient - This endpoint allows you get the transfer beneficiary details
/transfer - This endpoint allows you to initiate an intra or inter-funds transfer
/transactions - This endpoint allows you to retrieve details of a transaction
/credit – This endpoint allows you to simulate an inward credit to your pool account
/transactions/reversal – This endpoint allows you query the reversal status of a transaction.
Account Creation - Allows a client to set up a new account/wallet.

There are two methods for account creation:

No Consent Method: This allows you create indiviual or corporate accounts and the accounts would not be placed on PND (Post No Debit) and don't require bvn consent to be usable.
Consent Method: This also allows you create indiviual or corporate accounts but the accounts would be placed on PND (Post No Debit) and require bvn consent to be usable.
Under No Consent Method, there are:

/client/create - This endpoint allows you to create a client with BVN and DOB as mandatory
/corporateclient/create - This endpoint allows you create a corporate account
/virtualaccount - This endpoint allows you to create a one-time temporary virtual account
/virtualaccount/amountupdate - This endpoint allows you to update a virtual account transaction amount
Under Consent Method, there are:

/client/individual - This endpoint allows you to create a client with BVN as mandatory
/client/corporate - This endpoint allows you to create a corporate collections account
/bvn-consent - This endpoint allows you to obtain consent to a customer's BVN.
/client/release - This endpoint allows you remove PND from a created account (individual or corporate) after consent is gotten successfully
KYC Enquiry – Allows a client retrieve the bvn details of a customer

/client – This endpoint allows you to retrieve the bvn details of a customer
/bvn-consent – This endpoint allows you get consent from a customer to use his/her bvn
/bvn-account-lookup- This endpoint retrieves all the bank accounts linked with a bvn
Account Enquiry

/sub-accounts/ – This endpoint allows you retrieve all virtual accounts or corporate accounts or individual accounts
Transaction Enquiry

/transaction/limit – This endpoint allows you to modify a customer’s daily transaction and withdrawal limits
/account/transactions – This endpoint allows you to retrieve all transactions from your pool account or a sub-account.
/virtualaccount/transactions – This endpoint allows you to retrieve a virtual account transaction history.
QR Code Services

/qrcode/generate – This endpoint allows you to generate a QR Code and create a customer on the QR Code platform
/qrcode/query – This endpoint allows you to retrieve merchant details using a QR Code
/qrcode/pay - This endpoint allows customers on the QR Code platform to make payment
Account Upgrade

/client/upgrade – This endpoint allows you to update a client information
5.0 Inward Credit Notification
Inward Credit Notification refers to a webhook notification you receive when funds are transferred to a wallet account and the funds settled in the account.

A webhook is to be shared both in the testing and production environments for this notification. Its http method should be POST and the payload it would receive would be in the format below:

{
  "reference": "uniquevalue-(Randomly generated value)",
  "amount": "1000",
  "account_number": "1010123498",
  "originator_account_number": "2910292882",
  "originator_account_name": "AZUBUIKE MUSA DELE",
  "originator_bank": "000004",
  "originator_narration": "test",
  "timestamp": "2021-01-11T09:34:55.879Z",
  "transaction_channel":"EFT",
  "session_id": "00001111222233334455"

}

Field	Description
reference	This is prefixed by your wallet name followed by a random string
amount	This is the amount sent to the wallet account
account_number	This is the account number credited with the inward transfer
originator_account_number	This is the initiator’s account number
originator_account_name	This is the initiator’s name
originator_bank	This is the initiator’s bank code
timestamp	This is the initiator’s name
transaction_channel	This is the channel through which the transaction was initiated: EFT (Electronic Funds Transfer), USSD, or NQR.
note
When sharing a webhook with us, security measures such as Authentication or IP whitelisting are advised to be in place.

Also, your webhook url should respond with a 200 status code once notified successfully


6.0 Initial Inward Credit Notification
Initial Inward Credit Notification refers to a webhook notification you receive when funds are transferred to a wallet account even though the funds might not have settled in the account.


If you want this notification, you need to request that it be activated and you need to share a webhook for it both in the testing and production environments. The webhook's http method should be POST and the payload it would receive would be in the format below:

{
  "reference": "uniquevalue-(Randomly generated value)",
  "amount": "1000",
  "account_number": "1010123498",
  "originator_account_number": "2910292882",
  "originator_account_name": "AZUBUIKE MUSA DELE",
  "originator_bank": "000004",
  "originator_narration": "test",
  "timestamp": "2021-01-11T09:34:55.879Z",
  "session_id": "00001111222233334455",
  "initialCreditRequest": true
}

Field	Description
reference	This is prefixed by your wallet name followed by a random string
amount	This is the amount sent to the wallet account
account_number	This is the account number credited with the inward transfer
originator_account_number	This is the initiator’s account number
originator_account_name	This is the initiator’s name
originator_bank	This is the initiator’s bank code
timestamp	This is the initiator’s name
initialCreditRequest	This would be true if the notification is an initial inward credit notification
7.0 Retrigger Webhook Notification
API Context: /transactions/repush

Description: This endpoint enables you retrigger the webhook notification for an inward transaction by passing the transaction's id or sessionId.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Sample Request

{
    "transactionId": "rosapay-1012",
    "sessionId" : "",
    "pushIdentifier":"transactionId"
}


OR

{
    "transactionId": "",
    "sessionId" : "090110220924210740278805531934",
    "pushIdentifier":"sessionId"
}

Field	Description	Status
transactionId	id of transaction you want to be notified for	Mandatory if pushIdentifier is transactionId
sessionId	transaction sessionId	Mandatory if pushIdentifier is sessionId
pushIdentifier	can either be sessionId or transactionId	Mandatory

Sample Response

{
    "status": "00",
    "message": "success"
}

Account Creation
Client and account creation can be accomplished through two distinct methods:

No Consent Method
Consent Method
1. No Consent Method
1.1 Individual (client/create)
API Context: /client/create?bvn={bvn}&dateOfBirth={dateOfBirth}

Description: This API endpoint allows you to create a new client account or a duplicate account for an existing client

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
REQUEST BODY

{
}

Field	Description	Status
bvn	Customers Bank Verification Number e.g 22222222222	Mandatory
dateOfBirth	Date Of Birth Registered to Customers BVN e.g 08-Mar-1995 (Must be in this date format)	Mandatory
tip
Please note that to create a duplicate account for an existing client, you must only pass the client's existing account number as previousAccountNo in the request url like so: '/client/create?previousAccountNo={previousAccountNo}'

Sample Success Response

{
    "status": "00",
    "message": "Successful Creation",
    "data": {
        "firstname": "MARIUS",
        "middlename": "DOE",
        "lastname": "PETERSON",
        "bvn": "22222222223",
        "phone": "09022222222",
        "dob": "08-Mar-1995",
        "accountNo": "1001563612"
    }
}

Sample Failure Responses

{ 
    "status":"106",
    "message":"Client's BVN is not linked to any phone number."
} 


{ 
  "status":"102",
  "message":"Invalid BVN or Could Not Reach BVN Service"
}


{ 
  "status":"929",
  "message":"Error creating client: Contact Admin"
}


{ 
  "status":"199",
  "message":"BVN Is Mandatory"
}


  { 
    "status":"119",
    "message":"Not Authorized to Create Clients"
  }


  { 
    "status":"103",
    "message":"Date Of Birth Mismatch"
  }

1.2 Corporate (corporateclient/create)
API Context: /corporateclient/create

Description: This endpoint enables you create an account for a corporate client or a duplicate corporate account for an existing client. Also bvn consent is not required.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{

    "rcNumber":"12345666",
    "companyName":"Roland Technologies",
    "incorporationDate":"05 January 2021",
    "bvn":"22155258549",
    "address": "10 Abbey Str, Ikeja, Lagos",
    "state": "Lagos"

}

Request Body	Description	Required
rcNumber	Company’s RC Number	Mandatory
companyName	Company’s Name	Mandatory
incorporationDate	Company’s Incorporation Date e.g 05 January 2021 (Must be in this date format)	Mandatory
bvn	BVN of one of company's board of directors	Mandatory
address	Company's address	Mandatory
state	State where the company is located	Mandatory
tip
Please note that to create a duplicate account for an existing client, you must only pass the client's existing account number as previousAccountNo in the request body like so:

{
  "previousAccountNo":"1001620812"
}


Sample Success Response

{
 "status": "00",
 "message": "Corporate account created successfully",
 "data": {
            "accountNo": "1000053589",
            "accountName": "Roland Technologies"
   }
}


Sample Failed Responses

{
    "status": "199",
    "message": "Company exist with same RC Number Or Company Name"
}

{ 
  "status":"199",
  "message":"Not Authorized to Create Clients"
}

{ 
  "status":"199",
  "message":"Account Creation Failed"
}


1.3 Virtual Account
API Context: /virtualaccount

Description: This endpoint allows you to create a one time temporary virtual account

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "amount":"5000",
    "merchantName":"Tunde merchant",
    "merchantId":"M0123444",
    "reference":"TundeWallet-212272727",
    "validityTime":"2400",
    "amountValidation":"A3"

}

Field	Description	Status
amount	Amount to be paid into the account	Mandatory
merchantName	Merchant's Name e.g customer's business name	Mandatory
merchantId	Merchants unique Identifier	Mandatory
reference	Unique Reference for transaction, Reference should have wallet Name as Prefix	Mandatory
validityTime	Validity time for account expiration in minutes, the default value is 4320 minutes. Maximum value that can be passed is 4320	Optional
amountValidation	This determines the amount a created virtual account can be funded with. If it's not passed it's given a default value of A4	Optional

tip
amountValidation can be either of the following:

A0: If passed the created virtual account can only be funded with an amount equal to what was specified during its creation.
A1: If passed the created virtual account can only be funded with an amount less than what was specified during its creation.
A2: If passed the created virtual account can only be funded with an amount greater than what was specified during its creation.
A3: If passed the created virtual account can only be funded with an amount equal or less than what was specified during its creation.
A4: If passed the created virtual account can only be funded with an amount equal or greater than what was specified during its creation.
A5: If passed the created virtual account can be funded with any amount.

Sample Success Response

{
    "status": "00",
    "message": "Successful",
    "accountNumber": "4600070017",
    "reference": "TundeWallet-212272727"
}


Sample Failed Responses

  { 
    "status":"98",
    "message":"Reference Exist"
 }

  {
    "status":"01",
    "message":"ValidityTime must not be above 4320 minutes"
  }


{
    "status": "01",
    "message": "Merchant Name is missing",
    "accountNumber": "",
    "reference": ""
}

   {
    "status": "01",
    "message": "Reference is missing",
    "accountNumber": "",
    "reference": ""
}


1.3.1 Virtual Account Update
API Context: /virtualaccount/amountupdate

Description: This endpoint allows you to update amount on a virtual account

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "amount":"5000",
    "reference":"TundeWallet-22222222223"
}

Field	Description	Status
amount	Amount to be updated on account	Mandatory
reference	Unique Reference used to generate the virtual account initially	Mandatory

Sample Response

{
    "status": "00",
    "message": "Amount updated successfully",
    "amount": "5000",
    "merchantAccountNo": "4600070017",
    "merchantId": "M0123444"
}


Sample Failed Response

{
    "status": "01",
    "message": "Merchant account inactive"
}

2. Consent Method
The IGREE Process

The developer calls the account creation endpoint and passes the client Bio-data (payload required as stated in the documentation)
The account is created immediately and placed on PND.
The developer calls the wallet2/bvn-consent endpoint to get the customer’s consent.
If the consent returned is false, then the consent URL returned to the developer should be displayed to the customer.
The customer clicks on the URL and is directed to the consent management service page.
The customer inputs the BVN, is directed to select the contact linked with the BVN (email/phone number) that would be used in receiving the OTP, and clicks submit.
An OTP is generated and sent to the customer.
The customer is redirected to the OTP authentication page to input the OTP and grant consent.
The developer consent webhook is notified once consent has been granted.
The developer calls the /client/release endpoint to lift PND.
The merchant is notified of all pending inflows, if any.
IGREE Process Flow Chart

IGREE Process Flow logo

tip
Please note that for cases where customers require another account, once consent has been given for the first, there is no need to initiate the consent process for the extra account as it would not be placed on PND.

2.1 Individual (client/individual)
API Context: /client/individual

Description: This API endpoint allows you to create a new client account (account would be placed on pnd) or a duplicate account for an existing client.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request


{

    "firstname":"twallet",
    "lastname":"dwallet",
    "middlename":"mwallet",
    "dob":"04 October 1989",
    "address":"No 5 address",
    "gender":"Male",
    "phone":"08102231310",
    "bvn":"22256616778"
}


Request Body	Description	Required
firstname	Client’s first name	Mandatory
lastname	Client’s last name	Mandatory
middlename	Client’s middle name	Optional
dob	Client’s date of birth	Mandatory
address	Client’s address	Optional
phone	Client's phone no	Mandatory
gender	Client’s gender	Optional
bvn	Client’s BVN	Mandatory

tip
Please note that to create a duplicate account for an existing client, you must only pass the client's existing account number as previousAccountNo in the request body like so:

{
 "previousAccountNo":"1001555949"
}


Sample Success Response

{
    "status": "00",
    "message": "Successful Creation",
    "data": {
        "firstname": "twallet",
        "middlename": "mwallet",
        "lastname": "dwallet",
        "bvn": "22256616778",
        "phone": "08102231310",
        "dob": "04 October 1989",
        "accountNo": "1001554856"
    }
}


Sample Failure Responses

{  
"status":"01",
"message":"User Exists",
"data": {"accountNo":"1001616350"}
}

{ 
  "status":"929",
  "message":"Invalid previous account number"
} 


{ 
  "status":"199",
  "message":"BVN on account is pending consent, kindly escalate to Admin if consent has been gotten already."
}



{ 
  "status":"199",
  "message":"BVN on account is pending consent, kindly escalate to Admin if consent has been gotten already."
}



{ 
  "status":"119",
  "message":"Not Authorized to Create Clients"
}


{ 
  "status":"929",
  "message":"Error creating client: Contact Admin"
}


{  
  "status":"01",
  "message":"Client Account Exists",
  "data": {"accountNo":"1001616350"}
}

2.2 Corporate (client/corporate)
API Context: /client/corporate

Description: This endpoint enables Corporate Client creation with account number being generated which will be placed on pnd until the release API is called. It also enables you create a duplicate account for an existing client

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Sample Request

{

    "rcNumber":"12345666",
    "companyName":"Tunde Wallets",
    "incorporationDate":"05 January 2021",
    "bvn":"22155258549",
    "address": "10 Abbey Str, Ikeja, Lagos",
    "state": "Lagos"
}

Request Body	Description	Required
rcNumber	Company’s RC Number	MANDATORY
companyName	Company’s Name	MANDATORY
incorporationDate	Company’s Incorporation Date e.g 05 January 2021 (Must be in this date format)	MANDATORY
bvn	BVN of one of company's board of directors	MANDATORY
address	Company's address	MANDATORY
bvn	State where the company is located	MANDATORY
tip
Please note that to create a duplicate account for an existing client, you must only pass the client's existing account number as previousAccountNo in the request body like so:

{
 "previousAccountNo":"1001555949"
}


Sample Success Response

{
    "status": "00",
    "message": "Corporate account created successfully",
    "data": {
        "accountNo": "1001554832",
        "accountName": "Tunde Wallets"
    }
}


Sample Failed Responses

{  
  "status":"01",
  "message":"Client Account Exists","data": {"accountNo":"1001603833"} 
}

{
  "status": "99",
  "message": ""
 }

{ 
    "status":"929",
    "message":"Invalid previous account number"
} 

{ 
    "status":"199",
    "message":"BVN on account is pending consent, kindly escalate to Admin if consent has been gotten already."
}



2.3 BVN Consent
API Context: /bvn-consent?bvn={bvn}&type={type}&reference={reference}

Description: This endpoint allows us to obtain consent to a customer's BVN.

API METHOD: GET

REQUEST HEADERS

Field	Description	Required
type	02	Mandatory
bvn	e.g 22222222227	Mandatory
reference	Unique reference for a particular bvn consent (max 250 characters)	Optional

SAMPLE RESPONSE : Consent Not Given

{
    "status": "00",
    "message": "Consent response",
    "data": {
        "statusCode": "false",
        "url": "https://services.vfdtech.ng/",
        "reference":"595-22222222231-250927022024"
    }
}


info
In case consent is not given, proceed to the URL returned to initiate a request for BVN consent.


SAMPLE RESPONSE : Consent Already Given

{
    "status": "00",
    "message": "Consent response",
    "data": {
        "statusCode": "true",
        "reference":"595-22222222231-250927022024"
    }
}

info
In case consent is already given, proceed to release the account

2.4 IGREE Notifications
For BVN Consent Notification, you are required to provide a webhook that will receive notification when the customer has given BVN consent. This webhook is to be shared both in the testing and production environments. Its http method should be POST and its request will be sent in the format below.

{
    "status": "00",
    "message": "Customer Consent Received",
    "data": {
        "bvn": "22222222222",
        "status": true,
        "reference":"595-22222222231-250927022024"

    }
}


Field	Description
status	This defines the API response status
message	This defines the API response message
data.bvn	This defines the BVN that requested consent
data.status	This determines if customers have given or rejected consent. It can either be true or false.
data.reference	This determines if customers have given or rejected consent. It can either be true or false.
2.4 Release Account
API Context: /client/release

Description: This endpoints is used to remove the PND(Post No Debit) restriction from an account that has been created

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request


{
    "accountNo":"10010101"
}


Field	Description	Status
accountNo	Account Number to release from PND	Mandatory
Sample Response


{
    "status": "00",
    "message": "Successful Release"
}



Sample Failed Response

{

    "status": "99",
    "message": "Kindly get consent again"
}

3. Test Data (BVN Bio data)
BVN	OTP	BVN-FIRSTNAME	BVN_LASTNAME	BVN_MIDDLENAME	NIN	BVN DOB
22222222252	111162	Phil	Holden	Bull	23230042941	05-Apr-1994
22222222253	111161	Golaith	David	Chesnut	01947597293	05-Apr-1994
22222222254	111150	Abdul	Ibrahim	Adesanya	10392320193	05-Apr-1994
22222222255	111159	Bobby	Tamil	Brown	22310291001	05-Apr-1994
22222222256	111158	Tom	Boderick	Phinea	64797232424	05-Apr-1994
22222222257	111157	Victory	Tim	Bucketson	89475355532	05-Apr-1994
22222222258	111156	Jamey	Combs	Jules	55385399222	05-Apr-1994
22222222259	111155	Teasy	Theresa	Plankton	10929832955	05-Apr-1994
22222222260	111141	Speed	Combell	Phils	00929281923	05-Apr-1994
22222222261	111142	Derick	Okeke	Charles	23448292110	05-Apr-1994
22222222263	111145	Golden	Tim	Rice	11380234201	05-Apr-1994
22222222264	111143	James	Raul	Steve	74353922112	05-Apr-1994
22222222265	111136	John	Raul	Tamas	12193230212	05-Apr-1994
22222222266	111230	Chris	Raul	Rock	11392032221	05-Apr-1994
22222222267	111231	Jeremy	Raul	Tamas	90009123223	05-Apr-1994
22222222268	111232	Peter	Raul	Tamas	91192022012	05-Apr-1994
22222222269	111233	Ade	Raul	Josh	48439022212	05-Apr-1994
22222222270	111234	Dan	Raul	Tamas	23747281332	05-Apr-1994
22222222271	111235	Frank	Raul	Tamas	94221118383	05-Apr-1994
22222222272	111236	Sarah	Raul	Tamas	38238229133	05-Apr-1994
22222222273	111237	Jane	Raul	Tamas	29324824921	05-Apr-1994
22222222274	111238	Hope	Raul	Tamas	11100000984	05-Apr-1994
22222222275	111239	Zainab	Raul	Tamas	84532222323	05-Apr-1994
22222222276	111240	Rita	Raul	Tamas	11384244321	05-Apr-1994
22222222277	111240	Paul	Raul	Tamas	48024824321	05-Apr-1994
22222222223	111111	MARIUS	PETERSON	DOE	22345678910	08-Mar-1995
22222222224	111112	FEMI	UCHECHUKWU	ZACK	23230049900	17-Mar-1989
22222222229	111115	JAMES	Tunde	TERRY	29995678910	01-Oct-1988
22222222239	111114	SUNDAY	ABAH	OJIMAOJO	22345678111	05-Apr-1994
22222222235	111124	JAMES	TERRY	Tunde	74353922112	01-Oct-1988
22222222225	111113	SUSAN	UCHECHUKWU	DOE	22225678910	01-Oct-1988
22222222227	111116	CHRISTOPHER	CHINONYE	OGBA	23335678910	05-Apr-1994
22222222230	111117	Steve	DOE	PETERSON	29995678910	08-Mar-1980
22222222226	111118	DAN		DOE	24445678910	20-May-1995

New Account Creation
1.1 Individual (client/tiers/individual)
1.1.1 Account creation with nin and date of birth
API Context: /client/tiers/individual?nin={nin}&dateOfBirth={dateOfBirth}

Description: This endpoint allows you create a new individual account with nin and date of birth only.

note
Accounts created via this method are placed on tier 1 with a daily withdrawal limit and max transaction limit of ₦30000.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Status
nin	Customer's National Identification Number	Mandatory
dateOfBirth	Date Of Birth Registered to Customer's NIN e.g 2002-01-20 (Must be in this date format)	Mandatory

Sample Success Response

    {
    "status": "00",
    "message": "Account created successfully",
    "data": {
        "firstname": "rosapay-Ronald",
        "middlename": "Segun",
        "lastname": "Kareem",
        "currentTier": "1",
        "accountNo": "1001640287"
    }
}


Sample Failure Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{ 
    "status":"199",
    "message":"dob is mandatory"
    }


   {
        "status": "01",
        "message": "Client Account Exists",
        "data": {
            "accountNo": "1000001991"
     }
}


  {
    "status": "102",
    "message": "Invalid nin: 88888888899"
   }


  {
    "status": "103",
    "message": "Date Of Birth Mismatch"
}


{ 
    "status":"929",
    "message":"Error creating client: Contact Admin"
    }


{
    "status":"106",
    "message":"Client's BVN is not linked to any phone number."
}

1.1.2 Account creation with bvn and date of birth
API Context: /client/tiers/individual?bvn={bvn}&dateOfBirth={dateOfBirth}

Description: This endpoint allows you to create a new individual account with bvn and date of birth only.

note
Accounts created via this method are placed on tier 1 with a daily withdrawal limit and max transaction limit of ₦30000.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Status
bvn	Customers Bank Verification Number e.g 22222222222	Mandatory
dateOfBirth	Date Of Birth Registered to Customers BVN e.g 08-Mar-1995 (Must be in this date format)	Mandatory

Sample Success Response

   {
    "status": "00",
    "message": "Account created successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "1",
        "accountNo": "1001640304"
    }
}


Sample Failure Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{ 
    "status":"199",
    "message":"dob is mandatory"
    }


   {
        "status": "01",
        "message": "Client Account Exists",
        "data": {
            "accountNo": "1000001991"
     }
}


  {
    "status": "103",
    "message": "Client's BVN is not linked to any phone number."
   }


  {
    "status": "103",
    "message": "Date Of Birth Mismatch"
   }


{ 
    "status":"929",
    "message":"Error creating client: Contact Admin"
    }


{ 
    "status":"929",
    "message":"Invalid BVN or Could Not Reach BVN Service"
    }


1.1.3 Account creation with nin, bvn and date of birth
API Context: /client/tiers/individual?bvn={bvn}&nin={nin}&dateOfBirth={dateOfBirth}

Description: This endpoint allows you to create a new individual account with nin, bvn and date of birth only.

note
Accounts created via this method are placed on tier 2 with a daily withdrawal limit and max transaction limit of ₦100,000.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Status
bvn	Customer's Bank Verification Number e.g 22222222222	Mandatory
dateOfBirth	Date Of Birth Registered to Customers BVN or Customer's NIN. e.g 08-Mar-1995 (Must be in this format)	Mandatory
nin	Customer's National Identity Number	Mandatory

Sample Success Response

 {
    "status": "00",
    "message": "Account created successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "2",
        "ninVerification": "Successful",
        "ninValidation": "Successful",
        "bvnVerification": "Successful",
        "bvnValidation": "Successful",
        "accountNo": "1001640335",
        "nameMatch": "true"
    }
}


Sample Failure Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{ 
    "status":"199",
    "message":"dob is mandatory"
    }


   {
        "status": "01",
        "message": "Client Account Exists",
        "data": {
            "accountNo": "1000001991"
     }
}


  {
    "status": "199",
    "message": "Invalid bvn: 29787877111, Invalid nin: 89999196600"
   }


{ 
    "status":"929",
    "message":"Error creating client: Contact Admin"
    }


  {
    "status": "103",
    "message": "Client's BVN is not linked to any phone number."
   }


1.1.4 Account creation with nin, bvn, address and date of birth
API Context: /client/tiers/individual?bvn={bvn}&nin={nin}&address={address}&dateOfBirth={dateOfBirth}

Description: This endpoint allows you to create a new individual account with nin, bvn, address and date of birth only.

note
Accounts created via this method are placed on tier 3 with a daily withdrawal limit of ₦10,000,000 and a max transaction limit of ₦1,000,000.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Status
bvn	Customer's Bank Verification Number e.g 22222222222	Mandatory
dateOfBirth	Date Of Birth Registered to Customers BVN or Customer's NIN. e.g 08-Mar-1995 (Must be in this format)	Mandatory
nin	Customer's National Identity Number	Mandatory
address	Customer's address	Mandatory

Sample Success Response

{
    "status": "00",
    "message": "Account created successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "3",
        "ninVerification": "Successful",
        "ninValidation": "Successful",
        "bvnVerification": "Successful",
        "bvnValidation": "Successful",
        "accountNo": "1001640342",
        "nameMatch": "true",
        "address": "10, Johnson Street, Ikeja, Lagos"
    }
}


Sample Failure Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{ 
    "status":"199",
    "message":"dob is mandatory"
    }


   {
        "status": "01",
        "message": "Client Account Exists",
        "data": {
            "accountNo": "1000001991"
     }
}


  {
    "status": "199",
    "message": "Invalid bvn: 29787877111,Invalid nin: 89999196600"
   }


{ 
    "status":"929",
    "message":"Error creating client: Contact Admin"
    }


  {
    "status": "103",
    "message": "Client's BVN is not linked to any phone number."
   }


1.1.5 Duplicate individual account creation
API Context: /client/tiers/individual?previousAccountNo={previousAccountNo}

Description: This API endpoint allows you to create a duplicate account for an existing individual client.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Status
previousAccountNo	Individual client's previous account	Mandatory

Sample Success Response

 {
    "status": "00",
    "message": "Account created successfully",
    "data": {
        "firstname": "rosapay-Paul",
        "middlename": "Smith",
        "lastname": "Doe",
        "accountNo": "1001631397"
    }
}


Sample Failure Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{
    "status": "929",
    "message": "Invalid Previous Account: 9001630761"
}


{
    "status": "929",
    "message": "Invalid Previous Account: 1001630761. Kindly update the previous account with its bvn or nin"
}



{
    "status": "929",
    "message": "Account under review: 1001630761. Contact admin"
}


1.2 Client Upgrade
API Context: /client/update

Description: This endpoint enables you upgrade the tier of an existing individual account only.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
1.2.1 Account upgrade to tier 2 for a tier 1 account created with nin and date of birth only
Sample Request

{
    "accountNo": "1001637241",
    "bvn": "23448292110"
}

Request Body	Description	Required
accountNo	Existing individual account	Mandatory
bvn	Individual's bvn	Mandatory

Sample Success Response

 {
    "status": "00",
    "message": "Account upgraded successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "2",
        "bvnVerification": "Successful"
    }
}


1.2.2 Account upgrade to tier 3 for a tier 1 account created with nin and date of birth only
Sample Request

{
    "accountNo": "1001637241",
    "bvn": "23448292110",
    "address":"5, Johnson Str, Ikeja, Lagos"
}

Request Body	Description	Required
accountNo	Existing individual account	Mandatory
bvn	Individual's bvn	Mandatory
address	Individual's address	Optional if it was passed during account creation else must be passed

Sample Success Response

 {
    "status": "00",
    "message": "Account upgraded successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "3",
        "bvnVerification": "Successful"
    }
}


1.2.3 Account upgrade to tier 2 for a tier 1 account created with bvn and date of birth only
Sample Request

{
    "accountNo": "1001640294",
    "nin": "22228819111"
}

Request Body	Description	Required
accountNo	Existing individual account	Mandatory
nin	Individual's nin	Mandatory

Sample Success Response

 {
    "status": "00",
    "message": "Account upgraded successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "2",
        "ninVerification": "Successful"
    }
}

1.2.4 Account upgrade to tier 3 for a tier 1 account created with bvn and date of birth only
Sample Request

{
    "accountNo": "1001640294",
    "nin": "22228819111",
    "address":"5, Johnson Str, Ikeja, Lagos"
}

Request Body	Description	Required
accountNo	Existing individual account	Mandatory
nin	Individual's nin	Mandatory
address	Individual's address	Optional if it was passed during account creation else must be passed

Sample Success Response

{
    "status": "00",
    "message": "Account upgraded successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "3",
        "ninVerification": "Successful"
    }
}

1.2.5 Account upgrade to tier 3 for a tier 2 account
Sample Request

{
    "accountNo": "1001640335",
    "address":"5, Johnson Str, Ikeja, Lagos"
}

Request Body	Description	Required
accountNo	Existing individual account	Mandatory
address	Individual's address	Optional if it was passed during account creation else must be passed

Sample Success Response

{
    "status": "00",
    "message": "Account upgraded successfully",
    "data": {
        "firstname": "rosapay-Zack",
        "middlename": "Rock",
        "lastname": "Doe",
        "currentTier": "3",
        "ninVerification": "Successful"
    }
}


Sample Failed Responses

{
    "status": "199",
    "message": "No previous account found"
}


{
"status": "199",
"message": "Unable to upgrade account"
}

1.3 Corporate (client/tiers/corporate)
1.3.1 Corporate account creation
API Context: /client/tiers/corporate

Description: This endpoint enables you create an account for a corporate client.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "rcNumber": "9876212",
    "companyName": "Famous Technologies",
    "incorporationDate": "05 January 2005",
    "bvn": "22222222226",
    "tin":"",
    "nin":"24445678910",
    "address":"12, newton street, ikeja, lagos",
    "businessType":"RC",
    "state":"Lagos"
}

Request Body	Description	Required
rcNumber	Company’s RC Number	Mandatory
companyName	Company’s Name	Mandatory
incorporationDate	Company’s Incorporation Date e.g 05 January 2021 (Must be in this date format)	Mandatory
bvn	BVN of one of company's board of directors	Mandatory
nin	NIN of one of company's board of directors	Mandatory
tin	Company's Tax Identification Number	Optional
address	Company's address	Mandatory
businessType	Type of rcNumber. It can be RC For Limited Liability Companies (Ltd, PLC) or BN for Sole Proprietorships & Partnerships	Mandatory
state	State where company is located	Mandatory

Sample Success Response

 {
         "status": "00",
         "message": "Successful Corporate Creation",
         "data": {
                "accountNo": "1000053589",
                "accountName": "Famous Technologies"
            }
     }


Sample Failed Responses

  { 
      "status":"199",
      "message":"address is mandatory"
  }


  { 
      "status":"199",
      "message":"incorporationNumber is mandatory"
  }


  { 
      "status":"199",
      "message":"bvn is mandatory"
  }


  { 
      "status":"199",
      "message":"nin is mandatory"
  }


  { 
      "status":"199",
      "message":"businessName is mandatory"
  }


  { 
      "status":"199",
      "message":"incorporationDate is mandatory"
  }


     { 
       "status":"01",
       "message":"Client Account Exists",
       "data": {"accountNo":"1000053589"}
    }


{ 
    "status":"199",
    "message":"Invalid Rc number: 000001"
}


{ 
    "status":"199",
    "message":"Invalid NIN: 1000000001"
}


{ 
    "status":"102",
    "message":"Invalid BVN or Could Not Reach BVN Service"
}


1.3.2 Test Data (RC Number Bio data)
RC Number	Company name	Business Type
9889992	Victory Technologies	RC
9876555	James Technologies	RC
9876548	APP Vest Ltd	RC
9876543	Famous Farms	RC
9876522	Chris Technologies	RC
9876321	Chris Farms	RC
9876212	Famous Technologies	RC
9821543	Kemi Technologies	RC
9111998	Dan gardens	RC
3782902	Sam gardens	RC
2290991	Ken gardens	RC
0981771	Zack Foods	RC
0276543	Dan Foods	RC
1.3.3 Corporate Duplicate Account Creation
API Context: /client/tiers/corporate

Description: This endpoint enables you create a duplicate account for an existing corporate client.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
     "previousAccountNo": "1001631690"
}

Request Body	Description	Required
previousAccountNo	Corporate client's previous account	Mandatory

Sample Success Response

  {
    "status": "00",
    "message": "Successful Corporate Creation",
    "data": {
        "accountNo": "1001631634",
        "accountName": "Roland Technologies"
    }
}


Sample Failed Responses

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{
    "status": "929",
    "message": "Invalid Previous Account: 9001630761"
}


{
    "status": "929",
    "message": "Invalid Previous Account: 1001630761. Kindly update the previous account with its bvn or nin"
}



{
    "status": "929",
    "message": "Account under review: 1001630761. Contact admin"
}


1.4 Corporate Sub Account Creation
API Context: /client/corporate/sub-account

Description: This endpoint enables you do two things:

Create a branch account for an existing corporate client.
Create another account for an existing corporate client that would serve a different purpose e.g Settlement, etc.
API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
How to use the Sub Account Creation api
Option 1: If you want to create a branch account for an existing corporate client, use the payload below

    {
        "parentAccountNo":"1001631634",
        "branch":"Lekki"
    }

Request Body	Description	Required
parentAccountNo	Existing corporate client account	Mandatory
branch	Branch name	Mandatory
tip
If the parentAccountNo belongs to a company with name XYZ and you pass branch as Lekki, the new account created would have a name XYZ-Lekki


Sample Success Response

  {
    "status": "00",
    "message": "Successful Corporate Creation",
    "data": {
        "accountNo": "1001631621",
        "accountName": "Roland Technologies-Lekki"
    }
}


Option 2: If you want to create another account for an existing corporate client that would serve a different purpose e.g Settlement, use the payload below

    {
        "parentAccountNo":"1001631634",
        "type":"Settlement"
    }

Request Body	Description	Required
parentAccountNo	Existing corporate client account	Mandatory
type	purpose of the new account e.g Settlement, Logistics, etc.	Mandatory
tip
If the parentAccountNo belongs to a company with name XYZ and you pass type as Settlement, the new account created would have a name XYZ-Settlement


Sample Success Response

  {
    "status": "00",
    "message": "Successful Corporate Creation",
    "data": {
        "accountNo": "1001631784",
        "accountName": "Roland Technologies-Settlement"
    }
}


Sample Failure Responses For Sub Account Creation

{
    "status": "119",
    "message": "Not Authorized to Create Clients"
}


{
    "status": "929",
    "message": "Invalid Parent Account: 9001630761"
}


{
    "status": "929",
    "message": "Invalid Parent Account: 1001630761. Kindly update the parent account with its bvn or nin"
}



{
    "status": "929",
    "message": "Parent account under review: 1001630761. Contact admin"
}


1.5 Test Data (BVN Bio data)
BVN	OTP	BVN-FIRSTNAME	BVN_LASTNAME	BVN_MIDDLENAME	NIN	BVN DOB
22222222252	111162	Phil	Holden	Bull	23230042941	05-Apr-1994
22222222253	111161	Golaith	David	Chesnut	01947597293	05-Apr-1994
22222222254	111150	Abdul	Ibrahim	Adesanya	10392320193	05-Apr-1994
22222222255	111159	Bobby	Tamil	Brown	22310291001	05-Apr-1994
22222222256	111158	Tom	Boderick	Phinea	64797232424	05-Apr-1994
22222222257	111157	Victory	Tim	Bucketson	89475355532	05-Apr-1994
22222222258	111156	Jamey	Combs	Jules	55385399222	05-Apr-1994
22222222259	111155	Teasy	Theresa	Plankton	10929832955	05-Apr-1994
22222222260	111141	Speed	Combell	Phils	00929281923	05-Apr-1994
22222222261	111142	Derick	Okeke	Charles	23448292110	05-Apr-1994
22222222263	111145	Golden	Tim	Rice	11380234201	05-Apr-1994
22222222264	111143	James	Raul	Steve	74353922112	05-Apr-1994
22222222265	111136	John	Raul	Tamas	12193230212	05-Apr-1994
22222222266	111230	Chris	Raul	Rock	11392032221	05-Apr-1994
22222222267	111231	Jeremy	Raul	Tamas	90009123223	05-Apr-1994
22222222268	111232	Peter	Raul	Tamas	91192022012	05-Apr-1994
22222222269	111233	Ade	Raul	Josh	48439022212	05-Apr-1994
22222222270	111234	Dan	Raul	Tamas	23747281332	05-Apr-1994
22222222271	111235	Frank	Raul	Tamas	94221118383	05-Apr-1994
22222222272	111236	Sarah	Raul	Tamas	38238229133	05-Apr-1994
22222222273	111237	Jane	Raul	Tamas	29324824921	05-Apr-1994
22222222274	111238	Hope	Raul	Tamas	11100000984	05-Apr-1994
22222222275	111239	Zainab	Raul	Tamas	84532222323	05-Apr-1994
22222222276	111240	Rita	Raul	Tamas	11384244321	05-Apr-1994
22222222277	111240	Paul	Raul	Tamas	48024824321	05-Apr-1994
22222222223	111111	MARIUS	PETERSON	DOE	22345678910	08-Mar-1995
22222222224	111112	FEMI	UCHECHUKWU	ZACK	23230049900	17-Mar-1989
22222222229	111115	JAMES	Tunde	TERRY	29995678910	01-Oct-1988
22222222239	111114	SUNDAY	ABAH	OJIMAOJO	22345678111	05-Apr-1994
22222222235	111124	JAMES	TERRY	Tunde	74353922112	01-Oct-1988
22222222225	111113	SUSAN	UCHECHUKWU	DOE	22225678910	01-Oct-1988
22222222227	111116	CHRISTOPHER	CHINONYE	OGBA	23335678910	05-Apr-1994
22222222230	111117	Steve	DOE	PETERSON	29995678910	08-Mar-1980
22222222226	111118	DAN		DOE	24445678910	20-May-1995

KYC Enquiry
1. Get Client using BVN
API Context /client?bvn={bvn}

This endpoint is used to get client information using the BVN number of the client.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

bvn	22222222229

Sample Response

{
    "status": "00",
    "message": "BVN Details Retrieved Successfully",
    "data": {
        "firstName": "DANIEL",
        "middleName": "MOSES",
        "lastName": "BABATUNDE",
        "gender": "Male",
        "dateOfBirth": "05-Oct-1988",
        "phoneNo": "09070658263",
        "pixBase64": ""
    }
}


Sample Failed Response

{
    "status": "102",
    "message": "Invalid BVN or Could Not Reach BVN Service"
}

2. BVN Account Lookup
Before initiating the BVN account lookup call, it is necessary to obtain BVN consent first.

2.1. BVN Consent
API Context:  /bvn-consent?bvn={bvn}&type={type}&reference={reference}

Description: This endpoint allows you to obtain consent using a customer's BVN.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Field	Description	Required
type	03	Mandatory
bvn	e.g 22222222229	Mandatory
reference	Unique reference for a particular bvn consent (max 250 characters)	Optional
info
You should use any of the below test bvns and their respective otps for this call

22222222223, Otp: 111111
22222222224, Otp: 111112
22222222229, Otp: 111115
info
Note: After obtaining consent, proceed to call the BVN Account Lookup API.


SAMPLE RESPONSE : Consent Given

{
    "status": "00",
    "message": "Consent response",
    "data": {
        "statusCode": "true",
        "reference":"595-22222222231-250927022024"
    }
}

SAMPLE RESPONSE : Consent Not Given

{
    "status": "00",
    "message": "Consent response",
    "data": {
        "statusCode": "false",
        "url": "https://services.vfdtech.ng/",
        "reference":"595-22222222231-250927022024"
    }
}


info
In case consent is not given, proceed to the URL provided to initiate a request for BVN consent.


2.2. BVN Account Lookup
API Context : /bvn-account-lookup?bvn={bvn}

This endpoint retrieves all the bank accounts linked with a bvn(Bank Verification Number).

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
bvn	Customer's bvn number	Mandatory
info
For '/bvn-account-lookup', you can use any of the below test bvns

22222222223
22222222224
22222222229

Sample Response

{
    "status": "00",
    "message": "Successful",
    "data": [
        {
            "accountname": "TEST NAME ONE",
            "accountnumber": "0001091234",
            "accountDesignation": "2",
            "accountstatus": "1",
            "accounttype": "2",
            "institution": "9",
            "branch": "0491",
            "accounttier": "0",
            "nipCode": "000004",
            "BankCode": "033",
            "BankName": "UBA Bank",
            "AccountDesignationName": "INDIVIDUAL",
            "AccountTypeName": "SAVINGS"
        },
        {
            "accountname": "TEST NAME TWO",
            "accountnumber": "3090091234",
            "accountDesignation": "2",
            "accountstatus": "1",
            "accounttype": "2",
            "institution": "10",
            "branch": "4671683",
            "accounttier": "0",
            "nipCode": "000016",
            "BankCode": "011",
            "BankName": "First Bank",
            "AccountDesignationName": "INDIVIDUAL",
            "AccountTypeName": "SAVINGS"
        },
        {
            "accountname": "TEST NAME THREE",
            "accountnumber": "6090091234",
            "accountDesignation": "2",
            "accountstatus": "1",
            "accounttype": "2",
            "institution": "6",
            "branch": "0691",
            "accounttier": "0",
            "nipCode": "000007",
            "BankCode": "070",
            "BankName": "Fidelity Bank",
            "AccountDesignationName": "INDIVIDUAL",
            "AccountTypeName": "SAVINGS"
        }
    ]
}

Account Enquiry
1. Sub accounts
API Context: /sub-accounts?entity={entity}&size={size}&page={page}

This endpoint is used to fetch all virtual accounts or corporate accounts or individual accounts created for a wallet depending on what is passed as entity.

If entity passed is:
a) virtual ==> all virtual accounts created on wallet are returned
b) individual ==> all individual accounts created on wallet are returned
c) corporate ==> all corporate accounts created on wallet are returned

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
entity	can be virtual, individual or corporate	Mandatory
page	page no starts from 0	Mandatory
size	page size	Mandatory

Sample Response

{
    "status": "00",
    "message": "Successful",
    "data": {
        "content": [
            {
                "lastName": "PETERSON",
                "phone": "Tes109019056926",
                "firstName": "TestWalletSteve",
                "createdDate": "2023-06-08 16:21:40.0",
                "clientId": "140009",
                "bvn": "Test122222222244",
                "accountNo": "1000000000"
            },
            {
                "lastName": "ABAH",
                "phone": "Tes09019056916",
                "firstName": "TestWalletSUNDAY",
                "createdDate": "2023-06-08 16:20:10.0",
                "clientId": "141000",
                "bvn": "Test122222222245",
                "accountNo": "1000000020"
            }
        ],
        "totalElements": 2,
        "totalPages": 1
    }
}


Sample Failure Response

{
    "status":"500",
    "message":"Internal Server Error"
}

Transfer Services
1. Account Enquiry
API Context: /account/enquiry?accountNumber={accountNumber}

This endpoint is used to get account details of a transfer sender. When accountNumber is not passed the pool account details is returned.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
accountNumber	Customer's Account Number	Optional

Sample Response Without An Account Number

{
    "status": "00",
    "message": "Account Details",
    "data": {
        "accountNo": "1001554791",
        "accountBalance": "14764178.880000",
        "accountId": "155479",
        "client": "Babatunde Moses Daniel",
        "clientId": "138421",
        "savingsProductName": "Corporate Current Account"
    }
}


Sample Response With An Account Number

{
    "status": "00",
    "message": "Account Details",
    "data": {
        "accountNo": "1001547795",
        "accountBalance": "0.000000",
        "accountId": "154779",
        "client": "ANNA OGECHI ABEL",
        "clientId": "5613",
        "savingsProductName": "Corporate Current Account"
    }
}

2. Beneficiary Enquiry
API Context: /transfer/recipient?accountNo={accountNo}&bank={bank}&transfer_type={transfer_type}

This endpoint is used to get a transfer recipient account details

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
accountNo	Customer's Account Number	Mandatory
bank	Customer's Bank Code	Mandatory
transfer_type	Transfer type	Mandatory

Sample Response

{
    "status": "00",
    "message": "Account Found",
    "data": {
        "name": "Babatunde Moses Daniel",
        "clientId": "138421",
        "bvn": "22155258549",
        "account": {
            "number": "1001554818",
            "id": "155481"
        },
        "status": "active",
        "currency": "NGN",
        "bank": "VFD Microfinance Bank"
    }
}


Sample Failed Responses

Account Not Found: This occurs when the specified account does not exist.
Ensure you validate the account number and retry the request.
{ "status":"104","message":"Account Not Found"}


Internal Server Error: This occurs when there is a server-side error.
Kindly retry the request. If the issue persists, escalate to support.
 { "status":"500","message":"Internal Server Error"}


3. Bank List
API Context: /bank

Description: This endpoint is used to fetch the list of all nigerian banks and bank codes

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
4. Transfer
API Context : /transfer

Description: This endpoint performs funds transfer(withdrawals)

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

HOW TO MAKE A TRANSFER

During Transfer the first process is to call the account enquiry API (a) to get the From details for the transfer payload.

The second process is to call the bank list API to get the bank codes.

The third process is to call the transfer recipient endpoint (b) to get the beneficiary or ‘’TO’’ details.

The fourth process is to generate the signature using SHA512(fromAccount ToAccount). The accounts should be concatenated together. There is a table below that shows how to populate the transfer payload

Sample Request

{
    "fromAccount": "1001561522",
    "uniqueSenderAccountId": "",
    "fromClientId": "139213",
    "fromClient": "RolandPay-Roland Bright Doe",
    "fromSavingsId": "156152",
    "fromBvn": "Rolandpay-birght 221552585559",
    "toClientId": "139214",
    "toClient": "RolandPay-Roland Bright Doe",
    "toSavingsId": "156153",
    "toSession": "",
    "toBvn": "11111111111",
    "toAccount": "1001561539",
    "toBank": "999999",
    "signature": "899358f98ae041aa7471bdc03797b1f64c6f96a542955023849d2dbddb1cf7318d8599e9692b1345b8383288dc8550ed70f1de6aa2ea6a149f48d515c9e6eb1e",
    "amount": "1006765",
    "remark": "trf download",
    "transferType": "intra",
    "reference": "TestWallet-fhehfhgdrtrewe"
}


Field	Description	Pointer	Status
fromAccount	This is the account Number to Initiate Disbursement	(a) accountNo	Mandatory
fromClientId	This is the clientId of account Number to initiate disbursement	(a) clientId	Mandatory
fromClient	This is the client Name of account Number to initiate disbursement	(a) client	Mandatory
fromSavingsId	This is the savings Id of account Number to initiate disbursement	(a) accountId	Mandatory
uniqueSenderAccountId	This is the savings Id of the account number of the wallet customer initiating the disbursement.

It is only required in pool implementation for customers creating sub accounts who want to enable the receiving bank and the recipient know who the exact sender is(in this case the sub account sending the funds).

This can be gotten by doing an account enquiry on the actual sender's account number	(a) accountId	Optional
fromBvn	This is the bvn of account Number to initiate disbursement	(a) bvn	if present, should be passed
toClientId	This is the beneficiary clientId	(b) clientId	Mandatory(Intra)
toClient	This is the beneficiary Client Name	(b) name	Mandatory
toSavingsId	This is beneficiary savings Id	(b) account.id	Mandatory(Intra)
toSession	This is beneficiary session Id	(b) account.id	Mandatory(Inter)
toBvn	This is Beneficiary BVN	(b) bvn	if present, should be passed
toAccount	This is beneficiary Account number	(b) account.number	Mandatory
toBank	This is beneficiary bank Code, it is returned from banklist		Mandatory
signature	Contact admin		Mandatory
amount	This is the transaction amount		Mandatory
remark	This is the transaction remark or customer narration		Mandatory
transferType	This is the transfer type can either be intra(VFD -VFD) or inter(VFD - Other Banks)		Mandatory
reference	This is a unique randomly generated string must be prefixed with wallet name e.g TestWallet-AWW3WDIUWU4U		Mandatory

Sample Response Inter

{
    "status": "00",
    "message": "Successful Transfer",
    "data": {
        "txnId": "TestWallet-AWW3WDIUWU4U",
        "sessionId": "090110220420225737701409365803",
        "reference": "1650491857685"
    }
}


Sample Response Intra

  { 
  "status":"00",
  "message":"Successful Transfer",
  "data":
      {
      "txnId": "TestWallet-AWW3WDIUWU4U"
      }
  }


Sample Failed Responses

Failed Transaction: This normally occurs when your transfer payload is incorrect or the fromAccount is on PND (Post No Debit)

{
    "status": "99",
    "message": "Failed Transaction",
    "data": {
        "txnId": "TestWallet-AWW3WDIUWU4U"
    }
}


Signature Mismatch: This occurs when the signature passed is incorrect

{
    "status": "02",
    "message": "Signature Mismatch"
}


Invalid source account: This occurs when the fromSavingsId field in the transfer payload does not match the accountId (gotten from /account/enquiry endpoint) of the fromAccount

{
    "status": "99",
    "message": "Invalid source account",
    "data": {
        "txnId": "TestWallet-AWW3WDIUWU4U"
    }
}


Invalid source:

For Pool Implementation, this occurs when you are transferring from an account that's not your pool account
For 1-1 Implementation, this occurs when you're transferring from an account that does not belong to your wallet
{
    "status": "99",
    "message": "Invalid source",
    "data": {
        "txnId": "TestWallet-AWW3WDIUWU4U"
    }
}


Invalid uniqueSenderAccountId: This would be gotten if you are using a wrong account savings id, a savings id of a wallet you didn't create or the savings id of your pool account.

{ 
  "status":"98",
  "message":"Invalid uniqueSenderAccountId"
}


Invalid transfer type: This is gotten if the transfer type provided is not supported.

{ "status":"99","message":"Invalid transfer type"}


Transaction Exist: This is gotten if the reference of that transaction has been used before.

{ "status":"98","message":"Transaction Exist"}

5. Bulk Transfer
API Context : /bulk/transfer

Description: This API handles bulk Transfer.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

[
  {
    "fromSavingsId": "157448",
    "amount": "33400",
    "uniqueSenderAccountId": "",
    "toAccount": "1081696143",
    "signature": "xxxx",
    "fromAccount": "1001574489",
    "toBvn": "rosapay-222222",
    "remark": "test",
    "fromClientId": "140455",
    "fromClient": "John doe",
    "toKyc": "",
    "reference": "txn-gtxia7pmz5dsdds444g5ducy5gxprd",
    "toClientId": "154799",
    "toClient": "Rosapay-Phil Bull Holden",
    "toSession": "",
    "transferType": "intra",
    "toBank": "999999",
    "toSavingsId": "169614"
  },
  {
    "fromSavingsId": "157448",
    "amount": "3400",
    "uniqueSenderAccountId": "",
    "toAccount": "1041696143",
    "signature": "xxxxx",
    "fromAccount": "1001574489",
    "toBvn": "rosapay-222222",
    "remark": "test",
    "fromClientId": "140455",
    "fromClient": "John doe",
    "toKyc": "",
    "reference": "txn-gtxia7pmz5g5durercy5gxprd",
    "toClientId": "154799",
    "toClient": "Rosapay-Phil Bull Holden",
    "toSession": "",
    "transferType": "intra",
    "toBank": "999999",
    "toSavingsId": "169614"
  },
  {
    "fromSavingsId": "157448",
    "amount": "100",
    "uniqueSenderAccountId": "",
    "toAccount": "1001696143",
    "signature": "xxxx",
    "fromAccount": "1001574489",
    "toBvn": "Rosapay-222222",
    "remark": "test",
    "fromClientId": "140455",
    "fromClient": "John doe",
    "toKyc": "",
    "reference": "txn-gtxia7pmz5geweew5ducy5gxprd",
    "toClientId": "154799",
    "toClient": "Rosapay-Phil Bull Holden",
    "toSession": "",
    "transferType": "intra",
    "toBank": "999999",
    "toSavingsId": "169614"
  }
]


Sample Response

{
  "status": "00",
  "message": "Successful",
  "data": {
    "createdAt": "2026-07-31T12:46:23.766716",
    "batchId": "bd6b4ca2-432e-486d-a6f3-a7bd837f231e",
    "totalCount": 4,
    "status": "PROCESSING"
  }
}


6. Bulk Transfer Enquiry
API Context: /bulk/transfers?batchId={batchId}

Description: This API is used to check the transaction enquiry of a bulk transfer.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
batchId	Transaction Batch ID	Mandatory

Sample Response

{
  "status": "00",
  "message": "Transactions retrieved successfully",
  "data": [
    {
      "batchId": "bd91c058-c347-412b-b559-e859b3230b73",
      "reference": "TestWallet-8909203902",
      "fromAccount": "1001561522",
      "uniqueSenderAccountId": null,
      "fromClientId": "139213",
      "fromClient": "RolandPay-Roland Bright Doe",
      "fromSavingsId": "156152",
      "fromBvn": "Rolandpay-birght 221552585559",
      "toClientId": "139214",
      "toClient": "RolandPay-Roland Bright Doe",
      "toSavingsId": "156153",
      "toSession": "",
      "toBvn": "11111111111",
      "toAccount": "1001561539",
      "toBank": "999999",
      "amount": 1006765.00,
      "remark": "trf groceries",
      "signature": null,
      "transferType": "intra",
      "processState": "UNKNOWN",
      "transactionStatus": null,
      "createdAt": "2026-07-29T08:48:07",
      "updatedAt": null
    },
    {
      "batchId": "bd91c058-c347-412b-b559-e859b3230b73",
      "reference": "TestWallet-8498595093",
      "fromAccount": "1001561522",
      "uniqueSenderAccountId": null,
      "fromClientId": "139213",
      "fromClient": "RolandPay-Roland Bright Doe",
      "fromSavingsId": "156152",
      "fromBvn": "Rolandpay-birght 221552585559",
      "toClientId": "139214",
      "toClient": "RolandPay-Roland Bright Doe",
      "toSavingsId": "156153",
      "toSession": "",
      "toBvn": "11111111111",
      "toAccount": "1001561539",
      "toBank": "999999",
      "amount": 1006765.00,
      "remark": "trf school fees",
      "signature": null,
      "transferType": "intra",
      "processState": "PROCESSED",
      "transactionStatus": null,
      "createdAt": "2026-07-29T08:48:07",
      "updatedAt": null
    },
    {
      "batchId": "bd91c058-c347-412b-b559-e859b3230b73",
      "reference": "TestWallet-989e9r0e9",
      "fromAccount": "1001561522",
      "uniqueSenderAccountId": null,
      "fromClientId": "139213",
      "fromClient": "RolandPay-Roland Bright Doe",
      "fromSavingsId": "156152",
      "fromBvn": "Rolandpay-birght 221552585559",
      "toClientId": "139214",
      "toClient": "RolandPay-Roland Bright Doe",
      "toSavingsId": "156153",
      "toSession": "",
      "toBvn": "11111111111",
      "toAccount": "1001561539",
      "toBank": "999999",
      "amount": 1006765.00,
      "remark": "trf download",
      "signature": null,
      "transferType": "intra",
      "processState": "UNKNOWN",
      "transactionStatus": null,
      "createdAt": "2026-07-29T08:48:07",
      "updatedAt": null
    }
  ]
}



7. Transfer Webhook Notification
Transfer webhook notification is sent when an outbound transfer has been processed. The webhook is delivered as a POST request and includes the transfer status, event name, and transaction details.

Webhook Event: payout.success or payout.failed

HTTP Method: POST

Sample Success Payload

{
    "status": "00",
    "message": "success",
    "event": "payout.success",
    "data": {
        "reference": "TestWallet-AWW3WDIUWU4U",
        "amount": "1000",
        "account_number": "1001561539",
        "originator_account_number": "1001561522",
        "originator_account_name": "RolandPay-Roland Bright Doe",
        "originator_bank": "999999",
        "timestamp": "2026-08-14T10:00:00.000Z",
        "session_id": "090110220420225737701409365803",
        "transfer_type": "intra",
        "charge": "20",
        "batchId": "BATCH-001"
    }
}

Field	Description
status	Transfer status returned by the payout engine.
message	Status message returned by the webhook.
event	Webhook event name.
data.reference	Unique transfer reference.
data.amount	Transfer amount.
data.account_number	Beneficiary account number.
data.originator_account_number	Sender account number.
data.originator_account_name	Sender account name.
data.originator_bank	Sender bank code.
data.timestamp	Notification timestamp.
data.session_id	Transaction session ID.
data.transfer_type	Transfer type, such as intra or inter.
data.charge	Applied transfer charge.
data.batchId	Batch identifier for bulk transfer, when the transfer is part of a bulk transfer
Sample Failure Payload

{
    "status": "99",
    "message": "failed",
    "event": "payout.failed",
    "data": {
        "reference": "TestWallet-AWW3WDIUWU4U",
        "batchId": "BATCH-001"
    }
}

note
When sharing a webhook with us, security measures such as Authentication or IP whitelisting are advised to be in place.

Also, your webhook url should respond with a 200 status code once notified successfully.

8. Test Accounts
For inter transfer in test environment, use 1111111103 for accountNo and 000002 as bank to get the transfer recipient details. While for intra transfer you can use 1000074944 and 999999 as accountNo and bank respectively to get the transfer recipient details.

9. Transaction Status Query (TSQ)
API Context:

Search By Reference: /transactions?reference={reference}

Search By SessionId: /transactions?sessionId={sessionId}

Description: This endpoint is used to query the status of a transaction by providing either the transaction reference or sessionId.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
Reference	Transaction Unique Reference	Optional
SessionId	Transaction Unique SessionId	Optional

Sample Response

{
    "status": "00",
    "message": "Successful Transaction Retrieval",
    "data": {
        "TxnId": "TestWallet-1019101910190993",
        "amount": "500000.00",
        "accountNo": "1000058012",
        "fromAccountNo": "1000075901",
        "transactionStatus": "99",
        "transactionDate": "2023-01-11 08:05:25.0",
        "toBank": "999999",
        "fromBank": "999999",
        "sessionId": "",
        "bankTransactionId": "",
        "transactionType": "OUTFLOW"
    }
}

note
Pls work with the transactionStatus field in the response above to confirm the transaction's current status


Sample Failed Responses:

No Transaction: This occurs when no transaction was found for the provided reference.
Confirm that the transaction reference is correct, then retry the TSQ (Transaction Status Query) process. If the issue persists, escalate it to support.
{ "status":"108","message":"No Transaction!"}


TransactionId or SessionId Is Mandatory: This occurs when there is a missing transaction or session ID in your request.
Ensure that the transactionId or sessionId is included in the request and retry the TSQ process.
{ "status":"199","message":"TransactionId or SessionId Is Mandatory" }


10. Transaction Reversal Status Query (TRSQ)
API Context /transactions/reversal?reference={reference}

This endpoint is used to query the reversal status of a transaction.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
reference	Transaction Unique Reference	Mandatory

Sample Response

{
  "status": "00",
  "message": "Successful",
  "data": {
    "amount": "500",
    "reversalStatus": "00",
    "reversalDate": "2026-03-11 15:23:12",
    "reversalId": "2802306",
    "sessionId": "090110230930134752962090709204"
  }
}

11. Credit
API Context: /credit

Description: This endpoint allows you to simulate an inflow on the dev environment

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
  "amount": "8000",
  "accountNo": "1003500000",
  "senderAccountNo": "5050104057",
  "senderBank": "999070",
  "senderNarration": "Test credit"
}

Field	Description	Status
amount	Amount to fund	Mandatory
accountNo	Account Number to receive funding	Mandatory
senderAccountNo	Account Number to initiate disbursement	Mandatory
senderBank	Bank Code of Account Number to initiate disbursement	Mandatory
senderNarration	Sender narration	Mandatory

Note: For senderAccountNo and senderBank you can use 5050104070 and 000002 respectively

Sample Response

{
    "status": "00",
    "message":"Successfully notified"
}

CODES DESCRIPTION FOR TRANSFER API
Code	Description	Category	Reversal Instruction	TSQ Required
00	Approved or Completed Successfully	SUCCESSFUL	No Reversal	No
01	Status Unknown, Please wait for Settlement Report	PENDING	No Reversal	Yes
02	Status Unknown, Please wait for Settlement Report	PENDING	No Reversal	Yes
03	Invalid Sender	FAILED	Reversal	No
05	Do not Honor	FAILED	Reversal	No
06	Dormant Account	FAILED	Reversal	No
07	Invalid Account	FAILED	Reversal	No
08	Account Name Mismatch	FAILED	Reversal	No
09	Request Processing in Progress	PENDING	No Reversal	Yes
12	Invalid Transaction	FAILED	Reversal	No
13	Invalid Amount	FAILED	Reversal	No
14	Invalid Batch Number	FAILED	Reversal	No
15	Invalid Session or Record ID	FAILED	Reversal	No
16	Unknown Bank Code	FAILED	Reversal	No
17	Invalid Channel	FAILED	Reversal	No
18	Wrong Method Call	FAILED	Reversal	No
21	Failed with reversal	FAILED	Reversal	No
25	Unable to Locate Record	PENDING	No Reversal	Yes
26	Successful	SUCCESSFUL	No Reversal	No
30	Format Error	FAILED	Reversal	No
34	Suspected Fraud	FAILED	No Reversal	No
35	Contact Sending Bank	FAILED	No Reversal	No
51	No Sufficient Funds	FAILED	No Debit	No
57	Transaction not Permitted to Sender	FAILED	Reversal	No
58	Transaction not Permitted on Channel	FAILED	Reversal	No
61	Transaction Limit Exceeded	FAILED	Reversal	No
63	Security Violation	FAILED	No Reversal	No
65	Exceeds Withdrawal Frequency	FAILED	Reversal	No
68	Response Received Too Late	FAILED	Reversal	No
69	Unsuccessful Account/Amount Block	FAILED	Reversal	No
70	Unsuccessful Account/Amount Block	FAILED	Reversal	No
71	Empty Mandate Reference Number	FAILED	Reversal	No
81	Transaction Failed	FAILED	Reversal	No
91	Beneficiary Bank Not Available	FAILED	Reversal	Yes
92	Routing Error	FAILED	Reversal	No
94	Duplicate Transaction	PENDING	No Reversal	Yes
96	System Malfunction	PENDING	No Reversal	Yes
97	Timeout Waiting for response from Destination	FAILED	Reversal	No
98	Transaction Exists	FAILED	No Debit	Yes
99	Transaction Failed	FAILED	No Debit	No
500	Internal server error	PENDING	No Reversal	Yes
null	Failed with reversal	FAILED	Reversal	Yes
note
Quick Guide – Handling of Transaction Status codes

FAILED RESPONSES → Run TSQ to confirm → If confirmed failed or failure response is returned → Treat as failed.
PENDING RESPONSES → Keep running TSQ until status is SUCCESS or FAILED.
If transaction is still pending after 24 hours → Contact support via the support channel with transaction details.
SUCCESS RESPONSES (whether directly or via TSQ) → Treat as successful (credit/fulfill).
Other/Undocumented Errors → Run TSQ to confirm actual status.
If error is still unclear or not listed in docs → Share details with support via the support channel.
Transaction Enquiry
1. Account Transactions
API Context : /account/transactions?accountNo={accountNo}&startDate={startDate}&endDate={endDate}&page=0&size=20&transactionType={transactionType}

This endpoint is designed to retrieve all account transactions associated with the merchant, including the pool account, transit accounts, virtual accounts, or sub-accounts.

The transaction type property defines the source type of the transaction. If you wish to retrieve wallet based transactions associated, you should pass 'wallet' as the transaction type. If you want to retrieve bank statement, you should pass 'Bank' as the transaction type.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
accountNo	Customer's Account Number	Mandatory
startDate	start date e.g 2023-01-01 00:00:00	Mandatory
endDate	end date e.g 2023-03-01 23:59:59	Mandatory
transactionType	wallet or bank	Mandatory
page	Page no, starts from 0	Optional
size	Page size	Optional

Sample Response when Transaction Type is 'Bank'

{
    "status": "00",
    "message": "Successful",
    "data": {
        "content": [
            {
                "accountNo": "1001555750",
                "receiptNumber": "090110230522074319965480267793",
                "amount": "20.000000",
                "remarks": "Inward Credit Charge with reference: rosapay-20230522064320488",
                "createdDate": "2023-11-30 06:43:23.0",
                "transactionType": "DEBIT",
                "runningBalance": "1074467.000000",
                "currencyCode": "NGN",
                "id": "2603203"
            },
            {
                "remarks": "Funds Withdrawal For - rosapay-/trf download",
                "receiptNumber": "090110230518144841059905192360",
                "amount": "100.000000",
                "accountNo": "1001555750",
                "createdDate": "2023-11-29 16:53:50.0",
                "transactionType": "DEBIT",
                "runningBalance": "1074487.000000",
                "currencyCode": "NGN",
                "id": "2603203"
            },
            {
                "remarks": "Rosapay/trf/John_Doe",
                "receiptNumber": "090110230313215606726102172204",
                "amount": "400.000000",
                "accountNo": "1001555750",
                "createdDate": "2023-10-22 18:57:09.0",
                "transactionType": "CREDIT",
                "runningBalance": "1074587.000000",
                "currencyCode": "NGN",
                "id": "2603203"
            }
        ],
        "totalElements": 3,
        "totalPages": 1
    }
}


Sample Response when Transaction Type is 'Wallet'

{
    "status": "00",
    "message": "Successful",
    "data": {
        "content": [
            {
                "time": "2023-11-12 15:59:43.0",
                "transactionType": "OUTFLOW",
                "transactionId": "testing281",
                "walletName": "Victory",
                "amount": "80.00",
                "toAccountNo": "1111111106",
                "transactionResponse": "00",
                "fromBank": "999999",
                "fromAccountNo": "1001558751",
                "toBank": "000001",
                "sessionId": "090110231112165943586797955171"
            },
            {
                "time": "2023-11-11 14:55:00.0",
                "transactionType": "OUTFLOW",
                "transactionId": "testing280",
                "walletName": "Victory",
                "amount": "80.00",
                "toAccountNo": "1111111106",
                "transactionResponse": "00",
                "fromBank": "999999",
                "fromAccountNo": "1001558751",
                "toBank": "000001",
                "sessionId": "090110231111155500317071230464"
            }
        ],
        "totalElements": 69,
        "totalPages": 35
    }
}

2. Transaction Limit
API Context : /transaction/limit

Description: This endpoint is used to update an account's maximum transaction and daily withdrawal limits

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "accountNumber":"10000000001",
    "transactionLimit":"500000",
    "dailyLimit":"500000"
}

Field	Description	Status
accountNumber	Customer's Account Number	Mandatory
transactionLimit	This allows you to set transaction limit for customers	Mandatory
dailyLimit	This allows you to set daily limit for customers	Mandatory

Sample Response

{
    "status": "00",
    "message": "Successfully Updated"
}

3. Virtual Account Transactions
API Context : /virtualaccount/transactions?accountNumber={accountNumber}&startDate={startDate}&endDate={endDate}&page={page}&size={size}

Description: This endpoint allows you retrieve a virtual account transaction history

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

QUERY PARAMS

Field	Description	Status
accountNumber	virtual account number	Mandatory
startDate	transaction start date e.g 2022-01-01 00:00:00	Mandatory
endDate	transaction end date e.g 2023-01-01 23:59:59	Mandatory
page	page no, starts from 0	Optional
size	page size	Optional

Sample Response

{
    "status": "00",
    "message": "Successful",
    "data": {
        "content": [
            {
                "reference": "rosapay-000917",
                "dateCreated": "2023-10-31 13:39:05.0",
                "merchantAccountNo": "6007026895",
                "merchantAccountName": "DSTV",
                "accountStatus": "09",
                "amount": "2000",
                "expired": "false",
                "amountValidation": "A3"
            }
        ],
        "totalElements": 1,
        "totalPages": 1
    }
}

QR Code Services
1. Generate QR Code
API Context : /qrcode/generate

Description: Generates qrcode for payments

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
  "accountNo": "1001563612",
  "qrType": "2",
  "amount": "9000",
  "phone": "08135542267",
  "email": "shileroland@gmail.com"
}


Sample Response

{
    "status":"00",
    "message":"QRCode created successfully",
    "data": {
    "qrCode":"09875R12344554**99944T4T166**5747574****PKG000000090726720019NG.COM.NIBSS-PLC.QR0222S000000066302309665405200005802NG5916MUHAMMEDALEXIS6007Nigeria7304FB00"
    }
}


Field	Description	Status
accountNo	Test account number of merchant	Mandatory
qrType	1 == fixed, 2 == dynamic	Mandatory
amount	Test amount to be sent	Mandatory
phone	Test phone number	Mandatory
email	Test email address	Mandatory
2. Query QR Code
API COontext qrcode/query

Description: This endpoint retrieves merchant information from qr code

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "qrCode": "09875R12344554**99944T4T166**5747574****PKG000000090726720019NG.COM.NIBSS-PLC.QR0222S000000066302309665405200005802NG5916MUHAMMEDALEXIS6007Nigeria7304FB00"
}


Field	Description	Status
qrCode	qr code	Mandatory
3. QR Code Pay
API Context /qrcode/pay

Description: This endpoint is used to make payment using NIBSS qrcode

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

Sample Request

{
    "amount": "9000",
    "merchantNo": "1002345667",
    "subMerchantNo": "",
    "subMerchantName": "",
    "qrType": "2",
    "orderSn": "",
    "signature": ""
}

Field	Description	Status
amount	Test amount to be sent	Mandatory
merchantNo	Test account number of merchant	Mandatory
subMerchantNo	Test account number of sub merchant	Mandatory
subMerchantName	name of sub merchant	Mandatory
qrType	1 == fixed, 2 == dynamic	Mandatory
orderSn	Test serial number	Optional
signature	To be given by admin	Mandatory
Account Upgrade
API Context: /client/upgrade

This API endpoint allows you to perform these actions:

Update Account using BVN details
Update Account Compliance using BVN details
Upgrade Individual Account to Corporate Account
1. Update Account using BVN details
This functionality verifies the accuracy of the existing account number against the information provided by the BVN, and upon successful validation, removes the account from PND status.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
REQUEST BODY

{
    "accountNo": "1000000000",
    "bvn": "20000000009",
    "action":"Update-BVN"
}

or

{
    "accountNo": "1000000000",
    "nin": "20000000009",
    "action":"Update-BVN"

}

Field	Description	Status
accountNo	Customers Account Number e.g 1000000000	Mandatory
bvn	Customers Bank Verification Number e.g 20000000009 (You can use either the BVN or NIN below)	Mandatory
nin	Customers National Identity Number e.g 20000000009 (You can use either the NIN or BVN above)	Mandatory
action	Action to perform on account should be Update-BVN	Mandatory
Sample Response

{
    "status":"00",
    "message":"Account updated successfully"
}

2. Update Account Compliance using BVN details
This functionality regularizes the existing account number in accordance with the details obtained from the BVN. Upon successful execution, the account is released from PND status.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
REQUEST BODY

{
    "accountNo": "1000000000",
    "bvn": "20000000009",
    "dob":"08-Mar-1995",
    "action":"Recomply-With-BVN",

}

or

{
    "accountNo": "1000000000",
    "nin": "20000000009",
    "dob":"08-Mar-1995",
    "action":"Recomply-With-BVN",

}

Field	Description	Status
accountNo	Customers Account Number e.g 1000000000	Mandatory
bvn	Customers Bank Verification Number e.g 20000000009 (You can use either the BVN or NIN below)	Mandatory
nin	Customers National Identity Number e.g 20000000009 (You can use either the NIN or BVN above)	Mandatory
action	Action to perform on account should be Recomply-With-BVN	Mandatory
dob	Customers date of birth on BVN or NIN	Mandatory
Sample Response

{
    "status":"00",
    "message":"Account updated successfully"
}

3. Upgrade Individual Account to Corporate Account
This functionality updates and transitions an individual account to a Corporate Account utilizing the company name, incorporation date, and RC Number. Upon successful execution, the account is released from PND status.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
REQUEST BODY

{
    "accountNo": "1000000000",
    "companyName": "Rita and friends",
    "incorporationDate":"12-Oct-2007",
    "rcNumber":"123456",
    "action":"Convert-To-Corporate"

}


Field	Description	Status
accountNo	Customers Account Number e.g 1000000000	Mandatory
companyName	Company Name e.g Rita and friends	Mandatory
incorporationDate	Incorpotartion Date e.g 12-Oct-2007	Mandatory
rcNumber	Company RCNumber	Mandatory
action	Action to perform on account should be Convert-To-Corporate	Mandatory
Sample Response

{
    "status":"00",
    "message":"Account updated successfully"
}

Lux POS
This API endpoint allows partners perform these actions:

Retrigger Lux webhook notification
Query Lux transaction status
1. Webhook Repush API
API Context: /transactions/repush

This endpoint allows integrated partners to retrigger Lux webhook notifications for both successful and failed POS transactions. It ensures that the webhook notification can be repushed when initial attempts fail.

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
REQUEST BODY

{
    "reference": "408210-P051200150941-2057JVSC-012804578357",
    "transactionType": "card-payment",
    "pushIdentifier": "reference"
}

Field	Description	Status	Note
reference	Unique Lux-generated transaction reference	Mandatory	Must match the reference from the original transaction
transactionType	Type of transaction	Mandatory	Use the static value "card-payment"
pushIdentifier	Identifier for the repush	Mandatory	Use the static value "reference"
Sample Response

Successful Response

{
    "status": "00",
    "message": "success",
    "data": [
        {
            "transactionId": "LUX-20250730123709648-012804578357",
            "transactionStatus": "00"
        }
    ]
} 

Other Responses

Webhook Not Reachable

{
    "status": "00",
    "message": "success",
    "data": [
        {
            "transactionId": "LUX-20250730123709648-012804578357",
            "transactionStatus": "01"
        }
    ]
}

Invalid Transaction

{
    "status": "99",
    "message": "Invalid transaction"
} 

Missing Push Identifier

{
    "status": "99", 
    "message": "transactionId is mandatory"
} 

2. Transaction Status Query (TSQ)
API Context: /transactions?transactionType={type}&reference={reference}

This endpoint enables partners to query the status of a Lux POS transaction using its unique reference.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

QUERY PARAMS

Field	Description	Status	Example
transactionType	Type of transaction	Mandatory	card-payment
reference	Unique Lux-generated reference	Mandatory	450035-P051200150941-2057JVSC-751706450035
Sample Response

Successful Response

{
    "status": "00",
    "message": "Successful Transaction Retrieval",
    "data": {
        "reference": "450035-P051200150941-2057JVSC-751706450035",
        "rrn": "751706450035",
        "transactionId": "LUX-20250705100740920-751706450035",
        "statusCode": "00",
        "amount": "0.01",
        "transactionType": "card",
        "transactionTime": "2025-07-05 09:07:40.0",
        "terminalId": "2057JVSC",
        "settledAmount": "0.01",
        "statusDescription": "Approved"
    }
} 

Other Responses

Unsettled or Failed Transaction

{
    "status": "00",
    "message": "Successful Transaction Retrieval",
    "data": {
    "reference": "837188-P051200150941-2057JVSC-881738996157",
        "rrn": "881738996157",
        "transactionId": "LUX-20250705081732019-881738996157",
        "statusCode": "25",
        "amount": "0.01",
        "transactionType": "card",
        "transactionTime": "2025-07-05 07:17:32.0",
        "terminalId": "2057JVSC",
        "settledAmount": "",
        "statusDescription": "Unable To Locate Record"
    }
} 

No Transaction Found

{
    "status": "108",
    "message": "No Transaction!"
} 

Previous
VFD POS
