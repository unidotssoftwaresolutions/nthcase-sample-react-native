#!/usr/bin/env bash
# Builds the Release configuration for the iOS Simulator, with the JavaScript bundle inside the .app (no Metro needed),
# for arm64 and x86_64, unsigned. Then zips the .app as NthCase installs it: dist/mossgrove-react-native-<tag>-simulator.zip.
#
#   npx expo prebuild --platform ios --clean     # once: generates ios/ and runs pod install
#   scripts/build-ios-simulator.sh [tag]         # tag defaults to "local"
#
# It boots no simulator: a generic simulator destination only compiles. Build output stays in build/.
set -euo pipefail

tag="${1:-local}"
cd "$(dirname "$0")/.."

xcodebuild \
  -workspace ios/Mossgrove.xcworkspace \
  -scheme Mossgrove \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/DerivedData \
  -jobs 4 \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGNING_ALLOWED=NO \
  build

app="build/DerivedData/Build/Products/Release-iphonesimulator/Mossgrove.app"
if [ ! -f "$app/main.jsbundle" ]; then
  echo "error: $app has no main.jsbundle; it would need Metro to run" >&2
  exit 1
fi
echo "architectures: $(lipo -archs "$app/Mossgrove")"

mkdir -p dist
zip="dist/mossgrove-react-native-${tag}-simulator.zip"
rm -f "$zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$zip"
echo "wrote $zip ($(stat -f %z "$zip" 2>/dev/null || stat -c %s "$zip") bytes)"
