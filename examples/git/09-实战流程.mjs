// 对应章节：09；运行：node examples/git/09-实战流程.mjs
//
// 第 09 章 · 实战：从零走一遍规范协作流程。
//   演示：分支命名 → 小步语义化提交 → 合并 → 删分支 → 打 tag。
//   每一步都打印"为什么这么做" + 真实 git 输出。
//
// 本文件用真实 git 命令（若装了 git），零第三方依赖。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const line = (t) => console.log('\n--- ' + t + ' ---');
const step = (n, t) => console.log(`\n[步骤 ${n}] ${t}`);

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

const dir = mkdtempSync(join(tmpdir(), 'git-flow-'));
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', ...opts }).trimEnd();
const commit = (msg) => {
  git(['add', '-A']);
  git(['commit', '-q', '-m', msg]);
};

try {
  console.log('=== 一个"需求 → 上线"的规范流程 ===');

  step(1, '初始化仓库 + 本地身份配置');
  git(['init', '-q', '-b', 'main']); // -b main：让默认分支直接叫 main，而不是 master
  git(['config', 'user.email', 'dev@example.com']);
  git(['config', 'user.name', 'Dev']);
  git(['config', 'core.autocrlf', 'false']);
  console.log('（user.name / user.email 会写进每个 commit，先配好别用错名字提交）');

  step(2, '在 main 上初始化项目');
  writeFileSync(join(dir, 'README.md'), '# 我的项目\n', 'utf8');
  writeFileSync(join(dir, 'package.json'), '{"name":"demo"}\n', 'utf8');
  commit('chore: 初始化项目骨架');
  console.log(git(['log', '--oneline', '-1']));

  step(3, '开一个语义化的功能分支');
  git(['checkout', '-q', '-b', 'feature/add-login']);
  console.log('分支名 feature/add-login 一看就知道：这是一条"加登录"的功能分支');

  step(4, '小步开发：每完成一个独立单元就提交一次');
  writeFileSync(join(dir, 'login.js'), 'function login() { return "todo"; }\n', 'utf8');
  commit('feat: 新增 login 模块骨架');
  appendFileSync(join(dir, 'login.js'), 'function validate(u, p) { return !!u && !!p; }\n', 'utf8');
  commit('feat: 实现用户名密码校验');
  writeFileSync(join(dir, 'test.js'), 'console.log("单测占位");\n', 'utf8');
  commit('test: 补充登录单测占位');
  console.log('feature 分支上的提交（语义化信息：feat / test / chore）：');
  console.log(git(['log', '--oneline', '-4']));

  step(5, '切回 main，模拟"期间同事合入了别的改动"');
  git(['checkout', '-q', 'main']);
  writeFileSync(join(dir, 'config.js'), 'module.exports = {};\n', 'utf8');
  commit('fix: 补上缺失的 config 模块');
  console.log('main 现在：', git(['log', '--oneline', '-1']));

  step(6, '把 feature 合并回 main（三方合并）');
  const mergeOut = git(['merge', 'feature/add-login', '-m', 'merge: 合入登录功能']);
  console.log(mergeOut.split('\n')[0] || mergeOut);
  console.log('合并后的历史：');
  console.log(git(['log', '--oneline', '--graph']));

  step(7, '合并完删掉已经没用的功能分支');
  git(['branch', '-d', 'feature/add-login']);
  console.log('git branch 现在只剩：');
  console.log(git(['branch']));
  console.log('（删分支只是删掉那张"纸条"，commit 都还在历史里）');

  step(8, '打 tag 发布');
  git(['tag', '-a', 'v1.0.0', '-m', '首个版本：含登录功能']);
  console.log('git tag -n：');
  console.log(git(['tag', '-n']));

  step(9, '回顾：这套流程的四个规范点');
  console.log('1) 分支命名：feature/<主题>、fix/<主题>，一眼看懂。');
  console.log('2) 提交信息：feat/fix/test/chore 前缀，一个小单元一条。');
  console.log('3) 合并方向：功能分支 → main，main 保持可发布状态。');
  console.log('4) 收尾：合并后删分支、打 tag 留里程碑。');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
