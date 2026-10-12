# 第 07 章 · docker compose：一个文件编排多个服务

> 前面你都是**一个个** `docker run` 起容器。这一章学会用**一个 YAML 文件**，把多个服务、它们之间的网络和卷，一次性声明并管理起来。
>
> 本章你需要记住的就一件事：**compose 把"一堆 `docker run` 命令"写成一个 `docker-compose.yml`；`docker compose up` 一键起整套，`down` 一键清理。`depends_on` 只保证启动顺序，不保证服务就绪。**

---

## 07.1 compose 解决什么问题

**先说结论**：一个真实应用几乎从来不是"一个容器"，而是"好几个容器"——Web 服务、数据库、缓存、消息队列。compose 就是用来**把这一堆容器当成一个整体来管理**的。

**没有 compose 时，你要这样起一套 Web + 数据库：**

```bash
# 1. 建网络
docker network create my-net

# 2. 建卷
docker volume create pgdata

# 3. 起数据库
docker run -d --name db --network my-net -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=secret postgres:16

# 4. 起 Web
docker run -d --name web --network my-net -p 3000:3000 \
  -e DATABASE_URL=postgres://db:5432/mydb myapp

# 5. 停机时，再一个个 docker stop / rm / network rm ...
```

**每次都要敲这一长串，而且停机、重启、换环境都要重新来一遍。** 任何一步漏了、顺序错了，整个环境就起不来。

**有了 compose，这一整套变成一份文件 + 两条命令：**

```yaml
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
    environment:
      DATABASE_URL: postgres://db:5432/mydb
    depends_on:
      - db

volumes:
  pgdata:
```

```bash
docker compose up -d     # 一键起整套
docker compose down      # 一键清理
```

**compose 的本质**：它是 `docker run` 各种参数（`-d`、`--network`、`-v`、`-e`、`-p`）的**声明式翻译**。你不再一个个敲命令，而是把"最终想要的样子"写进 YAML，让 compose 去达成。

> 一句话记住它：**compose 把"一堆 docker run + 网络 + 卷"声明成一个 YAML 文件，`up` 一键起、`down` 一键清。它的本质是 docker run 参数的声明式写法。**

---

## 07.2 第一个 compose 文件

**先说结论**：compose 文件的核心是 `services`（服务列表），外加可选的 `networks`、`volumes` 顶层块。

```yaml
services:            # 顶层：服务列表（必填）
  web:               # 服务名（你自己起的）
    image: nginx     # 用现成镜像
    ports:
      - "8080:80"    # 端口映射
  db:                # 第二个服务
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret

volumes:             # 顶层：声明卷（可选）
  pgdata:

networks:            # 顶层：声明网络（可选）
  my-net:
```

**三段式结构：**

| 顶层块 | 作用 | 对应 docker 命令 |
|---|---|---|
| `services` | 定义有哪些服务（每个服务 = 一个容器） | `docker run` |
| `volumes` | 声明用到的卷 | `docker volume create` |
| `networks` | 声明用到的网络 | `docker network create` |

**几个新手必懂的规则：**

**规则一：缩进是语法，不是美观。** YAML 靠缩进表达层级，缩进错了文件就解析失败。`services` 顶格，`web`/`db` 缩 2 格，`web` 下的 `image`/`ports` 缩 4 格。

**规则二：服务名就是你给容器起的名字。** `services.web` 里的 `web`，就是容器名（compose 会自动加项目前缀，见 07.6）。

**规则三：文件名有讲究。** 默认读 `docker-compose.yml` 或 `compose.yaml`。如果你用了别的名字，要用 `-f` 指定：

```bash
docker compose -f my-compose.yml up
```

> 一句话记住它：**compose 文件核心是 `services`（每个服务一个容器），加可选 `volumes`/`networks`；缩进即语法；默认读 `docker-compose.yml`。**

---

## 07.3 service：服务是什么

**先说结论**：一个 service（服务）就是一个"容器规格说明书"——描述这个容器用什么镜像、映射什么端口、挂什么卷、设什么环境变量。**一个 service 通常对应一个运行的容器（不扩展时）。**

**service 下最常用的字段：**

| 字段 | 作用 | 对应 docker run 参数 |
|---|---|---|
| `image` | 用现成镜像 | `docker run 镜像` |
| `build` | 用 Dockerfile 构建 | `docker build` |
| `ports` | 端口映射 | `-p` |
| `volumes` | 挂载卷/目录 | `-v` |
| `environment` | 环境变量 | `-e` |
| `depends_on` | 声明启动依赖 | （compose 独有） |
| `command` | 覆盖启动命令 | `docker run 镜像 命令` |
| `restart` | 重启策略 | `--restart` |

