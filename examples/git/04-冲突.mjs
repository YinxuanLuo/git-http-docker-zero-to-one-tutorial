// 对应章节：04；运行：node examples/git/04-冲突.mjs
//
// 第 04 章 · 冲突：真的去制造一次 CONFLICT (content)，再亲手解决它。
//   1. 冲突的报错原文与触发条件
//   2. 冲突标记 <<<<<<< / ======= / >>>>>>> 长什么样
//   3. 三种解法：手动编辑、--abort 中止、--ours/--theirs
//
// 本文件用真实 git 命令（若装了 git）。每一步都打印真实输出。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
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

const dir = mkdtempSync(join(tmpdir(), 'git-conflict-'));
// 有些命令会非 0 退出（比如 merge 冲突），所以这里不直接抛错
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();
const gitRaw = (args, opts = {}) => {
  try {
    return { ok: true, out: git(args, opts) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').toString() + (e.stderr || '').toString() };
  }
};

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  line('1. 准备一个分叉：两边改同一行');
  writeFileSync(join(dir, 'README.md'), '版本号：1\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'base']);

  git(['checkout', '-q', '-b', 'feature']);
  writeFileSync(join(dir, 'README.md'), '版本号：feature 改的\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'feature 改成 2']);

  git(['checkout', '-q', 'master']);
  writeFileSync(join(dir, 'README.md'), '版本号：master 改的\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'master 改成 3']);

  line('2. merge 触发冲突：报错原文');
  const r = gitRaw(['merge', 'feature']);
  console.log('（exit ok =', r.ok, '，冲突时 git merge 会以非 0 退出）');
  console.log(r.out.split('\n').filter((l) => l.includes('CONFLICT') || l.includes('Automatic merge') || l.includes('failed')).join('\n'));

  line('3. 冲突时 git status 说什么');
  console.log(git(['status']));

  line('4. 冲突标记长什么样');
  console.log('README.md 现在的完整内容：');
  console.log(readFileSync(join(dir, 'README.md'), 'utf8'));
  console.log('（<<<<<<< HEAD 到 ======= 是"当前分支"，======= 到 >>>>>>> feature 是"被合入的分支"）');

  line('5. 解法一：--abort 中止合并，当没事发生过');
  console.log(git(['merge', '--abort']));
  console.log('中止后 README.md 恢复为 =', JSON.stringify(readFileSync(join(dir, 'README.md'), 'utf8')));
  console.log('中止后 status：');
  console.log(git(['status', '-s']));

  line('6. 解法二：手动编辑解决，再 add + commit');
  gitRaw(['merge', 'feature']); // 会再次冲突，但这里用 gitRaw 吞掉非 0 退出
  // 手动把两边合成一行：写一个既不是 master 也不是 feature 的"合并结果"
  writeFileSync(join(dir, 'README.md'), '版本号：手动协商的 4\n', 'utf8');
  git(['add', 'README.md']);
  console.log('解决后 status（冲突标记消失，进入待提交状态）：');
  console.log(git(['status', '-s']));
  git(['commit', '-q', '-m', 'merge feature: 手动解决冲突']);
  console.log('提交后历史：');
  console.log(git(['log', '--oneline', '--graph']));
  console.log('最终文件内容 =', JSON.stringify(readFileSync(join(dir, 'README.md'), 'utf8')));

  line('小结');
  console.log('1) 冲突报错原文：CONFLICT (content): Merge conflict in <文件>');
  console.log('2) 冲突标记：<<<<<<< HEAD（当前分支）=======（分界）>>>>>>> 分支名（对方）');
  console.log('3) 不想合并了用 --abort；想继续就改文件 → add → commit。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
