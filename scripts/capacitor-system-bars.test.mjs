import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [capacitorConfig, rootRoute] = await Promise.all([
  readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/routes/__root.tsx', import.meta.url), 'utf8'),
]);

test('Android SystemBars uses native insets instead of startup CSS injection', () => {
  assert.match(
    capacitorConfig,
    /SystemBars\s*:\s*\{[^}]*insetsHandling\s*:\s*["']native["']/s,
    'configure @capacitor/android SystemBars with insetsHandling=native',
  );
  assert.match(
    rootRoute,
    /viewport-fit=cover/,
    'keep viewport-fit=cover so WebView can receive native safe-area insets',
  );
});