**一个 service 的完整例子：**

```yaml
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    environment:
      - NGINX_HOST=example.com
    volumes:
      - ./html:/usr/share/nginx/html
    restart: unless-stopped
```

**字段映射成命令，你能看懂每一行的"前世"：**

```bash
# 上面这段 YAML 等价于
docker run -d \
  -p 8080:80 \
  -e NGINX_HOST=example.com \
  -v "$(pwd)/html:/usr/share/nginx/html" \
  --restart unless-stopped \
  nginx:1.27
```

**注意 `ports` 的两种写法：**

```yaml
# 短写法（简洁）
ports:
  - "8080:80"

# 长写法（显式）
ports:
  - "8080:80"
  - target: 80
    published: 8080
    protocol: tcp
```

日常短写法就够了。

> 一句话记住它：**service = 一个容器规格说明书；`image/build/ports/volumes/environment/depends_on` 分别对应 docker run 的各个参数。看懂 YAML，就是看懂翻译后的 docker run。**

---

## 07.4 network：compose 里的网络

**先说结论**：compose 会**自动创建一个网络**，把文件里所有 service 都连进去。所以 compose 里的服务**天然可以用服务名互访**（第 05 章的 DNS）。

**compose 自动做的事：**

```yaml
services:
  web:
    image: nginx
  db:
    image: postgres:16
```

compose 内部自动：

1. 创建一个网络（默认名如 `项目名_default`）；
2. 把 `web` 和 `db` 都连进去；
3. 于是 `web` 里可以直接用 `db` 访问数据库（DNS 解析）。

**这就是为什么 compose 里你不用写 `--network`、也不用 `docker network create`**——它全自动了。

**手动声明网络（需要更精细控制时）：**

```yaml
services:
  web:
    image: nginx
    networks:
      - frontend
      - backend
  db:
    image: postgres:16
    networks:
      - backend

networks:
  frontend:
  backend:
```

这个例子做了一件很有用的事：**网络分段**。`web` 同时连 `frontend`（对外）和 `backend`（连数据库），`db` 只连 `backend`。于是外界能访问 web，但**访问不到 db**（db 只在内网）。

**看 compose 建的网络：**

```bash
docker network ls
```

```text
NETWORK ID     NAME                  DRIVER    SCOPE
a1b2c3d4e5f6   项目名_default         bridge    local    ← compose 自动建的
```

> 一句话记住它：**compose 自动建网络并连接所有服务，所以服务名可直接互访；手动声明 networks 可以做网络分段（数据库只连内网）。**

---

## 07.5 volume：compose 里的卷

**先说结论**：compose 里的 `volumes` 顶层块声明卷，service 里的 `volumes` 字段把它挂进服务。用法和第 06 章一致，但**生命周期跟着 compose 走**。

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data   # 挂命名卷

volumes:
  pgdata:                                 # 声明命名卷
```

**两种挂载写法：**

```yaml
services:
  web:
    volumes:
      - pgdata:/data              # 命名卷（推荐）
      - ./src:/app                # bind mount（宿主相对路径）
      - /host/abs:/app            # bind mount（宿主绝对路径）
```

**关键点：compose 里的卷名会自动加项目前缀。** 你写 `pgdata`，实际卷名可能是 `项目名_pgdata`（避免不同项目重名冲突）。用 `docker volume ls` 能看到：

```text
VOLUME NAME
项目名_pgdata
```

**卷的生命周期和 `down -v`：** 这是本章最重要的一个警告——

```bash
docker compose down          # 停服务、删容器，但卷保留
docker compose down -v       # 停服务、删容器，连卷一起删！
```

`down -v` 会把你声明的卷**一起删掉**，数据就没了。**除非你确定要清库，否则别用 `-v`。**

> 一句话记住它：**compose 的卷在 `volumes` 顶层声明、service 里挂载；卷名会加项目前缀；`down` 不删卷，`down -v` 连卷删（慎用，数据会没）。**

---

## 07.6 docker compose up / down

**先说结论**：`docker compose up` 启动整套服务（创建网络、卷、容器），`docker compose down` 停掉并删除整套。这是 compose 的一对核心命令。

**`up` 的行为：**

```bash
docker compose up            # 前台启动（日志刷在终端，Ctrl+C 停）
docker compose up -d         # 后台启动（推荐）
docker compose up -d --build # 后台启动，并强制重新构建镜像
```

**`up` 第一次会做的事：**

```text
1. 读 docker-compose.yml
2. 创建缺失的网络
3. 创建缺失的卷
4. 拉取/构建镜像
5. 按 depends_on 顺序创建并启动容器
```

**`down` 的行为：**

```bash
docker compose down          # 停止并删除容器、删除自动建的网络
docker compose down -v       # 额外删除卷（危险）
```

**`down` 删什么、留什么：**

| 资源 | `down` 后 |
|---|---|
| 容器 | 删除 |
| 自动创建的网络 | 删除 |
| 卷 | **保留**（除非 `-v`） |
| 镜像 | 保留 |

**一个高频困惑：改了 compose 文件，怎么生效？**

```bash
# 改了 ports、volumes、environment 等 → 重新 up
docker compose up -d

