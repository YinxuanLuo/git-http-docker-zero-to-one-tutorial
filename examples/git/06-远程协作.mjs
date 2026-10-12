// 对应章节：06；运行：node examples/git/06-远程协作.mjs
//
// 第 06 章 · 远程协作：origin 是什么、push/pull/fetch 的区别。
//   1. origin 只是"那个远程仓库的 URL"起的一个名字（默认第一个远程）
//   2. push = 把本地提交推上去；fetch = 只下载不合并；pull = fetch + merge
//   3. 远程分支 origin/master 是"你上次看到的远程的样子"
//
// 本文件用"本地裸仓库"模拟一个远程（git init --bare），无需联网。
// 装了 git 就能跑。

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

const base = mkdtempSync(join(tmpdir(), 'git-remote-'));
const remote = join(base, 'remote.git');
const A = join(base, 'A');
const B = join(base, 'B');
const at = (cwd) => (args, opts = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', ...opts }).trimEnd();
const raw = (cwd) => (args, opts = {}) => {
  try {
    return { ok: true, out: at(cwd)(args, opts) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').toString() + (e.stderr || '').toString() };
  }
};

try {
  line('1. 建一个裸仓库当"远程"');
  execFileSync('git', ['init', '--bare', '-q', remote], { encoding: 'utf8' });
  console.log('裸仓库没有工作区，只有 .git 里的东西：remote.git/');

  line('2. 仓库 A：提交，添加 origin，push');
  execFileSync('git', ['init', '-q', A], { encoding: 'utf8' });
  const gA = at(A);
  gA(['config', 'user.email', 't@example.com']);
  gA(['config', 'user.name', 'Tutor']);
  gA(['config', 'core.autocrlf', 'false']);
  writeFileSync(join(A, 'hello.txt'), '来自 A\n', 'utf8');
  gA(['add', 'hello.txt']);
  gA(['commit', '-q', '-m', 'A: 第一次提交']);
  gA(['remote', 'add', 'origin', remote]);
  console.log('git remote -v：');
  console.log(gA(['remote', '-v']));
  console.log('git push -u origin master：');
  console.log(gA(['push', '-u', 'origin', 'master']));

  line('3. 仓库 B：clone 下来，看到远程分支 origin/master');
  execFileSync('git', ['clone', '-q', remote, B], { encoding: 'utf8' });
  const gB = at(B);
  gB(['config', 'user.email', 't@example.com']);
  gB(['config', 'user.name', 'Tutor']);
  gB(['config', 'core.autocrlf', 'false']);
  console.log('B 里的分支（-a 含远程）：');
  console.log(gB(['branch', '-a']));
  console.log('（origin/master 是"远程仓库 master 的本地快照"，不是你可以直接 checkout 改的分支）');

  line('4. B 提交并 push，然后 A 想 push 会失败');
  appendFileSync(join(B, 'hello.txt'), 'B 加了一行\n', 'utf8');
  gB(['add', 'hello.txt']);
  gB(['commit', '-q', '-m', 'B: 加一行']);
  console.log('B push：');
  console.log(gB(['push']));

  // A 新建一个"不同"的文件，这样 pull 时能和 B 的改动自动三方合并（不冲突）
  writeFileSync(join(A, 'a.txt'), 'A 的新文件\n', 'utf8');
  gA(['add', 'a.txt']);
  gA(['commit', '-q', '-m', 'A: 新增 a.txt']);
  const r = raw(A)(['push']);
  console.log('A push 结果（ok =', r.ok, '）：');
  console.log(r.out.split('\n').filter((l) => l.startsWith('!') || l.includes('fetch') || l.includes('rejected')).join('\n'));
  console.log('（"rejected" = 远程领先于本地，Git 拒绝让历史分叉）');

  line('5. A：先 fetch 看看，再 pull 合并');
  console.log('git fetch origin：');
  console.log(gA(['fetch', 'origin']));
  console.log('fetch 后 A 的分支：');
  console.log(gA(['branch', '-a']));
  // 分叉时 git pull 需要知道怎么合并：这里明确指定用 merge 策略
  gA(['config', 'pull.rebase', 'false']);
  console.log('git pull（= fetch + merge）：');
  console.log(gA(['pull', 'origin', 'master']));
  console.log('合并后 A 的历史：');
  console.log(gA(['log', '--oneline', '--graph']));

  line('6. 三个命令一句话');
  console.log('git push  = 把本地提交推到远程');
  console.log('git fetch = 只下载远程最新，不动你的工作区');
  console.log('git pull  = fetch + merge（下载并合并）');

  line('小结');
  console.log('1) origin 是 remote add 时给远程 URL 起的名字，可以叫别的，只是大家习惯叫 origin。');
  console.log('2) origin/master 是远程分支的本地副本，push/fetch 时更新。');
  console.log('3) push 被 rejected，是因为远程有你没有的提交——先 fetch/pull 再 push。');
} finally {
  rmSync(base, { recursive: true, force: true });
}
