// 对应章节：08；运行：node examples/git/08-工程化.mjs
//
// 第 08 章 · 工程化：.gitignore、Git Hooks、stash、tag。
//   1. .gitignore 用 glob 规则决定"哪些文件 Git 永远不理"
//   2. Git Hooks 是 .git/hooks/ 下的脚本，在特定时机自动触发
//   3. stash 把没做完的改动"藏起来"，切完分支再拿回来
//   4. tag 给某个 commit 起一个稳定名字（版本号）
//
// 本文件用真实 git 命令（若装了 git）。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
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

const dir = mkdtempSync(join(tmpdir(), 'git-eng-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Tutor']);
  git(['config', 'core.autocrlf', 'false']);

  line('1. .gitignore：让 Git 忽略某些文件');
  writeFileSync(join(dir, '.gitignore'), '# 忽略 node_modules 和日志\nnode_modules/\n*.log\nbuild/\n', 'utf8');
  writeFileSync(join(dir, 'index.js'), "console.log('ok');\n", 'utf8');
  writeFileSync(join(dir, 'app.log'), '日志内容\n', 'utf8');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init with gitignore']);
  console.log('.gitignore 内容：');
  console.log(readFileSync(join(dir, '.gitignore'), 'utf8'));
  console.log('提交后 git ls-files（已跟踪文件，注意 app.log 不在里面）：');
  console.log(git(['ls-files']));
  console.log('（*.log 被忽略，node_modules/ 和 build/ 目录也不会被跟踪）');

  line('2. Git Hooks：pre-commit 钩子');
  const hookPath = join(dir, '.git/hooks/pre-commit');
  writeFileSync(hookPath, '#!/bin/sh\necho ">>> pre-commit 钩子被触发了！"\n', 'utf8');
  chmodSync(hookPath, 0o755);
  appendFileSync(join(dir, 'index.js'), "console.log('再加一行');\n", 'utf8');
  git(['add', 'index.js']);
  console.log('执行 git commit 时，钩子输出：');
  console.log(git(['commit', '-q', '-m', 'second commit']));
  console.log('（pre-commit 在 commit 之前跑，你可以在里面跑 lint/测试拦截坏提交）');

  line('3. stash：把没做完的改动藏起来');
  appendFileSync(join(dir, 'index.js'), "// 还没写完的代码\n", 'utf8');
  console.log('改了一半，git status -s：');
  console.log(git(['status', '-s']));
  console.log('git stash（藏起来）：');
  console.log(git(['stash']));
  console.log('stash 之后 status -s：');
  console.log(git(['status', '-s']) || '  （干净）');
  console.log('git stash list：');
  console.log(git(['stash', 'list']));
  console.log('git stash pop（拿回来）：');
  console.log(git(['stash', 'pop']));
  console.log('pop 之后 status -s：');
  console.log(git(['status', '-s']));

  line('4. tag：给 commit 起个稳定的名字');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'release candidate']);
  console.log('git tag v1.0.0 之后，git tag：');
  git(['tag', 'v1.0.0']);
  console.log(git(['tag']));
  console.log('git tag v1.0.0-rc -m 带说明的标签：');
  git(['tag', '-a', 'v1.0.0-rc', '-m', '第一个候选版本']);
  console.log(git(['tag', '-n']));
  console.log('tag 指向的 commit：', git(['rev-parse', '--short', 'v1.0.0']));

  line('小结');
  console.log('1) .gitignore 是"告诉 Git 哪些文件永远别管"，用 glob 规则。');
  console.log('2) Hooks 是 .git/hooks/ 下的脚本，pre-commit 在提交前自动触发。');
  console.log('3) stash 藏起未提交改动，pop 取回；tag 给 commit 起稳定名字。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
