import { randomBytes } from 'react-native-randombytes';

// First, set up the randomBytes global
if (typeof global.crypto === 'undefined') {
    global.crypto = {};
}

if (typeof global.crypto.getRandomValues === 'undefined') {
    global.crypto.getRandomValues = function (array) {
        const randomBytesArray = randomBytes(array.length);
        for (let i = 0; i < array.length; i++) {
            array[i] = randomBytesArray[i];
        }
        return array;
    };
}

// Set up Buffer globally
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Process polyfill
import process from 'process';
global.process = process;
global.process.env.NODE_ENV = __DEV__ ? 'development' : 'production';

// TextEncoder/TextDecoder polyfills if needed
if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}

// Add other necessary polyfills
global.location = {
    protocol: 'https:'
};

// Fix for webcrypto in React Native
if (typeof global.crypto.subtle === 'undefined') {
    global.crypto.subtle = {}; // Add empty subtle object
}

// Export a dummy value to ensure this file is not tree-shaken
export default 'crypto-shim';