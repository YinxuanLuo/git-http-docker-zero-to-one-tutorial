# 第 07 章 · rebase 与历史整理

> 第 03 章讲了 merge，第 05 章讲了"改写历史有代价"。这一章把这两件事拧在一起：`rebase` 到底是干什么的、它和 merge 怎么选、以及为什么"改历史"在团队里是个敏感词。
>
> 读完本章，你要能回答三个问题：
> 1. `rebase` 和 `merge` 的根本区别是什么？什么场景该用哪个？
> 2. 交互式 rebase（`-i`）能帮你做哪几件事？
> 3. 为什么说"永远不要 rebase 一个已经推送到公共仓库的分支"？
>
> 本章你需要记住的就一件事：**merge 保留真实的分叉历史，rebase 把历史"捋直"但会重写 commit；rebase 只对自己、尚未推送的分支用，绝不 rebase 共享分支。**

---

## 07.1 两种"整合分支"的方式：merge vs rebase

### 先给结论

假设你在 `feature` 分支上开发，`main` 也在往前走。你想把 `main` 的最新改动"拿进来"，有两种方式：

| | `git merge` | `git rebase` |
|---|---|---|
| 历史形态 | 保留分叉，生成 merge commit | 把提交"搬到" main 之后，历史变直线 |
| 是否重写 commit | 否 | **是**（哈希会变） |
| 结果 | 真实、但可能乱 | 干净、但"编造"了时间线 |

用图对比最直观：

```text
merge：
  C1 ── C2 ── C4 ── M（merge commit，两个 parent）
        \        /
         └── C3 ─┘

rebase：
  C1 ── C2 ── C4 ── C3'（C3 被"重放"到 C4 之后，历史一条直线）
```

**同一个 C3，rebase 后变成了 C3'**——内容一样，但 parent 变了，所以哈希变了。

### 一句话说清本质区别

- **merge**：问"这两条线的**最新状态**合并起来是什么？"
- **rebase**：问"如果我从**头**开始，按新的顺序把 feature 的每个提交重做一遍，会得到什么？"

rebase 的英文直译就是"重新设定基底"——把 feature 的"基底"从 C2 换成 C4。

> 一句话记住它：merge 保留分叉，rebase 捋直历史；rebase 会重写 commit（哈希变），merge 不会。

---

## 07.2 rebase 到底做了什么

### 先给结论

`git rebase main` 做三件事：

1. 找到当前分支和 `main` 的**共同祖先**（分叉点）；
2. 把当前分支上"分叉之后的所有提交"**逐个摘下来**；
3. 把这些提交**依次重放到 `main` 的顶端**，形成一条直线。

### 亲手走一遍

```bash
# 准备分叉
git init && git config user.name t && git config user.email t@example.com
echo 1 > f.txt && git add . && git commit -m C1
git switch -c feature
echo 2 >> f.txt && git add . && git commit -m "C2 feature 功能 A"
echo 3 >> f.txt && git add . && git commit -m "C3 feature 功能 B"
git switch master
echo master > g.txt && git add . && git commit -m "C4 master 修复"

git switch feature
git rebase master
```

```text
Rebasing (1/2)
Rebasing (2/2)
Successfully rebased and updated refs/heads/feature.
```

rebase 前的历史：

```text
* 2ede027 C4 master 修复 bug
| * 200a128 C3 feature 功能 B
| * e5c29de C2 feature 功能 A
|/
* 900d709 C1 基础
```

rebase 后的历史：

```text
* 0d33391 C3 feature 功能 B
* d136882 C2 feature 功能 A
* 2ede027 C4 master 修复 bug
* 900d709 C1 基础
```

**对比看：`C2` 和 `C3` 的哈希变了（`e5c29de` → `d136882`），因为它们被重放到了 C4 之后。** 这就是"改写历史"的物理表现。

### rebase 之后怎么合回 master

rebase 完成后，`feature` 已经排在 `master` 前面了。此时切回 master 合并，会是**快进合并**：

