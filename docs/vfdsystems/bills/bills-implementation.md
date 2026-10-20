Bills Payment
info
The Bills payment API allows developers to integrate bill payment functionality into their applications or systems. It provides a standardized way to interact with bill payment service providers and facilitates the automation of payment processes.

1.0 AUTHORIZATION
Authorization to the APIs below requires an access token. To get more info on how to generate this access token, click on Generating Access Token

2.0 BASE URL
All requests to the Bills Payment API must be done using the web API URL below.

Test Environment: https://api-devapps.vfdbank.systems/vtech-bills/api/v2/billspaymentstore

LIVE Environment: https://api-apps.vfdbank.systems/vtech-bills/api/v2/billspaymentstore

3.0 HOW TO USE THE APIS
Below are the steps involved to make a bill payment

The developer first calls the BILLER CATEGORY endpoint and gets a list of biller categories
The developer then calls the BILLER LIST endpoint and passes a category name returned from BILLER CATEGORY to get all the billers for the category
The developer then calls the BILLER ITEMS to get the biller items for a biller returned from BILLER LIST
The developer can then call CUSTOMER VALIDATE to verify the customerId input that would be used in the PAY endpoint. Note this is mandatory for the utility and cable TV services and should be done in the live environment.
The developer then calls the PAY endpoint to make the bill payment as stated in the docs using the information returned from BILLER LIST and BILLER ITEMS
The developer can then call the TRANSACTION STATUS endpoint to check the payment status
3.1 BILLER CATEGORY
API Context : /billercategory

Description: This endpoint returns biller categories

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

SAMPLE RESPONSE

{
    "status": "00",
    "message": "Successfully Returned Biller Category",
    "data": [
        {
            "category": "Airtime"
        },
        {
            "category": "Cable TV"
        },
        {
            "category": "Data"
        },
        {
            "category": "Internet Subscription"
        },
        {
            "category": "Utility"
        }
    ]
}

3.2 BILLER LIST
API Context : /billerlist?categoryName={categoryName}

Description: This endpoint returns a list of billers for a particular category

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMETERS

Field	Description	Status
categoryName	This allows you fetch list of billers based on a category. If not passed, billers for all categories are returned	Optional

SAMPLE RESPONSE

{
    "status": "00",
    "message": "Succesfully Returned Biller list",
    "data": [
        {
            "id": "airng",
            "name": "AIRTEL",
            "division": "C",
            "product": "423",
            "category": "Airtime"
        },
        {
            "id": "eting",
            "name": "9MOBILE",
            "division": "C",
            "product": "422",
            "category": "AIRTIME",
            "convenienceFee":"30"
        },
        {
            "id": "glong",
            "name": "GLO",
            "division": "C",
            "product": "424",
            "category": "AIRTIME"
        },
        {
            "id": "GLO_VBANK",
            "name": "GLO",
            "division": "G",
            "product": "424",
            "category": "AIRTIME",
            "convenienceFee":"30"
        }
    ]
}

info
In Dev the billers returned are limited. A comprehensive list of billers is returned in Prod.
In some cases, the Biller List API returns a Convenience Fee , which is an additional charge applied for bill payments..
3.3 BILLER ITEMS
API Context : /billerItems?billerId={billerId}&divisionId={divisionId}&productId={productId}

Description: This endpoint returns all items under a biller

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMETERS

Field	Value	Description	Status	
billerId	airng	This is returned from biller List	Mandatory	
divisionId	C	This is returned from biller List	Mandatory	
productId	423	This is returned from biller List	Mandatory	

SAMPLE RESPONSE

{
    "status": "00",
    "message": "Succesfully Returned Biller Items",
    "data": {
        "paymentitems": [
            {
                "id": "5",
                "billerid": "airng",
                "amount": "0",
                "code": "2",
                "paymentitemname": "AIRNG",
                "productId": "423",
                "paymentitemid": "423",
                "currencySymbol": "NGN",
                "isAmountFixed": "false",
                "itemFee": "0",
                "itemCurrencySymbol": "NGN",
                "pictureId": "87",
                "paymentCode": "airng",
                "sortOrder": "4",
                "billerType": "MO",
                "payDirectitemCode": "airng",
                "currencyCode": "566",
                "division": "C",
                "categoryid": "3",
                "createdDate": "2022-10-18 10:11:43"
            }
        ]
    }
}

