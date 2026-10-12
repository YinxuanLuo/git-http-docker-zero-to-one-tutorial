/**
 * 04 章 · Dockerfile 指令解析演示（纯 Node 内置模块，零依赖）
 *
 * 演示：把一段 Dockerfile 文本解析成"指令 + 参数"的有序列表，
 * 并说明每条指令在构建时做什么、会产生什么影响。
 *
 * 运行：node examples/docker/04-Dockerfile解析.mjs
 */

// 一段典型的 Node 应用 Dockerfile（作为字符串内嵌，避免依赖真实文件）
const DOCKERFILE = `
# 基础镜像：从哪一层开始叠
FROM node:22-alpine

# 设置工作目录（不存在的目录会被自动创建，后面 RUN/COPY 都相对它）
WORKDIR /app

# 先只复制依赖清单 → 让 npm install 这一层能被缓存
COPY package*.json ./

# 安装依赖（这一层最贵，所以要尽量靠前 + 靠缓存）
RUN npm install --omit=dev

# 再复制其余源码
COPY . .

# 声明容器运行时监听哪个端口（只是元数据，不真的开端口）
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动命令（一个容器只允许一个 CMD）
CMD ["node", "server.js"]
`;

console.log('==================== 解析 Dockerfile ====================');
console.log('原始文本：');
console.log(DOCKERFILE);

// 逐行解析：去掉注释和空行，拆分指令名与参数
function parse(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const sp = line.indexOf(' ');
    const instr = sp === -1 ? line : line.slice(0, sp);
    const args = sp === -1 ? '' : line.slice(sp + 1);
    out.push({ instr: instr.toUpperCase(), args });
  }
  return out;
}

const steps = parse(DOCKERFILE.split('\n'));

console.log('\n解析出的指令序列（构建时按此顺序执行）：');
console.log('------------------------------------------------------------');
console.log('序号  指令        参数                         作用');
console.log('------------------------------------------------------------');

// 每条指令的"人话说明"（对应 04 章正文）
const MEANING = {
  FROM: '指定基础镜像，相当于"从哪一层开始叠"（必须第一条）',
  WORKDIR: '设置工作目录，后续 RUN/COPY 都相对它（自动创建）',
  COPY: '把构建上下文里的文件复制进镜像（比 ADD 更明确，优先用）',
  RUN: '构建时执行命令，产物固化成一个新层',
  EXPOSE: '声明监听端口（只是文档元数据，不实际开端口）',
  ENV: '设置环境变量，运行时容器里也能读到',
  CMD: '容器启动时的默认命令（可被 docker run 末尾参数覆盖）',
};

steps.forEach((s, i) => {
  const note = MEANING[s.instr] ?? '(其它指令)';
  console.log(
    String(i + 1).padStart(3) + '  ' +
    s.instr.padEnd(11) + ' ' +
    s.args.padEnd(30) + ' ' +
    note,
  );
});

console.log('\n==================== 关键结论 ====================');
console.log('1. FROM 必须排第一，且一个 Dockerfile 通常只有一个（多阶段构建除外，第 08 章）。');
console.log('2. 指令顺序 = 缓存友好顺序：越"贵且不易变"的（npm install）越靠前。');
console.log('3. RUN 会产生新层，尽量合并成一条（用 &&），减少层数。');
console.log('4. CMD 和 ENTRYPOINT 二选一或组合用：CMD 可被覆盖，ENTRYPOINT 更"硬"。');
