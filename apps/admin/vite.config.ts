import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One origin for the browser: the refresh cookie (path /api/v1/auth) and API calls share it.
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
