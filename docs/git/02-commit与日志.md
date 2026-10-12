# 第 02 章 · commit 与日志

> 第 01 章你会了 `add` / `commit` 三板斧，但你还不知道 `commit` 到底往 `.git/objects/` 里写了什么，也不知道怎么"读"已经发生的历史。
> 这一章就把 commit 拆到骨头里，并给你三件读历史的工具：`git log`、`git show`、`git diff`。
>
> 读完本章，你要能回答三个问题：
> 1. 一个 commit 对象里存了哪几样东西？它们各自有什么用？
> 2. `git log` 那几十个选项，哪几个是天天要用的？
> 3. `git diff` / `git diff --staged` / `git diff HEAD` 三个到底各在比什么？
>
> 本章你需要记住的就一件事：**commit 不是"这次改了哪些行"，而是一张完整的快照 + 一个指向父提交的指针；历史就是这些 commit 串成的一条链表。**

---

## 02.1 拆开一个 commit：它到底存了什么

### 先给结论

一个 commit 对象里，固定存着这么几样东西：

| 字段 | 存什么 | 回答的问题 |
|---|---|---|
| `tree` | 指向一棵目录树的哈希 | 这一版，整个项目长什么样？ |
| `parent` | 指向父 commit 的哈希（可有 0 个或多个） | 这一版，是从哪个提交接着改的？ |
| `author` | 作者名 + 邮箱 + 时间 | 是谁、在什么时候写的这段改动？ |
| `committer` | 提交者名 + 邮箱 + 时间 | 是谁、在什么时候把这个改动提交进来的？ |
| 提交说明 | 一段文本 | 为什么做这次改动？ |

**注意：没有"diff"。** commit 里**没有**存"我改了哪些行"这个信息。它存的是"这一刻的完整快照"（通过 `tree` 引用），以及"我爸爸是谁"（通过 `parent` 引用）。

用一条命令就能亲眼看到：

```bash
git cat-file -p HEAD
```

```text
tree e961e734ec29dcbd1b6236a8ad516739ca992048
parent 6320f3bf182769f67f0ee4fabc485918265891ee
author Tutor <t@example.com> 1791817133 +0800
committer Tutor <t@example.com> 1791817133 +0800

feat: 新增 app.js 入口
```

### 一个很容易搞混的点：author 和 committer

大部分时候 `author` 和 `committer` 是同一个人、同一个时间。但它们**真的可以是两个人**：

- **author（作者）**：写这段代码的人。比如你写了补丁，发给了同事。
- **committer（提交者）**：把这段代码执行 `git commit` 的人。比如同事 `git cherry-pick` 了你的补丁（第 07 章讲 cherry-pick），这时 author 是你，committer 是同事。

什么时候会不一样？典型的几个场景：

1. `git cherry-pick` / `git rebase` / `git am` 应用别人的提交时；
2. 用 `git commit --amend` 改提交说明时，author 保留，committer 更新；
3. 团队里有人负责"合入"别人的 PR。

**面试常考这个点**：问你"commit 里的 author 和 committer 有什么区别"，能答出上面这个区别，就是加分项。

### 为什么时间戳是一串数字

上面 `1791817133` 这种 10 位数字，是 **Unix 时间戳**——从 1970-01-01 00:00:00 UTC 起算的秒数。Git 用它的好处是：**不依赖时区、不依赖格式**，怎么排序都简单。那后面的 `+0800` 是时区偏移（东八区）。

`git log` 显示时间时，会自动把它转成人能看的：

```text
Date:   Mon Oct 12 22:57:33 2026 +0800
```

> 一句话记住它：commit 存的是"快照引用 + 父指针 + 作者/提交者 + 说明"，**没有 diff**；author 是写代码的人，committer 是提交的人。

---

## 02.2 parent：历史就是一条链表

### 先给结论

每个 commit（除了第一个）都有一个 `parent` 字段，指向它**前一个** commit。于是历史就变成了一条**单向链表**：

```text
C1 <── C2 <── C3
       ↑ 每个 commit 的 parent 指向左边那一个
```

第一个 commit 没有 parent，所以叫 **root commit**（第 01 章见过 `[master (root-commit) ...]`）。

### 为什么是"链表"而不是"数组"

这个设计（其实是第 00 章"一切皆对象"的直接推论）带来一个特性：**commit 是不可变的**。

因为 commit 的名字是它内容的哈希，而 `parent` 是内容的一部分。所以一旦你想改历史中间某个 commit，它的哈希就变了，它后面所有 commit 的 `parent` 也都跟着变——**牵一发动全身**。这就是第 05、07 章会反复出现的"改写历史是有代价的"的根源。

### merge 会让 parent 有两个

一个 commit 可以有一个 parent（普通提交）、零个 parent（root commit）、或者**两个 parent**（merge commit，第 03 章细讲）。当你合并两个分支时，Git 生成的 merge commit 会有两个 parent，分别指向两条线的顶端：

