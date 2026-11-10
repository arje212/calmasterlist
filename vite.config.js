import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 1735,
    watch: {
  ignored: [
    '**/external/**',
    '**/report-data/**',
    '**/*.xls', '**/*.XLS', '**/*.xlsx', '**/*.XLSX', '**/*.xlsm', '**/*.XLSM', '**/*.sqlite',
  ],
},
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT || 3001}`,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
  ]
});
