// 第 10 章 · 第五关 第 5 题答案：远程协作（本地裸仓库模拟）
// 运行：node examples/git/answers/a5-远程协作.mjs
//
// 题：用两个本地仓库 + 一个裸仓库，完整演示 push / fetch / pull，
//     并复现 push 被 rejected 的场景。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function hasGit() {
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}
if (!hasGit()) { console.log('本机未检测到 git，跳过。'); process.exit(0); }

const base = mkdtempSync(join(tmpdir(), 'a5-'));
const remote = join(base, 'remote.git');
const A = join(base, 'A');
const B = join(base, 'B');
const at = (c) => (a, o = {}) => execFileSync('git', a, { cwd: c, encoding: 'utf8', ...o }).trimEnd();

try {
  execFileSync('git', ['init', '--bare', '-q', remote], { encoding: 'utf8' });
  execFileSync('git', ['init', '-q', A], { encoding: 'utf8' });
  const gA = at(A);
  gA(['config', 'user.email', 't@example.com']);
  gA(['config', 'user.name', 'Tutor']);
  gA(['config', 'core.autocrlf', 'false']);
  writeFileSync(join(A, 'f.txt'), 'A\n', 'utf8');
  gA(['add', 'f.txt']); gA(['commit', '-q', '-m', 'A init']);
  gA(['remote', 'add', 'origin', remote]);
  gA(['push', '-q', '-u', 'origin', 'master']);
  console.log('① A 已 push 到 origin');

  execFileSync('git', ['clone', '-q', remote, B], { encoding: 'utf8' });
  const gB = at(B);
  gB(['config', 'user.email', 't@example.com']);
  gB(['config', 'user.name', 'Tutor']);
  gB(['config', 'core.autocrlf', 'false']);
  writeFileSync(join(B, 'b.txt'), 'B\n', 'utf8');
  gB(['add', 'b.txt']); gB(['commit', '-q', '-m', 'B add']);
  gB(['push', '-q']);
  console.log('② B clone 后又 push 了一个新提交');

  writeFileSync(join(A, 'a.txt'), 'A2\n', 'utf8');
  gA(['add', 'a.txt']); gA(['commit', '-q', '-m', 'A add']);
  let out = '';
  try { gA(['push', '-q']); } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  console.log('③ A 再 push 被拒：');
  console.log(out.split('\n').filter((l) => l.includes('rejected')).join('\n'));

  gA(['fetch', '-q', 'origin']);
  console.log('④ fetch 后远程分支已更新：', gA(['rev-parse', '--short', 'origin/master']));
  gA(['config', 'pull.rebase', 'false']);
  gA(['pull', '-q', 'origin', 'master']);
  console.log('⑤ pull 合并后 A 的历史：');
  console.log(gA(['log', '--oneline', '--graph']).replace(/^/gm, '  '));
  console.log('\n结论：push 被拒 = 远程领先；fetch 只下载，pull = fetch + merge。');
} finally {
  rmSync(base, { recursive: true, force: true });
}
