// 第 10 章 · 第五关 第 4 题答案：分支合并工作流
// 运行：node examples/git/answers/a4-分支工作流.mjs
//
// 题：在 feature 分支上开发并合并回 main，演示快进合并与三方合并的触发条件。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function hasGit() {
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}
if (!hasGit()) { console.log('本机未检测到 git，跳过。'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'a4-'));
const git = (a, o = {}) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', ...o }).trimEnd();
const commit = (m) => { git(['add', '-A']); git(['commit', '-q', '-m', m]); };

try {
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(join(dir, 'f.txt'), '1\n', 'utf8'); commit('base');

  // 场景一：快进合并（main 没动，直接 merge feature）
  git(['checkout', '-q', '-b', 'feature']);
  appendFileSync(join(dir, 'f.txt'), '2\n', 'utf8'); commit('feat');
  git(['checkout', '-q', 'main']);
  console.log('① 快进合并：', git(['merge', 'feature']).split('\n')[0]);

  // 场景二：三方合并（两边都动了）
  git(['checkout', '-q', '-b', 'feat2']);
  writeFileSync(join(dir, 'x.txt'), 'x\n', 'utf8'); commit('feat2');
  git(['checkout', '-q', 'main']);
  writeFileSync(join(dir, 'y.txt'), 'y\n', 'utf8'); commit('main');
  console.log('② 三方合并：', git(['merge', 'feat2', '-m', 'merge feat2']).split('\n')[0]);

  console.log('最终历史：');
  console.log(git(['log', '--oneline', '--graph']));
  console.log('\n结论：目标分支没动 → 快进；两边都动 → 三方合并生成 merge commit。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
