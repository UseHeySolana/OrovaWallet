Payment Widget
The Payment widget allows for instant payment collection using bank transfer, QR code, card and USSD payment methods

Integration
Launching Widget From An HTML File
Inside an HTML file's script tag, add the SDK link https://swiftpay-sdk.vfdtech.ng/v-payment-widget.js

Next initialize the SDK by including the constant below in a script tag within the html file:

 const widget = new VPaymentWidget({
        token: "XXXXXX",
        merchantId: 1,
        environment: "development",
        email: "user@email.com",
        logo: "",
        successRedirectUrl: "",
        reference: "rosapay-0191",
        onSuccess: callBackFunc,
      });

      await widget.pay({
        amount: 1000,
      });


Below is a sample html code to achieve these:

tip
Sample Html Code

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="https://swiftpay-sdk.vfdtech.ng/v-payment-widget.js"></script>
</head>
<body>
<form onsubmit="event.preventDefault(); handleSubmit();">
    <input oninput="handleChange()" id="amountInput" placeholder="amount" />
    <div>
        <br />
        <button id="submitBtn">Submit</button>
    </div>
</form>
<script>
      let amount;
      const handleChange = (e) => {
        amount = document.getElementById("amountInput").value;
      };
      const widget = new VPaymentWidget({
        token:
          "XXXXXX",
        merchantId: 1,
        environment: "development",
        email: "user@email.com",
        reference: "rosapay-0191",
        logo: "",
        successRedirectUrl: "",
        onSuccess: success,
      });
      const handleSubmit = async () => {
        await widget.pay({
          amount,
        });
      };

      function success(data) {
        console.log(data);
      }
    </script>
</body>
</html>


Launching Widget From Any JavaScript Framework
If you are using any of the javascript framework e.g React, locate the index.html or the main html file and add the sdk link in the script tag

 <script src="https://swiftpay-sdk.vfdtech.ng/v-payment-widget.js"></script>


Next initialize the SDK by including the constant below in a javascript file:

 const widget = new VPaymentWidget({
        token: "XXXXXX",
        merchantId: 1,
        environment: "development",
        email: "user@email.com",
        reference: "rosapay-0191",
        logo: "",
        successRedirectUrl: "",
        onSuccess: callBackFunc,
      });

      await widget.pay({
        amount: 1000,
      });

note
Initializing the SDK is slightly different in React JS. See below how to do it in React JS

tip
Sample Code To Initialize Widget In React

import "./App.css";

function App() {
  async function pay() {
    const widget = new window.VPaymentWidget({
      token:
        "XXXXXX",
      merchantId: 1,
      environment: "development",
      email: "user@email.com",
        reference: "rosapay-0191",
      logo: "",
      successRedirectUrl: "",
      onSuccess: success,
    });
    await widget.pay({
      amount: 5000,
    });
  }
  function success(data) {
    console.log(data);
  }
  return (
    <div className="App">
      <header className="App-header">
        <button onClick={pay}>Pay</button>
      </header>
    </div>
  );
}
export default App;


Alternative For Launching Widget In React
Alternatively if you're using react you can launch the widget by first running the command below:

npm i vfd-react-widget

Next launch the widget in a .js file like in the sample below:

import "./App.css";
import VPaymentWidget from "vfd-react-widget";

function App() {
  const pay = async () => {
    const widget = await VPaymentWidget.loadWidget();
    const widgetLaunch = new widget({
      token:
        "XXXXXX",
      merchantId: "1",
      email: "user@email.com",
      reference: "rosapay-0191",
      logo: "",
      successRedirectUrl: "",
      environment: "development",
      onSuccess: success,
    });
    widgetLaunch.pay({
      amount: 5000, // amount to pay
    });
  };
  function success(data) {
    console.log(data);
  }
  return (
    <div className="App">
      <header className="App-header">
        <button onClick={pay}>Pay</button>
      </header>
    </div>
  );
}

export default App;


note
Any of the ways above will launch the Payment widget.

note
For Pay with Transfer, Pay with USSD and Pay with QR Code, If the payment is successful you will get a notification with payload as described here.

For Pay with debit card, If the payment is successful you will get a notification with payload as described here.

Fields Description For Launching Payment Widget
Field	Description	Required
token	Your wallet access token. You can check here for how to generate it	Mandatory
merchantId	Customer's id on your system	Mandatory
environment	Use development when integrating, when you are ready to go live, you can change this to production. You can use an environment variable to save this.	Mandatory
logo	This should be the url of your company's logo	Optional
email	The email of the customer making payment	Mandatory
reference	A unique reference generated by you to identify the transaction	Optional
onSuccess	This is your call back function which would be called with an object({method, reference}) when payment is successful. method is the payment method while reference is the unique transaction reference(Generated by us)	Optional
successRedirectUrl	This is the page you want the customer redirected to after completing the payment	Optional