# 改了 Dockerfile → 需要重新构建
docker compose up -d --build
```

`up -d` 会对比配置，只重启"配置变了"的服务（其余不动）。

> 一句话记住它：**`up` 一键起整套（自动建网络/卷/容器），`down` 一键清理（删容器和网络，留卷和镜像）。改了配置 `up -d`，改了 Dockerfile 要 `up -d --build`。**

---

## 07.7 常用 compose 命令

**先说结论**：compose 命令都是 `docker compose <动作>`，最常用的就这几个。

```bash
docker compose up -d              # 后台启动整套
docker compose down               # 停止并清理
docker compose ps                 # 看这套服务的容器状态
docker compose logs -f web        # 跟踪某个服务的日志
docker compose build              # 只构建镜像（不启动）
docker compose start web          # 启动某个服务
docker compose stop web           # 停止某个服务
docker compose restart web        # 重启某个服务
docker compose exec web bash      # 进入某个服务（= docker exec）
docker compose config             # 校验/展开 compose 文件（检查语法）
```

**`docker compose ps` 和 `docker ps` 的区别：** 前者只显示**当前项目**（这个 compose 文件）管理的容器，后者显示所有容器。

**`docker compose exec` 和 `docker exec` 的区别：** 前者用**服务名**（不用记容器全名）：

```bash
docker compose exec web bash     # 用服务名，方便
docker exec 项目名_web_1 bash     # 用容器全名，啰嗦
```

**`docker compose config` 是个好习惯**：改完 YAML 先 `config` 校验一下，能避免"缩进错了、字段拼错"这类低级错误：

```bash
docker compose config
```

它会打印展开后的完整配置（补齐默认值），如果 YAML 有语法错误会直接报。

> 一句话记住它：**常用命令：up/down/ps/logs/build/start/stop/restart/exec/config。用 `exec` 进服务用服务名，改完 YAML 先 `config` 校验。**

---

## 07.8 depends_on：启动顺序的坑

**先说结论**：`depends_on` 只保证"**先启动** db、再启动 web"，但**不保证"db 已经就绪"**。这是 compose 新手最容易踩的坑。

```yaml
services:
  web:
    depends_on:
      - db
  db:
    image: postgres:16
```

**你以为**：db 完全启动好（能接受连接了），web 才启动。

**实际**：db 容器**先被创建**，web 容器**后创建**。但"容器创建了" ≠ "应用就绪了"。postgres 容器起来后，还要花几秒初始化数据目录、接受连接。web 可能在 db 还没准备好时就启动了，然后连不上数据库报错。

**现象**：`docker compose up` 后，web 服务一直报"连接数据库失败"，重启几次才好——因为 web 起来得太早。

**怎么解决？** 三种方案，从简单到完善：

**方案一（最简单，不完美）：`restart: on-failure`。** 让 web 连接失败就重试：

```yaml
services:
  web:
    depends_on:
      - db
    restart: on-failure
```

web 连不上就退出，on-failure 自动重启，直到 db 就绪。粗糙但有效。

**方案二（应用层等待）：应用启动前先等 db。** 在 web 的启动脚本里，加一段"等 db 端口通了再启动"的逻辑（wait-for-it 模式）：

```yaml
services:
  web:
    depends_on:
      - db
    command: sh -c "while ! nc -z db 5432; do sleep 1; done; node server.js"
```

**方案三（最完善）：healthcheck + depends_on 的 condition。** 让 db 暴露健康状态，web 等它健康：

```yaml
services:
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
  web:
    depends_on:
      db:
        condition: service_healthy
