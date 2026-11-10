import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    dashboard: resolve(import.meta.dirname, 'dashboard.html'),
  },
})
