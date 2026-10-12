/**
 * 05 章 · 网络与端口映射演示（纯 Node 内置模块，零依赖）
 *
 * 演示三件事：
 *   1. 端口映射：宿主端口 → 容器端口的"转发关系"（-p 宿主:容器）
 *   2. bridge 网络：容器之间靠"容器名"互相访问（内置 DNS）
 *   3. 容器默认是隔离的：不映射端口，外面访问不到
 *
 * 运行：node examples/docker/05-网络端口映射.mjs
 */

console.log('==================== 1. 端口映射（-p 宿主:容器） ====================');
// -p 8080:80 的意思是：把宿主机的 8080 端口，转发到容器的 80 端口。
// 顺序千万别搞反：左边是"宿主机（你从外面访问的）"，右边是"容器（应用真正监听的）"。
function parsePortMapping(spec) {
  const [host, container, proto = 'tcp'] = spec.split(/[:\/]/);
  return {
    spec,
    hostPort: Number(host),
    containerPort: Number(container),
    proto,
    desc: `宿主机 ${host} 端口 → 容器 ${container} 端口（${proto}）`,
  };
}

const examples = ['8080:80', '3000:3000', '5432:5432/tcp', '127.0.0.1:8080:80'];
console.log('docker run 的 -p 参数    实际含义');
console.log('------------------------------------------------');
for (const e of examples) {
  const m = parsePortMapping(e);
  console.log('  -p ' + m.spec.padEnd(22) + ' ' + m.desc);
}
console.log('\n最容易踩的坑：');
console.log('  docker run -p 80:8080 nginx');
console.log('  含义是"宿主机 80 → 容器 8080"。如果你写反成 -p 8080:80，');
console.log('  外面访问 8080，但 nginx 在容器里其实监听 80，会连接失败。');

console.log('\n==================== 2. bridge 网络与容器名解析 ====================');
// 在同一个自定义网络里，容器之间可以直接用"容器名"当主机名访问。
// 这是 Docker 内置的 DNS 在起作用，不用记 IP。
const network = {
  name: 'my-net',
  dns: new Map(),
  attach(container) {
    this.dns.set(container.name, container.ip);
    console.log(`  容器 ${container.name} 接入网络 ${this.name}，IP=${container.ip}`);
  },
  resolve(name) {
    return this.dns.get(name) ?? null;
  },
};

const db = { name: 'db', ip: '172.18.0.2' };
const web = { name: 'web', ip: '172.18.0.3' };
network.attach(db);
network.attach(web);

console.log('\nweb 容器里直接访问 db 容器（用容器名，不是 IP）：');
const resolved = network.resolve('db');
console.log(`  连接字符串: postgres://db:5432/mydb`);
console.log(`  DNS 解析 "db" → ${resolved}`);
console.log('\n为什么能用容器名？Docker 内置 DNS：同一网络里的容器名会自动注册。');
console.log('（而默认的 bridge 网络里，老版本 Docker 不能靠容器名互访，要用 --link 或自定义网络。）');

console.log('\n==================== 3. 默认隔离 ====================');
// 不写 -p，容器监听的端口只在"容器自己的网络命名空间"里，宿主和外界都摸不到。
const running = {
  name: 'web',
  listening: '0.0.0.0:3000（容器内部）',
  portMapped: false,
};
console.log(`容器 ${running.name} 监听 ${running.listening}`);
console.log(`端口映射了吗？${running.portMapped ? '是' : '否 → 宿主机访问 localhost:3000 会 Connection refused'}`);
console.log('结论：想从外面访问容器，必须显式 -p 映射；容器之间互访则走网络。');

console.log('\n==================== 小结 ====================');
console.log('-p 宿主:容器 —— 左宿主机、右容器，别写反；');
console.log('同一自定义网络里用容器名互访（内置 DNS），别用 IP；');
console.log('不映射端口，容器对外就是"隐身"的。');
