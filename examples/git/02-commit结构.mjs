// 对应章节：02；运行：node examples/git/02-commit结构.mjs
//
// 第 02 章 · commit 与日志：一次提交到底记录了哪些东西。
//   1. commit 对象有五个字段：tree / parent / author / committer / 说明
//   2. parent 把 commit 串成一条"链表"——这就是历史
//   3. git log / git show / git diff 是读这条链表的三个视角
//
// 本文件用真实 git 命令建一个临时仓库来演示（若装了 git，退出码仍为 0）。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const line = (t) => console.log('\n--- ' + t + ' ---');

function hasGit() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!hasGit()) {
  console.log('本机未检测到 git，跳过演示。安装 git 后再跑一次即可看到完整输出。');
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'git-commit-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'commit.gpgsign', 'false']); // 关掉签名，避免输出里的干扰

  line('1. 建三个 commit，组成一条历史');
  writeFileSync(join(dir, 'README.md'), '# demo\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'docs: 初始化 README']);

  appendFileSync(join(dir, 'README.md'), '\n## 用法\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'docs: 补一节用法']);

  writeFileSync(join(dir, 'app.js'), "console.log('hi');\n", 'utf8');
  git(['add', 'app.js']);
  git(['commit', '-q', '-m', 'feat: 新增 app.js 入口']);

  console.log('git log --oneline（从新到旧）：');
  console.log(git(['log', '--oneline']));

  line('2. 拆开一个 commit 看字段（git cat-file -p HEAD）');
  console.log('HEAD 指向的最新 commit 内部：');
  console.log(git(['cat-file', '-p', 'HEAD']));
  console.log('（tree = 指向快照的目录树；parent = 指向父 commit，串成链表）');

  line('3. parent 字段就是"链表指针"');
  const parents = git(['log', '--pretty=format:%h %s', '--all']);
  console.log('提交历史（%h = 短哈希，%s = 标题）：');
  console.log(parents);
  console.log('读法：每个 commit 的 parent 指向它前面那一个，像单向链表一样串起来。');

  line('4. git show：看某一次提交改了啥');
  console.log('git show --stat HEAD（只看改了哪些文件、几行）：');
  console.log(git(['show', '--stat', '--oneline', 'HEAD']));

  line('5. git diff：看"还没提交"的改动');
  appendFileSync(join(dir, 'app.js'), "console.log('bye');\n", 'utf8');
  console.log('改了一行还没 add，git diff 输出（diff --git 那段）：');
  console.log(git(['diff', '--', 'app.js']));

  line('6. 三种"比较"的区别');
  console.log('git diff           → 工作区 vs 暂存区（还没 add 的改动）');
  console.log('git diff --staged  → 暂存区 vs 最新 commit（add 了还没 commit 的）');
  console.log('git diff HEAD      → 工作区 vs 最新 commit（两者加起来）');

  console.log('\n（演示结束，临时仓库已清理）');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