```text
C1 ── C2 ── C4 ── M
   \              /
    └── C3 ──────┘
          M 的 parent 是 C4 和 C3 两个
```

用 `git show` 能看到 merge commit 有两个 parent 行：

```bash
git show -s --pretty=format:%P <merge-commit>
```

```text
39c790d0e4fa6ca7ce6abaa83e24755f84c76fed cf2f847cb307308ab3ea58f4c858fb79d414ff60
```

（两个哈希之间一个空格，就是 parent1 和 parent2。）

### 亲手看 parent 链

```bash
# 逆着 parent 一直往回走，就是完整历史
git log --oneline
```

```text
d1fa81b feat: 新增 app.js 入口
6320f3b docs: 补一节用法
730db49 docs: 初始化 README
```

这三行从上到下，就是"从新到旧"沿着 parent 链走出来的顺序。

> 一句话记住它：历史是一条由 `parent` 串成的单向链表；普通提交一个 parent，合并提交两个 parent，第一个提交零个 parent。

---

## 02.3 `git log`：读历史的各种姿势

### 先给结论

`git log` 是"读历史"的主命令。裸跑 `git log` 输出完整信息，但你九成时间会用几个选项把它**压缩成一行一行**，或者**过滤**出你想看的部分。

裸跑（第 01 章见过）：

```bash
git log
```

```text
commit 16344d6e30022e0a9c1115853846cd87437d4562 (HEAD -> master)
Author: t <t@example.com>
Date:   Mon Oct 12 22:57:33 2026 +0800

    first commit
```

**每天必用的三种姿势：**

### ① 一行一条：`--oneline`

```bash
git log --oneline
```

```text
d1fa81b feat: 新增 app.js 入口
6320f3b docs: 补一节用法
730db49 docs: 初始化 README
```

短哈希 + 提交说明第一行。**这是最常用的读法**——扫一眼就知道历史脉络。

### ② 看分支图形：`--graph`

```bash
git log --oneline --graph --all
```

```text
*   52d26c8 merge feature: 手动解决冲突
|\
| * 71c1574 feature 改成 2
* | 0e0f3d4 master 改成 3
|/
* 82ef030 base
```

`*` 是 commit，`|` 和 `\` `/` 画出了分支的分叉与合并。**看懂这张图，你就看懂了一个仓库的整个历史。**

### ③ 按提交者/作者过滤：`--author`

```bash
git log --oneline --author="张三"
```

只显示张三的提交。同理还有 `--since`（某个时间之后）、`--grep`（按说明文本搜索）：

```bash
git log --oneline --since="2 weeks ago"
git log --oneline --grep="fix"
```

### ④ 限定范围：`-n` 和路径

```bash
git log --oneline -3            # 只看最近 3 条
git log --oneline -- src/app.js # 只看碰过这个文件的提交
```

### 一张速查表

| 你想看什么 | 命令 |
|---|---|
| 一行一条 | `git log --oneline` |
| 分支图 | `git log --oneline --graph --all` |
| 最近 N 条 | `git log -n`（或 `-3`） |
| 某人的提交 | `git log --author="名字"` |
| 某时间之后 | `git log --since="2 weeks ago"` |
| 说明含关键词 | `git log --grep="fix"` |
| 碰过某文件 | `git log -- 路径` |
| 每条显示改了几个文件 | `git log --stat` |
| 每条显示具体改了什么 | `git log -p` |

> 一句话记住它：`git log --oneline` 扫脉络，`--graph --all` 看分支图，`--author/--since/--grep/路径` 做过滤。

---

## 02.4 `git show`：看某一次提交的完整细节

### 先给结论

`git log` 是"列表"，`git show` 是"详情页"。你想知道**某一次提交具体改了什么**，就用 `git show`。

```bash
git show HEAD
```

会依次显示：commit 的元信息（作者、时间、说明）、以及这次提交的 **diff**（改了哪些行）。

### 只想要摘要：`--stat`

```bash
git show --stat HEAD
```

```text
d1fa81b feat: 新增 app.js 入口
 app.js | 1 +
 1 file changed, 1 insertion(+)
