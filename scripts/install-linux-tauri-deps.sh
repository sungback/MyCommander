#!/usr/bin/env bash
# Bound network operations separately so a slow mirror never interrupts dpkg installation.
set -euo pipefail

apt_options=(
  -o Acquire::Retries=1
  -o Acquire::http::Timeout=20
  -o Acquire::https::Timeout=20
  -o DPkg::Lock::Timeout=60
)
packages=(libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf)

refresh_and_download() {
  sudo timeout --signal=TERM --kill-after=15s 90s \
    apt-get "${apt_options[@]}" -o APT::Update::Error-Mode=any update || return 1
  sudo timeout --signal=TERM --kill-after=15s 180s \
    apt-get "${apt_options[@]}" --yes --download-only --no-install-recommends \
    install "${packages[@]}"
}

use_fallback_mirror() {
  # The override is used by the offline fixture tests; CI uses /etc/apt.
  sudo python3 - "${TAURI_APT_SOURCES_DIR:-/etc/apt}" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
files = [root / 'sources.list', *sorted((root / 'sources.list.d').glob('*.list')),
         *sorted((root / 'sources.list.d').glob('*.sources'))]
changed = False
for path in files:
    if not path.is_file():
        continue
    original = path.read_text()
    updated = original.replace('://azure.archive.ubuntu.com/ubuntu',
                               '://archive.ubuntu.com/ubuntu')
    if updated != original:
        path.write_text(updated)
        changed = True
if not changed:
    sys.exit('No Azure Ubuntu mirror found; cannot select the fallback safely.')
print('Using archive.ubuntu.com instead of the Azure Ubuntu mirror.')
PY
}

if ! refresh_and_download; then
  echo 'Ubuntu package download failed or exceeded its time limit; retrying with the fallback mirror.' >&2
  use_fallback_mirror
  refresh_and_download
fi

# All packages must already be downloaded. Do not timeout or retry a running installation.
sudo env DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" \
  --yes --no-download --no-install-recommends install "${packages[@]}"
