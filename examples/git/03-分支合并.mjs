// 对应章节：03；运行：node examples/git/03-分支合并.mjs
//
// 第 03 章 · 分支与合并：分支是一张写着 commit 哈希的小纸条。
//   1. HEAD 是"你站在哪"的指针；分支是"指向某个 commit"的指针
//   2. 快进合并（fast-forward）：目标分支没动，直接往前挪
//   3. 三方合并（3-way merge）：两边都动了，Git 自己合成一个 merge commit
//
// 本文件用真实 git 命令 + 直接读 .git 里的文件来演示（若装了 git）。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, rmSync } from 'node:fs';
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

const dir = mkdtempSync(join(tmpdir(), 'git-branch-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  line('1. 分支就是 .git/refs/heads/ 下的一个小文件');
  writeFileSync(join(dir, 'a.txt'), 'v1\n', 'utf8');
  git(['add', 'a.txt']);
  git(['commit', '-q', '-m', 'C1']);
  const c1 = git(['rev-parse', 'HEAD']);
  console.log('提交 C1 后，.git/refs/heads/master 内容 =', readFileSync(join(dir, '.git/refs/heads/master'), 'utf8').trim());
  console.log('HEAD 内容 =', readFileSync(join(dir, '.git/HEAD'), 'utf8').trim());
  console.log('（HEAD 存的是"我指向哪个分支"，分支文件存的是"那个 commit 的哈希"）');

  line('2. 建一个 feature 分支并提交');
  git(['checkout', '-q', '-b', 'feature']);
  appendFileSync(join(dir, 'a.txt'), 'v2\n', 'utf8');
  git(['add', 'a.txt']);
  git(['commit', '-q', '-m', 'C2 (on feature)']);
  console.log('现在两个分支：');
  console.log(git(['log', '--oneline', '--all', '--graph']));
  console.log('feature 指向', git(['rev-parse', 'feature']));
  console.log('master  指向', git(['rev-parse', 'master']));

  line('3. 快进合并：master 没动，直接往前挪');
  git(['checkout', '-q', 'master']);
  const merge1 = git(['merge', 'feature']);
  console.log('git merge feature 输出：');
  console.log(merge1);
  console.log('（"Fast-forward" 说明 master 只是把指针挪到 feature 的位置，没有新 commit）');
  console.log('合并后 master 指向 =', git(['rev-parse', 'master']), '（和 feature 一样）');

  line('4. 三方合并：两边各自都往前走了');
  // 回到分叉：master 和 feature 各自再提交一个
  git(['checkout', '-q', '-b', 'feat2']);
  writeFileSync(join(dir, 'b.txt'), 'feat2 的文件\n', 'utf8');
  git(['add', 'b.txt']);
  git(['commit', '-q', '-m', 'C3 (on feat2)']);
  git(['checkout', '-q', 'master']);
  writeFileSync(join(dir, 'c.txt'), 'master 的文件\n', 'utf8');
  git(['add', 'c.txt']);
  git(['commit', '-q', '-m', 'C4 (on master)']);

  console.log('合并前历史（分叉了）：');
  console.log(git(['log', '--oneline', '--all', '--graph']));

  const merge2 = git(['merge', 'feat2', '-m', 'merge feat2 into master']);
  console.log('git merge feat2 输出：');
  console.log(merge2);
  console.log('（这次不是 Fast-forward，Git 造了一个新 commit，有两个 parent）');
  const mergeCommit = git(['rev-parse', 'HEAD']);
  console.log('merge commit 的两个 parent：');
  console.log(git(['log', '--pretty=format:%h', '-1', mergeCommit]));
  console.log(git(['show', '-s', '--pretty=format:%P', mergeCommit]), '← parent1 parent2');

  line('5. 小结');
  console.log('1) 分支 = .git/refs/heads/<名字> 里的一行哈希，创建成本几乎为零。');
  console.log('2) HEAD = "我现在站在哪"，通常是"某个分支"（也可以直接指向某个 commit）。');
  console.log('3) 快进合并：一方没动，指针平移；三方合并：两边都动，Git 合成 merge commit。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