```bash
git switch master
git merge feature
```

```text
Updating 2ede027..0d33391
Fast-forward
```

历史最终是一条直线，干干净净，没有任何 merge commit。

> 一句话记住它：rebase 把"分叉后的提交"逐个重放到目标分支顶端；重放导致哈希变，历史变直线。

---

## 07.3 rebase 的黄金法则：别 rebase 共享分支

### 先给结论

**永远不要 rebase 一个已经 `push` 到公共仓库、别人可能基于它工作的分支。**

### 为什么

因为 rebase 会**改写历史**（重写 commit 哈希）。一旦你 rebase 了一个已推送的分支，你的本地历史和远程历史就"对不上了"。你要同步，只能 `push --force` 强行覆盖远程——这时：

- 已经 `pull` 过你旧历史的人，他们的本地有了"一套你已经重写过的旧 commit"；
- 他们下一次 `pull`，会和你的新历史产生混乱、冲突，甚至需要手动修复。

**rebase 的核心禁忌就一句话：你改写的，只能是"只有你自己知道、还没共享出去"的历史。**

### 什么时候可以 rebase

| 场景 | 可以 rebase 吗 | 理由 |
|---|---|---|
| 本地 feature 分支，没 push 过 | ✅ 可以 | 历史只有你自己有，随便重写 |
| feature 分支 push 了，但**只有你一个人用** | ⚠️ 勉强可以 | 但别人 pull 过就完蛋，慎用 |
| main 这种公共分支 | ❌ 绝对不行 | 共享分支，重写会坑到所有人 |

**团队里最常见的规范是：功能分支自己 rebase，公共分支只用 merge。**

### 一个真实的报错：rebase 时冲突

rebase 重放提交时，如果某个提交和新的基底冲突，rebase 会停下来：

```text
error: could not apply d08d899... C2 feature 功能 A
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
hint: You can instead skip this commit: run "git rebase --skip".
hint: To abort and get back to the state before "git rebase", run "git rebase --abort".
```

**触发条件**：重放某个提交时，它改的内容和基底上的内容重叠。三个选项：

- `git rebase --continue`：解决冲突后继续（先 `git add` 标记解决）；
- `git rebase --skip`：跳过这个提交；
- `git rebase --abort`：放弃整个 rebase，回到 rebase 前。

**注意**：rebase 冲突时，`--ours` / `--theirs` 的含义和 merge 是**反的**（第 04 章提过）——因为 rebase 过程中"当前分支"被临时倒转了。

> 一句话记住它：rebase 只对"未共享"的分支用，绝不 rebase 公共分支；rebase 冲突用 `--continue` / `--skip` / `--abort` 处理。

---

## 07.4 交互式 rebase：`-i` 整理自己的提交

### 先给结论

`git rebase -i`（interactive，交互式）让你在**重放历史之前，先编辑"重放清单"**。你能做四件事：合并提交（squash）、改提交说明（reword）、删提交（drop）、调顺序（reorder）。

这是"整理历史"的利器——但**同样只能对未推送的本地提交用**。

### 一个典型场景

你开发时提交了一堆 `wip`、`fix typo` 之类的碎提交，想在合并前把它们**压成一个干净的提交**。

```bash
git rebase -i HEAD~3
```

会打开一个编辑器，列出最近 3 个提交：

```text
pick d08d899 功能 A
pick f5fc4f4 功能 B
pick 2d19bbb 修个 typo

# Rebase 900d709..2d19bbb onto 900d709 (3 commands)
# ...
# p, pick = 保留这个提交
# s, squash = 把这个提交合并进上一个
# r, reword = 保留但改说明
# d, drop = 删除这个提交
```

把最后两行改成 `squash`（缩写 `s`）：

```text
pick d08d899 功能 A
squash f5fc4f4 功能 B
squash 2d19bbb 修个 typo
```

保存退出后，Git 会把三个提交压成一个，并让你写一条合并后的新说明。

### 四个命令的速查

