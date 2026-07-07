#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
SDK_DIR="/home/coder/android-sdk"
PORT=8765

# 1. Ask what to build
VARIANT=""
while [ -z "$VARIANT" ]; do
  echo "🔧 What do you want to build?"
  echo "   1) Debug   (for testing on your phone alongside the release app)"
  echo "   2) Release (the real app)"
  read -p "   Enter 1 or 2: " choice
  case "$choice" in
    1) VARIANT="debug" ;;
    2) VARIANT="release" ;;
    *) echo "   ❌ Please enter 1 or 2." ;;
  esac
done

APK_DIR="$ANDROID_DIR/app/build/outputs/apk/$VARIANT"
APK_NAME="app-$VARIANT.apk"

if [ "$VARIANT" = "debug" ]; then
  echo "📦 CommaApp Android Build (DEVELOPMENT)"
else
  echo "📦 CommaApp Android Build (STANDALONE OFFLINE RELEASE)"
fi
echo "======================================================"

# 2. Ensure local.properties exists
LOCAL_PROPS="$ANDROID_DIR/local.properties"
if [ ! -f "$LOCAL_PROPS" ] || ! grep -q "sdk.dir" "$LOCAL_PROPS"; then
  echo "⚙️  Writing local.properties..."
  echo "sdk.dir=$SDK_DIR" > "$LOCAL_PROPS"
fi

cd "$ANDROID_DIR"

if [ "$VARIANT" = "debug" ]; then
  # 3a. Debug: just clear stale native module caches, no full clean needed
  echo "🧹 Clearing stale C++ caches..."
  for mod in react-native-worklets react-native-screens react-native-nitro-modules react-native-reanimated react-native-gesture-handler; do
    dir="$PROJECT_ROOT/node_modules/$mod/android"
    if [ -d "$dir/build" ] || [ -d "$dir/.cxx" ]; then
      rm -rf "$dir/build" "$dir/.cxx"
      echo "   cleared: $mod"
    fi
  done

  echo ""
  echo "🔨 Building development APK..."
  ./gradlew assembleDebug
else
  # 3b. Release: full clean build
  echo "🧹 Clearing stale Gradle & Android C++ caches..."
  rm -rf "$ANDROID_DIR/.gradle" "$ANDROID_DIR/app/build" "$ANDROID_DIR/app/.cxx" "$ANDROID_DIR/build"

  echo ""
  echo "🔨 Building offline release APK..."
  ./gradlew clean
  mkdir -p app/src/main/assets
  mkdir -p app/build/intermediates/sourcemaps/react/release
  mkdir -p app/build/generated/sourcemaps/react/release
  ./gradlew assembleRelease
fi

echo ""
echo "✅ Build complete!"
echo "   APK: $APK_DIR/$APK_NAME"

# 4. Prompt to serve over HTTP
echo ""
if [ -t 0 ]; then
  read -t 10 -p "📲 Serve APK for phone install? [Y/n] " answer || answer="Y"
else
  answer="Y"
fi
answer="${answer:-Y}"
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  exit 0
fi

DOWNLOAD_URL="http://coder.lan:$PORT/$APK_NAME"

echo ""
echo "════════════════════════════════════════"
echo "   📡 Serving APK on port $PORT"
echo ""
echo "   On your phone, open:"
echo "   👉  $DOWNLOAD_URL"
echo ""

# Print QR code
python3 -c "
try:
    import qrcode
    qr = qrcode.QRCode(border=1)
    qr.add_data('$DOWNLOAD_URL')
    qr.make(fit=True)
    qr.print_ascii(invert=True)
except ImportError:
    print('   Tip: pip3 install qrcode  →  get a scannable QR code here next time')
" 2>/dev/null || true

echo ""
echo "   ⚠️  Enable 'Install unknown apps' on your phone if prompted."
echo "   Press Ctrl+C when done."
echo "════════════════════════════════════════"
echo ""

cd "$APK_DIR"
python3 -m http.server $PORT