```

这是生产推荐做法：`depends_on` 的 `condition: service_healthy` 让 web 真正等 db 健康。

> 一句话记住它：**`depends_on` 只保证启动顺序，不保证就绪。要等就绪：简单用 `restart: on-failure` 重试，生产用 healthcheck + `condition: service_healthy`。**

---

## 07.9 环境变量与配置

**先说结论**：compose 里的环境变量有三种来源：文件里写死、从 `.env` 文件读、从宿主环境读。生产里**敏感信息（密码）永远别写死在 YAML 里**。

**方式一：写死在 YAML（开发方便，生产别这么干）：**

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: secret123
```

**方式二：用 `.env` 文件。** compose 会自动读同目录的 `.env` 文件：

```env
# .env
POSTGRES_PASSWORD=secret123
```

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}   # 从 .env 读
```

**方式三：从宿主环境读。** 宿主 shell 里 `export POSTGRES_PASSWORD=xxx`，compose 同样用 `${...}` 引用。

**优先级**：shell 环境 > `.env` 文件 > 默认值。可用 `${VAR:-默认值}` 给兜底：

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-defaultpass}
```

**敏感信息的正确姿势**：密码不进 Git。做法是：`.env` 加进 `.gitignore`，只在部署机器上维护 `.env` 文件。

> 一句话记住它：**环境变量三个来源：YAML 写死、`.env` 文件、宿主环境。用 `${VAR:-默认}` 兜底；敏感信息放 `.env` 并 gitignore，别写死进 YAML。**

---

## 07.10 build vs image：构建还是现成

**先说结论**：每个 service 要么用现成镜像（`image`），要么用本地 Dockerfile 构建（`build`）。**你自己的应用用 `build`，第三方服务（数据库等）用 `image`。**

**用现成镜像：**

```yaml
services:
  db:
    image: postgres:16      # 直接拉 Docker Hub 的镜像
```

**用本地构建：**

```yaml
services:
  web:
    build: .                # 用当前目录的 Dockerfile 构建
```

**`build` 的完整写法（指定 Dockerfile 位置和上下文）：**

```yaml
services:
  web:
    build:
      context: .            # 构建上下文
      dockerfile: Dockerfile  # Dockerfile 文件名（默认就叫 Dockerfile）
```

**一个典型组合**：一个 compose 里既有 build 又有 image：

```yaml
services:
  web:
    build: .                # 你自己的应用，本地构建
  db:
    image: postgres:16      # 现成的数据库
  redis:
    image: redis:7          # 现成的缓存
```

**什么时候必须重新 build？** 改了 Dockerfile 或源码时：

```bash
docker compose up -d --build
```

> 一句话记住它：**自己的应用用 `build`，第三方服务用 `image`。改了 Dockerfile/源码要 `up -d --build` 重新构建。**

---

## 07.11 一个完整的实战 compose

把前面所有知识点串成一个"能跑"的完整例子（Web 应用 + 数据库 + 网络分段 + 卷 + 健康检查）。这个文件作为示例文件存在（见 `examples/docker/09-app/docker-compose.yml`）：

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://app:secret@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**逐段回顾，看它综合了哪些知识点：**

| 片段 | 知识点 |
|---|---|
| `app.build: .` | 自己的应用本地构建（07.10） |
| `ports: "3000:3000"` | 端口映射（第 05 章） |
| `DATABASE_URL: ...@db:5432` | 用服务名 db 访问（07.4 的 DNS） |
| `depends_on.db.condition: service_healthy` | 等 db 健康（07.8） |
| `db.volumes: pgdata:...` | 命名卷持久化（07.5 / 第 06 章） |
| `db.healthcheck` | 健康检查（07.8） |
| `volumes.pgdata` | 声明卷（07.5） |
| `restart: unless-stopped` | 自动重启（第 03 章） |

**配套脚本把这个文件的 service/volume 结构解析出来：**

```bash
node examples/docker/07-compose解析.mjs
```

```text
[services]
  db
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
  web
    build: .
    ports:
      - 3000:3000
    depends_on:
      - db
    environment:
      - DATABASE_URL: postgres://db:5432/mydb

[volumes]
  pgdata

启动顺序（拓扑排序）: db → web
```

> 一句话记住它：**一份完整的 compose = 服务（build/image）+ 端口 + 网络 + 卷 + 环境变量 + depends_on + 健康检查。前面 6 章的所有知识点，在这一份文件里汇合。**

---

