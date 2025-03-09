import 'react-native-get-random-values';
// import 'react-native-crypto';
import { Buffer } from 'buffer';

// Fix for "Super expression must either be null or a function"
global.Buffer = Buffer;
global.process = require('process');
global.process.env.NODE_ENV = __DEV__ ? 'development' : 'production';

// Polyfill for crypto features
if (typeof global.crypto !== 'object') {
    global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
    global.crypto.getRandomValues = require('react-native-get-random-values').getRandomValues;
}