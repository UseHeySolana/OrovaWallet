# HeySolana Build Scripts

This directory contains automated build scripts for the HeySolana app.

## Scripts

### `version-bump.js`
The main version bump and build script that:
1. Automatically increments the version in `app.json`
2. Increments the Android `versionCode` by 1
3. Updates `runtimeVersion` to match the new version
4. Runs `npx expo prebuild`
5. Executes the original build command

**Usage:**
```bash
npm run build:android-local
```

### `test-version-bump.js`
A test script that only performs the version bump without running the build process.

**Usage:**
```bash
npm run test-version-bump
```

## Version Bump Logic

The script follows semantic versioning rules:
- **Patch increment**: `2.0.8` → `2.0.9`
- **Minor increment**: `2.0.9` → `2.1.0` (when patch reaches 9)
- **Version code**: Always increments by 1
- **Runtime version**: Always matches the new version

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run build:android-local` | Full version bump + prebuild + build |
| `npm run build:android-local-original` | Original build without version bump |
| `npm run test-version-bump` | Test version bump only |

## Example Output

```
🎯 HeySolana Version Bump & Build Script
==========================================
🚀 Starting version bump process...
📦 Current version: 2.0.8 -> 2.0.9
🔢 Current versionCode: 18 -> 19
⚡ Current runtimeVersion: 2.0.8 -> 2.0.9
✅ Version bump completed successfully!
📝 Updated app.json with version 2.0.9 and versionCode 19
🔨 Running expo prebuild...
✅ Prebuild completed successfully!
🏗️  Running original build command...
✅ Build completed successfully!
🎉 All processes completed successfully!
```

## Notes

- The script automatically handles version increments based on semantic versioning
- If the build fails, the version bump will still be applied
- You can always revert the version bump by manually editing `app.json`
- The original build command is preserved as `build:android-local-original` 