info
We recommend the response from the Biller Items API call is not persisted as this is usually dynamic.

3.4 VALIDATE CUSTOMER
API Context : /customervalidate?divisionId={divisionId}&paymentItem={paymentItem}&customerId={customerId}&billerId={billerId}

Description: This endpoint allows you validate the customerId input field e.g meter number before making the bill payment.

info
For data and airtime products, the validate customer field is optional and can be by-passed. However, for utility, cable TV services, betting and gaming the customerId validation is required before making a payment.

info
To initiate customer validation for JAMB pin purchase, use the profile code generated as customer ID.

To generate your JAMB profile code, send an SMS in this format NIN [space] your 11-digit NIN (e.g., NIN 12345678901) to 55019 or 66019 using your personal, active phone number. Ensure you have at least ₦50 airtime. Your unique 10-digit profile code will be sent to you via SMS.

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
Query Parameters	Description	Required
customerId	Customer Id e.g Meter Number	Mandatory
divisionId	This is returned from biller List as division	Mandatory
paymentItem	This is returned from biller items as paymentCode	Mandatory
billerId	This signifies the ID of the biller it is returned from the Biller List	Mandatory

SAMPLE SUCCESS RESPONSE

{ 
  "status":"00",
  "message":"Successfully validated customer",
  "data":{}
 }


SAMPLE FAILED RESPONSE

{ 
  "status":"99",
  "message":"Failed validation",
  "data":{}
}

3.5 PAY BILLS
API Context : /pay

Description: This endpoint is used to initiate a bill payment

API METHOD: POST

REQUEST HEADERS

Key	Value
AccessToken	{{token}}

SAMPLE REQUEST

{
    "customerId": "09071046909",
    "amount": "2150",
    "division": "C",
    "paymentItem": "dstv",
    "productId": "399",
    "billerId": "dstv",
    "reference": "rosapay-1234",
    "phoneNumber":"09000000000"
}

Field	Description	Status	
customerId	This allows you to enter the customer Id, e.g Phone Number or Meter Number	Mandatory	
amount	bill cost	Mandatory	
division	This is returned from biller List	Mandatory	
paymentItem	This is returned from biller items as paymentCode	Mandatory	
productId	This is returned from biller List	Mandatory	
billerId	This signifies the ID of the biller it is returned from the Biller List	Mandatory	
reference	This signifies a unique reference to identify transactions and must be pre-fixed with walletName or name of choice e.g rosapay-1234	Mandatory	
phoneNumber	Customer Phone Number	Not Mandatory	

SAMPLE RESPONSE

{
    "status": "00",
    "message": "Successful payment",
    "data": {
        "reference": "rosapay-1234"
    }
}


SAMPLE FAILED RESPONSE

{
    "status": "99",
    "message": "Failed Transaction",
    "data": {
        "reference": "rosapay-1234"
    }
}

info
For first-time payments on Abuja Electric Disco (AEDC), two key change tokens are returned: KCT1 and KCT2. On the meter, the two KCTs (KCT1 and KCT2) should be entered one at a time, followed by the third token, which is the energy credit token.

For Ikeja Electric Disco (IKEDC), customer phone number is mandatory.

The minimum vending amount for IBEDC (Band A) is NGN 5,000. Transactions below this amount will not be processed successfully.


3.6 TRANSACTION STATUS
API Context : /transactionStatus?transactionId={transactionId}

Description: This endpoint returns the status of a transaction

API METHOD: GET

REQUEST HEADERS

Key	Value
AccessToken	{{token}}
QUERY PARAMS

Field	Description	Status
transactionId	transaction reference	Mandatory

Sample Response

{
    "status": "00",
    "message": "Successful Transaction Retrieval",
    "data": {
        "transactionStatus": "00",
        "amount": "500",
        "token": ""
    }
}


Sample Not Found Response

{
    "status": "108",
    "message": "No Transaction!"
}


CODES DESCRIPTION FOR BILLS PAYMENT API
Code	Description	Reversal Instruction
00	Successful	No Reversal
09	Pending	No Reversal
99	Failed	Reversal