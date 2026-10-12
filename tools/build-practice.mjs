/**
 * 把 site/quiz-bank.json 注入 tools/practice-template.html，
 * 产出根目录下的单文件练习站：Git-从零到一-练习站.html
 *
 * 用法（在 tools 目录下）：
 *   node build-practice.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const tplPath = path.join(import.meta.dirname, 'practice-template.html');
const bankPath = path.join(ROOT, 'site', 'quiz-bank.json');
const outPath = path.join(ROOT, 'Git-从零到一-练习站.html');

if (!fs.existsSync(tplPath)) throw new Error('缺少 practice-template.html');
if (!fs.existsSync(bankPath)) throw new Error('缺少 site/quiz-bank.json，请先运行 extract-quiz.mjs');

const tpl = fs.readFileSync(tplPath, 'utf8');
const bank = fs.readFileSync(bankPath, 'utf8');

// 安全注入：JSON 里的 </script> 会被提前闭合，必须转义
const safe = bank.replace(/<\//g, '<\\/');

if (!tpl.includes('__BANK__')) throw new Error('模板里找不到 __BANK__ 占位符');
const html = tpl.replace('__BANK__', safe);

fs.writeFileSync(outPath, html, 'utf8');

const b = JSON.parse(bank);
console.log('题库：第一关', b.stage1.length, '/ 第二关', b.stage2.length, '/ 面试', b.interview.length);
console.log('产出：', path.relative(ROOT, outPath), '(' + (html.length / 1024).toFixed(0) + ' KB)');

// 自检：确保没有残留占位符、script 标签配对
const strayPlaceholder = html.includes('__BANK__');
const openScript = (html.match(/<script/g) ?? []).length;
const closeScript = (html.match(/<\/script>/g) ?? []).length;
console.log('残留占位符:', strayPlaceholder ? '❌ 有' : 'OK 无');
console.log('script 标签:', openScript, '开 /', closeScript, '闭', openScript === closeScript ? 'OK' : '❌ 不匹配');
if (strayPlaceholder || openScript !== closeScript) process.exitCode = 1;
