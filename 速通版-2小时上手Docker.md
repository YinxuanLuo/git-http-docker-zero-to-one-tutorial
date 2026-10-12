# 速通版 · 2 小时上手 Docker

> 这是「Docker 从零到一」的**极简路线**：2 小时，只讲"上手必须会的"，跳过所有"为什么这么设计"的深度。
> 想真正搞懂原理，回到完整版 `docs/docker/00-设计哲学.md` 从头读。
>
> 本速通版你需要记住的就一件事：**Docker = 把"代码 + 环境"打包成镜像，跑起来就是容器。你只需要会四件事：跑容器（run）、写镜像（Dockerfile）、映射端口（-p）、挂数据（-v），再加一个编排（compose）。**

---

## 0. 三个词，先记住

| 词 | 是什么 | 类比 |
|---|---|---|
| **镜像 image** | 只读的"代码 + 环境"打包产物 | 类 / 安装包 |
| **容器 container** | 镜像跑起来的实例 | 实例 / 运行中的进程 |
| **仓库 registry** | 放镜像的远端（Docker Hub） | npm registry |

一条命令串起三者：

```bash
docker pull nginx      # 从仓库拉镜像
docker run nginx       # 用镜像跑容器
docker push 你的名/nginx # 把镜像推回仓库
```

---

## 1. 装好没？三行自检（10 分钟）

```bash
docker --version        # 看 client 在不在
docker version          # 看 daemon 在不在（会打印 Client 和 Server 两段）
docker run hello-world  # 看整条链路通不通
```

**看到这个就是 daemon 没启动**（最常见的第一个坑）：

```text
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

修法：开 Docker Desktop（Windows/Mac），或 `sudo systemctl start docker`（Linux）。

> 记住：`docker run` 第一次跑某个镜像，会先打印 `Unable to find image 'xxx' locally`——**这不是报错**，是"本地没有，去拉"的意思。

---

## 2. 跑你的第一个容器（20 分钟）

```bash
# 后台跑一个 nginx，命名 web，宿主 8080 映射到容器 80
docker run -d --name web -p 8080:80 nginx

# 看它
docker ps

# 访问它
curl http://localhost:8080

# 看日志
docker logs web

# 停掉、删掉
docker stop web
docker rm web
```

**必须会的几个参数：**

| 参数 | 作用 |
|---|---|
| `-d` | 后台运行 |
| `--name 名` | 起名字（不写就随机怪名） |
| `-p 宿主:容器` | 端口映射（左宿主右容器，别写反） |
| `-e 名=值` | 传环境变量 |
| `-v 卷/目录:容器路径` | 挂数据 |
| `--rm` | 用完自动删 |
| `-it` | 交互（`docker exec -it 容器 bash` 进入容器） |

**进一个正在跑的容器：**

```bash
docker exec -it web bash
# exit 退出（不影响容器）
```

**`docker ps` 看不到刚跑的容器？** 加 `-a`：

```bash
docker ps -a      # 看所有状态（含 exited）
```

---

## 3. 写自己的镜像：Dockerfile（40 分钟）

一个最小但正确的 Node 应用 Dockerfile：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

**构建 + 运行：**

```bash
docker build -t myapp:1.0 .
docker run -d --name app -p 3000:3000 myapp:1.0
```

**八个指令，记牢：**

| 指令 | 作用 | 最容易错的点 |
|---|---|---|
| `FROM` | 基础镜像（第一条） | 生产用 `-alpine`（小） |
| `WORKDIR` | 工作目录 | 后续命令都相对它 |
| `COPY` | 复制文件进镜像 | 只能取构建上下文里的文件 |
| `RUN` | **构建时**执行命令 | 别用它启动服务 |
| `ENV` | 环境变量 | 构建运行时都生效 |
| `EXPOSE` | 声明端口 | **不真正开放端口** |
| `CMD` | 启动命令 | 用 `["node","server.js"]` 形式 |
| `ENTRYPOINT` | 固定启动命令 | 比 CMD 更"硬" |

**两个黄金顺序：**

1. **依赖清单先 COPY，源码后 COPY**（这样改代码不会重装依赖）：

```dockerfile
COPY package*.json ./
RUN npm install
COPY . .
```

2. **启动用 CMD，别用 RUN**（RUN 是构建时执行的）。

---

## 4. 网络：容器怎么互相找到（15 分钟）

**外面访问容器**：靠端口映射 `-p 宿主:容器`。

**容器之间互访**：创建自定义网络，用**容器名**互访：

```bash
docker network create my-net
docker run -d --name db --network my-net postgres:16
docker run -d --name web --network my-net myapp
# web 里直接连 db 这个名字（不用记 IP）
```

> 默认 bridge 网络里**不能**用容器名互访（只能用 IP），所以多容器一定用自定义网络。

---

## 5. 数据持久化：卷（15 分钟）

**容器的数据默认会丢**（随容器删除而销毁）。要留住数据，挂卷：

```bash
# 命名卷（生产存数据用这个）
docker run -d -v pgdata:/var/lib/postgresql/data postgres:16

