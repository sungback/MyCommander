#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Release asset fixture test failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_command awk
require_command grep
require_command jq
require_command shasum

version="${RELEASE_FIXTURE_VERSION:-9.8.7}"
release_tag="v${version}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

required_assets=(
  "MyCommander-${version}-1.x86_64.rpm"
  "MyCommander_${version}_amd64.AppImage"
  "MyCommander_${version}_amd64.deb"
  "MyCommander_${version}_universal.dmg"
  "MyCommander_${version}_x64-setup.exe"
  "MyCommander_${version}_x64_en-US.msi"
  "MyCommander_universal.app.tar.gz"
)

write_fixture_assets() {
  local smoke_dir="$1"

  mkdir -p "$smoke_dir"
  for asset in "${required_assets[@]}"; do
    printf 'fixture content for %s\n' "$asset" > "$smoke_dir/$asset"
  done
}

write_release_json() {
  local smoke_dir="$1"
  local release_json="$2"
  local is_draft="$3"
  local digest_mode="${4:-good}"
  local assets_json="[]"

  for asset in "${required_assets[@]}"; do
    local digest
    digest="$(shasum -a 256 "$smoke_dir/$asset" | awk '{print $1}')"

    if [[ "$digest_mode" == "missing_first" && "$asset" == "${required_assets[0]}" ]]; then
      digest=""
    else
      digest="sha256:${digest}"
    fi

    assets_json="$(
      jq \
        --arg name "$asset" \
        --arg digest "$digest" \
        '. + [{name: $name, digest: $digest}]' \
        <<< "$assets_json"
    )"
  done

  jq -n \
    --arg tag_name "$release_tag" \
    --arg name "MyCommander ${release_tag}" \
    --arg url "https://github.example.invalid/release/${release_tag}" \
    --argjson is_draft "$is_draft" \
    --argjson assets "$assets_json" \
    '{
      assets: $assets,
      isDraft: $is_draft,
      isPrerelease: false,
      name: $name,
      publishedAt: null,
      tagName: $tag_name,
      targetCommitish: "fixture",
      url: $url
    }' \
    > "$release_json"
}

make_fixture() {
  local name="$1"
  local is_draft="${2:-true}"
  local digest_mode="${3:-good}"
  local fixture_dir="$tmp_root/$name"
  local smoke_dir="$fixture_dir/assets"
  local release_json="$fixture_dir/release.json"

  mkdir -p "$fixture_dir"
  write_fixture_assets "$smoke_dir"
  write_release_json "$smoke_dir" "$release_json" "$is_draft" "$digest_mode"

  printf '%s\n' "$fixture_dir"
}

run_verifier() {
  local fixture_dir="$1"

  DOWNLOAD_RELEASE_ASSETS=0 \
  VERIFY_RELEASE_ASSET_CONTENTS=0 \
  RELEASE_TAG="$release_tag" \
  RELEASE_JSON="$fixture_dir/release.json" \
  RELEASE_SMOKE_DIR="$fixture_dir/assets" \
  bash "$repo_root/scripts/verify-release-assets.sh"
}

expect_success() {
  local name="$1"
  local fixture_dir="$2"
  local log="$fixture_dir/$name.log"

  if ! run_verifier "$fixture_dir" > "$log" 2>&1; then
    cat "$log" >&2
    fail "$name should have passed"
  fi
}

expect_failure() {
  local name="$1"
  local fixture_dir="$2"
  local expected_message="$3"
  local log="$fixture_dir/$name.log"
  local status=0

  run_verifier "$fixture_dir" > "$log" 2>&1 || status=$?

  if [[ "$status" -eq 0 ]]; then
    cat "$log" >&2
    fail "$name should have failed"
  fi

  grep -q "$expected_message" "$log" || {
    cat "$log" >&2
    fail "$name failed without expected message: $expected_message"
  }
}

success_fixture="$(make_fixture success true good)"
expect_success "valid-fixture" "$success_fixture"

missing_asset_fixture="$(make_fixture missing-asset true good)"
rm "$missing_asset_fixture/assets/${required_assets[0]}"
expect_failure "missing-asset" "$missing_asset_fixture" "missing asset"

digest_mismatch_fixture="$(make_fixture digest-mismatch true good)"
printf 'tampered fixture content\n' >> "$digest_mismatch_fixture/assets/${required_assets[1]}"
expect_failure "digest-mismatch" "$digest_mismatch_fixture" "sha256 mismatch"

missing_digest_fixture="$(make_fixture missing-digest true missing_first)"
expect_failure "missing-digest" "$missing_digest_fixture" "missing sha256 digest"

published_fixture="$(make_fixture published false good)"
expect_failure "published-release" "$published_fixture" "must remain draft"

echo "Release asset fixture tests passed"