```

`--stat` 只告诉你"改了哪个文件、加了几行删了几行"，不展开具体内容。**这是日常最常用的 `git show` 形态**——先看 stat 判断改动规模，再看具体 diff。

### 只想要某一次提交的说明和元信息：`-s`

```bash
git show -s --format=fuller HEAD
```

`-s` 表示 suppress（抑制）diff 输出，只看元信息。`--format=fuller` 会显示 author 和 committer 两套信息（普通 `--format` 只显示一套）。

### 看某个历史提交

`HEAD` 可以换成任何提交的引用：短哈希、分支名、或者 `HEAD~1`（上一个提交）、`HEAD~2`（上上个）：

```bash
git show HEAD~1          # 上一个提交
git show 6320f3b         # 指定短哈希
```

**`HEAD~1` 这个语法很重要**：`~1` 表示"沿着 parent 链往回走 1 步"。`HEAD~3` 就是往回 3 步。第 05 章的 `reset` 大量用到它。

> 一句话记住它：`git log` 看列表，`git show` 看单个提交的详情；`--stat` 先看规模，`HEAD~1` 表示上一个提交。

---

## 02.5 `git diff`：三种"比较"的区别

### 先给结论

`git diff` 有**三种**最常用的形态，分别比较三棵树里**不同的一对**。这是新手最容易搞混的，必须背下来：

| 命令 | 比较的是 | 回答的问题 |
|---|---|---|
| `git diff` | **工作区** vs **暂存区** | 我改了但还没 add 的，是哪些？ |
| `git diff --staged` | **暂存区** vs **最新 commit** | 我 add 了但还没 commit 的，是哪些？ |
| `git diff HEAD` | **工作区** vs **最新 commit** | 从上一次提交到现在，总共变了哪些？ |

（`--staged` 和 `--cached` 是同一个意思，两个都能用。）

### 亲手看三种输出

先造一个"改了两处"的状态：一处 add 了，一处没 add。

```bash
echo "line 1" > a.txt
git add a.txt
git commit -m "base"

echo "line 2" >> a.txt   # 改动一：没 add
git add a.txt            # 把这个改动 add 了
echo "line 3" >> a.txt   # 改动二：没 add
```

现在：

```bash
git diff          # 工作区 vs 暂存区 → 只会显示 "line 3"
```

```text
diff --git a/a.txt b/a.txt
index 86273d2..c6a1b2e 100644
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,3 @@
 line 1
 line 2
+line 3
```

```bash
git diff --staged # 暂存区 vs 最新 commit → 只会显示 "line 2"
```

```text
diff --git a/a.txt b/a.txt
index 790da40..86273d2 100644
--- a/a.txt
+++ b/a.txt
@@ -1 +1,2 @@
 line 1
+line 2
```

```bash
git diff HEAD    # 工作区 vs 最新 commit → "line 2" 和 "line 3" 都有
```

**三种输出各自只显示"那两棵树之间"的差异**，这就是它们分工的意义。

### 怎么读 diff 输出

diff 的输出格式（叫 unified diff）要能读懂：

```text
diff --git a/a.txt b/a.txt        ← 比较的是 a 版本 和 b 版本 的 a.txt
index 86273d2..c6a1b2e 100644     ← 两边的 blob 哈希（前 7 位）+ 文件权限
--- a/a.txt                       ← 左边（旧版本）
+++ b/a.txt                       ← 右边（新版本）
@@ -1,2 +1,3 @@                   ← 位置标记：从第 1 行起，旧 2 行 / 新 3 行
 line 1                           ← 上下文行（没变）
 line 2                           ← 上下文行（没变）
+line 3                           ← 新增的行（+ 开头）
```

- `+` 开头：新增的行（属于 `+++` 那一边）；
- `-` 开头：删除的行（属于 `---` 那一边）；
- 空格开头：上下文，没变，帮你定位。

### 一个常见坑：`git diff` 不显示"未跟踪"的新文件

如果你新建了一个文件但**从没 `git add` 过**（未跟踪状态），`git diff` 是**看不到**它的。因为 `git diff` 只在"已跟踪文件"之间比较，未跟踪文件对 Git 来说还"不存在"。

```bash
echo "brand new" > new.txt
git diff          # 什么都不显示！new.txt 是未跟踪的
git status -s     # ?? new.txt   ← 只能在这里看到
```

> 一句话记住它：`git diff` 比工作区 vs 暂存区，`--staged` 比暂存区 vs commit，`HEAD` 比工作区 vs commit；未跟踪的新文件 `git diff` 看不见。

---

## 02.6 `git blame`：每一行是谁写的

### 先给结论

**`git blame <file>` 显示文件里每一行是"哪次提交、哪个作者"写的。** 它是排查"这行代码是谁加的、为什么加"的神器。

```bash
git blame README.md
```

```text
730db49 (Tutor       2026-10-12 22:57:33 +0800  1) # demo
6320f3b (Tutor       2026-10-12 22:58:01 +0800  2) 
6320f3b (Tutor       2026-10-12 22:58:01 +0800  3) ## 用法
```

每一行是：`提交短哈希 (作者 时间 行号) 内容`。**看到某行可疑，就拿那个短哈希去 `git show` 看当时的完整改动**。

### 为什么叫 blame（责怪）

名字起得很有"甩锅"意味——它的本意就是"找出这一行是谁写的"。虽然叫 blame，但它真正的用途是**定位改动来源**，方便问清楚"当时为什么要这么写"。

### 几个实用选项

```bash
git blame -L 10,20 file     # 只看第 10~20 行
git blame --since="3 months ago" file   # 只看最近 3 个月改的行
```

### 和 `git log -- 路径` 的分工

| | 粒度 | 回答的问题 |
|---|---|---|
| `git log -- 文件` | 按**提交** | 这个文件的历史提交有哪些？ |
| `git blame 文件` | 按**行** | 这一行具体是哪次提交写的？ |

想"看这个文件整体怎么演变的"用 log，想"定位某一行"用 blame。

> 一句话记住它：`git blame` 把文件的每一行对应到"哪次提交、谁写的"；看到可疑行，拿短哈希去 `git show` 挖上下文。

---

## 02.7 定制 `git log` 输出：`--pretty=format`

### 先给结论

`git log` 的输出格式可以用 `--pretty=format:"..."` **完全自定义**，用 `%` 占位符拼出你想要的字段。这是脚本处理历史时最常用的能力。

### 常用占位符

| 占位符 | 含义 |
|---|---|
| `%h` | 短哈希 |
| `%H` | 完整哈希 |
| `%s` | 提交说明（第一行） |
| `%an` | 作者名 |
| `%ad` | 作者日期 |
| `%d` | 分支/标签引用（如 `(HEAD -> main)`） |

### 一个实战例子

```bash
git log --pretty=format:"%h | %an | %s"
```

```text
d1fa81b | Tutor | feat: 新增 app.js 入口
6320f3b | Tutor | docs: 补一节用法
730db49 | Tutor | docs: 初始化 README
```

### 为什么脚本要用它

因为**固定的、机器可读的格式**能被其它程序解析。比如你要统计"每个作者提交了几次"：

```bash
git log --pretty=format:"%an" | sort | uniq -c
```

或者只想拿到哈希列表做批处理：

```bash
git log --pretty=format:"%H"
```

### `git shortlog`：按作者汇总

```bash
git shortlog -sn
```

```text
     3  Tutor
     1  张三
