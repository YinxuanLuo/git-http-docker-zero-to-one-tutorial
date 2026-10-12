// 第 10 章 · 第五关 第 2 题答案：制造并解决一个冲突
// 运行：node examples/git/answers/a2-解决冲突.mjs
//
// 题：两个分支改同一文件的同一行，merge 时制造冲突，再手动解决并提交。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function hasGit() {
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}
if (!hasGit()) { console.log('本机未检测到 git，跳过。'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'a2-'));
const git = (a, o = {}) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', ...o }).trimEnd();
const raw = (a) => { try { return { ok: true, out: git(a) }; } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; } };

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(join(dir, 'f.txt'), '标题：原始\n', 'utf8');
  git(['add', 'f.txt']); git(['commit', '-q', '-m', 'base']);

  git(['checkout', '-q', '-b', 'feature']);
  writeFileSync(join(dir, 'f.txt'), '标题：feature 版\n', 'utf8');
  git(['add', 'f.txt']); git(['commit', '-q', '-m', 'feature 改标题']);

  git(['checkout', '-q', 'master']);
  writeFileSync(join(dir, 'f.txt'), '标题：master 版\n', 'utf8');
  git(['add', 'f.txt']); git(['commit', '-q', '-m', 'master 改标题']);

  const r = raw(['merge', 'feature']);
  console.log('制造冲突（exit ok =', r.ok, '）：');
  console.log(r.out.split('\n').filter((l) => l.includes('CONFLICT')).join('\n'));

  console.log('冲突标记：');
  console.log(readFileSync(join(dir, 'f.txt'), 'utf8').replace(/^/gm, '  '));

  // 手动解决：取一个合并结果
  writeFileSync(join(dir, 'f.txt'), '标题：合并后的统一版\n', 'utf8');
  git(['add', 'f.txt']);
  git(['commit', '-q', '-m', 'merge feature: 解决冲突']);
  console.log('解决后：');
  console.log(git(['log', '--oneline', '--graph']));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
