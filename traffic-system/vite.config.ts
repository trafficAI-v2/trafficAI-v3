import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 將 /api2 的請求代理到後端 detect_API
      '/api2': {
        // 在 Docker Compose 網路中，應使用服務名稱 'api2' 而不是 'localhost'
        target: 'http://api2:5001', 
        changeOrigin: true,
        ws:true,
        rewrite: (path) => path.replace(/^\/api2/, ''), // 將 /api2 前綴移除
      },
    },
  },
})
