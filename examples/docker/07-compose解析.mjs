/**
 * 07 章 · docker compose 解析演示（纯 Node 内置模块，零依赖）
 *
 * 演示：手写解析一个最小 docker-compose.yml，抽出 service / network / volume，
 * 并说明 `docker compose up` 启动时会发生什么。
 *
 * 注意：这里只做"结构展示 + 依赖排序"的教学解析，不引入 yaml 依赖。
 * 真实 compose 的完整 YAML 解析由 docker 自己完成。
 *
 * 运行：node examples/docker/07-compose解析.mjs
 */

const COMPOSE = `
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
  web:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://db:5432/mydb

volumes:
  pgdata:
`;

console.log('==================== 一段 docker-compose.yml ====================');
console.log(COMPOSE);

console.log('==================== 解析出的结构 ====================');
// 教学用的极简解析：按缩进识别 services / volumes 顶层块，并收集子项
function parseCompose(text) {
  const services = [];
  const volumes = [];
  let section = null;
  let currentService = null;
  let currentField = null;   // 正在收集子项的字段（environment / volumes / ports / depends_on）

  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    if (indent === 0) {
      // 顶层键：services: / volumes: / networks:
      section = line.replace(/:$/, '');
      currentField = null;
      continue;
    }
    if (section === 'services' && indent === 2) {
      // 服务名
      currentService = { name: line.replace(/:$/, ''), fields: {} };
      services.push(currentService);
      currentField = null;
      continue;
    }
    if (section === 'services' && indent === 4 && currentService) {
      // 服务下的字段：image / ports / depends_on / environment / volumes
      const idx = line.indexOf(':');
      const k = line.slice(0, idx === -1 ? undefined : idx);
      const v = idx === -1 ? '' : line.slice(idx + 1).trim();
      // 去掉字符串两端的引号
      currentService.fields[k] = v.replace(/^"(.*)"$/, '$1') || [];
      currentField = v ? null : k;   // 没有值 → 下面有子项
      continue;
    }
    if (section === 'services' && indent === 6 && currentService && currentField) {
      // 子项：environment 的 KEY: val、ports/volumes/depends_on 的 - item
      const arr = currentService.fields[currentField];
      if (Array.isArray(arr)) {
        arr.push(line.replace(/^-\s*/, '').replace(/^"(.*)"$/, '$1'));
      }
      continue;
    }
    if (section === 'volumes' && indent === 2) {
      volumes.push(line.replace(/:$/, ''));
    }
  }
  return { services, volumes };
}

const parsed = parseCompose(COMPOSE);

console.log('\n[services]');
for (const s of parsed.services) {
  console.log(`  ${s.name}`);
  for (const [k, v] of Object.entries(s.fields)) {
    if (Array.isArray(v) && v.length > 0) {
      console.log(`    ${k}:`);
      for (const item of v) console.log(`      - ${item}`);
    } else if (Array.isArray(v)) {
      console.log(`    ${k}: (空)`);
    } else {
      console.log(`    ${k}: ${v}`);
    }
  }
}
console.log('\n[volumes]');
for (const v of parsed.volumes) {
  console.log(`  ${v}`);
}

console.log('\n==================== depends_on 与启动顺序 ====================');
// depends_on 只保证"先启动 db、再启动 web"，不保证"db 已就绪"。
// 这里做一次拓扑排序，展示启动顺序。
function startOrder(services) {
  const order = [];
  const started = new Set();
  // 简化：depends_on 里列出的服务先启动
  const deps = new Map();
  for (const s of services) {
    const raw = s.fields.depends_on ?? [];
    const d = Array.isArray(raw) ? raw : String(raw).match(/\w+/g) ?? [];
    deps.set(s.name, d);
  }
  const visit = (name) => {
    if (started.has(name)) return;
    for (const d of deps.get(name) ?? []) visit(d);
    started.add(name);
    order.push(name);
  };
  for (const s of services) visit(s.name);
  return order;
}

console.log('启动顺序（拓扑排序）:', startOrder(parsed.services).join(' → '));
console.log('\n⚠ depends_on 的坑：它只等"容器起来了"，不等"应用就绪"。');
console.log('  db 容器虽然先启动，但 postgres 可能还没初始化完，web 就连不上。');
console.log('  生产里用 wait-for-it / healthcheck + depends_on.condition 解决。');

console.log('\n==================== 常用命令对照 ====================');
console.log('  docker compose up           前台启动（Ctrl+C 停）');
console.log('  docker compose up -d        后台启动');
console.log('  docker compose down         停止并删除容器/网络');
console.log('  docker compose down -v      连卷一起删（数据也删！）');
console.log('  docker compose logs -f web  跟踪某个服务的日志');
console.log('  docker compose build        重新构建（Dockerfile 变了才需要）');

console.log('\n==================== 小结 ====================');
console.log('一个 yml 描述"多个服务 + 它们之间的网络与卷"；');
console.log('docker compose up 一键拉起整套；down 一键清理；');
console.log('depends_on 管启动顺序，不管就绪状态。');
