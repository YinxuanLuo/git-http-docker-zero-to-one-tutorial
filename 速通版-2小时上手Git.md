# Git 速通版 · 2 小时上手

> 写给**会 `add/commit/push` 三板斧、但不懂 Git 底层**的人。
> 目标是让你**今天就能规范地协作**，不求讲透，只求会用、用不错。
>
> 想搞懂"为什么"，看 [`docs/git/`](docs/git/) 完整版（每章 1 小时）。
> 本文件每个小节末尾都有 `→ 深入：第 XX 章` 的路标。

---

## 目录

- [0. 先建立心智模型（10 分钟）](#0-先建立心智模型10-分钟)
- [1. 安装配置 + 第一次提交（20 分钟）](#1-安装配置--第一次提交20-分钟)
- [2. 分支与合并（25 分钟）](#2-分支与合并25-分钟)
- [3. 冲突（20 分钟）](#3-冲突20-分钟)
- [4. 撤销与回退（20 分钟）](#4-撤销与回退20-分钟)
- [5. 远程协作（20 分钟）](#5-远程协作20-分钟)
- [6. rebase 与工程化速览（15 分钟）](#6-rebase-与工程化速览15-分钟)
- [7. 十二个必踩的坑（10 分钟）](#7-十二个必踩的坑10-分钟)
- [8. 一页速查表（5 分钟）](#8-一页速查表5-分钟)
- [9. 自测 20 题（10 分钟）](#9-自测-20-题10-分钟)
- [下一步](#下一步)

---

## 0. 先建立心智模型（10 分钟）

### 三句话

**第一句：Git 不是保存你的文件，是保存一个"内容寻址的对象数据库"。**

每次 `commit`，Git 存的是"整个项目那一刻的完整快照"，不是"这次改了哪些行"。
同一个文件内容，只存一份，大家靠哈希共享引用。

**第二句：你的项目分三个区。**

| 区 | 是什么 | 你操作它 |
|---|---|---|
| 工作区 | 你正在改的文件 | 编辑器 |
| 暂存区 | 你挑选出来准备提交的 | `git add` |
| 版本库 | 已经 commit 的历史 | `git commit` |

数据流动：工作区 `--add-->` 暂存区 `--commit-->` 版本库。**`commit` 只认暂存区，不认工作区。**

**第三句：分支只是一张写着哈希的小纸条。**

分支不是"复制一份代码"，它只是一个指向某个 commit 的指针。
所以建分支、删分支都几乎零成本——**为每个想法开一个分支。**

### 三条推论，能解释你 90% 的困惑

| 你看到的 | 背后的原因 |
|---|---|
| 改了文件忘 add，commit 没提交进去 | commit 只认暂存区 |
| 两个分支改同一行，merge 甩你一堆 `<<<<<<<` | 内容重叠，Git 无法自动裁决 |
| push 被拒 `[rejected]` | 远程有你没有的提交，先 pull |

### 一个必须背下来的事实

> **未推送的提交随便改，已推送的提交只能用 `revert` 追加反向提交。**

`reset`（改写历史）只对"还没 push"的提交用；`revert`（追加反向提交）对"已 push"的提交用。

→ 深入：`docs/git/00-设计哲学.md`、`docs/git/01-环境与心智模型.md`

---

## 1. 安装配置 + 第一次提交（20 分钟）

### 检查环境

```bash
git --version          # 有输出 = 装好了
```

### 配身份（只做一次，全局）

```bash
git config --global user.name "你的名字"
git config --global user.email "you@example.com"
```

不配的话第一次 commit 会报 `Author identity unknown`。

### 第一次提交

```bash
mkdir demo && cd demo
git init                 # 建一个 .git 目录
echo "hello" > a.txt
git status               # 看状态：?? a.txt（未跟踪）
git add a.txt            # 进暂存区
git status -s            # A  a.txt（已暂存）
git commit -m "feat: 初始化 a.txt"
git log --oneline        # 看历史
```

### `git status -s` 缩写速记

| 缩写 | 含义 |
|---|---|
| `??` | 未跟踪 |
| `A ` | 新文件已暂存 |
| `M ` | 已修改已暂存（第一列） |
| ` M` | 已修改未暂存（第二列） |

### 三个高频命令

```bash
git diff                # 工作区 vs 暂存区（还没 add 的）
git diff --staged       # 暂存区 vs 最新 commit（add 了没 commit 的）
git diff HEAD           # 工作区 vs 最新 commit（全部）
```

→ 深入：`docs/git/01-环境与心智模型.md`、`docs/git/02-commit与日志.md`

---

## 2. 分支与合并（25 分钟）

### 建分支 + 切分支

```bash
git switch -c feature   # 创建并切换（推荐）
git switch master       # 切回 master
git branch              # 列出，* 是当前
git branch -d feature   # 删除（只删已合并的）
```

### 开发 + 合并

```bash
git switch -c feature/login
# ... 改代码 ...
git add -A
git commit -m "feat: 登录功能"
git switch main
git merge feature/login -m "merge: 合入登录"
git branch -d feature/login
```

### 快进 vs 三方合并

```text
快进合并：main 在分叉后没动 → 直接平移指针，历史一条直线
三方合并：两边都动了 → 生成一个有 2 个 parent 的 merge commit
```

判断就看一句：**分叉之后，当前分支有没有新提交？** 没有 → 快进；有 → 三方。

### 看懂历史图

```bash
git log --oneline --graph --all
```

`*` 是 commit，`|` `\` `/` 画出分叉与合并。

→ 深入：`docs/git/03-分支与合并.md`

---

## 3. 冲突（20 分钟）

### 什么时候会冲突

只有"两边改了**同一个文件的同一块地方**"才冲突。改不同文件、不同行都不会。

### 制造并解决

```bash
# 两个分支都改了 f.txt 的第一行
git merge feature
```

会看到：

```text
CONFLICT (content): Merge conflict in f.txt
Automatic merge failed; fix conflicts and then commit the result.
```

打开 `f.txt`：

```text
<<<<<<< HEAD
你的版本
=======
对方的版本
>>>>>>> feature
```

### 解决三步

1. 打开文件，删掉 `<<<<<<<`、`=======`、`>>>>>>>` 三行标记，只留你想要的内容；
2. `git add f.txt`（关键：标记"已解决"）；
3. `git commit -m "merge: 解决冲突"`。

### 不想合并了就中止

```bash
git merge --abort
```

→ 深入：`docs/git/04-冲突.md`

---

## 4. 撤销与回退（20 分钟）

### 按"改到哪一层"选工具

```text
工作区改了没 add      → git restore <file>
add 了没 commit       → git restore --staged <file>   （取消 add，保留改动）
commit 了没 push      → git reset
已经 push 了          → git revert
```

### reset 三兄弟

```bash
git reset --soft  HEAD~1    # 只挪指针，改动还在暂存区
git reset --mixed HEAD~1    # 挪指针 + 清暂存区（默认）
git reset --hard  HEAD~1    # 连工作区一起砸（最危险！）
```

### revert（安全）

```bash
git revert <commit>     # 新增一个"反向提交"，不改历史
```

### 救命稻草 reflog

```bash
git reflog              # 看 HEAD 每次移动的记录
git reset --hard <hash> # 找回"丢了"的提交
```

→ 深入：`docs/git/05-撤销与回退.md`

---

## 5. 远程协作（20 分钟）

### 关联远程 + 推送

```bash
git remote add origin https://github.com/你/项目.git
git push -u origin main    # -u 建立跟踪，之后 git push 即可
```

`origin` 只是"那个 URL"的别名。

### fetch / pull / push

```bash
git fetch origin     # 只下载，更新 origin/master 影子
git pull origin main # fetch + merge，下载并合并
git push             # 上传本地提交
```

### push 被拒了

```text
! [rejected] master -> master (fetch first)
```

意思是"远程有你没有的提交"。正确做法：

```bash
git pull origin main   # 先合并远程改动
git push               # 再推
```

**别用 `--force`**——它会覆盖同事的提交。

→ 深入：`docs/git/06-远程协作.md`

---

## 6. rebase 与工程化速览（15 分钟）

### rebase vs merge

```text
merge   → 保留分叉，历史真实但乱，适合公共分支
rebase  → 历史变直线，但会重写 commit，只适合未推送的私有分支
```

```bash
git switch feature
git rebase main        # 把 feature 提交重放到 main 顶端
git switch main
git merge feature      # 此时是快进，历史直线
```

**黄金法则：绝不 rebase 公共分支。**

### 工程化四件套

```bash
# .gitignore：忽略垃圾文件
echo "node_modules/" > .gitignore

# stash：藏起未提交改动
git stash
git stash pop

# tag：打版本标签
git tag -a v1.0.0 -m "首个版本"
git push origin v1.0.0

# cherry-pick：摘一个提交
git cherry-pick <commit>
```

→ 深入：`docs/git/07-rebase与历史整理.md`、`docs/git/08-工程化.md`

---

## 7. 十二个必踩的坑（10 分钟）

| # | 坑 | 正确做法 |
|---|---|---|
| 1 | 改了文件忘 add 就 commit | 先 `git add` 再 `git commit` |
| 2 | `git branch x` 以为会切过去 | 用 `git switch -c x` |
| 3 | 解决冲突忘了删标记线 | 连 `<<<<<<<`/`=======`/`>>>>>>>` 一起删 |
| 4 | 解决完不 add 就 commit | 解决后必须 `git add` |
| 5 | 对已推送的提交用 reset | 用 `git revert` |
| 6 | push 被拒就用 --force | 先 pull 再 push |
| 7 | `restore` 想取消 add 却丢了改动 | 取消 add 用 `restore --staged` |
| 8 | rebase 公共分支 | 只 rebase 未推送的私有分支 |
| 9 | 已跟踪文件加 .gitignore 没用 | 先 `git rm --cached <file>` |
| 10 | 标签没推远程 | `git push origin --tags` |
| 11 | 在非仓库目录跑 git | 先 `git init` 或 cd 进仓库 |
| 12 | pull 时分叉报错 | `git config pull.rebase false` |

---

## 8. 一页速查表（5 分钟）

| 场景 | 命令 |
|---|---|
| 看状态 | `git status -s` |
| 暂存全部 | `git add -A` |
| 提交 | `git commit -m "feat: 说明"` |
| 看历史 | `git log --oneline --graph --all` |
| 建+切分支 | `git switch -c feature` |
| 合并 | `git merge feature` |
| 中止合并 | `git merge --abort` |
| 丢工作区改动 | `git restore <file>` |
| 取消 add | `git restore --staged <file>` |
| 回退 | `git reset --soft/--mixed/--hard HEAD~1` |
| 安全撤销 | `git revert <commit>` |
| 找回提交 | `git reflog` |
| 藏改动 | `git stash` / `git stash pop` |
| 打标签 | `git tag -a v1.0.0 -m "说明"` |
| 加远程 | `git remote add origin <url>` |
| 推/拉 | `git push` / `git pull` |
| 摘提交 | `git cherry-pick <commit>` |

---

## 9. 自测 20 题（10 分钟）

判断对错，答完看最下方答案。

1. `git commit` 会把工作区所有改动一起提交。
2. 暂存区就是 `.git/index` 文件。
3. 分支是一份独立的代码拷贝。
4. commit 对象里存着这次提交的 diff。
5. 快进合并会生成一个新的 merge commit。
6. 冲突时 Git 会丢弃其中一方的改动。
7. `git reset --hard` 会抹掉未提交的改动。
8. `git revert` 会改写历史。
9. `git reflog` 记录的是 HEAD 的移动轨迹。
10. `origin` 是 Git 的特殊关键字，不能改名。
11. `git fetch` 会合并远程改动到本地。
12. `origin/master` 是远程 master 的本地快照。
13. rebase 会重写 commit（哈希变）。
14. 可以 rebase 已推送的公共分支。
15. `.gitignore` 对已跟踪文件也生效。
16. `git stash pop` 之后 stash 列表里就没有这一条了。
17. `git cherry-pick` 会复制整条分支。
18. push 被拒是因为你的提交内容有问题。
19. `git restore --staged` 会删除文件内容。
20. 标签会随 commit 自动往前移动。

<details><summary>参考答案</summary>

1 错 2 对 3 错 4 错 5 错 6 错 7 对 8 错 9 对 10 错 11 错 12 对 13 对 14 错 15 错 16 对 17 错 18 错 19 错 20 错

错 3 题以上，回看对应小节；错 5 题以上，去读完整版。

</details>

---

## 下一步

- 想搞懂"为什么"：从 [`docs/git/00-设计哲学.md`](docs/git/00-设计哲学.md) 开始读完整版。
- 想动手验证：跑一遍示例，`node examples/git/01-数据模型.mjs` 开始。
- 想去面试：直接看 [`docs/git/11-面试速查表.md`](docs/git/11-面试速查表.md)。
- 想自测水平：做 [`docs/git/10-测试题与答案.md`](docs/git/10-测试题与答案.md) 的五关。

> 一句话记住它：**Git 不是网盘，是"内容寻址的对象数据库"；未推送随便改，已推送用 revert。**
