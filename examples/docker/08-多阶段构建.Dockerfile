# 08 章示例：多阶段构建
# 目标：构建工具（编译器、dev 依赖）留在阶段一，最终镜像只留产物

# ---------- 阶段一：构建（起别名 builder） ----------
FROM node:22 AS builder
WORKDIR /app

# 先复制依赖清单，缓存 npm install 这一层
COPY package*.json ./
RUN npm install

# 复制源码并构建
COPY . .
RUN npm run build

# ---------- 阶段二：运行（最终镜像从这里开始） ----------
FROM node:22-alpine
WORKDIR /app

# 只把阶段一的产物和生产依赖拷过来，编译器/源码/dev 依赖都不进来
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
