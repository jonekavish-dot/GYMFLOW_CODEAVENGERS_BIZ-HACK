import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the SPA runs on :5173 and proxies /api to FastAPI, so the browser sees one origin
// (the httpOnly refresh cookie then works exactly as it does in production).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: { chunkSizeWarningLimit: 900 },
});