```

`-s` 只显示计数，`-n` 按次数排序。**一眼看出谁贡献了多少提交**，做项目总结时很有用。

> 一句话记住它：`--pretty=format:"%h | %an | %s"` 定制 log 输出、方便脚本解析；`shortlog -sn` 按作者汇总提交数。

---

## 02.8 提交信息规范：怎么写一条好信息

### 先给结论

提交说明是**给未来的自己和同事看的**。一条好信息要能回答一个问题：**"为什么"要做这次改动**——因为"改了什么" `git diff` 已经告诉你了。

### 业界最通用的格式：Conventional Commits

目前最流行的是 **Conventional Commits（约定式提交）** 规范，格式是：

```text
<type>(<scope>): <subject>

<可选的详细正文>

<可选的 footer>
```

核心是**第一行**，它由三部分组成：

```text
feat(login): 新增用户名密码校验
│    │        │
│    │        └─ subject：一句话说清做了什么（为什么）
│    └────────── scope：影响的范围（可省略）
└─────────────── type：改动的类型（必填）
```

### type 的常见取值

| type | 含义 | 例子 |
|---|---|---|
| `feat` | 新功能 | `feat: 新增登录接口` |
| `fix` | 修 bug | `fix: 修复密码校验绕过` |
| `docs` | 只改文档 | `docs: 更新 README` |
| `style` | 格式（不影响逻辑） | `style: 统一缩进` |
| `refactor` | 重构（不改功能） | `refactor: 抽出校验函数` |
| `test` | 只改测试 | `test: 补充单测` |
| `chore` | 杂项（构建、依赖等） | `chore: 升级依赖` |
| `perf` | 性能优化 | `perf: 缓存查询结果` |

**面试/工作中最常问的是 `feat` 和 `fix` 的区别**：`feat` 是"加了新东西"，`fix` 是"修了坏的东西"。

### 为什么要统一 type 前缀

因为可以**机器可读**。有了统一前缀，工具就能：

- 自动生成 changelog（发布日志）；
- 自动决定版本号怎么升（`feat` 升小版本、`fix` 升补丁版本，叫 semantic versioning）；
- 用 `git log --grep="^fix"` 一键捞出所有修 bug 的提交。

### 三条写作铁律

1. **写"为什么"，不写"做了什么"。** 差：`改了下 login.js`；好：`修复空密码能通过校验的漏洞`。
2. **一条提交只做一件事。** 别把"修 bug + 加功能 + 改格式"塞进一条。拆开，这是第 01 章"暂存区"设计的意义所在。
3. **用祈使句、现在时。** 英文习惯写 `Add login` 而不是 `Added login`；中文写"新增登录"而不是"新增了登录"。

### 正文（body）和 footer：一句话讲不清时怎么写

大部分提交一行 subject 就够了。但有两种情况需要写更多：

**正文（body）**：当"为什么"一句话讲不清时，空一行后在正文里展开。

```text
fix: 修复登录接口在高并发下的偶发超时

