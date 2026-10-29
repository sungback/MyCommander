#!/usr/bin/env bash
# Exercise network failures offline without sudo access or changes to the host's APT sources.
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 - "${script_dir}/install-linux-tauri-deps.sh" <<'PY'
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

INSTALL_SCRIPT = sys.argv.pop(1)
MOCK_TOOL = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
state = Path(os.environ['MOCK_STATE'])
mode = os.environ['MOCK_MODE']
with (state / 'calls.jsonl').open('a') as log:
    log.write(json.dumps([name, args]) + '\\n')
if name == 'sudo':
    os.execvp(args[0], args)
if name == 'timeout':
    command = args[3:]
    if '--download-only' in command and mode == 'download_timeout' and not (state / 'timed-out').exists():
        (state / 'timed-out').touch()
        sys.exit(124)
    os.execvp(command[0], command)
if name == 'apt-get':
    if 'update' in args:
        marker = state / 'updated'
        failed = mode == 'always_fail' or (mode == 'update_failure' and not marker.exists())
        marker.touch()
        sys.exit(100 if failed else 0)
    if '--download-only' in args:
        marker = state / 'downloaded'
        failed = mode == 'download_failure' and not marker.exists()
        marker.touch()
        sys.exit(100 if failed else 0)
    sys.exit(100 if mode == 'install_failure' else 0)
sys.exit(99)
'''


class InstallDependenciesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mycommander-apt-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sources = self.root / 'apt'
        (self.sources / 'sources.list.d').mkdir(parents=True)
        self.legacy = self.sources / 'sources.list'
        self.legacy.write_text('deb http://azure.archive.ubuntu.com/ubuntu jammy main\n')
        self.deb822 = self.sources / 'sources.list.d' / 'ubuntu.sources'
        self.deb822.write_text('URIs: https://azure.archive.ubuntu.com/ubuntu\nSuites: noble\n')
        self.third_party = self.sources / 'sources.list.d' / 'vendor.list'
        self.third_party.write_text('deb https://packages.microsoft.com/ubuntu noble main\n')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name in ('sudo', 'timeout', 'apt-get'):
            path = self.bin / name
            path.write_text(MOCK_TOOL)
            path.chmod(0o755)

    def run_install(self, mode='success'):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                   MOCK_STATE=str(self.root), MOCK_MODE=mode,
                   TAURI_APT_SOURCES_DIR=str(self.sources))
        result = subprocess.run(['bash', INSTALL_SCRIPT], env=env, text=True,
                                capture_output=True, timeout=15)
        self.calls = [json.loads(line) for line in (self.root / 'calls.jsonl').read_text().splitlines()]
        return result

    def installs(self):
        return [args for name, args in self.calls if name == 'apt-get' and '--no-download' in args]

    def test_success_keeps_mirror_and_installs_only_downloaded_required_packages(self):
        result = self.run_install()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('azure.archive.ubuntu.com', self.legacy.read_text())
        self.assertEqual(len(self.installs()), 1)
        self.assertIn('--no-install-recommends', self.installs()[0])
        for name, args in self.calls:
            if name == 'timeout':
                self.assertIn(args[2], ('90s', '180s'))
                self.assertNotIn('--no-download', args)

    def test_update_failure_switches_both_source_formats_and_preserves_other_repositories(self):
        result = self.run_install('update_failure')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('http://archive.ubuntu.com/ubuntu', self.legacy.read_text())
        self.assertIn('https://archive.ubuntu.com/ubuntu', self.deb822.read_text())
        self.assertIn('packages.microsoft.com', self.third_party.read_text())
        self.assertEqual(sum(name == 'apt-get' and 'update' in args for name, args in self.calls), 2)
        self.assertEqual(len(self.installs()), 1)

    def test_download_failure_retries_before_installing(self):
        result = self.run_install('download_failure')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum(name == 'apt-get' and '--download-only' in args for name, args in self.calls), 2)
        self.assertEqual(len(self.installs()), 1)

    def test_download_timeout_uses_fallback_and_then_installs(self):
        result = self.run_install('download_timeout')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root / 'timed-out').exists())
        self.assertIn('http://archive.ubuntu.com/ubuntu', self.legacy.read_text())
        self.assertEqual(len(self.installs()), 1)

    def test_both_attempts_fail_without_installing(self):
        result = self.run_install('always_fail')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sum(name == 'apt-get' and 'update' in args for name, args in self.calls), 2)
        self.assertEqual(self.installs(), [])

    def test_install_failure_is_not_retried_or_interrupted(self):
        result = self.run_install('install_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.installs()), 1)
        self.assertIn('azure.archive.ubuntu.com', self.legacy.read_text())

    def test_unknown_mirror_fails_without_rewriting_it(self):
        self.legacy.write_text('deb https://custom.example/ubuntu noble main\n')
        self.deb822.write_text('URIs: https://custom.example/ubuntu\n')
        result = self.run_install('always_fail')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('No Azure Ubuntu mirror found', result.stderr)
        self.assertIn('custom.example', self.legacy.read_text())
        self.assertEqual(self.installs(), [])


unittest.main()
PY
