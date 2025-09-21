import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080, // 修正：使用 8080 端口與 Docker 映射一致
    proxy: {
      // 將 /api 的請求代理到 web_api 服務
      '/api': {
        target: 'http://web_api:3002', // 修正：使用容器服務名稱
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      // 將 /api2 的請求代理到後端 detect_API (本地運行)
      '/api2': {
        target: 'http://host.docker.internal:5001', // 修正：連接到主機上的本地服務
        changeOrigin: true,
        ws: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api2/, ''), // 將 /api2 前綴移除
      },
    },
  },
})