原因是连接池默认只有 5 个连接，峰值时请求排队，
导致超过网关 3 秒超时被掐断。把连接池上限调到 50，
并给查询加了 300ms 超时。
```

注意格式：**第一行 subject 空一行，然后才是 body**。这个空行不是装饰——Git 和很多工具约定"第一行是摘要，空行之后是正文"，解析工具靠它区分。

**footer**：用来标注两件机器可读的事。

1. **破坏性改动（breaking change）**。两种写法二选一：
   - 在 type 后加感叹号：`feat!:`；
   - 或在 footer 写 `BREAKING CHANGE:` 加说明。

2. **关联 issue / PR**：`Closes #123`（合并后自动关闭 issue）、`Refs #456`（只引用，不关闭）。

```text
feat!: 把登录接口从 v1 迁移到 v2

BREAKING CHANGE: 删除了 /v1/login，客户端必须升级到 /v2/login

Closes #321
```

**为什么 footer 要机器可读**：`Closes #123` 能被 GitHub / GitLab 识别，合并后自动关闭对应 issue；`BREAKING CHANGE` 能被 changelog 工具识别，自动标记"下个版本是破坏性升级"。

### 什么时候写多，什么时候一行就够

| 情况 | 写法 |
|---|---|
| 简单修复/新增，一句话讲得清 | 一行 `fix: ...` |
| "为什么"需要解释（改了算法、绕过坑） | subject + 空行 + body |
| 破坏性改动 | `type!:` 或 `BREAKING CHANGE:` footer |
| 和 issue 关联 | `Closes #123` footer |

**一句话总结三层分工**：subject 是给"扫历史"看的，body 是给"真要弄懂这次改动"的人看的，footer 是给机器看的。该写才写，不写废话。

### 真实的坏例子 vs 好例子

```text
# 坏例子（都是废话）
update
fix bug
改了改
wip
123

# 好例子
feat: 新增登录接口
fix: 修复空密码校验绕过
refactor(login): 抽出 validate 函数
docs: 补充安装步骤
```

> 一句话记住它：提交信息写"为什么"，格式用 `type(scope): subject`；一条提交只做一件事，`feat` 加功能、`fix` 修 bug。

---

## 02.9 revision 语法：怎么"点名"一个提交

### 先给结论

前面你已经见过了 `HEAD`、`HEAD~1`、`6320f3b`（短哈希）这些写法。它们统称 **revision（引用）**，作用都是**指向某一个 commit**。`reset`、`rebase`、`diff`、`show` 全都靠它"点名"。

Git 里点一个提交的方式，最常用的有下面这些：

| 写法 | 含义 | 例子 |
|---|---|---|
| `HEAD` | 当前提交 | `git show HEAD` |
| `HEAD~1` / `HEAD^` | 上一个提交（往回 1 步） | `git show HEAD~1` |
| `HEAD~2` / `HEAD^^` | 上上个提交（往回 2 步） | `git show HEAD~2` |
| `HEAD~n` | 往回 n 步 | `git show HEAD~5` |
| 短哈希 | 完整哈希的前几位（够唯一就行） | `git show 6320f3b` |
| 分支名 / 标签名 | 该分支/标签指向的提交 | `git show main`、`git show v1.0` |

### 亲手看：`git rev-parse` 把这些写法翻译成完整哈希

`git rev-parse` 就是"引用解析器"——你给它任意一种写法，它吐出完整的 40 位哈希：

```bash
git rev-parse HEAD HEAD~1 HEAD~2 HEAD^ HEAD^^
```

```text
97bfc7cf83a192da28311103a285b0fb338732e0
e0c8cdb05b99d02f4c30b3b91f83ea6ae10edc06
1533647f37e2d5d263902e9c380c8dc757a229ee
e0c8cdb05b99d02f4c30b3b91f83ea6ae10edc06
1533647f37e2d5d263902e9c380c8dc757a229ee
```

注意看第 2 行和第 4 行**一模一样**——`HEAD~1` 和 `HEAD^` 指向同一个提交；第 3 行和第 5 行也一样——`HEAD~2` 和 `HEAD^^` 是同一个。

### `~` 和 `^` 到底差在哪

结论先说：**在普通提交（只有一个 parent）上，`~` 和 `^` 完全等价。** 它们的分歧只出现在 merge commit（有两个 parent）上。

- `~n`：**沿第一个 parent 往回走 n 步**。`HEAD~2` = 爸爸的爸爸。
- `^n`：**选第 n 个 parent**。`HEAD^1` = 第一个 parent，`HEAD^2` = 第二个 parent。

所以 `HEAD^` 是 `HEAD^1` 的缩写（选第一个 parent），`HEAD^^` 是"往回一步，再往回一步"，结果和 `HEAD~2` 相同。

**当你要访问 merge commit 的"另一条线"时，必须用 `^2`**（`~` 走不到第二条线）：

