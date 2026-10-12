// 第 10 章 · 第五关 第 1 题答案：三棵树完整流程
// 运行：node examples/git/answers/a1-三棵树.mjs
//
// 题：从零建一个仓库，把一个文件走完"工作区 → 暂存区 → 版本库"，
//     并证明三个区各是什么状态。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function hasGit() {
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}
if (!hasGit()) { console.log('本机未检测到 git，跳过。'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'a1-'));
const git = (a, o = {}) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', ...o }).trimEnd();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(join(dir, 'note.txt'), 'v1\n', 'utf8');
  console.log('① 刚创建文件（只在工作区）：');
  console.log(git(['status', '-s']), '← "??" 表示未跟踪');

  git(['add', 'note.txt']);
  console.log('② git add 之后（进入暂存区）：');
  console.log(git(['status', '-s']), '← "A " 表示已暂存、待提交');

  git(['commit', '-q', '-m', 'first']);
  console.log('③ git commit 之后（进入版本库）：');
  console.log(git(['status', '-s']) || '  （干净：工作区、暂存区、版本库三者一致）');
  console.log('版本库里的快照：', git(['log', '--oneline', '-1']));

  console.log('\n结论：三棵树 = 工作区（?? /  M）→ 暂存区（A  / M ）→ 版本库（干净）');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
