/**
 * 教程仓库自检：文档清单 / 编码 / 内部链接 / 章节齐备性 / 示例语法 / HTML 阅读版 / 根目录清洁度。
 *
 * 用法（在 tools 目录下）：
 *   node check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'tools']);

function walk(dir, ext, extraSkip = new Set()) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || extraSkip.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext, extraSkip));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

let problems = 0;

// ---- 1. 文档清单 ----
console.log('==================== 1. 文档清单 ====================');
const mds = [
  path.join(ROOT, 'README.md'),
  path.join(ROOT, '速通版-2小时上手Git.md'),
  path.join(ROOT, '速通版-2小时上手网络与HTTP.md'),
  path.join(ROOT, '速通版-2小时上手Docker.md'),
  ...walk(path.join(ROOT, 'docs'), '.md').sort(),
];
let totalLines = 0;
let totalBytes = 0;
for (const f of mds) {
  const text = fs.readFileSync(f, 'utf8');
  const n = text.split('\n').length;
  totalLines += n;
  totalBytes += Buffer.byteLength(text);
  console.log('  ' + path.relative(ROOT, f).padEnd(46) + String(n).padStart(6) + ' 行');
}
console.log('  ' + '-'.repeat(54));
console.log('  ' + ('合计 ' + mds.length + ' 个文件').padEnd(44) + String(totalLines).padStart(6) + ' 行');
console.log('  ' + '总字节'.padEnd(46) + (totalBytes / 1024).toFixed(0).padStart(6) + ' KB');

// ---- 2. 编码 ----
console.log('\n==================== 2. 编码检查 ====================');
let encBad = 0;
let intentional = 0;
for (const f of mds) {
  const buf = fs.readFileSync(f);
  const text = buf.toString('utf8');
  const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  // 编码类教程会「刻意」展示乱码字符（U+FFFD）来演示问题，所以先去掉
  // 围栏代码块与行内代码，只看正文——真正的编码损坏会出现在正文里。
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const bad = (prose.match(/\uFFFD/g) ?? []).length;
  intentional += (text.match(/\uFFFD/g) ?? []).length - bad;
  if (hasBOM || bad > 0) {
    encBad++;
    problems++;
    console.log('  ⚠ ' + path.relative(ROOT, f) + '  BOM=' + hasBOM + '  正文替换字符=' + bad);
  }
}
console.log(encBad === 0 ? '  OK  全部 UTF-8，无 BOM、正文无解码失败字符' : '  ❌ ' + encBad + ' 个文件有问题');
if (intentional > 0) {
  console.log('  （代码块内另有 ' + intentional + ' 个 U+FFFD，属于「演示乱码」的正文内容，不计为问题）');
}

// ---- 3. 内部链接 ----
console.log('\n==================== 3. 内部链接 ====================');
let checked = 0, broken = 0;
for (const f of mds) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      let t = m[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      t = t.replace(/#.*$/, '').replace(/^<|>$/g, '');
      if (!t) continue;
      checked++;
      if (!fs.existsSync(path.resolve(path.dirname(f), decodeURIComponent(t)))) {
        broken++;
        problems++;
        console.log('  BROKEN  ' + path.relative(ROOT, f) + ':' + (i + 1) + '  ->  ' + t);
      }
    }
  });
}
console.log('  扫描 ' + checked + ' 个内部链接，断链 ' + broken + ' 个');

// ---- 4. 章节齐备性 ----
console.log('\n==================== 4. 章节齐备性 ====================');
const missing = [];
for (const track of ['git', 'http', 'docker']) {
  const dir = path.join(ROOT, 'docs', track);
  if (!fs.existsSync(dir)) {
    console.log('  ❌ 缺少目录 docs/' + track);
    problems++;
    continue;
  }
  const present = fs.readdirSync(dir);
  for (const n of ['00','01','02','03','04','05','06','07','08','09','10','11']) {
    const hit = present.find((x) => x.startsWith(n + '-'));
    if (!hit) { missing.push(track + '/' + n); problems++; }
    console.log('  ' + track + '/' + n + '  ' + (hit ? 'OK  ' + hit : '❌ 缺失'));
  }
}
if (missing.length) console.log('  ❌ 缺失章节: ' + missing.join(', '));

// ---- 5. 配套代码 ----
console.log('\n==================== 5. 配套代码 ====================');
// 三篇示例均为 .mjs（零第三方依赖）；Docker 篇另有 .Dockerfile / .yml 示例文件（非可执行，见下）
const samples = walk(path.join(ROOT, 'examples'), '.mjs').sort();
for (const f of samples) {
  const n = fs.readFileSync(f, 'utf8').split('\n').length;
  console.log('  ' + path.relative(ROOT, f).padEnd(46) + String(n).padStart(6) + ' 行');
}
if (!samples.length) {
  console.log('  ❌ examples/ 下没有 .mjs 文件');
  problems++;
}
// 语法校验：node --check 能挡住 JSX 误入 .mjs / 括号不闭合等问题
let syntaxBad = 0;
for (const f of samples) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    syntaxBad++;
    problems++;
    const msg = (e.stderr ? e.stderr.toString() : String(e)).split('\n').slice(0, 3).join(' ').trim();
    console.log('  ❌ 语法错误  ' + path.relative(ROOT, f) + '  →  ' + msg);
  }
}
console.log(syntaxBad === 0 ? '  OK  全部 ' + samples.length + ' 个示例通过 node --check（无 JSX 误入）' : '  ❌ ' + syntaxBad + ' 个文件语法错误');

const stray = samples.filter((f) => path.basename(f).startsWith('_'));
if (stray.length) {
  problems++;
  console.log('\n  ⚠ 发现临时/探针文件，应删除：');
  stray.forEach((f) => console.log('      ' + path.relative(ROOT, f)));
} else {
  console.log('  OK  无临时/探针文件残留');
}

// ---- 6. HTML 阅读版 ----
console.log('\n==================== 6. HTML 阅读版 ====================');
const htmlPath = path.join(ROOT, 'Git-从零到一-阅读版.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const c = (re) => (html.match(re) ?? []).length;
  const open = c(/<section class="chapter"/g);
  const close = c(/<\/section>/g);
  console.log('  大小: ' + (html.length / 1024 / 1024).toFixed(2) + ' MB');
  console.log('  章 section: ' + open + ' 开 / ' + close + ' 闭' + (open === close ? '  OK' : '  ❌ 不匹配'));
  console.log('  表格 ' + c(/<table>/g) + ' / 代码块 ' + c(/<pre><code/g) + ' / 二级目录项 ' + c(/class="nav-sub"/g));
  const fences = c(/```/g);
  console.log('  未渲染的三反引号: ' + fences + (fences === 0 ? '  OK' : '  ❌'));
  if (open !== close || fences > 0) problems++;
} else {
  problems++;
  console.log('  ❌ 未生成（在 tools 下跑 npm run build:html）');
}

// ---- 7. 练习站 ----
console.log('\n==================== 7. 练习站 ====================');
const practicePath = path.join(ROOT, 'Git-从零到一-练习站.html');
if (fs.existsSync(practicePath)) {
  const html = fs.readFileSync(practicePath, 'utf8');
  const stray2 = html.includes('__BANK__');
  const openScript = (html.match(/<script/g) ?? []).length;
  const closeScript = (html.match(/<\/script>/g) ?? []).length;
  console.log('  大小: ' + (html.length / 1024).toFixed(0) + ' KB');
  console.log('  残留占位符: ' + (stray2 ? '❌ 有' : 'OK 无'));
  console.log('  script 标签: ' + openScript + ' 开 / ' + closeScript + ' 闭' + (openScript === closeScript ? '  OK' : '  ❌'));
  if (stray2 || openScript !== closeScript) problems++;
} else {
  problems++;
  console.log('  ❌ 未生成（在 tools 下跑 npm run build:practice）');
}

// ---- 8. 仓库根目录不该有临时/草稿文件 ----
console.log('\n==================== 8. 根目录清洁度 ====================');
const JUNK = /(^\.tmp|^_|\.tmp$|\.log$|\.bak$|~$)/;
const junk = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && JUNK.test(e.name))
  .map((e) => e.name);
if (junk.length) {
  problems++;
  console.log('  ⚠ 根目录发现疑似临时/草稿文件，应删除或加进 .gitignore：');
  junk.forEach((n) => console.log('      ' + n));
} else {
  console.log('  OK  根目录无临时/草稿文件');
}

console.log('\n====================================================');
console.log(problems === 0 ? '全部检查通过 ✅' : '存在 ' + problems + ' 个问题 ❌');
process.exitCode = problems === 0 ? 0 : 1;