| 命令 | 缩写 | 作用 |
|---|---|---|
| `pick` | `p` | 保留这个提交（默认） |
| `squash` | `s` | 合并进上一个提交，保留说明 |
| `reword` | `r` | 保留提交，但改说明 |
| `drop` | `d` | 删除这个提交 |

**注意**：交互式 rebase 打开的也是 vim。不会用的话，第 01 章讲过：按 `i` 编辑，`Esc` 退出编辑，`:wq` 保存退出。

### 为什么编辑器里是"倒序"

清单里**最上面是最老的提交**（因为 rebase 按时间顺序重放）。别搞反——想 squash 掉"最新的几个"，改的是**清单靠下**的那几行。

> 一句话记住它：`rebase -i HEAD~N` 打开"重放清单"，`squash` 合并提交、`reword` 改说明、`drop` 删提交；同样只能对未推送的提交用。

---

## 07.5 `cherry-pick`：摘一个樱桃

### 先给结论

**`git cherry-pick` 把"某一个提交的改动"复制到当前分支**——不整条分支搬，只挑一个提交。

```bash
git cherry-pick <commit-hash>
```

它生成一个**新的提交**，内容是那个 commit 的改动，但 parent 是"当前分支的顶端"。

### 什么时候用

1. **只想把某个 fix 挪到别的分支**：比如 main 上有个紧急 bug 修复，你想把它也应用到 release 分支，不用 merge 整条 main。
2. **从别人的分支挑一个提交**：你想用同事 feature 分支上的某个小工具函数，只挑那个 commit。

### 亲手走一遍

```bash
# 假设 main 上有三个提交，你想把中间那个摘到新分支
git switch -c hotfix main~2
git cherry-pick main~1
```

```text
[hotfix 086707f] C2 feature 功能 A
 Date: Mon Oct 12 23:04:33 2026 +0800
 1 file changed, 1 insertion(+)
```

**注意输出里的 `Date` 和原提交一致**——cherry-pick 保留了原提交的 author 和日期（这正是第 02 章说的"author ≠ committer"的典型场景：author 是原作者，committer 是你）。

### cherry-pick 和 merge 的区别

| | `git cherry-pick` | `git merge` |
|---|---|---|
| 复制什么 | **一个**提交的改动 | **整条**分支的所有提交 |
| 生成什么 | 一个新提交（一个 parent） | 快进 或 merge commit |
| 用途 | 挑单个改动 | 整合整条分支 |

> 一句话记住它：cherry-pick 摘单个提交的改动到当前分支，生成新提交但保留原 author；merge 是整合整条分支。

---

## 07.6 `rebase --onto`：给提交换一个基底

### 先给结论

普通的 `git rebase main` 把"当前分支分叉后的提交"重放到 main 顶端。而 `rebase --onto` 更灵活：**你可以指定"把哪一段提交，重放到哪个基底上"。**

语法：

```bash
git rebase --onto <新基底> <旧基底> <分支>
```

含义：把 `<旧基底>..<分支>` 之间的提交，重放到 `<新基底>` 之上。

### 一个真实场景

场景：你的 `feature` 是从 `develop` 拉出来的，但后来发现应该基于 `main` 开发。

```text
main    A ── B ── C
develop      └─ D ── E ── F ── G
                          └─ H ── I   （feature，从 G 拉的）
```

你想把 feature 的 H、I 两个提交，从"基于 G"换成"基于 main 的 C"：

```bash
git rebase --onto main G feature
```

结果：

```text
main    A ── B ── C ── H' ── I'   （feature）
develop      └─ D ── E ── F ── G
```

H、I 被搬到了 C 之后，脱离了对 G 的依赖。**这就是"给提交换基底"。**

### 什么时候用

1. 分支拉错了基底（如上例）；
2. 想把某段提交从一个分支挪到另一个分支。

`--onto` 是 rebase 的高级用法，日常用得少，但遇到"分支拉错了地方"时，它是最干净的解法（比手动 cherry-pick 快）。