# 绑定宿主目录（开发热更用这个）
docker run -d -v "$(pwd)/src:/app" myapp
```

**区分口诀**：`-v` 冒号左边**带 `/`** 是绑宿主目录，**不带 `/`** 是命名卷。

**关键事实**：`docker rm` **不删卷**，数据还在；删卷要 `docker volume rm`。

---

## 6. 编排多个服务：compose（25 分钟）

把"一堆 docker run"写成一个 `docker-compose.yml`：

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**四个命令，够用了：**

```bash
docker compose up -d              # 一键起整套
docker compose ps                 # 看状态
docker compose logs -f app        # 看某个服务日志
docker compose down               # 一键清理（留卷）
```

> ⚠️ `docker compose down -v` 会**连卷一起删**（数据没了），别乱用。

**`depends_on` 的坑**：它只保证启动**顺序**，不保证数据库**就绪**。要等就绪，加 `healthcheck` + `condition: service_healthy`（如上）。

---

## 7. 完整实战：Node 应用容器化并编排（20 分钟）

走一遍完整闭环（详细代码见 `examples/docker/09-app/`）：

**第 1 步：写应用** `server.js`（零依赖，裸机先跑通）：

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'hello from node app' }));
});

server.listen(3000, () => console.log('listening on 3000'));
```

**第 2 步：写 Dockerfile**（见上面第 3 节）。

**第 3 步：写 .dockerignore**：

```dockerignore
node_modules
.git
.env
```

**第 4 步：构建 + 单容器验证**：

```bash
docker build -t myapp:1.0 .
docker run -d -p 3000:3000 myapp:1.0
curl http://localhost:3000/health
```

**第 5 步：写 compose**（见上面第 6 节）+ `docker compose up -d`。

**没有 Docker 也想看效果？** 配套脚本用 Node 演示了完整闭环：

```bash
node examples/docker/09-node-app容器化.mjs
```

---

## 8. 一页速查（贴在键盘旁边）

```bash
# 镜像
docker pull 镜像:tag          # 拉
docker image ls               # 看
docker image rm 镜像          # 删
docker build -t 名:tag .      # 构建

# 容器
docker run -d --name 名 -p 8080:80 镜像   # 跑
docker ps / docker ps -a                   # 看（运行中 / 全部）
docker logs -f 容器                        # 日志
docker exec -it 容器 bash                  # 进入
docker stop 容器 / docker kill 容器        # 停 / 强杀
docker rm 容器                             # 删

# 网络 / 卷
docker network create 名
docker volume create 名
docker volume ls

# compose
docker compose up -d
docker compose ps
docker compose down
```

**三个"不是"救你命：**

1. `Unable to find image ... locally` **不是报错**（去拉了）。
2. `Cannot connect to the Docker daemon` **不是命令错**（daemon 没起）。
3. `EXPOSE` 写的端口**不会自动开放**（要 `-p`）。

---

## 9. 学完速通版，接下来

- 想搞懂原理：回 [第 00 章 · 设计哲学](docs/docker/00-设计哲学.md) 从头读。
- 想系统补：按 [第 01 章](docs/docker/01-环境与心智模型.md) 到 [第 11 章](docs/docker/11-面试速查表.md) 顺序读。
- 想面试突击：直接看 [第 11 章 · 面试速查表](docs/docker/11-面试速查表.md)。
- 想自测：做 [第 10 章 · 测试题与答案](docs/docker/10-测试题与答案.md)。

> 一句话记住它：**跑容器用 run，写镜像用 Dockerfile，外面进来靠 -p，数据留住靠 -v，多服务用 compose。这五件事会了，Docker 就算上手了。**
