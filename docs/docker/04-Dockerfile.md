# 第 04 章 · Dockerfile：把"装环境"写进文件

> 前面你一直在用别人做好的镜像（`nginx`、`node`）。这一章教你**做自己的镜像**——把"装环境、放代码、定启动命令"这一整套，写进一个叫 `Dockerfile` 的文件里。
>
> 本章你需要记住的就一件事：**Dockerfile 是一份"构建镜像的配方"，每条指令产生一层；指令顺序直接决定缓存效率。`FROM/RUN/COPY/CMD` 是骨架，`ENTRYPOINT` 和 `CMD` 的区别是最容易答错的面试题。**

---

## 04.1 Dockerfile 是什么：构建镜像的"配方"

**先说结论**：`Dockerfile` 是一个文本文件，里面一条条写着"怎么从零搭出这个环境"。`docker build` 逐条执行它，每条指令产出一层（第 02 章的分层）。

**它像什么？** 像一份"装机的自动化脚本"，或者 `package.json` 里的 scripts——都是"把重复的手工操作，写成可复现的文本"。

一个最小但完整的 Dockerfile：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**逐条翻译成人话：**

| 指令 | 人话 |
|---|---|
| `FROM node:22-alpine` | 从 node 的 alpine 版镜像开始（这是地基） |
| `WORKDIR /app` | 后续操作都在 `/app` 目录里进行 |
| `COPY package*.json ./` | 把构建上下文里的 package.json 拷进来 |
| `RUN npm install --omit=dev` | 在镜像里装依赖（只装生产的） |
| `COPY . .` | 把其余源码拷进来 |
| `EXPOSE 3000` | 声明"这个容器监听 3000 端口" |
| `CMD [...]` | 容器启动时执行 `node server.js` |

**把它变成镜像，一条命令：**

```bash
docker build -t myapp:1.0 .
```

```text
[+] Building 5.2s (10/10) FINISHED
 => [1/6] FROM docker.io/library/node:22-alpine
 => [2/6] WORKDIR /app
 => [3/6] COPY package*.json ./
 => [4/6] RUN npm install --omit=dev
 => [5/6] COPY . .
 => [6/6] EXPOSE 3000
 => exporting to image
 => => naming to docker.io/library/myapp:1.0
```

`-t myapp:1.0` 是给镜像起名（tag），最后的 `.` 是**构建上下文**（04.2 详讲）。

**完整命令结构：**

```text
docker build [OPTIONS] 路径
    -t 名字:tag     给镜像命名
    路径            构建上下文（通常是 . 表示当前目录）
```

> 一句话记住它：**Dockerfile = 构建镜像的配方；`docker build -t 名字:tag .` 逐条执行它，每条指令产出一层。写 Dockerfile = 把"装环境"从手工变成可复现的文本。**

---

## 04.2 构建上下文与 docker build

**先说结论**：`docker build` 最后的那个 `.` 不是"随便写的"，它指定了**构建上下文（build context）**——Docker 会把**整个这个目录**打包发给 daemon，作为构建的"素材库"。

```bash
docker build -t myapp .
#                       ↑ 构建上下文 = 当前目录
```

**构建上下文的工作流程：**

```text
1. 你把某个目录（如 .）指定为构建上下文
2. client 把这个目录打包（tar），发给 daemon
3. daemon 解包，得到一堆文件
4. Dockerfile 里的 COPY 指令，只能从这个上下文里取文件
```

**这带来两个关键认知：**

**认知一：`COPY` 只能复制"上下文里"的文件，不能复制上下文之外的。** 看这个报错（真实原文）：

```dockerfile
# Dockerfile 里写
COPY /etc/passwd /app/passwd
```

```text
COPY failed: file not found in build context or excluded by .dockerignore: stat /etc/passwd: file does not exist
```

为什么 `/etc/passwd` 明明在宿主机上存在，却报"找不到"？因为 `COPY` 的源路径是**相对构建上下文的**，不是相对宿主机根目录的。上下文里没有 `/etc/passwd`，所以报错。

**认知二：上下文越大，build 越慢。** 因为要把整个目录打包上传。如果你在项目根目录 build，而目录里有 `node_modules`（几百 MB）、`.git`、日志文件，它们全被打包上传——即使 Dockerfile 根本没 `COPY` 它们。

**这就是 `.dockerignore` 的用途**：像 `.gitignore` 一样，告诉 Docker"这些别打包进上下文"。第 08 章会展开，这里先给个最小示例：

```dockerignore
node_modules
.git
*.log
```

