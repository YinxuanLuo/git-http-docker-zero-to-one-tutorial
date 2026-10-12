// 对应章节：07；运行：node examples/git/07-rebase.mjs
//
// 第 07 章 · rebase 与历史整理：rebase vs merge、cherry-pick、改历史的风险。
//   1. rebase 把分支的提交"搬到"目标分支之后，历史变成一条直线
//   2. rebase 会重写提交（哈希变了），所以不能对已推送的分支乱用
//   3. cherry-pick 只挑某一个 commit 复制到当前分支
//
// 本文件用真实 git 命令（若装了 git）。

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

const dir = mkdtempSync(join(tmpdir(), 'git-rebase-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  line('1. 制造一个分叉');
  writeFileSync(join(dir, 'f.txt'), '1\n', 'utf8');
  git(['add', 'f.txt']);
  git(['commit', '-q', '-m', 'C1 基础']);

  git(['checkout', '-q', '-b', 'feature']);
  appendFileSync(join(dir, 'f.txt'), 'feature 第一笔\n', 'utf8');
  git(['add', 'f.txt']);
  git(['commit', '-q', '-m', 'C2 feature 功能 A']);
  appendFileSync(join(dir, 'f.txt'), 'feature 第二笔\n', 'utf8');
  git(['add', 'f.txt']);
  git(['commit', '-q', '-m', 'C3 feature 功能 B']);

  git(['checkout', '-q', 'master']);
  // master 改的是"另一个文件"，这样 rebase 时和 feature 的 f.txt 不冲突
  writeFileSync(join(dir, 'g.txt'), 'master 的新文件\n', 'utf8');
  git(['add', 'g.txt']);
  git(['commit', '-q', '-m', 'C4 master 修复 bug']);

  console.log('分叉后的历史：');
  console.log(git(['log', '--oneline', '--all', '--graph']));
  console.log('rebase 前 feature 的两个 commit：');
  console.log(git(['log', '--oneline', 'feature', '-2']));

  line('2. 在 feature 上 rebase master');
  git(['checkout', '-q', 'feature']);
  const rebaseOut = git(['rebase', 'master']);
  console.log('git rebase master 输出：');
  console.log(rebaseOut);
  console.log('\nrebase 后的历史（一条直线，分叉消失了）：');
  console.log(git(['log', '--oneline', '--all', '--graph']));

  line('3. rebase 重写了提交：哈希变了');
  console.log('rebase 后 feature 上的两个 commit：');
  console.log(git(['log', '--oneline', 'feature', '-2']));
  console.log('（C2、C3 被"重放"成两个新 commit，内容一样但哈希不同——这就是"改写历史"）');

  line('4. 切回 master 快进合并（因为 feature 已经排到 master 前面）');
  git(['checkout', '-q', 'master']);
  console.log(git(['merge', 'feature']));
  console.log('合并后：');
  console.log(git(['log', '--oneline', '--graph']));

  line('5. cherry-pick：只挑一个 commit 复制过来');
  git(['checkout', '-q', '-b', 'hotfix', 'master~2']); // 回到更早的位置
  console.log('hotfix 从 master~2 出发，当前：', git(['log', '--oneline', '-1']));
  const pickMe = git(['rev-parse', '--short', 'master~1']);
  console.log('把 master~1（', pickMe, '）cherry-pick 过来：');
  console.log(git(['cherry-pick', 'master~1']));
  console.log('hotfix 现在：');
  console.log(git(['log', '--oneline', '--graph', '--all']));
  console.log('（cherry-pick 复制的是"那个改动"，不是整条分支）');

  line('小结');
  console.log('1) rebase 让历史变直线，但会重写 commit（哈希变），别对已推送的分支用。');
  console.log('2) merge 保留分叉和 merge commit，历史更真实但更绕。');
  console.log('3) cherry-pick 是"摘樱桃"：只挑一个 commit 的改动复制过来。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
