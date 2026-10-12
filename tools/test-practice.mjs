/**
 * 练习站 DOM 冒烟测试：用 jsdom 真实加载 HTML，模拟点击，验证交互逻辑。
 *
 * 本教程「三篇合一」，第一关 60 题（3×20）、第二关 75 题（3×25）。
 *
 * 用法（在 tools 目录下）：
 *   NODE_PATH=<workspace>/node_modules node test-practice.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const file = path.join(ROOT, 'Git-从零到一-练习站.html');
const KEY = 'git-http-docker-tutorial-progress-v1';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

const html = fs.readFileSync(file, 'utf8');

// 提供 localStorage shim
const store = {};
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'file:///' + file.replace(/\\/g, '/'),
  beforeParse(win) {
    Object.defineProperty(win, 'localStorage', {
      value: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      },
      configurable: true,
    });
    win.confirm = () => true;
    win.scrollTo = () => {};
  },
});

const { window } = dom;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));

console.log('\n========== 练习站 DOM 冒烟测试 ==========\n');

// ---- 1. 基础结构 ----
console.log('[1] 基础结构');
ok('标题正确', doc.title.includes('练习站'), doc.title);
ok('内嵌题库可解析', !!$('#bank'));
const bank = JSON.parse($('#bank').textContent.replace(/<\\\//g, '</'));
const S1 = bank.stage1.length;   // 期望 60
const S2 = bank.stage2.length;   // 期望 75
ok('题库 stage1 = 60', S1 === 60, '实际 ' + S1);
ok('题库 stage2 = 75', S2 === 75, '实际 ' + S2);
ok('题库 interview > 0', bank.interview.length > 0, '实际 ' + bank.interview.length);
ok('无残留占位符', !html.includes('__BANK__'));

// ---- 2. 第一关渲染 ----
console.log('\n[2] 第一关渲染');
const s1Cards = $$('#list-s1 .q');
ok('渲染 60 张题卡', s1Cards.length === 60, '实际 ' + s1Cards.length);
const firstBtns = s1Cards[0].querySelectorAll('.btn');
ok('首题有 对/错 两个按钮', firstBtns.length === 2, '实际 ' + firstBtns.length);
ok('首题初始无判定样式', !s1Cards[0].classList.contains('right') && !s1Cards[0].classList.contains('wrong'));
ok('初始统计 已答 0', $('#st-done').textContent === '0', $('#st-done').textContent);
ok('初始进度条 0%', $('#bar').style.width === '0%', $('#bar').style.width);

// ---- 3. 答对一题 ----
console.log('\n[3] 答对第 1 题（正确答案：' + (bank.stage1[0].answer ? '对' : '错') + '）');
const correctLabel = bank.stage1[0].answer ? '对' : '错';
const btnToClick = Array.from(s1Cards[0].querySelectorAll('.btn')).find((b) => b.textContent.trim() === correctLabel);
ok('找到正确按钮', !!btnToClick);
btnToClick.click();

const card0 = $$('#list-s1 .q')[0];
ok('题卡变为 right 样式', card0.classList.contains('right'), card0.className);
ok('出现解析文本', !!card0.querySelector('.explain'));
ok('解析显示"答对了"', card0.querySelector('.verdict').textContent.includes('答对'));
ok('统计 已答=1', $('#st-done').textContent === '1', $('#st-done').textContent);
ok('统计 正确=1', $('#st-ok').textContent === '1', $('#st-ok').textContent);
ok('正确率=100%', $('#st-rate').textContent === '100%', $('#st-rate').textContent);
const expectBar1 = (1 / S1 * 100) + '%';
ok('进度条=' + expectBar1, $('#bar').style.width === expectBar1, $('#bar').style.width);
ok('进度已写入 localStorage', !!store[KEY], '无存储');

// ---- 4. 答错一题 → 错题本 ----
console.log('\n[4] 答错第 2 题 → 应进入错题本');
const cards2 = $$('#list-s1 .q');
const wrongLabel = bank.stage1[1].answer ? '错' : '对';
const wrongBtn = Array.from(cards2[1].querySelectorAll('.btn')).find((b) => b.textContent.trim() === wrongLabel);
wrongBtn.click();

const card1 = $$('#list-s1 .q')[1];
ok('题卡变为 wrong 样式', card1.classList.contains('wrong'), card1.className);
ok('解析显示"答错了"', card1.querySelector('.verdict').textContent.includes('答错'));
ok('统计 错题=1', $('#st-wrong').textContent === '1', $('#st-wrong').textContent);
ok('正确率=50%', $('#st-rate').textContent === '50%', $('#st-rate').textContent);

const wrongItems = $$('#list-wrong .q');
ok('错题本出现 1 题', wrongItems.length === 1, '实际 ' + wrongItems.length);

// ---- 5. 错题本"重做" ----
console.log('\n[5] 错题本 重做 按钮');
const redoBtn = wrongItems[0].querySelector('.btn');
ok('错题本每题有重做按钮', !!redoBtn, redoBtn && redoBtn.textContent);
redoBtn.click();
ok('重做后错题本清空', $$('#list-wrong .q').length === 0, '仍有 ' + $$('#list-wrong .q').length);
ok('重做后 已答=1', $('#st-done').textContent === '1', $('#st-done').textContent);

// ---- 6. 第二关 ----
console.log('\n[6] 第二关');
const s2Cards = $$('#list-s2 .q');
ok('渲染 75 张题卡', s2Cards.length === 75, '实际 ' + s2Cards.length);
ok('首题含代码块', !!s2Cards[0].querySelector('pre code'));
ok('首题初始隐藏答案', !s2Cards[0].querySelector('.explain'));
const revealBtn = s2Cards[0].querySelector('.btn');
ok('有"查看答案"按钮', revealBtn && revealBtn.textContent.includes('查看答案'), revealBtn && revealBtn.textContent);
revealBtn.click();
const s2first = $$('#list-s2 .q')[0];
ok('展开后出现答案解析', !!s2first.querySelector('.explain'));
ok('答案含实际输出', s2first.querySelector('.explain').innerHTML.includes('实际输出'));
const outEl = s2first.querySelector('.explain code');
ok('输出值非空且不是 undefined', !!outEl && outEl.textContent.trim() !== '' && outEl.textContent.trim() !== 'undefined',
  outEl ? JSON.stringify(outEl.textContent.slice(0, 40)) : '无 code 元素');
ok('第二关计数=1', $('#s2-done').textContent === '1', $('#s2-done').textContent);

// ---- 7. 面试速查 ----
console.log('\n[7] 面试速查');
const ivItems = $$('#list-iv details.iv');
ok('渲染面试题若干', ivItems.length > 0, '实际 ' + ivItems.length);
ok('计数与渲染一致', $('#iv-count').textContent === String(ivItems.length));
const ivFirst = ivItems[0].querySelector('summary');
ok('首题默认折叠', !ivItems[0].hasAttribute('open'));
ok('首题有题号 chip', !!ivItems[0].querySelector('.numchip'));

// 搜索过滤：用三篇里稳定存在的关键词
const before = ivItems.length;
$('#iv-search').value = 'commit';
$('#iv-search').dispatchEvent(new window.Event('input', { bubbles: true }));
const after = $$('#list-iv details.iv').length;
ok('搜索 "commit" 能过滤', after > 0 && after < before, before + ' → ' + after);
$('#iv-search').value = 'zzz不可能匹配zzz';
$('#iv-search').dispatchEvent(new window.Event('input', { bubbles: true }));
ok('无匹配显示空状态', !!$('#list-iv .empty'));
$('#iv-search').value = '';
$('#iv-search').dispatchEvent(new window.Event('input', { bubbles: true }));
ok('清空搜索恢复全量', $$('#list-iv details.iv').length === before, String($$('#list-iv details.iv').length));

// ---- 8. 标签页 ----
console.log('\n[8] 标签页切换');
const tabs = $$('.tab');
ok('有 5 个标签', tabs.length === 5, '实际 ' + tabs.length);
tabs[3].click();
ok('点击后对应面板激活', $('#p-wrong').classList.contains('on'));
ok('其他面板隐藏', !$('#p-home').classList.contains('on'));
tabs[4].click();
ok('切到面试速查', $('#p-iv').classList.contains('on') && !$('#p-wrong').classList.contains('on'));
tabs[1].click();
ok('切到第一关', $('#p-s1').classList.contains('on'));

// ---- 9. 全对流程 ----
console.log('\n[9] 全部答对 → 统计与错题本');
$$('.tab')[0].click();
$('#all-reset').click();
$$('#list-s1 .q').forEach((card, i) => {
  const item = bank.stage1[i];
  const label = item.answer ? '对' : '错';
  const btn = Array.from(card.querySelectorAll('.btn')).find((b) => b.textContent.trim() === label);
  btn.click();
});
ok('全对后 已答=60', $('#st-done').textContent === '60', $('#st-done').textContent);
ok('全对后 正确=60', $('#st-ok').textContent === '60', $('#st-ok').textContent);
ok('全对后 正确率=100%', $('#st-rate').textContent === '100%', $('#st-rate').textContent);
ok('全对后 错题=0', $('#st-wrong').textContent === '0', $('#st-wrong').textContent);
ok('全对后错题本为空状态', !!$('#list-wrong .empty'));
ok('进度条 100%', $('#bar').style.width === '100%', $('#bar').style.width);

// ---- 10. 进度持久化 ----
console.log('\n[10] 进度持久化（模拟重开页面）');
const saved = store[KEY];
ok('localStorage 有进度数据', !!saved);
const parsed = JSON.parse(saved);
ok('保存了 60 题作答', Object.keys(parsed.s1 || {}).length === 60, '实际 ' + Object.keys(parsed.s1 || {}).length);

console.log('\n========================================');
console.log(pass + ' 通过 / ' + fail + ' 失败');
if (fail === 0) console.log('✅ 练习站交互全部正常');
else console.log('❌ 存在 ' + fail + ' 个问题');
process.exitCode = fail === 0 ? 0 : 1;