**一个真实反例**：在 React 项目根目录 `docker build .`，忘了写 `.dockerignore`，上传了 500MB 的 `node_modules`，build 慢得离谱。加上 `.dockerignore` 后，上下文降到几 MB，build 秒级。

> 一句话记住它：**`docker build` 末尾的路径是"构建上下文"，整个目录会被打包发给 daemon；`COPY` 只能取上下文里的文件；上下文越大越慢，用 `.dockerignore` 瘦身。**

---

## 04.3 FROM：一切从哪开始

**先说结论**：`FROM` 指定基础镜像，是 Dockerfile 的**第一条指令**（多阶段构建除外），几乎每个镜像都是"在别人基础上加东西"。

```dockerfile
FROM node:22-alpine
```

**为什么要有基础镜像？** 因为没人从零写一个操作系统。你总是站在巨人的肩膀上：官方基础镜像已经装好了 OS、运行时、常用工具，你只需在它上面加你的东西。

**怎么选基础镜像？** 这是 Dockerfile 的第一个决策点：

| 基础镜像 | 大小 | 适合场景 | 备注 |
|---|---|---|---|
| `node:22` | ~1GB | 快速起步、需要完整工具链 | 基于完整 Debian |
| `node:22-alpine` | ~130MB | 生产（省体积） | 基于 Alpine Linux，极小 |
| `node:22-slim` | ~200MB | 折中方案 | Debian 精简版 |
| `scratch` | 0 | 极致的静态二进制（Go 等） | 空的，什么系统都没有 |

**`alpine` 是个重要概念**：它是一个**极小型的 Linux 发行版**（几 MB 级），Docker 官方几乎所有镜像都提供 `-alpine` 变体。用 alpine 能让镜像从 1GB 降到 130MB——第 08 章"镜像瘦身"的核心手段之一。

**alpine 的代价**：它用 `musl` 而不是常见的 `glibc`，少数依赖 glibc 的程序会不兼容；包管理器是 `apk` 而不是 `apt`。所以 alpine 虽好，遇到坑要知道换回 `-slim` 或完整版。

**`FROM` 的完整语法：**

```dockerfile
FROM 镜像[:tag]
FROM 镜像[@digest]          # 精确到内容
FROM 镜像 AS 别名           # 多阶段构建（第 08 章）
```

**一个常见报错**：写了个不存在的 tag：

```dockerfile
FROM node:999
```

```text
ERROR: failed to solve: node:999: failed to resolve source metadata for docker.io/library/node:999: not found
```

> 一句话记住它：**`FROM` 是地基，第一条指令；生产优先 `-alpine`（小），遇到 glibc 兼容问题换 `-slim`；基础镜像选错，后面全白搭。**

---

## 04.4 RUN：构建时执行命令

**先说结论**：`RUN` 在**构建时**执行命令，执行的结果（装了什么、生成什么文件）被固化成一个新层。

```dockerfile
RUN npm install
RUN apt-get update && apt-get install -y curl
```

**`RUN` 的两个关键点：**

**关键点一：`RUN` 是"构建时"的，不是"运行时"的。** 它在 `docker build` 阶段执行一次，产出的层进了镜像。之后 `docker run` 时**不会再执行**。很多新手误以为 `RUN npm start` 能启动服务——不，`RUN` 只在构建时跑，启动要用 `CMD`/`ENTRYPOINT`（04.9/04.10）。

**关键点二：每条 `RUN` 产生一层，层多了镜像就臃肿。** 看这个反例：

```dockerfile
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git
RUN rm -rf /var/lib/apt/lists/*
```

四个 `RUN` = 四层。而且**前三层的垃圾（下载的缓存）已经固化成层了，第四层 `rm` 删不掉已经存在的层**——层是不可变的！

**正确写法：合并成一条，用 `&&` 串联：**

```dockerfile
RUN apt-get update \
    && apt-get install -y curl git \
    && rm -rf /var/lib/apt/lists/*
```

一条 `RUN` = 一层，装完立刻清理，垃圾不留在任何"中间层"。

**为什么会这样？** 回到第 02 章：层是不可变的，删除只是"盖一个看不见的戳"。如果你在层 A 里装了 curl（产生了文件），在层 B 里删掉，层 A 里的文件**物理上还在**（只是被遮住了）。所以镜像体积没减，反而多了一层。**合并成一条 RUN，让"装"和"清"发生在同一层里，垃圾才真的不留痕。**

> 一句话记住它：**`RUN` 构建时执行、产出一层；多条 RUN 要合并成一条（`&&` 串联），否则中间层的垃圾删不掉、镜像臃肿。启动服务用 CMD，别用 RUN。**

