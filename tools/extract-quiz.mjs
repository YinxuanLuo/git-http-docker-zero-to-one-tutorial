/**
 * 从三篇（git/http/docker）各自的 10-测试题与答案.md 与 11-面试速查表.md 抽取结构化题库，
 * 输出 site/quiz-bank.json，供练习站使用。
 *
 * 本教程「三篇合一」，题库也合并：每道题带 track（篇别）与 from（出处）标记。
 *
 * 用法（在 tools 目录下）：
 *   node extract-quiz.mjs
 *
 * 抽取内容：
 *   - 第一关 判断对错（每篇 20 题，共 60 题）
 *   - 第二关 说出输出（每篇 25 题，共 75 题）
 *   - 面试速查表里的高频问答（三篇合并）
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const docsRoot = path.join(ROOT, 'docs');
const outDir = path.join(ROOT, 'site');

const TRACKS = [
  { dir: 'git', name: 'Git', label: 'git' },
  { dir: 'http', name: '网络与HTTP', label: 'http' },
  { dir: 'docker', name: 'Docker', label: 'docker' },
];

const bank = { stage1: [], stage2: [], interview: [] };

/** 取 [startRe, endRe) 之间的片段 */
function section(text, startRe, endRe) {
  const s = text.search(startRe);
  if (s < 0) return '';
  const rest = text.slice(s);
  const e = rest.slice(1).search(endRe);
  return e < 0 ? rest : rest.slice(0, e + 1);
}