```text
        M（merge commit，有 parent1 和 parent2）
       / \
  parent1  parent2
     ↑        ↑
  M~1 / M^1  M^2   ← 只有 M^2 能点到右边那条线
```

第 03 章会正式讲 merge commit，这里先记住"`^2` 能点到第二个 parent"就够了。

### 短哈希：哈希可以只写前几位

```bash
git rev-parse --short HEAD
```

```text
97bfc7c
```

Git 允许你用哈希的**前几位**来引用提交，只要这几位在仓库里**唯一**。为什么够用？因为 SHA-1 有 40 位，前 7 位就有 `16^7 ≈ 2.7 亿` 种组合，一个正常仓库很难撞。所以 `git log --oneline` 默认只显示 7 位短哈希，你照着敲就行。

> 一句话记住它：`HEAD~n` 沿第一个 parent 往回走 n 步，`HEAD^` 是回 1 步，`HEAD^2` 点第二个 parent；`git rev-parse` 把任何引用翻译成完整哈希。

---

## 02.10 `git log` 的过滤：按时间、按代码内容、跨重命名

### 先给结论

02.3 讲了 `--oneline / --graph / --author` 这些基础过滤。这一节补三个**排查 bug 时特别有用**的进阶过滤：按时间（`--since/--until`）、按代码内容（`-S`）、跨文件重命名（`--follow`）。

### ① 按时间：`--since` / `--until`

```bash
git log --oneline --since="2026-10-01" --until="2026-10-10"
```

```text
e0c8cdb fix: change b to B
1533647 feat: add f.txt
```

`--since` 是"从什么时候起"（含边界），`--until` 是"到什么时候止"。时间格式很宽容：`"2 weeks ago"`、`"2026-10-01"`、`"yesterday"` 都行。

**典型场景**：线上昨晚 8 点出的 bug，你怀疑是这几天引入的，就 `--since="3 days ago"` 把范围砍到最近几天的提交，逐个排查。

### ② 按代码内容：`-S`（pickaxe）

**先给结论**：`-S"字符串"` 找出"**这个字符串出现次数发生变化**"的提交。它不是搜提交说明，是搜**代码里真实的内容**。

场景：你发现代码里多了一个可疑的变量名 `debug_flag`，想知道是哪次提交加进来的：

```bash
git log --oneline -S "debug_flag" -- src/
```

```text
e0c8cdb fix: change b to B
```

（这个例子里 `-S "B"` 找到了"把 `b` 改成 `B`"那次提交——因为大写 `B` 从无到有，出现次数变了。）

**`-S` 和 `-G` 的区别**：

| 选项 | 匹配逻辑 | 用途 |
|---|---|---|
| `-S"字符串"` | 字符串**出现次数**变化的提交 | 精确定位"某个东西加了/删了" |
| `-G"正则"` | diff 里**出现了匹配正则的行**的提交 | 按模式搜，更宽松 |

`-S` 更准（它能过滤掉"改了但次数没变"的噪音），`-G` 更宽（配合正则用）。

### ③ 跨重命名：`--follow`

普通 `git log -- 文件` 有个坑：**文件一旦被重命名，历史就"断"了**——旧名字下的提交查不到了。`--follow` 让 Git 追踪改名：

```bash
# 先把 f.txt 重命名成 g.txt 并提交
git mv f.txt g.txt
git commit -m "rename f.txt to g.txt"

# 不带 --follow：只看到 rename 之后的提交
git log --oneline -- g.txt

# 带 --follow：跨越 rename，看到完整历史
git log --oneline --follow -- g.txt
```

```text
99a401c rename
97bfc7c feat: add d
e0c8cdb fix: change b to B
1533647 feat: add f.txt
```

注意带 `--follow` 时，历史一路追溯到了"它还叫 f.txt 的时候"。**排查"这个文件从诞生到现在都经历了什么"，`--follow` 是必须的**。

> 一句话记住它：`--since/--until` 按时间砍范围，`-S` 按代码内容定位改动，`--follow` 跨重命名追全历史。

---

## 02.11 `git diff` 进阶：比较任意两个提交、只看改了什么文件

### 先给结论

02.5 的三种 `git diff` 都是"拿某棵树和当前状态比"。但 `git diff` 真正强大的地方是：**它可以比较任意两个提交、任意两个分支**，还能用 `--stat` / `--name-only` 只给摘要。

### ① 比较两个提交：`git diff A B`

```bash
git diff HEAD~2 HEAD
```

```text
diff --git a/f.txt b/f.txt
index 60478d2..6bd0c30 100644
--- a/f.txt
+++ b/f.txt
@@ -1,3 +1,4 @@
 a
-B
+B
 c
+d
```

`git diff A B` 回答的是："从 A 到 B，一共变了什么"。A 和 B 可以是短哈希、`HEAD~n`、分支名、标签名，任意混搭。

### ② 只想要"改了哪些文件"：`--stat` 和 `--name-only`