---

## 04.5 COPY vs ADD

**先说结论**：`COPY` 把文件从构建上下文复制进镜像；`ADD` 是它的"加强版"，多了两个容易惹祸的能力（自动解压 tar、支持 URL）。**默认用 `COPY`，只有明确需要那两个能力时才用 `ADD`。**

**`COPY` 的基本用法：**

```dockerfile
COPY 源 目标

COPY package.json /app/package.json      # 拷单个文件
COPY package*.json ./                    # 通配符
COPY src/ /app/src/                      # 拷整个目录
COPY . .                                 # 拷全部
```

**`COPY` 的两个容易踩的点：**

**点一：目标目录不存在会自动创建。** `COPY . /app/` 时，如果 `/app` 不存在，Docker 会自动创建它（像 `mkdir -p`）。

**点二：复制目录时，要分清"带不带斜杠"。** 这个坑很隐蔽：

```dockerfile
COPY src /app          # 结果：/app/src/...（src 目录本身被拷进去）
COPY src/ /app/        # 结果：/app/...（src 的内容被拷进去，不含 src 本身）
```

带尾斜杠 `src/` 表示"复制目录的**内容**"，不带斜杠 `src` 表示"复制目录**本身**"。

**`ADD` 多出来的两个能力（以及为什么不推荐）：**

| 能力 | 说明 | 为什么不推荐 |
|---|---|---|
| 自动解压 | `ADD app.tar.gz /app/` 会自动解压 | 行为"隐形"，容易踩坑；解压用 `RUN tar` 更明确 |
| 支持 URL | `ADD https://xxx/file /app/` | 会引入不确定性（下载的内容不固定，破坏缓存可复现性） |

**官方建议很明确：能用 `COPY` 就用 `COPY`。** `ADD` 只在"确实需要一个 tar 自动解压"时用。

**一个真实报错**（`COPY` 源文件不在上下文里，04.2 讲过，这里再强调）：

```text
COPY failed: file not found in build context or excluded by .dockerignore: stat package.json: file does not exist
```

> 一句话记住它：**默认用 `COPY`；`ADD` 只多了"自动解压 tar + 支持 URL"，但这俩能力容易惹祸。复制目录注意尾斜杠：`src/` 是内容，`src` 是目录本身。**

---

## 04.6 WORKDIR：设置工作目录

**先说结论**：`WORKDIR` 设置"当前工作目录"，后续的 `RUN`、`COPY`、`CMD` 都相对它执行。目录不存在会自动创建。

```dockerfile
WORKDIR /app
RUN npm install      # 在 /app 里执行
COPY . .            # 拷到 /app 里
```

**为什么需要它？** 两个理由：

**理由一：省得每个命令都写绝对路径。** 不设 WORKDIR，你得这么写：

```dockerfile
RUN cd /app && npm install          # 每个命令都得 cd 一次，啰嗦
```

有了 `WORKDIR /app`，后面直接写相对路径。

**理由二：避免"相对路径的坑"。** 不设 WORKDIR，`COPY . .` 会拷到根目录 `/`，`CMD ["node", "server.js"]` 会在 `/` 下找 `server.js`——找不到就报错。设了 WORKDIR，一切都对得上了。

**`WORKDIR` 可以多次使用，且支持相对路径：**

```dockerfile
WORKDIR /app
WORKDIR src          # 现在是 /app/src（相对上一条 WORKDIR）
```

**一个常见坑**：`WORKDIR` 会自动创建目录，但如果你写错路径（拼写错误），不会报错——它会**默默创建一个拼错名字的目录**，然后你的文件全跑错地方了。排查这类问题时，先 `docker exec 容器 pwd` 看看当前在哪。

> 一句话记住它：**`WORKDIR` 设工作目录（不存在自动建），后续 RUN/COPY/CMD 都相对它；拼错路径不会报错，只会默默建错目录，排查时先 `pwd`。**

---

## 04.7 ENV：环境变量

**先说结论**：`ENV` 设置环境变量，**构建时和运行时都生效**。你的程序靠它读配置。

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000 \
    DB_HOST=localhost
