#!/usr/bin/env node

const { bumpVersions } = require('./version-bump.js');

console.log('🧪 Testing version bump functionality...');
console.log('=====================================');

// Test the version bump
const success = bumpVersions();

if (success) {
  console.log('\n✅ Version bump test completed successfully!');
  console.log('📝 You can now run "npm run build:android-local" to execute the full build process.');
} else {
  console.log('\n❌ Version bump test failed!');
  process.exit(1);
} 