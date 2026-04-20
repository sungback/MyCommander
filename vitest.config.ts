import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const currentNodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
// Node 25 + Vitest jsdom workers emit a localStorage CLI warning unless workers
// get an explicit backing file. Keep the workaround scoped to the known-bad
// runtime so future Node/Vitest upgrades can remove or revisit this block cleanly.
const vitestExecArgv = currentNodeMajor === 25
  ? ['--localstorage-file=.vitest-localstorage']
  : [];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    execArgv: vitestExecArgv,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'src-tauri/**',
        'dist/**',
        'src/test/**',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
    },
  },
});