```

**`ENV` 的两大用途：**

**用途一：给程序传配置。** Node 里 `process.env.NODE_ENV` 就能读到：

```js
console.log(process.env.NODE_ENV);   // "production"
```

**用途二：影响后续指令。** `ENV` 之后的所有 `RUN`/`CMD` 都能看到这个变量：

```dockerfile
ENV APP_HOME=/opt/app
WORKDIR $APP_HOME          # WORKDIR 里可以用变量
```

**`ENV` 和 `RUN export` 的区别**：很多人用 `RUN export FOO=bar` 想设环境变量——没用，因为 `export` 只在**那一层**的 shell 里生效，层结束了变量就没了。要持久生效，用 `ENV`。

**一个实践建议**：**镜像里只放"默认值"，真正的值在 `docker run -e` 时覆盖：**

```dockerfile
ENV PORT=3000          # 默认 3000
```

```bash
docker run -e PORT=8080 myapp      # 运行时覆盖成 8080
```

这样镜像通用，运行时灵活。

> 一句话记住它：**`ENV` 设环境变量，构建和运行时都生效；`RUN export` 只在那一层有效，别用它设环境变量；镜像里放默认值，运行时用 `-e` 覆盖。**

---

## 04.8 EXPOSE：声明端口

**先说结论**：`EXPOSE` 只是**声明**"这个容器监听某个端口"，它**不会真的开放端口**。真正开放端口靠 `docker run -p`（第 05 章）。

```dockerfile
EXPOSE 3000
```

**最容易误解的一点**：很多人以为写了 `EXPOSE 3000`，容器就能被外面访问了。**不能。** `EXPOSE` 的作用是：

1. **文档作用**：告诉读 Dockerfile 的人"这个镜像跑起来监听 3000"。
2. **元数据**：写进镜像配置（第 02 章 `Config.ExposedPorts` 里见过），`docker inspect` 能看到。

**真正开放端口的是 `-p`（或 `-P`）：**

```bash
docker run -p 8080:3000 myapp     # 把宿主 8080 映射到容器 3000
docker run -P myapp               # -P 大写：自动映射所有 EXPOSE 声明的端口
```

`-P`（大写）是 `EXPOSE` 的"搭档"：它自动把所有 `EXPOSE` 声明的端口映射到宿主机的**随机**端口。

**总结关系：**

| 指令 | 作用 | 开放端口了吗 |
|---|---|---|
| `EXPOSE 3000` | 声明监听 3000 | **没有**，只是元数据 |
| `docker run -p 8080:3000` | 映射端口 | **有**，这才是真开放 |
| `docker run -P` | 映射所有 EXPOSE 的端口 | **有**，映射到随机宿主端口 |

> 一句话记住它：**`EXPOSE` 是"声明"，不开放端口；真正开放靠 `-p`（指定映射）或 `-P`（映射所有声明端口）。别以为写了 EXPOSE 外面就能访问。**

---

## 04.9 CMD：容器启动时的默认命令

**先说结论**：`CMD` 定义容器启动时执行的**默认命令**。它有两个特点：**只能有一个**、**能被 `docker run` 末尾参数覆盖**。

**两种写法：**

```dockerfile
# 写法一：shell 形式（经过 /bin/sh -c）
CMD node server.js

