import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const fileEnv = existsSync(envPath)
  ? parseEnv(readFileSync(envPath, 'utf8'))
  : {};
const port = process.env.PORT ?? fileEnv.PORT ?? '3001';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:' + port, changeOrigin: false },
    },
  },
});
