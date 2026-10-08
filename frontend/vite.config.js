import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
// basicSsl mengaktifkan HTTPS agar Web Bluetooth API bisa berjalan
// saat diakses dari perangkat lain di jaringan WiFi yang sama.
export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // HTTPS self-signed cert — diperlukan oleh Web Bluetooth API
  ],
  server: {
    https: true,
    host: true, // expose ke semua interface (0.0.0.0) agar bisa diakses via WiFi
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    https: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
