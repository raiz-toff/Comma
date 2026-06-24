#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
SDK_DIR="/home/coder/android-sdk"

echo "📦 CommaApp Android Build"
echo "=========================="

# 1. Ensure local.properties exists
LOCAL_PROPS="$ANDROID_DIR/local.properties"
if [ ! -f "$LOCAL_PROPS" ] || ! grep -q "sdk.dir" "$LOCAL_PROPS"; then
  echo "⚙️  Writing local.properties..."
  echo "sdk.dir=$SDK_DIR" > "$LOCAL_PROPS"
fi

# 2. Clear stale native module caches (fast, prevents armeabi ghost errors)
echo "🧹 Clearing stale C++ caches..."
for mod in react-native-worklets react-native-screens react-native-nitro-modules react-native-reanimated react-native-gesture-handler; do
  dir="$PROJECT_ROOT/node_modules/$mod/android"
  if [ -d "$dir/build" ] || [ -d "$dir/.cxx" ]; then
    rm -rf "$dir/build" "$dir/.cxx"
    echo "   cleared: $mod"
  fi
done

# 3. Run the build
echo ""
echo "🔨 Building release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

echo ""
echo "✅ Done! APK is at:"
echo "   $ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
