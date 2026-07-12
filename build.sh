#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
SERVE_HOST="${SERVE_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
SERVE_HOST="${SERVE_HOST:-localhost}"
PORT=8765

# 1. Ask what to build
VARIANT=""
while [ -z "$VARIANT" ]; do
  echo "🔧 What do you want to build?"
  echo "   1) Debug   (APK, for testing on your phone alongside the release app)"
  echo "   2) Release (APK, the real app, sideloadable)"
  echo "   3) Bundle  (AAB, for uploading to Google Play)"
  read -p "   Enter 1, 2, or 3: " choice
  case "$choice" in
    1) VARIANT="debug" ;;
    2) VARIANT="release" ;;
    3) VARIANT="bundle" ;;
    *) echo "   ❌ Please enter 1, 2, or 3." ;;
  esac
done

APK_DIR="$ANDROID_DIR/app/build/outputs/apk/$VARIANT"
APK_NAME="app-$VARIANT.apk"
AAB_DIR="$ANDROID_DIR/app/build/outputs/bundle/release"
AAB_NAME="app-release.aab"

case "$VARIANT" in
  debug)   echo "📦 CommaApp Android Build (DEVELOPMENT)" ;;
  release) echo "📦 CommaApp Android Build (STANDALONE OFFLINE RELEASE)" ;;
  bundle)  echo "📦 CommaApp Android Build (PLAY STORE BUNDLE)" ;;
esac
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
  # 3b. Release APK or Bundle: full clean build
  echo "🧹 Clearing stale Gradle & Android C++ caches..."
  rm -rf "$ANDROID_DIR/.gradle" "$ANDROID_DIR/app/build" "$ANDROID_DIR/app/.cxx" "$ANDROID_DIR/build"

  echo ""
  ./gradlew clean
  mkdir -p app/src/main/assets
  mkdir -p app/build/intermediates/sourcemaps/react/release
  mkdir -p app/build/generated/sourcemaps/react/release

  # DO NOT re-enable EXPO_UNSTABLE_TREE_SHAKING / EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH:
  # it strips NativeWind's runtime style registration, so every className token
  # renders unstyled (near-invisible text) in release builds. Debug is unaffected,
  # which is why it slipped through — v1.3.0 vc5 shipped broken because of it.

  if [ "$VARIANT" = "release" ]; then
    echo "🔨 Building offline release APK..."
    ./gradlew assembleRelease
  else
    echo "🔨 Building Play Store bundle (AAB)..."
    ./gradlew bundleRelease
  fi
fi

echo ""
echo "✅ Build complete!"
if [ "$VARIANT" = "bundle" ]; then
  echo "   AAB: $AAB_DIR/$AAB_NAME"
  echo ""
  echo "   Upload this file to Play Console → your release track → Create new release."
  echo "   (Not sideloadable — this is a Play Store upload format, not an installable APK.)"
  SERVE_DIR="$AAB_DIR"
  SERVE_FILE="$AAB_NAME"
  PROMPT="📡 Serve AAB over HTTP so you can download it to another machine? [Y/n] "
  PURPOSE="download it and upload to Play Console"
else
  echo "   APK: $APK_DIR/$APK_NAME"
  SERVE_DIR="$APK_DIR"
  SERVE_FILE="$APK_NAME"
  PROMPT="📲 Serve APK for phone install? [Y/n] "
  PURPOSE="install it"
fi

# 4. Prompt to serve over HTTP
echo ""
if [ -t 0 ]; then
  read -t 10 -p "$PROMPT" answer || answer="Y"
else
  answer="Y"
fi
answer="${answer:-Y}"
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  exit 0
fi

echo ""
echo "   🌐 Using hostname/IP: $SERVE_HOST"

print_qr() {
  DOWNLOAD_URL="http://$SERVE_HOST:$PORT/$SERVE_FILE"

  echo ""
  echo "════════════════════════════════════════"
  echo "   📡 Serving on port $PORT"
  echo ""
  echo "   Open this link to $PURPOSE:"
  echo "   👉  $DOWNLOAD_URL"
  echo ""

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
}

print_qr

# 5. Offer to change the hostname/IP if the detected one is wrong (e.g. picked the
# wrong NIC, or the device downloading is on a different network reachable by DNS name).
if [ -t 0 ]; then
  read -t 15 -p $'\n   Wrong hostname/IP? Enter a new one, or press Enter to keep it: ' new_host || new_host=""
  if [ -n "$new_host" ]; then
    SERVE_HOST="$new_host"
    echo "   🌐 Using hostname/IP: $SERVE_HOST"
    print_qr
  fi
fi

echo ""
if [ "$VARIANT" = "bundle" ]; then
  echo "   Scan or open the link on the device you'll upload from, then download the .aab."
else
  echo "   ⚠️  Enable 'Install unknown apps' on your phone if prompted."
fi
echo "   Press Ctrl+C when done."
echo "════════════════════════════════════════"
echo ""

cd "$SERVE_DIR"
python3 -m http.server $PORT