# 写法二：exec 形式（推荐，不经过 shell）
CMD ["node", "server.js"]
```

**为什么推荐 exec 形式？** shell 形式会包一层 `/bin/sh -c`，带来两个问题：

1. **信号问题**：`docker stop` 发的 SIGTERM 是发给 sh 的，sh 不一定会转给你的 node 进程（第 08 章详解）。
2. **变量/引号问题**：shell 形式里的变量展开、引号处理容易出意外。

所以**一律用 exec 形式**：`CMD ["node", "server.js"]`。

**"只能有一个 CMD"**：如果你写了多个 `CMD`，**只有最后一个生效**（前面的被覆盖）。所以别指望写多个 CMD 跑多个命令。

**"能被 docker run 覆盖"**：

```dockerfile
CMD ["node", "server.js"]
```

```bash
# 覆盖：启动时执行别的命令
docker run myapp echo "覆盖了 CMD"
```

```text
覆盖了 CMD
```

这就是第 03 章提到的"末尾 `[COMMAND]` 能覆盖镜像默认命令"。

**什么时候不该用 CMD？** 当你想让镜像"固定执行某个程序、且允许用户在末尾传参数"时，用 `ENTRYPOINT`（04.10）。CMD 更适合"给个默认值，允许整个覆盖"。

> 一句话记住它：**`CMD` 是默认启动命令：只能有一个（多个则最后生效）、能被 `docker run 末尾` 覆盖。一律用 exec 形式 `["node", "server.js"]`。**

---

## 04.10 ENTRYPOINT：更"硬"的启动命令

**先说结论**：`ENTRYPOINT` 也定义启动命令，但它**比 CMD 更"硬"**——`docker run` 末尾的参数**不会覆盖它，而是变成它的参数**。

```dockerfile
ENTRYPOINT ["node"]
CMD ["server.js"]
```

此时：

```bash
docker run myapp                    # 执行 node server.js（ENTRYPOINT + CMD）
docker run myapp other.js           # 执行 node other.js（末尾参数替换了 CMD）
```

看明白了吗？`ENTRYPOINT` 是"固定的命令"，`CMD` 是"默认参数"。`docker run` 末尾给的东西，**替换的是 CMD（参数），不是 ENTRYPOINT（命令）**。

**一个经典案例**：把镜像做成一个"命令工具"。比如一个 `curl` 镜像：

```dockerfile
FROM alpine
RUN apk add --no-cache curl
ENTRYPOINT ["curl"]
```

```bash
docker run mycurl https://example.com       # 等价 curl https://example.com
docker run mycurl -I https://example.com    # 等价 curl -I https://example.com
```

用户不用 `docker exec` 进去敲 curl，直接 `docker run mycurl 参数` 就是在跑 curl。这就是 ENTRYPOINT 的威力——**把容器做成一个"可执行文件"**。

**ENTRYPOINT 的两种形式：**

```dockerfile
ENTRYPOINT ["node"]          # exec 形式（推荐）
ENTRYPOINT node server.js    # shell 形式（有信号问题，不推荐）
```

**一个容易踩的坑**：`ENTRYPOINT` 用 exec 形式时，末尾参数是"追加"，不是"替换"。所以如果 ENTRYPOINT 写死了完整命令（`ENTRYPOINT ["node", "server.js"]`），末尾再传参数会变成 `node server.js 你的参数`——这可能不是你想要的。标准搭配是：**ENTRYPOINT 只写命令，CMD 写默认参数**（如上面的 node + server.js）。

> 一句话记住它：**`ENTRYPOINT` 是固定命令，`docker run` 末尾参数不覆盖它、只变成它的参数；标准搭配是 ENTRYPOINT 写命令 + CMD 写默认参数。**

---

## 04.11 CMD 和 ENTRYPOINT 怎么配（面试高频）

**先说结论**：这俩能单独用，也能组合用。四种组合，一张表说清：

| 写法 | 行为 | 场景 |
|---|---|---|
| 只有 `CMD` | 默认命令，可被 `run` 末尾整体覆盖 | 通用应用镜像 |
| 只有 `ENTRYPOINT` | 固定命令，`run` 末尾参数变成它的参数 | 把镜像做成"命令工具" |
| `ENTRYPOINT` + `CMD` | ENTRYPOINT 是命令，CMD 是默认参数 | 最灵活，推荐 |
| 两者都没有 | 用基础镜像的默认命令 | 继承了 FROM 的基础镜像行为 |

**四种组合的实际效果，看这个对比（假设 `CMD ["server.js"]`，`ENTRYPOINT ["node"]`）：**

| 你运行 | 实际执行 |
|---|---|
| `docker run 镜像` | `node server.js` |
| `docker run 镜像 a.js` | `node a.js`（末尾替换 CMD） |
| `docker run 镜像 node b.js` | 若用 `--entrypoint` 才覆盖，否则还是 `node b.js` |

**覆盖 ENTRYPOINT 需要显式 `--entrypoint`：**

```bash
docker run --entrypoint /bin/sh myapp     # 覆盖 ENTRYPOINT，进 shell 调试
```

**记忆口诀：**

> **CMD 是"软默认"（能整体覆盖），ENTRYPOINT 是"硬命令"（只能追加参数）。组合时：ENTRYPOINT 定命令，CMD 定默认参数。**

**面试常问的延伸**：为什么推荐 exec 形式而不是 shell 形式？因为 shell 形式 `CMD node server.js` 会变成 `sh -c "node server.js"`，导致：

1. 主进程是 sh 不是 node，SIGTERM 信号收不到（优雅退出失效）；
2. 环境变量展开、参数拼接行为不可控。

exec 形式 `CMD ["node", "server.js"]` 直接把 node 当 PID 1 的主进程，信号直达。

> 一句话记住它：**CMD 软默认、ENTRYPOINT 硬命令；组合时 ENTRYPOINT 定命令 + CMD 定默认参数；exec 形式让主进程直接是目标进程，信号能直达。**

---

## 04.12 构建缓存失效的完整规则

第 02 章讲了缓存的基本概念，这一节讲**完整的失效规则**——这是写出"快 Dockerfile"的核心。

**规则一句话**：Docker 逐条执行指令，对每条指令算一个"缓存键"（指令内容 + 上一层 digest）。**缓存键和上次一样 → 命中缓存；不一样 → 从这条开始，往后全部重建。**

**不同指令的"缓存键"怎么算：**

| 指令 | 缓存键取决于 | 何时失效 |
|---|---|---|
| `FROM` | 基础镜像 digest | 基础镜像更新了 |
| `RUN` | 指令文本 | 文本变了 |
| `COPY`/`ADD` | **文件内容**的 digest | 复制的文件内容变了 |
| `CMD`/`ENV`/`EXPOSE`/`WORKDIR` | 指令文本 | 文本变了 |

**关键细节：`COPY` 的缓存不看"指令文本"，看"文件内容"。** 所以：

```dockerfile
COPY . .
```

这条指令的缓存键，是**上下文里所有文件内容的 digest**。任何一个文件变化（哪怕是一行注释），这层的缓存就失效。

**这就是为什么"依赖清单先 COPY，源码后 COPY"这么重要**（第 02 章 02.8 讲过，这里从缓存键角度再看）：

```dockerfile
# ✅ 好
COPY package*.json ./       # 缓存键只取决于 package.json（不常变）
RUN npm install              # 所以这层能长期命中缓存

