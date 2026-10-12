# 04 章示例：一个最小但"对的" Node 应用 Dockerfile
# 注意指令顺序 = 缓存友好顺序：越贵且越不易变（npm install）越靠前

# 1. 基础镜像：alpine 比完整版小一个数量级
FROM node:22-alpine

# 2. 工作目录：后续 RUN/COPY 都相对它（目录不存在会自动创建）
WORKDIR /app

# 3. 先只复制依赖清单，让"装依赖"这一层能被缓存
COPY package*.json ./

# 4. 安装依赖（生产依赖即可，dev 依赖别进镜像）
RUN npm install --omit=dev

# 5. 再复制其余源码（源码一变，只有这一层和之后的层重建）
COPY . .

# 6. 声明端口（只是元数据，不真正开端口，真正开端口靠 docker run -p）
EXPOSE 3000

# 7. 环境变量
ENV NODE_ENV=production

# 8. 启动命令：数组形式，避免经过 shell 带来的信号/变量问题
CMD ["node", "server.js"]