> 一句话记住它：`rebase --onto 新基底 旧基底 分支` 把一段提交搬到新基底上，专治"分支拉错了地方"。

---

## 07.7 rebase vs merge：一张决策树

### 先给结论

"用 rebase 还是 merge"没有标准答案，只有**适合不适合**。按下面这张决策树选：

```text
这个分支已经 push 到公共仓库了吗？
├─ 是 → 用 merge（rebase 会改写共享历史，坑同事）
└─ 否 → 继续问：
     你要的是"真实的历史"还是"干净的历史"？
     ├─ 真实（保留分叉和 merge commit）→ merge
     └─ 干净（一条直线）→ rebase
```

### 更具体的团队实践

| 团队风格 | 做法 | 历史效果 |
|---|---|---|
| 重"真实可审计" | 公共分支 merge，保留 merge commit | 分叉清晰，谁合了什么一目了然 |
| 重"整洁线性" | 功能分支先 rebase 再 merge，公共分支快进 | 历史一条直线，干净 |
| 混合 | 功能分支自己 rebase 整理，合入时用 `--no-ff` | 两者兼顾 |

### 一句话的取舍本质

**merge 保真（历史就是实际发生的顺序），rebase 求净（历史是"如果重来会怎样"）。**

- 需要审计、协作人数多 → 偏 merge；
- 个人项目、想历史好看 → 偏 rebase；
- 公共分支 → 永远 merge。

> 一句话记住它：公共分支永远 merge；私有分支看你要"真实"还是"干净"——要审计用 merge，要整洁用 rebase。

---

## 07.8 cherry-pick 的三个实战场景

### 先给结论

第 07.5 节讲了 cherry-pick 是什么。这一节给三个**真实会用到的场景**，让你知道它什么时候派上用场。

### 场景一：把某个 bug 修复同步到发布分支

```text
main 分支上发现并修复了一个 bug（commit F），但这个 fix 也应该进到正在维护的 release 分支。
```

```bash
git switch release
git cherry-pick F
```

不用 merge 整条 main（那会把 main 上别的未完成功能也带过来），只挑那个 fix。

### 场景二：从别人的分支挑一个工具函数

同事在 `feature/xxx` 上写了个好用的 `formatDate` 函数，你想拿过来用，但不想合并他整条分支。

```bash
git cherry-pick <那个函数的 commit>
```

### 场景三：救回"游离"的提交

你在 detached HEAD 状态下提交了几个 commit（第 03.8 节），切回分支后发现它们"悬空"了。用 cherry-pick 把它们搬回分支：

```bash
git switch -c recover HEAD        # 先给游离提交一个分支名
git switch main
git cherry-pick <那几个提交的哈希>
```

### cherry-pick 冲突怎么办

cherry-pick 一个提交时，如果它改的内容和当前分支冲突，会停下来：

```text
error: could not apply <哈希>... <说明>
hint: after resolving the conflicts, mark the corrected paths
hint: with 'git add <paths>' or 'git rm <paths>'
```

解决方式和 merge 冲突一样：手动改 → `git add` → 然后 `git cherry-pick --continue`（或 `--abort` 放弃）。

> 一句话记住它：cherry-pick 用于"只搬一个提交"的场景——同步 fix 到发布分支、借别人的工具函数、救回游离提交。

---

## 07.9 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| rebase 已推送的分支 | 同事仓库混乱 | 改写了共享历史 | 只 rebase 未推送的本地分支 |
| rebase 冲突后卡住 | 不知道下一步 | 不会用 --continue | 解决 → add → `git rebase --continue` |
| rebase 中误用 --ours | 选了错的一边 | rebase 中 ours/theirs 反了 | 记住 rebase 里 ours 指"基底"，theirs 指"被重放的" |
| 交互式 rebase 搞反顺序 | squash 错了提交 | 清单是倒序（最老在上） | 最上面最老，squash 写在下方的行 |
| 想整理历史却已经 push | 只能 --force 强推 | 已经共享了 | 下次记得"先整理再 push" |
| 把 cherry-pick 当 merge | 只复制了一个提交 | 两者语义不同 | 挑单个改动用 cherry-pick，整条分支用 merge |
| 想改提交说明却重新提交 | 多了一个提交 | 不会用 reword | `rebase -i` 里用 `r`（reword） |
| 以为 rebase 不改哈希 | 判断错误 | rebase 必然重写 commit | 记住 rebase 后哈希必变 |