COPY . .                     # 缓存键取决于所有源码（常变）
# 之后的层会经常重建，但 npm install 已经在前面缓存住了
```

```dockerfile
# ❌ 差
COPY . .                     # 源码一变这层就失效
RUN npm install              # 于是这层也失效，每次都重装依赖
```

**一个隐蔽的坑：`ADD` 的缓存陷阱。** 如果 `ADD` 用的是 URL（`ADD https://... file`），URL 内容变了但 URL 没变，缓存键还是那个 URL——Docker **不会去检测远程内容是否变了**，可能用旧缓存。这也是少用 `ADD` 的另一个理由。

**强制绕过缓存：**

```bash
docker build --no-cache -t myapp .
```

> 一句话记住它：**缓存键 = 指令内容 + 上层 digest；`COPY` 的缓存键看文件内容，内容一变这层及之后全失效。所以"贵的、不常变的放前面"是永恒的铁律。**

---

## 04.13 指令顺序与缓存优化：一个对照实验

**先说结论**：同样几条指令，顺序不同，构建速度天差地别。这一节用一个 Node 应用的对照实验讲透。

**差劲的写法（每次改代码都重装依赖）：**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .                    # ← 所有源码，包括会变的业务代码
RUN npm install             # ← 源码一变，这层就重跑
CMD ["node", "server.js"]
```

每次改 `server.js`，`COPY . .` 失效 → `npm install` 重跑 → 慢。

**好的写法（依赖和源码分离）：**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install             # ← 只有 package.json 变时才重跑
COPY . .                    # ← 源码变了，只重建这一层
CMD ["node", "server.js"]
```

改 `server.js`，前几层全命中缓存，只有最后的 `COPY . .` 重建——**快得多**。

**通用的排序原则（从先到后）：**

```text
1. FROM（地基）
2. 最不常变、但最贵的操作（装系统依赖、装运行时）
3. 复制依赖清单 + 装依赖（package.json / requirements.txt / go.mod）
4. 复制源码
5. 构建（如果有多阶段构建，第 08 章）
6. 声明类指令（EXPOSE / ENV / CMD / ENTRYPOINT）——这些几乎不变
```

**为什么"声明类指令"放最后？** 因为 `EXPOSE`、`ENV`、`CMD` 这些指令产生的层是 0 字节（第 02 章提过），它们放最后，即使变了几条，重建的也是几乎零成本的层。

**配套脚本能直观看到缓存命中：**

```bash
node examples/docker/04-Dockerfile解析.mjs
```

```text
==================== 关键结论 ====================
1. FROM 必须排第一，且一个 Dockerfile 通常只有一个（多阶段构建除外，第 08 章）。
2. 指令顺序 = 缓存友好顺序：越"贵且不易变"的（npm install）越靠前。
3. RUN 会产生新层，尽量合并成一条（用 &&），减少层数。
4. CMD 和 ENTRYPOINT 二选一或组合用：CMD 可被覆盖，ENTRYPOINT 更"硬"。
```

> 一句话记住它：**顺序 = 缓存策略：贵且不常变的（依赖安装）排最前，源码 COPY 排中间，EXPOSE/ENV/CMD 排最后。依赖清单和源码要分开 COPY。**

---

## 04.14 一个完整的 Dockerfile 实战

把前面所有指令串起来，写一个"能上生产"的 Node 应用 Dockerfile，并逐行解释为什么。

