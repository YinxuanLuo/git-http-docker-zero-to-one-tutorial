/**
 * 08 章 · 多阶段构建演示（纯 Node 内置模块，零依赖）
 *
 * 演示：同样的应用，单阶段构建 vs 多阶段构建，最终镜像体积差多少。
 *
 * 核心思想：构建需要"重"的工具（编译、装一堆 dev 依赖），
 * 但运行只需要"轻"的产物。多阶段构建 = 在第一个阶段里构建，
 * 只把产物复制到第二个"运行阶段"，工具链不进入最终镜像。
 *
 * 运行：node examples/docker/08-多阶段构建.mjs
 */

console.log('==================== 1. 单阶段构建（对比基准） ====================');
// 单阶段：构建工具和源码全部留在最终镜像里
const singleStage = {
  layers: [
    { name: 'node:22 基础镜像', sizeMB: 340 },
    { name: '源码 + node_modules（含 devDependencies）', sizeMB: 280 },
    { name: '构建产物 dist/', sizeMB: 2 },
  ],
};
const singleTotal = singleStage.layers.reduce((s, l) => s + l.sizeMB, 0);
for (const l of singleStage.layers) {
  console.log(`  ${l.name.padEnd(40)} ${String(l.sizeMB).padStart(5)} MB`);
}
console.log(`  最终镜像 = ${singleTotal} MB（工具链、源码、dev 依赖全在里面，白占地方）`);

console.log('\n==================== 2. 多阶段构建 ====================');
// 阶段一（builder）：装齐工具、构建出产物
// 阶段二（runtime）：只复制产物，工具链不进来
const multiStage = {
  builder: {
    layers: [
      { name: 'node:22 基础镜像', sizeMB: 340 },
      { name: '源码 + devDependencies', sizeMB: 280 },
      { name: '构建出 dist/', sizeMB: 2 },
    ],
  },
  // 最终镜像只保留 runtime 阶段的层
  runtime: {
    layers: [
      { name: 'node:22-alpine 精简基础镜像', sizeMB: 110 },
      { name: '只复制 dist/ 产物', sizeMB: 2 },
      { name: '只复制生产依赖', sizeMB: 45 },
    ],
  },
};
const builderTotal = multiStage.builder.layers.reduce((s, l) => s + l.sizeMB, 0);
const runtimeTotal = multiStage.runtime.layers.reduce((s, l) => s + l.sizeMB, 0);
console.log('阶段一（builder，构建完就丢弃）:');
for (const l of multiStage.builder.layers) {
  console.log(`  ${l.name.padEnd(40)} ${String(l.sizeMB).padStart(5)} MB`);
}
console.log(`  builder 阶段 = ${builderTotal} MB（不进最终镜像）`);
console.log('阶段二（runtime，最终镜像）:');
for (const l of multiStage.runtime.layers) {
  console.log(`  ${l.name.padEnd(40)} ${String(l.sizeMB).padStart(5)} MB`);
}
console.log(`  最终镜像 = ${runtimeTotal} MB`);

console.log('\n==================== 3. 对比 ====================');
const saved = singleTotal - runtimeTotal;
console.log(`  单阶段最终镜像 : ${singleTotal} MB`);
console.log(`  多阶段最终镜像 : ${runtimeTotal} MB`);
console.log(`  省下           : ${saved} MB（${Math.round((saved / singleTotal) * 100)}%）`);
console.log('  同时：攻击面更小（没有编译器、没有 dev 依赖可被利用）。');

console.log('\n==================== 4. 对应的 Dockerfile 长这样 ====================');
const dockerfile = `# 阶段一：构建（起个别名 builder）
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 阶段二：运行（从零开始，只拿产物）
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]`;
console.log(dockerfile);
console.log('\n要点：');
console.log('  1. 每个 FROM 开启一个新阶段，最终镜像是"最后一个 FROM 之后的层"。');
console.log('  2. COPY --from=builder 从上一个阶段把文件拷过来。');
console.log('  3. 第一个阶段可起名（AS builder），也可以 --from=0 用序号引用。');

console.log('\n==================== 小结 ====================');
console.log('构建要重、运行要轻：多阶段把"构建工具链"挡在最终镜像之外；');
console.log('镜像瘦身三板斧：多阶段构建 + 精简基础镜像(alpine) + .dockerignore。');
