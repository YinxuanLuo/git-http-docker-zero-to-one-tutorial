/**
 * 09 章 · 实战：把一个 Node 应用容器化并编排（演示脚本）
 *
 * 三步走：
 *   1. 用 node:http 真的起一个迷你 API，请求自己，证明"应用本身能跑"；
 *   2. 展示为它写的 Dockerfile + docker-compose.yml（示例文件，正文里也有）；
 *   3. 检测 docker：装了就演示 build 命令，没装就打印"本机未安装 Docker，跳过"。
 *
 * 运行：node examples/docker/09-node-app容器化.mjs
 */

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

// ---- 1. 应用本身：一个迷你 API ----
console.log('==================== 1. 要容器化的应用本身 ====================');
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'hello from node app' }));
});

// 监听一个随机端口，跑起来、请求自己、再关掉（不阻塞）
await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', resolve);
  server.on('error', reject);
});
const port = server.address().port;
console.log(`  应用已在 127.0.0.1:${port} 启动`);

const r1 = await fetch(`http://127.0.0.1:${port}/health`);
console.log('  GET /health →', await r1.text());
const r2 = await fetch(`http://127.0.0.1:${port}/`);
console.log('  GET /      →', await r2.text());
await new Promise((resolve) => server.close(resolve));
console.log('  应用已关闭（这证明：本地裸机能跑）');
console.log('  Docker 要解决的，就是"让这个应用在任何机器上都这样跑"，不用现装环境。');

// ---- 2. 为它写的 Dockerfile ----
console.log('\n==================== 2. 配套 Dockerfile ====================');
const dockerfile = `# 阶段一：构建依赖
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# 阶段二：运行
FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]`;
console.log(dockerfile);
console.log('  说明：多阶段（先装依赖再只拷产物）+ alpine 精简基础镜像 + 显式 EXPOSE。');

// ---- 3. 配套 docker-compose.yml ----
console.log('\n==================== 3. 配套 docker-compose.yml ====================');
const compose = `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`;
console.log(compose);
console.log('  说明：app 用 build（本地构建），db 用现成镜像；pgdata 命名卷存数据。');

// ---- 4. 真实 docker 检测 ----
console.log('\n==================== 4. 真实 docker 检测 ====================');
let hasDocker = false;
try {
  const v = execFileSync('docker', ['--version'], { stdio: 'pipe' }).toString().trim();
  hasDocker = true;
  console.log('检测到本机 Docker：', v);
} catch {
  console.log('本机未安装 Docker，跳过真实 docker build / compose up 演示。');
  console.log('（下面是在装了 Docker 的机器上会执行的命令。）');
}

console.log('\n在有 Docker 的机器上，完整流程是：');
console.log('  docker compose up --build -d');
console.log('  docker compose ps');
console.log('  curl http://localhost:3000/health');
console.log('  docker compose down -v');

if (hasDocker) {
  try {
    console.log('\n尝试执行 docker build 预览（不真正构建，只验证 daemon 可用）：');
    const out = execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'pipe' }).toString().trim();
    console.log('  daemon 版本：', out);
  } catch (e) {
    const msg = (e.stderr ? e.stderr.toString() : e.message).trim();
    console.log('  docker info 失败：', msg);
  }
}

console.log('\n==================== 小结 ====================');
console.log('容器化的完整闭环：写代码 → 写 Dockerfile → docker build 成镜像 →');
console.log('多服务用 compose 编排 → docker compose up 一键起 → down 一键清理。');