```dockerfile
# 地基：alpine 精简基础镜像
FROM node:22-alpine

# 工作目录
WORKDIR /app

# 先复制依赖清单（缓存友好）
COPY package*.json ./

# 装依赖（只装生产的，dev 依赖别进镜像）
RUN npm install --omit=dev

# 再复制源码
COPY . .

# 声明端口（元数据）
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production

# 启动命令（exec 形式）
CMD ["node", "server.js"]
```

**逐条回顾，问自己为什么：**

| 指令 | 为什么这么写 |
|---|---|
| `FROM node:22-alpine` | alpine 小，生产省体积 |
| `WORKDIR /app` | 后续相对路径统一 |
| `COPY package*.json ./` 在 `RUN npm install` 前 | 依赖清单不常变，缓存住 install |
| `RUN npm install --omit=dev` | 只装生产依赖，dev 依赖（测试框架等）别进镜像 |
| `COPY . .` 放后面 | 源码常变，放后面让前面的层缓存住 |
| `EXPOSE 3000` | 声明端口，配合 `-p` 或 `-P` |
| `ENV NODE_ENV=production` | 让框架进生产模式 |
| `CMD ["node", "server.js"]` | exec 形式，信号直达 |

**这个 Dockerfile 作为示例文件存在**（见 `examples/docker/04-Node应用.Dockerfile`），你可以直接参考。配套的解析脚本：

```bash
node examples/docker/04-Dockerfile解析.mjs
```

```text
解析出的指令序列（构建时按此顺序执行）：
------------------------------------------------------------
序号  指令        参数                         作用
------------------------------------------------------------
  1  FROM        node:22-alpine                 指定基础镜像，相当于"从哪一层开始叠"（必须第一条）
  2  WORKDIR     /app                           设置工作目录，后续 RUN/COPY 都相对它（自动创建）
  3  COPY        package*.json ./               把构建上下文里的文件复制进镜像（比 ADD 更明确，优先用）
  4  RUN         npm install --omit=dev         构建时执行命令，产物固化成一个新层
  5  COPY        . .                            把构建上下文里的文件复制进镜像（比 ADD 更明确，优先用）
  6  EXPOSE      3000                           声明监听端口（只是文档元数据，不实际开端口）
  7  ENV         NODE_ENV=production            设置环境变量，运行时容器里也能读到
  8  CMD         ["node", "server.js"]          容器启动时的默认命令（可被 docker run 末尾参数覆盖）
```

> 一句话记住它：**写好一个 Dockerfile = 选对基础镜像 + 依赖清单先 COPY + 只装生产依赖 + 声明类指令放最后 + CMD 用 exec 形式。这五条，就是 90% 的最佳实践。**

---

## 04.15 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| `COPY` 报文件不存在 | `COPY failed: file not found in build context` | 源文件不在构建上下文里 | 确认文件在 `docker build` 的上下文目录里 |
| 上下文太大 build 很慢 | build 卡在"上传上下文" | 没写 `.dockerignore`，node_modules 等全打包了 | 加 `.dockerignore` 排除 |
| 多条 RUN 不合并 | 镜像臃肿，`rm` 删不掉垃圾 | 垃圾固在中间层，删不掉 | `&&` 合并成一条 RUN |
| 用 `RUN npm start` 想启动服务 | build 卡住或服务没起来 | `RUN` 是构建时的，不是运行时 | 启动用 `CMD`/`ENTRYPOINT` |
| 用 `RUN export` 设环境变量 | 变量没生效 | `export` 只在那层 shell 里有效 | 用 `ENV` |
| 以为 `EXPOSE` 能开放端口 | 外面访问不到 | `EXPOSE` 只是声明，不开端口 | 用 `-p` 或 `-P` 真正映射 |
| `ADD` 下载 URL 用旧缓存 | 内容更新了但镜像没变 | `ADD` 的 URL 缓存键不检测远程变化 | 少用 `ADD`，用 `RUN curl` |
| `CMD` 用 shell 形式 | 收不到 SIGTERM，优雅退出失效 | shell 形式主进程是 sh | 用 exec 形式 `["node", "server.js"]` |
| 写多个 `CMD` | 只有最后一个生效 | CMD 只能有一个 | 合并成一条，或改用 ENTRYPOINT + CMD |
| `COPY src` 和 `COPY src/` 混用 | 文件跑到错误路径 | 尾斜杠决定"目录本身"还是"目录内容" | 注意尾斜杠语义 |

---

## 04.16 本章小结

