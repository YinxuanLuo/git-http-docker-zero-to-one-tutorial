// 第 10 章 · 第五关 第 3 题答案：撤销与回退演练
// 运行：node examples/git/answers/a3-撤销演练.mjs
//
// 题：分别演示 reset --soft / --mixed / --hard、revert、reflog，并说清区别。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function hasGit() {
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}
if (!hasGit()) { console.log('本机未检测到 git，跳过。'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'a3-'));
const git = (a, o = {}) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', ...o }).trimEnd();
const commit = (m) => { git(['add', '-A']); git(['commit', '-q', '-m', m]); };

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(join(dir, 'f.txt'), '1\n', 'utf8'); commit('C1');
  appendFileSync(join(dir, 'f.txt'), '2\n', 'utf8'); commit('C2');
  appendFileSync(join(dir, 'f.txt'), '3\n', 'utf8'); commit('C3');

  const show = () => console.log('  status -s:', git(['status', '-s']) || '(干净)');

  console.log('① reset --soft HEAD~1（只挪 HEAD，改动留在暂存区）：');
  git(['reset', '--soft', 'HEAD~1']); show();
  commit('C3 again');

  console.log('② reset --mixed HEAD~1（挪 HEAD + 清暂存区，改动在工作区）：');
  git(['reset', '--mixed', 'HEAD~1']); show();
  commit('C3 again');

  console.log('③ reset --hard HEAD~1（全清，改动消失）：');
  git(['reset', '--hard', 'HEAD~1']); show();

  console.log('④ revert（新增反向 commit，历史保留）：');
  appendFileSync(join(dir, 'f.txt'), '3\n', 'utf8'); commit('C3');
  git(['revert', '--no-edit', 'HEAD']);
  console.log('  log:', git(['log', '--oneline', '-2']).split('\n').join(' | '));

  console.log('⑤ reflog 找回被 reset 掉的 commit：');
  console.log(git(['reflog', '-3']).replace(/^/gm, '  '));
  console.log('\n区别一句话：soft 动 HEAD，mixed 动 HEAD+暂存区，hard 动 HEAD+暂存区+工作区；');
  console.log('revert 不改历史，reflog 是后悔药。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
