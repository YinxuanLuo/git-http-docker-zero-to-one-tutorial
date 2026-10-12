// 对应章节：05；运行：node examples/git/05-撤销回退.mjs
//
// 第 05 章 · 撤销与回退：reset（soft/mixed/hard）、revert、restore、reflog。
//   1. reset 三兄弟只差在"动哪里"：HEAD / 暂存区 / 工作区
//   2. revert 是"新增一个反向 commit"，不改写历史（安全）
//   3. restore 是"丢弃工作区/暂存区改动"
//   4. reflog 是救回"丢了"的 commit 的救命稻草
//
// 本文件用真实 git 命令（若装了 git）。每步都打印真实 status 做对比。

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

const dir = mkdtempSync(join(tmpdir(), 'git-undo-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();
const commit = (msg) => {
  git(['add', '-A']);
  git(['commit', '-q', '-m', msg]);
};
const showStatus = () => {
  const s = git(['status', '-s']);
  console.log(s === '' ? '  （工作区干净）' : s.split('\n').map((l) => '  ' + l).join('\n'));
};

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(join(dir, 'f.txt'), '1\n', 'utf8');
  commit('C1');
  appendFileSync(join(dir, 'f.txt'), '2\n', 'utf8');
  commit('C2');
  appendFileSync(join(dir, 'f.txt'), '3\n', 'utf8');
  commit('C3');
  console.log('初始 3 个 commit：');
  console.log(git(['log', '--oneline']));

  line('1. reset --soft HEAD~1：只挪 HEAD，暂存区/工作区都不动');
  git(['reset', '--soft', 'HEAD~1']);
  console.log('HEAD 现在指向：', git(['log', '--oneline', '-1']));
  console.log('git status -s：');
  showStatus();
  console.log('（f.txt 的改动还在【暂存区】——绿色 "M "，说明可以重新 commit）');

  line('2. 补回这个 commit，再试 reset --mixed');
  commit('C3 again');
  git(['reset', '--mixed', 'HEAD~1']); // --mixed 是默认值
  console.log('git status -s：');
  showStatus();
  console.log('（f.txt 的改动退到了【工作区】——红色 " M"，暂存区被清空）');

  line('3. 补回，再试 reset --hard：连工作区一起清掉');
  commit('C3 again');
  git(['reset', '--hard', 'HEAD~1']);
  console.log('git status -s：');
  showStatus();
  console.log('f.txt 内容 =', JSON.stringify(git(['show', 'HEAD:f.txt'])));
  console.log('（--hard 把 HEAD、暂存区、工作区全部拉回 C2，C3 的改动没了）');

  line('4. revert：不删历史，新增一个"反向 commit"');
  appendFileSync(join(dir, 'f.txt'), '3\n', 'utf8');
  commit('C3（再来一次）');
  console.log('revert 前：', git(['log', '--oneline', '-1']));
  git(['revert', '--no-edit', 'HEAD']);
  console.log('revert 后：', git(['log', '--oneline', '-2']));
  console.log('f.txt 内容 =', JSON.stringify(git(['show', 'HEAD:f.txt'])));
  console.log('（注意历史里 C3 还在，只是多了一个"撤销 C3"的 commit）');

  line('5. restore：丢弃工作区改动');
  appendFileSync(join(dir, 'f.txt'), '手滑写错的一行\n', 'utf8');
  console.log('改之前 status -s：');
  showStatus();
  git(['restore', 'f.txt']);
  console.log('git restore f.txt 之后 status -s：');
  showStatus();
  console.log('（restore = 把工作区文件恢复到暂存区/HEAD 的版本，手滑的改动没了）');

  line('6. reflog：找回"丢了"的 commit');
  const before = git(['rev-parse', 'HEAD']);
  console.log('先记住当前 HEAD =', before.slice(0, 7));
  git(['reset', '--hard', 'HEAD~1']); // 假装手滑回退过头
  console.log('回退后 HEAD =', git(['rev-parse', 'HEAD']).slice(0, 7));
  console.log('git reflog（最近 5 条）：');
  console.log(git(['reflog', '-5']).split('\n').map((l) => '  ' + l).join('\n'));
  console.log('（reflog 记录了 HEAD 每一次移动，包括"回退过头"之前的那条）');

  line('小结');
  console.log('1) reset --soft 动 HEAD；--mixed 动 HEAD+暂存区；--hard 动 HEAD+暂存区+工作区。');
  console.log('2) revert 新增反向 commit，不改历史，适合已推送的分支。');
  console.log('3) restore 丢弃工作区/暂存区改动，是 checkout -- 的现代替代。');
  console.log('4) reflog 记住 HEAD 的所有移动，回退错了也能找回来。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