- **Dockerfile = 构建配方**；`docker build -t 名字:tag .` 逐条执行，每条指令一层。
- **构建上下文**：`build` 末尾的路径，整个目录打包发给 daemon；`COPY` 只能取上下文里的文件。
- **FROM**：地基，第一条指令；生产优先 `-alpine`（小），glibc 不兼容换 `-slim`。
- **RUN**：构建时执行、产出一层；多条合并成一条，垃圾不留中间层。
- **COPY vs ADD**：默认 COPY；ADD 的"自动解压 + URL"容易惹祸；尾斜杠语义要分清。
- **WORKDIR**：设工作目录，后续相对它；拼错不报错只建错目录。
- **ENV**：环境变量，构建运行时都生效；`RUN export` 没用。
- **EXPOSE**：只声明端口，不开放；真正开放靠 `-p`/`-P`。
- **CMD**：默认启动命令，可被覆盖，只能有一个，用 exec 形式。
- **ENTRYPOINT**：硬命令，末尾参数只变参数不变命令；配合 CMD 定默认参数。
- **缓存失效**：从第一条变化指令起往后全重建；`COPY` 缓存看文件内容；贵且不常变的排最前。

---

## 04.17 动手练习

**1. 为什么下面这个 Dockerfile 每次改代码都会重新 `npm install`？怎么改？**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

<details><summary>参考答案</summary>

因为 `COPY . .` 在 `RUN npm install` **之前**。源码一变，`COPY . .` 这层失效，后面的 `npm install` 也失效重跑。

改法：把依赖清单先 COPY，install 放在源码 COPY 之前：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]
```

</details>

---

**2. 为什么下面的 `RUN` 是坏味道？怎么改？**

```dockerfile
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

<details><summary>参考答案</summary>

三个 `RUN` 产生三层，且前两层里下载的缓存（apt lists）已经固化成层，第三层 `rm` 删不掉它们——镜像白白变大。

改法：合并成一条，装完立刻清理：

```dockerfile
RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
```

</details>

---

**3. 写了 `EXPOSE 3000`，但宿主机访问 `localhost:3000` 连不上，为什么？**

<details><summary>参考答案</summary>

`EXPOSE` 只是**声明**端口，是元数据，不会真正开放端口。

要真正开放，用 `docker run -p 8080:3000 镜像`（把宿主 8080 映射到容器 3000），或 `-P`（映射所有 EXPOSE 端口到随机宿主端口）。

</details>

---

**4. `CMD` 和 `ENTRYPOINT` 的区别是什么？各举一个场景。**

<details><summary>参考答案</summary>

- `CMD`：默认启动命令，能被 `docker run` 末尾参数**整体覆盖**。适合"给个默认值"。
- `ENTRYPOINT`：固定命令，末尾参数**不覆盖它，只变成它的参数**。适合"把镜像做成一个可执行工具"（如 curl 镜像）。

标准搭配：`ENTRYPOINT ["node"]` + `CMD ["server.js"]`，让用户能 `docker run 镜像 other.js` 来替换参数。

</details>

---

**5. `CMD node server.js` 和 `CMD ["node", "server.js"]` 有什么区别？推荐哪个？**

<details><summary>参考答案</summary>

- `CMD node server.js`：shell 形式，实际执行 `sh -c "node server.js"`，主进程是 sh。
- `CMD ["node", "server.js"]`：exec 形式，直接以 node 为主进程。

推荐 exec 形式：信号（SIGTERM）能直达 node 进程，`docker stop` 优雅退出才生效；shell 形式信号被 sh 挡住。

</details>

---

**6. 一条 `COPY` 指令报错 `COPY failed: file not found in build context or excluded by .dockerignore: stat package.json: file does not exist`，可能是什么原因？**

<details><summary>参考答案</summary>

两个可能：

1. `package.json` 不在 `docker build` 指定的**构建上下文**目录里（`COPY` 只能取上下文里的文件）。
2. `package.json` 被 `.dockerignore` 排除了。

检查：确认 `docker build` 末尾的路径是包含 `package.json` 的那个目录，且 `.dockerignore` 没把它排除。

</details>

---

> 📖 **本章的代码示例**：`examples/docker/04-Dockerfile解析.mjs` 和 `examples/docker/04-Node应用.Dockerfile`
> 跑一下看看：`node examples/docker/04-Dockerfile解析.mjs`
> 脚本把一个 Node 应用的 Dockerfile 解析成"指令 + 作用"的有序列表，零依赖、退出码 0。
>
> 下一章讲**网络**：bridge/host/none 三种模式、`-p` 端口映射、容器间通信、DNS，
> 以及"link 和自定义网络"的前世今生。
