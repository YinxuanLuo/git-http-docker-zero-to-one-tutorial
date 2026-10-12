# 09 章实战：一个会被 compose 编排的 Node 应用
# 本文件是示例，不要求能自动跑（读者机器未必装了 Docker）

FROM node:22-alpine
WORKDIR /app

# 先复制依赖清单 → 让 npm install 这一层可缓存
COPY package*.json ./
RUN npm install --omit=dev

# 再复制源码
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