## 07.12 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| `depends_on` 以为会等就绪 | web 起太早连不上 db | depends_on 只保证顺序，不保证就绪 | healthcheck + `condition: service_healthy` |
| `down -v` 误删数据 | 数据库数据全没了 | `-v` 连卷一起删 | 别用 `-v`，除非确定清库 |
| YAML 缩进错 | 解析报错 | YAML 靠缩进表达层级 | 用 `docker compose config` 校验 |
| 服务名互访失败 | 连不上别的服务 | 用了容器全名（含前缀） | 用服务名（compose 会自动加前缀） |
| 改了 Dockerfile 不生效 | 容器还是旧代码 | 没重新 build | `docker compose up -d --build` |
| 密码写死进 YAML | 密码进 Git 仓库 | 敏感信息硬编码 | 用 `.env` + gitignore |
| 端口冲突 | `port is already allocated` | 宿主端口被占 | 换端口，或先释放 |
| 忘了 `-f` 指定文件名 | 找不到文件 | 用了非默认文件名 | `docker compose -f xxx.yml up` |

---

## 07.13 本章小结

- **compose 本质**：把"一堆 docker run + 网络 + 卷"声明成 YAML；`up` 起、`down` 清。
- **三段结构**：`services`（服务列表）+ `volumes` + `networks`；缩进即语法。
- **service**：一个容器规格说明书，字段对应 docker run 参数。
- **网络**：compose 自动建网络连所有服务，服务名直接互访；可手动分段。
- **卷**：`volumes` 顶层声明、service 挂载；卷名加项目前缀；`down -v` 才删卷。
- **up/down**：up 自动建网络/卷/容器；down 删容器和网络，留卷和镜像。
- **depends_on**：只保证顺序不保证就绪；生产用 healthcheck + `service_healthy`。
- **环境变量**：YAML / `.env` / 宿主环境；敏感信息放 `.env` 并 gitignore。
- **build vs image**：自己的应用 build，第三方服务 image。
- **常用命令**：`up/down/ps/logs/build/exec/config`。

---

## 07.14 动手练习

**1. 下面 compose 里，`web` 服务启动后连不上 `db`，最可能的原因是什么？**

```yaml
services:
  web:
    depends_on:
      - db
  db:
    image: postgres:16
```

<details><summary>参考答案</summary>

`depends_on` 只保证"先启动 db 容器"，**不保证 db 已就绪**。postgres 起来后要几秒初始化，web 可能起太早连不上。

解决：给 db 加 healthcheck，web 用 `depends_on: db: condition: service_healthy`；或者简单点 `restart: on-failure` 重试。

</details>

---

**2. `docker compose down` 和 `docker compose down -v` 有什么区别？哪个危险？**

<details><summary>参考答案</summary>

- `down`：停止并删除容器、删除自动建的网络，**保留卷和镜像**。
- `down -v`：额外**删除卷**，数据就没了。

`-v` 危险，除非确定要清库，否则别用。

</details>

---

**3. 改了 Dockerfile 后，`docker compose up -d` 为什么还是旧的？怎么让它生效？**

<details><summary>参考答案</summary>

`up -d` 只会重启"配置变了"的服务，但**不会自动重新构建镜像**。

改了 Dockerfile/源码，要用 `docker compose up -d --build` 强制重新构建。

</details>

---

**4. 在 compose 里，服务之间怎么互相访问？用 IP 还是服务名？为什么？**

<details><summary>参考答案</summary>

用**服务名**。compose 会自动创建一个网络，把所有服务连进去，并内置 DNS 解析，服务名可以直接当主机名用（如 `postgres://db:5432/mydb`）。

不要用 IP（会变），也不要用容器全名（含前缀，啰嗦且不稳定）。

</details>

---

**5. 密码不想写死在 YAML 里，怎么处理？**

<details><summary>参考答案</summary>

用 `.env` 文件 + 变量引用：

```env
# .env（加入 .gitignore）
POSTGRES_PASSWORD=secret123
```

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

`.env` 不提交 Git，只在部署机器上维护。

</details>

---

**6. 写一个最小 compose，让 `web` 服务（用当前目录构建）能访问 `db` 服务（postgres:16），并给 db 挂一个命名卷。**

<details><summary>参考答案</summary>

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

</details>

---

> 📖 **本章的代码示例**：`examples/docker/07-compose解析.mjs` 和 `examples/docker/09-app/docker-compose.yml`
> 跑一下看看：`node examples/docker/07-compose解析.mjs`
> 脚本解析了一个 compose 文件，抽出 service/volume 结构，并做依赖拓扑排序演示启动顺序，零依赖、退出码 0。
>
> 下一章讲**工程化**：多阶段构建、镜像瘦身、`.dockerignore`、以及安全与最佳实践。
