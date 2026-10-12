/**
 * 01 章 · 环境与心智模型演示
 *
 * 演示三概念（镜像 / 容器 / 仓库）+ docker CLI 结构 + 架构（client/daemon/registry）。
 *
 * 涉及真实 docker 命令的部分会先检测 docker 是否存在：
 *   存在 → 打印真实版本信息；
 *   不存在 → 打印跳过提示，退出码仍为 0。
 *
 * 运行：node examples/docker/01-镜像容器仓库.mjs
 */

import { execFileSync } from 'node:child_process';

console.log('==================== 1. 三个核心概念 ====================');
// 镜像 = 只读的构建产物（类比"类"）；容器 = 镜像的运行实例（类比"实例"）；
// 仓库 = 存镜像的远端（类比 npm registry）。
const concepts = [
  ['镜像 image', '只读的构建产物，装好环境和代码的"安装包"', '类 / 安装包', '不可变'],
  ['容器 container', '镜像运行起来的一个实例', '实例 / 运行中的进程', '可创建可销毁'],
  ['仓库 registry', '存放镜像的远端（Docker Hub 等）', 'npm registry', '拉取/推送镜像'],
];
console.log('概念        是什么                                  类比           关键性质');
console.log('------------------------------------------------------------------');
for (const [a, b, c, d] of concepts) {
  console.log(`  ${a.padEnd(12)} ${b.padEnd(30)} ${c.padEnd(16)} ${d}`);
}

console.log('\n三者关系（一条命令串起来）：');
console.log('  docker pull nginx      ← 从仓库(registry) 拉镜像(image)');
console.log('  docker run nginx       ← 用镜像(image) 启动一个容器(container)');
console.log('  docker push user/nginx ← 把本地镜像(image) 推回仓库(registry)');

console.log('\n==================== 2. docker CLI 结构 ====================');
// 所有 docker 命令都是这个形状：docker <对象> <动作> [选项]
const cli = [
  ['docker images', '列出本地镜像'],
  ['docker ps', '列出运行中的容器'],
  ['docker pull <镜像>', '拉镜像'],
  ['docker run <镜像>', '跑容器'],
  ['docker build -t <名> .', '用 Dockerfile 构建镜像'],
  ['docker network ls', '列出网络'],
  ['docker volume ls', '列出卷'],
];
console.log('命令                   作用');
console.log('------------------------------------------');
for (const [cmd, desc] of cli) {
  console.log(`  ${cmd.padEnd(24)} ${desc}`);
}
console.log('\n规律：docker 后面先跟"对象"（image/container/network/volume），再跟"动作"。');
console.log('  例如 docker container rm xxx 和 docker rm xxx 等价（rm 是 container 的简写）。');

console.log('\n==================== 3. 架构（client / daemon / registry） ====================');
// 你敲的 docker 是 client；真正干活的是后台 daemon；镜像来自 registry。
console.log('  ┌─────────┐      unix socket      ┌──────────┐      https      ┌──────────┐');
console.log('  │ docker  │ ─────────────────────▶ │  daemon  │ ──────────────▶ │ registry │');
console.log('  │ (client)│ ◀───────────────────── │ (后台)   │ ◀────────────── │ (Docker  │');
console.log('  └─────────┘        REST API        └──────────┘                  │ Hub)     │');
console.log('                                                                  └──────────┘');
console.log('  关键：client 和 daemon 可以不在同一台机器（docker -H 远程连接）。');
console.log('  daemon 没启动时，client 会报：Cannot connect to the Docker daemon');

console.log('\n==================== 4. 真实 docker 检测 ====================');
let hasDocker = false;
try {
  const v = execFileSync('docker', ['--version'], { stdio: 'pipe' }).toString().trim();
  hasDocker = true;
  console.log('检测到本机 Docker：', v);
} catch {
  console.log('本机未安装 Docker（或不在 PATH），跳过真实命令演示。');
  console.log('（装了 Docker 之后，下面这些命令的典型输出如下。）');
}

if (hasDocker) {
  try {
    console.log('$ docker version --format "{{.Server.Version}}"');
    const server = execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'pipe' }).toString().trim();
    console.log('  Server 版本：', server);
  } catch (e) {
    const msg = (e.stderr ? e.stderr.toString() : e.message).trim();
    console.log('  docker version 失败：', msg);
    console.log('  （如果你看到 Cannot connect to the Docker daemon，说明 client 在但 daemon 没跑）');
  }
} else {
  console.log('$ docker version');
  console.log('Client: Docker Engine - Community');
  console.log(' Version:           27.3.1');
  console.log('Server: Docker Engine - Community');
  console.log(' Engine:');
  console.log('  Version:          27.3.1');
  console.log('（Client 和 Server 两段分开显示：Client 是命令行，Server 是 daemon）');
}

console.log('\n==================== 小结 ====================');
console.log('镜像=类/安装包、容器=实例/进程、仓库=远端存储；');
console.log('CLI 结构：docker <对象> <动作>；');
console.log('架构：client 发指令给 daemon 干活，daemon 从 registry 拉镜像。');