/** 按 | 切分表格行，保留被转义的 \| 。返回去掉首尾空字段后的单元格数组；不是表格行返回 null。 */
function cells(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  const parts = t
    .replace(/\\\|/g, '\u0000')
    .split('|')
    .map((s) => s.replace(/\u0000/g, '|').trim());
  if (parts.length >= 2 && parts[0] === '') parts.shift();
  if (parts.length >= 1 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

for (const t of TRACKS) {
  const dir = path.join(docsRoot, t.dir);
  const f10 = path.join(dir, '10-测试题与答案.md');
  const f11 = path.join(dir, '11-面试速查表.md');
  if (!fs.existsSync(f10) || !fs.existsSync(f11)) {
    console.warn('[跳过] 缺少题库文件: ' + t.dir);
    continue;
  }
  const md10 = fs.readFileSync(f10, 'utf8');
  const md11 = fs.readFileSync(f11, 'utf8');

  /* ───────────── 第一关：判断对错 ───────────── */
  const s1 = section(md10, /## 第一关 · 概念快问快答/, /\n## 第二关 · 说出输出/);
  const s1ans = section(md10, /## 第一关答案/, /\n## 第二关答案/);

  const q1 = {};
  for (const line of s1.split('\n')) {
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (m) q1[Number(m[1])] = m[2].trim();
  }

  const a1 = {};
  for (const line of s1ans.split('\n')) {
    const c = cells(line);
    if (!c || c.length < 4) continue;
    const no = Number(c[0]);
    if (!Number.isInteger(no)) continue;
    const ans = c[1].replace(/\*/g, '').trim();
    if (ans !== '对' && ans !== '错') continue;
    a1[no] = { answer: ans === '对', why: c[2], from: c[3] };
  }

  for (const n of Object.keys(q1).map(Number).sort((a, b) => a - b)) {
    const a = a1[n];
    bank.stage1.push({
      id: `${t.label}-s1-${n}`,
      track: t.label,
      no: n,
      q: q1[n],
      answer: a ? a.answer : null,
      why: a ? a.why : '',
      from: a ? a.from : '',
    });
  }

  /* ───────────── 第二关：说出输出 ───────────── */
  const s2 = section(md10, /## 第二关 · 说出输出/, /\n## 第三关 · 改错/);
  const s2ans = section(md10, /## 第二关答案/, /\n## 第三关答案/);

  const codeLines = {};
  const codeBlock = s2.match(/```(?:jsx?|javascript|tsx?|js|bash)\n([\s\S]*?)```/);
  if (codeBlock) {
    let cur = null;
    for (const line of codeBlock[1].split('\n')) {
      const m = line.match(/^\/\/\s*(\d+)\s*$/);
      if (m) {
        cur = Number(m[1]);
        codeLines[cur] = [];
        continue;
      }
      if (cur !== null) codeLines[cur].push(line);
    }
  }

  const a2 = {};
  for (const line of s2ans.split('\n')) {
    const c = cells(line);
    if (!c || c.length < 3) continue;
    const no = Number(c[0]);
    if (!Number.isInteger(no)) continue;
    a2[no] = { out: c[1], note: c[2] };
  }

  const q2nos = Object.keys(codeLines).map(Number).sort((a, b) => a - b);
  for (const n of q2nos) {
    const a = a2[n];
    const code = (codeLines[n] || []).join('\n').replace(/^\n+|\n+$/g, '');
    bank.stage2.push({
      id: `${t.label}-s2-${n}`,
      track: t.label,
      no: n,
      code,
      out: a ? a.out : '',
      note: a ? a.note : '',
    });
  }

  /* ───────────── 面试题（11 章） ───────────── */
  const qMarks = [];
  const reQ = /\*\*Q(\d+)[:：]\s*([\s\S]*?)\*\*/g;
  let mq;
  while ((mq = reQ.exec(md11)) !== null) {
    const tt = mq[2].trim();
    if (tt.endsWith('?') || tt.endsWith('？')) {
      qMarks.push({ no: Number(mq[1]), q: tt, start: mq.index, end: reQ.lastIndex });
    }
  }
  for (let i = 0; i < qMarks.length; i++) {
    const cur = qMarks[i];
    const next = qMarks[i + 1];
    let body = md11.slice(cur.end, next ? next.start : cur.end + 2000);
    body = body.split(/\n###\s/)[0].trim();
    if (body.length < 10) continue;
    bank.interview.push({
      id: `${t.label}-iv-${cur.no}-${i}`,
      track: t.label,
      no: cur.no,
      q: cur.q,
      a: body.slice(0, 1600),
    });
  }

  console.log(`[${t.name}] 第一关 ${bank.stage1.filter((x) => x.track === t.label).length} 题 / 第二关 ${bank.stage2.filter((x) => x.track === t.label).length} 题 / 面试 ${bank.interview.filter((x) => x.track === t.label).length} 题`);
}

/* ───────────── 输出 ───────────── */
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'quiz-bank.json');
fs.writeFileSync(out, JSON.stringify(bank, null, 2), 'utf8');

console.log('\n合计：第一关 ' + bank.stage1.length + ' / 第二关 ' + bank.stage2.length + ' / 面试 ' + bank.interview.length);

const miss1 = bank.stage1.filter((x) => x.answer === null);
const miss2 = bank.stage2.filter((x) => !x.out);
const miss1why = bank.stage1.filter((x) => !x.why);
let problems = 0;
if (bank.stage1.length !== 60) { console.log('⚠ 第一关题数应为 60（3×20），实际', bank.stage1.length); problems++; }
if (bank.stage2.length !== 75) { console.log('⚠ 第二关题数应为 75（3×25），实际', bank.stage2.length); problems++; }
if (miss1.length) { console.log('⚠ 缺答案的第一关题:', miss1.map((x) => x.track + '-' + x.no).join(',')); problems++; }
if (miss2.length) { console.log('⚠ 缺输出的第二关题:', miss2.map((x) => x.track + '-' + x.no).join(',')); problems++; }
if (miss1why.length) { console.log('⚠ 缺解析的第一关题:', miss1why.map((x) => x.track + '-' + x.no).join(',')); problems++; }
if (bank.interview.length < 90) { console.log('⚠ 面试题少于 90 道（3×30），检查 11 章格式'); problems++; }

const yes = bank.stage1.filter((x) => x.answer === true).length;
console.log('第一关答案分布    ', yes, '对 /', bank.stage1.length - yes, '错');

console.log(problems === 0 ? '\n✅ 题库抽取正常' : `\n❌ 存在 ${problems} 个问题`);
console.log('写入 ->', path.relative(ROOT, out));
if (problems) process.exitCode = 1;
