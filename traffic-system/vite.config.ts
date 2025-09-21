import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080, // 設定為 8080 端口
    proxy: {
      // 將 /api2 的請求代理到後端 detect_API
      '/api2': {
        // 更新為本地服務
        target: 'http://localhost:5001', 
        changeOrigin: true,
        ws:true,
        rewrite: (path) => path.replace(/^\/api2/, ''), // 將 /api2 前綴移除
      },
    },
  },
})
