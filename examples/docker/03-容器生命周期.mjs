/**
 * 03 章 · 容器生命周期演示
 *
 * 演示容器的状态机：created → running → exited → removed。
 * 容器 = 镜像的一个"运行实例"，它的状态由 docker run/create/start/stop/rm 驱动。
 *
 * 纯 Node 模拟状态机（不依赖 docker），外加真实 docker 检测：
 *   本机装了 docker 就顺便演示 docker ps -a 的"状态列"；
 *   没装就打印跳过提示，退出码仍为 0。
 *
 * 运行：node examples/docker/03-容器生命周期.mjs
 */

import { execFileSync } from 'node:child_process';

// ---- 1. 容器状态机（纯模拟） ----
console.log('==================== 1. 容器状态机 ====================');
// 一个容器一生只在这些状态之间迁移：
//   created ──start──▶ running ──stop──▶ exited ──rm──▶ (消失)
//                          └──kill──▶ killed
const TRANSITIONS = {
  created: { start: 'running', rm: 'removed' },
  running: { stop: 'exited', kill: 'killed', rm: 'removed' },
  exited: { start: 'running', rm: 'removed' },
  killed: { rm: 'removed' },
  removed: {},
};

function container(name, image) {
  let state = 'created';   // docker run 其实 = create + start，这里分开演示
  const api = {
    get state() { return state; },
    image,
    name,
    act(action) {
      const next = TRANSITIONS[state][action];
      if (!next) {
        console.log(`  ✗ ${name} 处于 ${state}，不能执行 ${action}（docker 会报错：容器状态不对）`);
        return api;
      }
      const prev = state;
      state = next;
      console.log(`  ${name}(${image}): ${prev} --${action}--> ${state}`);
      return api;
    },
  };
  return api;
}

const web = container('web', 'nginx:latest');
web.act('start').act('stop').act('start').act('kill').act('rm');
console.log('最终状态:', web.state);

console.log('\n（对照 docker 命令：）');
console.log('  docker create 镜像      → 只创建容器，状态 created（不运行）');
console.log('  docker start 容器       → created → running');
console.log('  docker run 镜像         → create + start 一步到位');
console.log('  docker stop 容器        → running → exited（发 SIGTERM，优雅退出）');
console.log('  docker rm 容器          → 删除容器（数据随容器一起没）');
console.log('  docker ps               → 只列出 running 的容器');
console.log('  docker ps -a            → 列出所有状态（含 exited）的容器');

// ---- 2. 真实 docker 检测 ----
console.log('\n==================== 2. 真实 docker 检测 ====================');
let hasDocker = false;
try {
  const v = execFileSync('docker', ['--version'], { stdio: 'pipe' }).toString().trim();
  hasDocker = true;
  console.log('检测到本机 Docker：', v);
} catch {
  hasDocker = false;
  console.log('本机未安装 Docker，跳过真实 docker ps -a 演示。');
  console.log('（下面的输出是 docker ps -a 在你装了 Docker 之后会看到的样子。）');
}

if (hasDocker) {
  try {
    const out = execFileSync('docker', ['ps', '-a'], { stdio: 'pipe' }).toString();
    console.log('$ docker ps -a');
    console.log(out);
  } catch (e) {
    console.log('docker ps -a 执行失败：', e.stderr ? e.stderr.toString().trim() : e.message);
    console.log('（常见原因：Docker daemon 没启动，报 Cannot connect to the Docker daemon）');
  }
} else {
  console.log('$ docker ps -a');
  console.log('CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS                      PORTS     NAMES');
  console.log('a1b2c3d4e5f6   nginx:latest   "/docker-entrypoint.…"   5 minutes ago   Exited (0) 2 minutes ago              web');
  console.log('（注意 STATUS 列：Exited(0) 表示进程退出码为 0 地结束了，容器还在，只是停了）');
}

console.log('\n==================== 小结 ====================');
console.log('容器是"一次性"的：run 出来、用完就 rm，状态存不住；');
console.log('要长期保存的数据，别放容器里，放卷（第 06 章）。');