---

## 07.10 本章小结

**merge vs rebase**

- merge 保留分叉、生成 merge commit、不改历史。
- rebase 把提交重放到目标顶端、历史变直线、**重写 commit（哈希变）**。

**rebase 的黄金法则**

- 只 rebase 未推送的本地分支；绝不 rebase 公共分支。
- rebase 冲突用 `--continue` / `--skip` / `--abort`。

**交互式 rebase**

- `rebase -i HEAD~N` 编辑重放清单：`pick`/`squash`/`reword`/`drop`。
- 清单最上面是最老的提交。

**cherry-pick**

- 摘单个提交的改动到当前分支，生成新提交但保留原 author。

---

## 07.11 动手练习

### 练习 1：说清 merge 和 rebase

用一段话 + 一张小图，说清 merge 和 rebase 在"历史形态"和"是否改写"上的区别。

<details><summary>参考答案</summary>

```text
merge：  A ── B ── M（分叉 + 合并）
              \  /
               C

rebase： A ── B ── C'（一条直线，C 被重写为 C'）
```

merge 保留真实分叉，生成 merge commit，不改历史；rebase 把 C 重放到 B 之后变成 C'，历史变直线，但 C 的哈希变了（改写历史）。

</details>

### 练习 2：能不能 rebase

判断下面哪些情况可以 rebase，哪些不行：

1. 本地 feature 分支，从没 push 过。
2. main 分支，团队共有。
3. 自己 push 过、但没人基于它工作的 feature 分支。

<details><summary>参考答案</summary>

1. **可以。** 历史只有你自己有，随便重写。
2. **不行。** 公共分支，rebase 会坑到所有人。
3. **勉强可以，但不推荐。** 虽然现在没人基于它工作，但"别人 pull 过"这件事你无法保证，风险高。

黄金法则：只 rebase 未推送的、完全私有的分支。

</details>

### 练习 3：交互式 rebase 怎么用

你有三个提交：`A（功能）`、`B（修 typo）`、`C（补注释）`，想把 B、C 压进 A。写出 `rebase -i` 的清单怎么改。

<details><summary>参考答案</summary>

```bash
git rebase -i HEAD~3
```

清单（注意最上面最老）：

```text
pick A 功能
pick B 修 typo
pick C 补注释
```

改成：

```text
pick A 功能
squash B 修 typo
squash C 补注释
```

保存退出后，三个提交压成一个，再写一条新说明。

</details>

### 练习 4：判断对错

1. rebase 之后，被重放的提交哈希保持不变。
2. `cherry-pick` 会复制整条分支。
3. 交互式 rebase 的清单里，最上面是最新的提交。
4. rebase 冲突时，可以用 `git rebase --abort` 放弃。
5. 对公共分支，应该用 merge 而不是 rebase。

<details><summary>参考答案</summary>

1. **错。** rebase 必然重写提交，哈希会变。
2. **错。** cherry-pick 只挑一个提交的改动，merge 才是整条分支。
3. **错。** 清单最上面是最老的提交（按重放顺序排列）。
4. **对。** `--abort` 放弃整个 rebase，回到 rebase 前。
5. **对。** 公共分支用 merge 保留真实历史，rebase 只用于私有分支。

</details>

---

> **本章的代码示例**：`examples/git/07-rebase.mjs`（`node examples/git/07-rebase.mjs`，实测退出码 0）
> 它现场演示 rebase 让历史变直线、哈希重写、以及 cherry-pick 摘单个提交。
>
> **下一章**：工程化——`.gitignore` 规则、Git Hooks、`stash`、`tag`，以及子模块和大文件。
