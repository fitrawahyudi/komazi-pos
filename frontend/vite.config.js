import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
// basicSsl mengaktifkan HTTPS agar Web Bluetooth API bisa berjalan
// saat diakses dari perangkat lain di jaringan WiFi yang sama.
export default defineConfig({
  resolve: {
    alias: {
      stream: path.resolve(__dirname, "src/utils/streamShim.js"),
    },
  },
  plugins: [
    react(),
    basicSsl(), // HTTPS self-signed cert — diperlukan oleh Web Bluetooth API
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: true,
            dropDebugger: true,
          },
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx')) {
              return 'vendor-excel';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@point-of-sale') || id.includes('esc-pos-encoder') || id.includes('qrcode')) {
              return 'vendor-printer';
            }
          }
        },
      },
    },
  },
  server: {
    https: true,
    host: true, // expose ke semua interface (0.0.0.0) agar bisa diakses via WiFi
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:4000",
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
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