不想看逐行 diff，只想先知道"这次动了几个文件、规模多大"：

```bash
git diff HEAD~2 HEAD --stat
```

```text
 f.txt | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

`--stat` 给你：改了哪个文件、加了几行（`+`）删了几行（`-`）、最后一行汇总。**这是代码审查时第一眼要看的东西**——先判断改动规模，再决定要不要深读。

只想拿文件名列表（给脚本用）：

```bash
git diff HEAD~2 HEAD --name-only
```

```text
f.txt
```

`--name-only` 只输出文件名，一行一个，非常适合喂给后续命令做批处理。

### ③ 比较两个分支：`git diff main feature`

想知道"feature 分支相对 main 到底做了些什么"，不用切过去，直接比：

```bash
git diff main feature
```

它会输出"从 main 到 feature 的所有差异"。反过来 `git diff feature main` 就是"从 feature 到 main"的差异（方向相反，`+`/`-` 会互换）。

**这个用法在做 PR 评审、或者合并前自查时天天用**：合并前先 `git diff main feature --stat` 扫一眼，心里有数再 `git merge`。

### 一张表汇总 diff 的各种"比什么"

| 命令 | 比较对象 | 典型场景 |
|---|---|---|
| `git diff` | 工作区 vs 暂存区 | 提交前看没 add 的 |
| `git diff --staged` | 暂存区 vs HEAD | 提交前看已 add 的 |
| `git diff HEAD` | 工作区 vs HEAD | 看全部未提交改动 |
| `git diff A B` | 提交 A vs 提交 B | 看两次提交/两个分支的差异 |
| `git diff --stat` | （配合上面）只看摘要 | 判断改动规模 |

> 一句话记住它：`git diff A B` 比较任意两个提交/分支，`--stat` 看"改了哪些文件+规模"，`--name-only` 只要文件名列表。

---

## 02.12 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| `git diff` 看不到新文件 | 明明建了新文件，diff 却空白 | 未跟踪文件不在 diff 范围 | `git status` 看 `??`，先 `add` 再看 `--staged` |
| 分不清三种 diff | 改了文件 add 之后，`git diff` 变空 | add 之后改动进了暂存区，`git diff` 比的是工作区 vs 暂存区 | 用 `git diff --staged` 看已暂存的 |
| 提交信息写废话 | 三个月后看不懂历史 | 没写"为什么" | 用 `type: subject`，写原因 |
| 一条提交塞太多东西 | 想回滚一个改动时牵连一片 | 没按"一件事一条"拆分 | 用小步提交，暂存区帮你拆 |
| `git show HEAD~10` 报错 | `fatal: ambiguous argument` | 历史没 10 条那么多 | 先 `git log --oneline` 数清楚 |
| 把 author 当 committer | 以为 cherry-pick 会换作者 | 两者职责不同 | author=写代码的人，committer=提交的人 |
| `git log` 输出太长刷屏 | 一次 commit 占 5 行 | 用了默认格式 | `git log --oneline` |
| 想搜历史却翻半天 | 找不到某次改动 | 不会用过滤 | `--author/--grep/--since/-- 路径` |
| diff 里看不懂 `@@` | 不知道改动在哪一行 | 不懂 hunk 头 | `@@ -旧起始,旧行数 +新起始,新行数 @@` |
| 搞混 `~` 和 `^` | 想访问 merge 的另一条线却点不到 | `~n` 只沿第一个 parent 走 | merge commit 用 `^2` 点第二个 parent |
| 查文件历史断了 | 重命名后 `git log -- 文件` 查不到旧记录 | 普通 log 不跨重命名 | 加 `--follow` |
| 分不清 `-S` 和 `-G` | 搜代码内容结果不对 | `-S` 按出现次数，`-G` 按正则匹配行 | 精确定位用 `-S`，宽松正则用 `-G` |
| 想比两个提交不会写 | 只会 `git diff HEAD` | 不知道 `git diff A B` | `git diff 提交A 提交B`，或 `git diff main feature` |

---

## 02.13 本章小结

**commit 的结构**

- commit 存五样：`tree`（快照）、`parent`（父指针）、`author`、`committer`、说明。
- **没有 diff**——它存快照，不存差异。
- author 是写代码的人，committer 是提交的人，cherry-pick/rebase/amend 时两者会不同。
- 时间戳是 Unix 秒数，`+0800` 是时区偏移。

**历史是链表**

- `parent` 把 commit 串成单向链表；第一个 commit 是 root（零 parent），merge commit 有两个 parent。
- commit 不可变：改中间一个，后面所有哈希都变。

**git log**

- `--oneline` 一行一条；`--graph --all` 看分支图；`--author/--since/--grep/路径` 过滤。

**git show**

- 看单个提交详情；`--stat` 看规模，`-s` 只看元信息；`HEAD~1` 是上一个提交。

**git diff**

- `git diff`：工作区 vs 暂存区；`--staged`：暂存区 vs commit；`HEAD`：工作区 vs commit。
- 未跟踪的新文件，`git diff` 看不见。

**提交信息规范**

- Conventional Commits：`type(scope): subject`；`feat` 加功能、`fix` 修 bug。
- 写"为什么"，一条提交一件事。

**revision 语法**

- `HEAD~n` 沿第一个 parent 往回走 n 步，`HEAD^` 是回 1 步，`HEAD^2` 点第二个 parent。
- `git rev-parse` 把任何引用（短哈希、分支、标签、`HEAD~n`）翻译成完整哈希。

**过滤与比较进阶**

- `--since/--until` 按时间砍范围，`-S` 按代码内容定位，`--follow` 跨重命名追历史。
- `git diff A B` 比较任意两个提交/分支，`--stat` 看摘要，`--name-only` 只要文件名。

---

## 02.14 动手练习

### 练习 1：拆开一个 commit

建一个仓库、提交一次，然后用 `git cat-file -p HEAD` 看它的结构。说出你看到了哪几个字段，分别是什么。

<details><summary>参考答案</summary>

```bash
git init && echo hi > a.txt
git add a.txt && git commit -m "init"
git cat-file -p HEAD
```

会看到 `tree`（目录树哈希）、`author`、`committer` 三行 + 提交说明。因为这是第一个提交，**没有 `parent` 行**。

</details>

### 练习 2：三个 diff 各比什么

执行下面操作，然后分别运行三个 diff 命令，说出每个命令能看到什么。

```bash
echo "1" > a.txt && git add a.txt && git commit -m base
echo "2" >> a.txt && git add a.txt
echo "3" >> a.txt
```

<details><summary>参考答案</summary>

- `git diff`：只显示 `3`（工作区 vs 暂存区，只有没 add 的 `3`）。
- `git diff --staged`：只显示 `2`（暂存区 vs commit，只有 add 了的 `2`）。
- `git diff HEAD`：显示 `2` 和 `3`（工作区 vs commit，全部改动）。

</details>

### 练习 3：判断对错

1. commit 对象里存着这次提交的 diff。
2. merge commit 可以有多个 parent。
3. `git diff --staged` 和 `git diff --cached` 是一回事。
4. `git show --stat` 会显示每一行的具体改动。
5. `HEAD~2` 表示 HEAD 后面的第 2 个提交。

<details><summary>参考答案</summary>

1. **错。** commit 存的是快照（tree）+ 父指针（parent）+ 元信息，diff 是 `git show`/`git diff` 现场算出来的。
2. **对。** merge commit 有两个 parent（分别指向两条被合并的线）；普通提交一个，root 提交零个。
3. **对。** `--staged` 和 `--cached` 是同一个选项的两个名字。
4. **错。** `--stat` 只显示"改了哪些文件、几行"，不展开具体内容；要看具体改动用 `-p` 或去掉 `--stat`。
5. **错。** `HEAD~2` 是往回走 2 步（HEAD 的爷爷），不是"后面"。

</details>

### 练习 4：改一条坏提交信息

下面这条提交信息有哪些问题？重写成规范格式。

```text
update
```

<details><summary>参考答案</summary>

`update` 是典型的废话——不知道改了什么、为什么改、是不是破坏性改动。规范写法举例：

```text
feat(login): 新增用户名密码校验
```

如果确实只是杂项，也可以：

```text
chore: 升级 lodash 到 4.17.21
```

关键：`type` 前缀 + 一句说清"为什么"的说明。

</details>

### 练习 5：定位"这行代码是谁改的"

仓库里有 `config.js`，其中一行 `const debugFlag = true;` 看起来来路不明。说出你用什么命令能定位：

1. 这行是**哪次提交**加进来的？
2. 如果 `config.js` 历史上被**重命名过**，第一条命令会漏什么？怎么补？

<details><summary>参考答案</summary>

1. 用 pickaxe 按内容搜：

```bash
git log --oneline -S "debugFlag" -- config.js
```

`-S` 找出"`debugFlag` 这个字符串出现次数发生变化"的提交，通常就是加它的那次。再 `git show 那个哈希` 看完整上下文。

2. 普通 `git log -- 文件` 不跨重命名，旧名字下的历史会断。加 `--follow` 补齐：

```bash
git log --oneline --follow -- config.js
```

也可以先用 `git blame config.js` 直接定位"这一行是哪次提交写的"。

</details>

---

> **本章的代码示例**：`examples/git/02-commit结构.mjs`（`node examples/git/02-commit结构.mjs`，实测退出码 0）
> 它现场建三个 commit，用 `git cat-file -p` 拆开一个 commit，再演示 `git log`、`git show`、`git diff` 三种读法。
>
> **下一章**：分支与合并——HEAD 到底是什么、快进合并和三方合并差在哪、为什么 Git 的分支便宜到像不要钱。
