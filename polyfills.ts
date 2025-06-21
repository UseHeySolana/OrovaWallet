import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { Buffer } from "buffer";
import { Stream } from "stream";


// Set global Buffer
global.Buffer = Buffer;


// Define Crypto class with getRandomValues method
class Crypto {
    getRandomValues = expoCryptoGetRandomValues;
}

// Check if crypto is already defined in the global scope
const hasInbuiltWebCrypto = typeof window.crypto !== "undefined";

// Use existing crypto if available, otherwise create a new Crypto instance
const webCrypto = hasInbuiltWebCrypto ? window.crypto : new Crypto();

// Polyfill crypto object if it's not already defined
if (!hasInbuiltWebCrypto) {
    Object.defineProperty(window, "crypto", {
        configurable: true,
        enumerable: true,
        get: () => webCrypto,
    });
}



// "sudo port install php82-cgi php82-gd php82-curl php82-intl php82-iconv php82-gettext php82-mbstring php82-imap php82-mcrypt php82-xmlrpc php82-mysql php82-openssl php82-sockets php82-zip php82-tidy php82-opcache php82-xsl php82-sqlite"