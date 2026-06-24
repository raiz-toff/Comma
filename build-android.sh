#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
SDK_DIR="/home/coder/android-sdk"
# CHANGED: Updated path to the debug output folder
APK_DIR="$ANDROID_DIR/app/build/outputs/apk/debug"
PORT=8765

echo "📦 CommaApp Android Build (DEVELOPMENT)"
echo "======================================="

# 1. Ensure local.properties exists
LOCAL_PROPS="$ANDROID_DIR/local.properties"
if [ ! -f "$LOCAL_PROPS" ] || ! grep -q "sdk.dir" "$LOCAL_PROPS"; then
  echo "⚙️  Writing local.properties..."
  echo "sdk.dir=$SDK_DIR" > "$LOCAL_PROPS"
fi

# 2. Clear stale native module caches
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
echo "🔨 Building development APK..."
cd "$ANDROID_DIR"
# CHANGED: Switched from assembleRelease to assembleDebug
./gradlew assembleDebug

echo ""
echo "✅ Build complete!"
# CHANGED: Updated filename to app-debug.apk
echo "   APK: $APK_DIR/app-debug.apk"

# 4. Prompt to serve over HTTP
echo ""
read -p "📲 Serve APK for phone install? [Y/n] " answer
answer="${answer:-Y}"
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  exit 0
fi

# CHANGED: Updated URL to point to the debug filename
DOWNLOAD_URL="http://coder.lan:$PORT/app-debug.apk"

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