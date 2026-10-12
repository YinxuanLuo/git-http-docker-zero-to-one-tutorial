/**
 * 06 章 · 卷与持久化演示（纯 Node 内置模块，零依赖）
 *
 * 演示两件事：
 *   1. 容器是"用完即丢"的：数据写在容器可写层，容器 rm 之后数据就没了
 *   2. 卷（volume / bind mount）把数据放在容器之外，容器没了数据还在
 *
 * 运行：node examples/docker/06-卷与持久化.mjs
 */

console.log('==================== 1. 没有卷：数据随容器一起消失 ====================');
// 容器有一个"可写层"（copy-on-write），往里写数据，容器一删，可写层也删。
function runContainerWithoutVolume(name) {
  const container = {
    name,
    writableLayer: {},   // 容器的可写层
    write(path, content) {
      this.writableLayer[path] = content;
    },
  };
  container.write('/app/data.txt', '重要数据');
  console.log(`  容器 ${name} 写入了 /app/data.txt = ${JSON.stringify(container.writableLayer['/app/data.txt'])}`);
  return container;
}

const c1 = runContainerWithoutVolume('web-1');
console.log('  docker rm web-1 之后……');
console.log(`  容器 web-1 的可写层没了，数据没了。容器对象本身已不可访问。`);

console.log('\n对比：数据放进卷（volume），它独立于容器生命周期：');

// ---- 2. 命名卷：数据独立于容器 ----
console.log('\n==================== 2. 命名卷（volume） ====================');
const volumes = {};   // Docker 的卷其实存在 /var/lib/docker/volumes/ 下，独立于容器

function dockerVolumeCreate(name) {
  volumes[name] = { data: {} };
  console.log(`  docker volume create ${name} → 创建了一个独立于容器的存储`);
  return volumes[name];
}

function runContainerWithVolume(name, volumeName, mountPoint) {
  const vol = volumes[volumeName] ?? dockerVolumeCreate(volumeName);
  const container = {
    name,
    mountPoint,
    write(path, content) {
      // 关键：写的是卷里的数据，不是容器可写层
      vol.data[path] = content;
    },
  };
  console.log(`  容器 ${name} 挂载卷 ${volumeName} 到 ${mountPoint}`);
  return container;
}

dockerVolumeCreate('pgdata');
const c2 = runContainerWithVolume('db-1', 'pgdata', '/var/lib/postgresql/data');
c2.write('pg_data', '数据库文件…');
console.log('  db-1 写入了数据（实际写到卷 pgdata 里）');

console.log('  docker rm db-1 之后，卷 pgdata 还在：');
console.log('  卷 pgdata 里的数据:', JSON.stringify(volumes['pgdata'].data));

const c3 = runContainerWithVolume('db-2', 'pgdata', '/var/lib/postgresql/data');
console.log('  新容器 db-2 挂载同一个卷 pgdata，数据"回来"了：', JSON.stringify(volumes['pgdata'].data));

// ---- 3. bind mount vs volume ----
console.log('\n==================== 3. bind mount vs volume ====================');
console.log('两种挂载的区别：');
console.log('------------------------------------------------------------');
console.log('  volume（命名卷）    docker 管理，路径在 /var/lib/docker/volumes/，适合"数据库数据"');
console.log('  bind mount（绑定挂载）直接挂宿主机的某个绝对路径，适合"开发时热更源码"');
console.log('------------------------------------------------------------');
console.log('命令对照：');
console.log('  docker run -v pgdata:/var/lib/postgresql/data postgres   # 命名卷（推荐）');
console.log('  docker run -v $(pwd)/src:/app nginx                       # bind mount（开发用）');

// ---- 4. 匿名卷 ----
console.log('\n==================== 4. 匿名卷 ====================');
console.log('  docker run -v /data nginx');
console.log('  没写冒号左边 → 匿名卷：Docker 自动起个随机名，数据一样持久，但不好管理。');
console.log('  容器 rm（不带 -v）后匿名卷会变成"孤儿卷"，越积越多 → docker volume prune 清理。');

console.log('\n==================== 小结 ====================');
console.log('容器可写层 = 一次性，容器删了数据没；');
console.log('要持久化就用卷：命名卷（生产）、bind mount（开发）、匿名卷（少用）；');
console.log('docker rm 默认不删卷，删卷要显式 docker volume rm / prune。');
