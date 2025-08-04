#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to increment version
function incrementVersion(version) {
  const parts = version.split('.');
  const major = parseInt(parts[0]);
  const minor = parseInt(parts[1]);
  const patch = parseInt(parts[2]);

  // If patch is 9, increment minor and reset patch to 0
  if (patch === 9) {
    return `${major}.${minor + 1}.0`;
  } else {
    return `${major}.${minor}.${patch + 1}`;
  }
}

// Function to read and parse app.json
function readAppJson() {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJsonContent = fs.readFileSync(appJsonPath, 'utf8');
  return JSON.parse(appJsonContent);
}

// Function to write app.json
function writeAppJson(appJson) {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
}

// Function to bump versions
function bumpVersions() {
  console.log('🚀 Starting version bump process...');
  
  try {
    // Read current app.json
    const appJson = readAppJson();
    
    // Store original values
    const originalVersion = appJson.expo.version;
    const originalVersionCode = appJson.expo.android.versionCode;
    const originalRuntimeVersion = appJson.expo.runtimeVersion;
    
    // Increment version
    const newVersion = incrementVersion(originalVersion);
    const newVersionCode = originalVersionCode + 1;
    
    console.log(`📦 Current version: ${originalVersion} -> ${newVersion}`);
    console.log(`🔢 Current versionCode: ${originalVersionCode} -> ${newVersionCode}`);
    console.log(`⚡ Current runtimeVersion: ${originalRuntimeVersion} -> ${newVersion}`);
    
    // Update app.json
    appJson.expo.version = newVersion;
    appJson.expo.android.versionCode = newVersionCode;
    appJson.expo.runtimeVersion = newVersion;
    
    // Write updated app.json
    writeAppJson(appJson);
    
    console.log('✅ Version bump completed successfully!');
    console.log(`📝 Updated app.json with version ${newVersion} and versionCode ${newVersionCode}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error during version bump:', error.message);
    return false;
  }
}

// Function to run prebuild
function runPrebuild() {
  console.log('🔨 Running expo prebuild...');
  try {
    execSync('npx expo prebuild', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Prebuild completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error during prebuild:', error.message);
    return false;
  }
}

// Function to run the original build command
function runOriginalBuild() {
  console.log('🏗️  Running original build command...');
  try {
    execSync('eas build --local -p android --profile production', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Build completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error during build:', error.message);
    return false;
  }
}

// Main execution
function main() {
  console.log('🎯 HeySolana Version Bump & Build Script');
  console.log('==========================================');
  
  // Step 1: Bump versions
  if (!bumpVersions()) {
    console.error('❌ Version bump failed. Exiting...');
    process.exit(1);
  }
  
  // Step 2: Run prebuild
  if (!runPrebuild()) {
    console.error('❌ Prebuild failed. Exiting...');
    process.exit(1);
  }
  
  // Step 3: Run original build
  if (!runOriginalBuild()) {
    console.error('❌ Build failed. Exiting...');
    process.exit(1);
  }
  
  console.log('🎉 All processes completed successfully!');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  incrementVersion,
  bumpVersions,
  runPrebuild,
  runOriginalBuild
}; 