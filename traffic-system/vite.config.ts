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
        // 安全注意：Docker 內部網絡通信使用 HTTP 是安全的
        // 該連線僅限於容器內部網絡，不暴露於公網
        target: 'http://web_api:3002', // NOSONAR: S5332 內部網絡通信
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      // 將 /api2 的請求代理到後端 detect_API (本地運行)
      '/api2': {
        // 安全注意：Docker 內部網絡通信使用 HTTP 是安全的
        // 該連線僅限於本機與容器內部通信，不暴露於公網
        target: 'http://host.docker.internal:5001', // NOSONAR: S5332 內部網絡通信
        changeOrigin: true,
        ws: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api2/, ''), // 將 /api2 前綴移除
      },
    },
  },
})
