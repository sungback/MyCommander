#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Release asset smoke test failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

release_tag="${RELEASE_TAG:-${1:-}}"
if [[ -z "$release_tag" ]]; then
  fail "set RELEASE_TAG or pass a release tag argument"
fi

if [[ ! "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  fail "release tag must look like v1.2.3, got: $release_tag"
fi

version="${release_tag#v}"
repo="${GITHUB_REPOSITORY:-sungback/MyCommander}"
smoke_dir="${RELEASE_SMOKE_DIR:-$(mktemp -d)}"
release_json="${RELEASE_JSON:-$smoke_dir/release.json}"
download_assets="${DOWNLOAD_RELEASE_ASSETS:-1}"
require_draft="${REQUIRE_DRAFT_RELEASE:-1}"

required_assets=(
  "MyCommander-${version}-1.x86_64.rpm"
  "MyCommander_${version}_amd64.AppImage"
  "MyCommander_${version}_amd64.deb"
  "MyCommander_${version}_universal.dmg"
  "MyCommander_${version}_x64-setup.exe"
  "MyCommander_${version}_x64_en-US.msi"
  "MyCommander_universal.app.tar.gz"
)

require_command awk
require_command codesign
require_command file
require_command gh
require_command grep
require_command hdiutil
require_command jq
require_command lipo
require_command plutil
require_command shasum
require_command spctl
require_command tar
require_command xcrun

mkdir -p "$smoke_dir"

if [[ "$download_assets" == "1" ]]; then
  gh release view "$release_tag" \
    --repo "$repo" \
    --json assets,isDraft,isPrerelease,name,publishedAt,tagName,targetCommitish,url \
    > "$release_json"

  if [[ "$require_draft" == "1" ]]; then
    [[ "$(jq -r '.isDraft' "$release_json")" == "true" ]] \
      || fail "$release_tag must remain draft until smoke tests pass"
  fi

  gh release download "$release_tag" --repo "$repo" --dir "$smoke_dir" --clobber
fi

[[ -f "$release_json" ]] || fail "release metadata not found: $release_json"

asset_count="$(jq '.assets | length' "$release_json")"
[[ "$asset_count" == "${#required_assets[@]}" ]] \
  || fail "expected ${#required_assets[@]} assets, found $asset_count"

for asset in "${required_assets[@]}"; do
  [[ -f "$smoke_dir/$asset" ]] || fail "missing asset: $asset"
  jq -e --arg name "$asset" '.assets[] | select(.name == $name)' "$release_json" >/dev/null \
    || fail "release metadata does not include asset: $asset"
done

while IFS=$'\t' read -r name digest; do
  [[ -n "$name" ]] || continue
  [[ "$digest" == sha256:* ]] || fail "missing sha256 digest for asset: $name"

  expected="${digest#sha256:}"
  actual="$(shasum -a 256 "$smoke_dir/$name" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || fail "sha256 mismatch for $name"
done < <(jq -r '.assets[] | [.name, (.digest // "")] | @tsv' "$release_json")

file "$smoke_dir/MyCommander-${version}-1.x86_64.rpm" | grep -q "RPM" \
  || fail "rpm asset does not look like an RPM package"
file "$smoke_dir/MyCommander_${version}_amd64.AppImage" | grep -q "ELF 64-bit" \
  || fail "AppImage asset does not look like an ELF binary"
file "$smoke_dir/MyCommander_${version}_amd64.deb" | grep -q "Debian binary package" \
  || fail "deb asset does not look like a Debian package"
file "$smoke_dir/MyCommander_${version}_x64-setup.exe" | grep -q "PE32 executable" \
  || fail "exe asset does not look like a Windows installer"
file "$smoke_dir/MyCommander_${version}_x64_en-US.msi" | grep -q "MSI Installer" \
  || fail "msi asset does not look like a Windows installer"

verify_macos_app() {
  local app_path="$1"
  local label="$2"
  local plist="$app_path/Contents/Info.plist"
  local executable="$app_path/Contents/MacOS/mycommander"

  [[ -d "$app_path" ]] || fail "$label app bundle not found"
  [[ -f "$plist" ]] || fail "$label Info.plist not found"
  [[ -x "$executable" ]] || fail "$label executable not found or not executable"

  [[ "$(plutil -extract CFBundleShortVersionString raw -o - "$plist")" == "$version" ]] \
    || fail "$label version does not match $version"
  [[ "$(plutil -extract CFBundleIdentifier raw -o - "$plist")" == "com.mycommander.desktop" ]] \
    || fail "$label bundle identifier is not com.mycommander.desktop"

  lipo "$executable" -verify_arch x86_64 arm64 >/dev/null \
    || fail "$label executable is not universal x86_64/arm64"
  codesign --verify --deep --strict --verbose=2 "$app_path" \
    || fail "$label code signature is invalid"
  xcrun stapler validate "$app_path" \
    || fail "$label notarization ticket is invalid or missing"
  spctl --assess --type execute --verbose=4 "$app_path" \
    || fail "$label Gatekeeper assessment failed"
}

app_extract_dir="$smoke_dir/app-tar-extract"
rm -rf "$app_extract_dir"
mkdir -p "$app_extract_dir"
tar -xzf "$smoke_dir/MyCommander_universal.app.tar.gz" -C "$app_extract_dir"
verify_macos_app "$app_extract_dir/MyCommander.app" "app tarball"

dmg_path="$smoke_dir/MyCommander_${version}_universal.dmg"
hdiutil verify "$dmg_path"

dmg_mount_dir="$smoke_dir/dmg-mount"
rm -rf "$dmg_mount_dir"
mkdir -p "$dmg_mount_dir"
dmg_device=""
cleanup_dmg() {
  if [[ -n "$dmg_device" ]]; then
    hdiutil detach "$dmg_device" >/dev/null 2>&1 || true
  fi
}
trap cleanup_dmg EXIT

attach_output="$(hdiutil attach -nobrowse -readonly -mountpoint "$dmg_mount_dir" "$dmg_path")"
dmg_device="$(printf '%s\n' "$attach_output" | awk '/Apple_HFS/ {print $1; exit}')"
[[ -n "$dmg_device" ]] || fail "could not determine mounted DMG device"

verify_macos_app "$dmg_mount_dir/MyCommander.app" "DMG"

echo "Release asset smoke test passed for $release_tag"
