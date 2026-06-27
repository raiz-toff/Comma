#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
SDK_DIR="/home/coder/android-sdk"
APK_DIR="$ANDROID_DIR/app/build/outputs/apk/release"
PORT=8765

echo "📦 CommaApp Android Build (STANDALONE OFFLINE RELEASE)"
echo "======================================================"

# 1. Ensure local.properties exists
LOCAL_PROPS="$ANDROID_DIR/local.properties"
if [ ! -f "$LOCAL_PROPS" ] || ! grep -q "sdk.dir" "$LOCAL_PROPS"; then
  echo "⚙️  Writing local.properties..."
  echo "sdk.dir=$SDK_DIR" > "$LOCAL_PROPS"
fi

# 2. Clear stale native module caches
echo "🧹 Clearing stale Gradle & Android C++ caches..."
rm -rf "$ANDROID_DIR/.gradle" "$ANDROID_DIR/app/build" "$ANDROID_DIR/app/.cxx" "$ANDROID_DIR/build"

# 3. Run the build
echo ""
echo "🔨 Building offline release APK..."
cd "$ANDROID_DIR"
./gradlew clean
mkdir -p app/src/main/assets
mkdir -p app/build/intermediates/sourcemaps/react/release
mkdir -p app/build/generated/sourcemaps/react/release
./gradlew assembleRelease

echo ""
echo "✅ Build complete!"
echo "   APK: $APK_DIR/app-release.apk"

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

DOWNLOAD_URL="http://coder.lan:$PORT/app-release.apk"

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
