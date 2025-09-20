# 使用 Node.js 20-alpine 作為基礎映像
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝所有依賴
RUN npm install

# 複製所有程式碼 (這一步是為了讓容器可以獨立運行，即使沒有 volume)
COPY . .

# 告訴 Docker 容器 Vite 開發伺服器預設會使用 5173 port
EXPOSE 5173

# 預設的啟動指令是啟動開發伺服器
CMD ["npm", "run", "dev"]