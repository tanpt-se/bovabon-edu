#!/usr/bin/env bash
# Đóng gói Bovabon Edu thành app macOS: dist/Bovabon Edu.app (+ dist/BovabonEdu.dmg nếu có --dmg)
#   ./scripts/bundle-macos.sh            # build cho kiến trúc máy hiện tại
#   ./scripts/bundle-macos.sh --dmg      # kèm file .dmg để chia sẻ
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

APP_NAME="Bovabon Edu"
BUNDLE_ID="edu.bovabon.app"
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
DIST="dist"
APP="$DIST/$APP_NAME.app"

echo "▶ Build bản desktop (release)…"
cargo build --release --features desktop --bin bovabon-desktop

echo "▶ Tạo bundle $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp target/release/bovabon-desktop "$APP/Contents/MacOS/bovabon-edu"

echo "▶ Tạo icon"
ICONSET="$(mktemp -d)/AppIcon.iconset"
swift scripts/render-icon.swift assets/icon.svg "$ICONSET"
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>bovabon-edu</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleDevelopmentRegion</key><string>vi</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

echo "▶ Ký ad-hoc (chạy được trên máy này; chia sẻ cho máy khác cần Developer ID + notarize)"
codesign --force --deep --sign - "$APP"

if [[ "${1:-}" == "--dmg" ]]; then
  echo "▶ Tạo DMG"
  STAGE="$(mktemp -d)"
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  rm -f "$DIST/BovabonEdu.dmg"
  hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DIST/BovabonEdu.dmg" >/dev/null
  echo "✓ $DIST/BovabonEdu.dmg"
fi

echo "✓ $APP ($(du -sh "$APP" | cut -f1))"
echo "Mở: open \"$APP\"   ·   Cài: kéo vào /Applications"
