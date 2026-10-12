/**
 * 把教程的所有 Markdown 合成一个自包含的单文件 HTML 阅读版。
 *
 * 本教程「三篇合一」：Git / 网络 HTTP / Docker，每篇 12 章。
 *
 * 用法（在 tools 目录下）：
 *   node build-html.mjs
 *
 * 输出：<仓库根>/Git-从零到一-阅读版.html
 */

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'Git-从零到一-阅读版.html');

// 三篇的目录与标题（顺序：Git → HTTP → Docker）
const TRACKS = [
  { dir: 'git', label: '第一篇 · Git' },
  { dir: 'http', label: '第二篇 · 网络与 HTTP' },
  { dir: 'docker', label: '第三篇 · Docker' },
];

// ---------- 1. 收集章节，按顺序 ----------
const parts = [
  { file: 'README.md', title: '开始之前 · 学习路线', id: 'ch-readme' },
];

for (const t of TRACKS) {
  const dir = path.join('docs', t.dir);
  const absDir = path.join(ROOT, dir);
  const files = fs.readdirSync(absDir).filter((f) => f.endsWith('.md')).sort();
  for (const f of files) {
    parts.push({
      file: path.join(dir, f),
      title: t.label + ' · ' + f.replace(/\.md$/, ''),
      id: 'ch-' + t.dir + '-' + f.slice(0, 2),
    });
  }
}

// 三个速通版放最后
parts.push(
  { file: '速通版-2小时上手Git.md', title: '🚀 速通版 · Git（2 小时）', id: 'ch-quick-git' },
  { file: '速通版-2小时上手网络与HTTP.md', title: '🚀 速通版 · 网络与 HTTP（2 小时）', id: 'ch-quick-http' },
  { file: '速通版-2小时上手Docker.md', title: '🚀 速通版 · Docker（2 小时）', id: 'ch-quick-docker' },
);

// 文件名 -> 锚点，用于重写内部链接
const fileToAnchor = new Map();
for (const p of parts) {
  const base = path.basename(p.file);
  fileToAnchor.set(base, p.id);
  fileToAnchor.set(p.file.replace(/\\/g, '/'), p.id);
}

// ---------- 2. 配置 marked ----------
function slug(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(tokens.map((t) => t.raw ?? '').join(''));
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

// ---------- 3. 逐章转换 ----------
const sections = [];
const toc = [];

for (const p of parts) {
  const abs = path.join(ROOT, p.file);
  if (!fs.existsSync(abs)) {
    console.warn('[跳过] 不存在: ' + p.file);
    continue;
  }
  let md = fs.readFileSync(abs, 'utf8');

  // 重写内部 .md 链接为锚点
  md = md.replace(/\[([^\]]*)\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (full, label, target, hash) => {
    const base = path.basename(target);
    const anchor = fileToAnchor.get(base) ?? fileToAnchor.get(target.replace(/\\/g, '/'));
    if (anchor) return `[${label}](#${anchor}${hash ? '-' + slug(hash.slice(1)) : ''})`;
    return label;
  });

  const html = marked.parse(md);
  sections.push(`<section class="chapter" id="${p.id}" data-title="${p.file}">\n${html}\n</section>`);

  const subs = [];
  const re = /^## (.+)$/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    const t = m[1].replace(/[`*]/g, '').trim();
    subs.push({ title: t, id: slug(t) });
  }
  toc.push({ ...p, subs });
  console.log('[合并] ' + p.file.padEnd(40) + (html.length / 1024).toFixed(0).padStart(5) + ' KB HTML');
}

// ---------- 4. 生成导航 ----------
const navHtml = toc
  .map(
    (c) => `<div class="nav-group">
  <a class="nav-chapter" href="#${c.id}">${escapeHtml(c.title)}</a>
  <div class="nav-subs">${c.subs
    .slice(0, 40)
    .map((s) => `<a class="nav-sub" href="#${c.id}::${s.id}" data-target="${s.id}">${escapeHtml(s.title)}</a>`)
    .join('')}</div>
</div>`,
  )
  .join('\n');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Git / 网络 HTTP / Docker 从零到一 · 中文实战教程</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --border: #d8dee4;
    --accent: #0969da; --code-bg: #f6f8fa; --mark: #fff8c5;
    --sidebar-bg: #f6f8fa;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.75 -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  }
  #layout { display: flex; min-height: 100vh; }

  #sidebar {
    width: 330px; flex: 0 0 330px; height: 100vh; position: sticky; top: 0;
    overflow-y: auto; background: var(--sidebar-bg);
    border-right: 1px solid var(--border); padding: 16px 12px 60px;
  }
  #search {
    width: 100%; padding: 8px 10px; margin-bottom: 12px;
    border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: #fff;
  }
  .nav-group { margin-bottom: 6px; }
  .nav-chapter {
    display: block; padding: 5px 8px; font-weight: 600; font-size: 14px;
    color: var(--fg); text-decoration: none; border-radius: 6px;
  }
  .nav-chapter:hover { background: #eaeef2; }
  .nav-subs { display: none; padding-left: 8px; }
  .nav-group.active .nav-subs { display: block; }
  .nav-sub {
    display: block; padding: 2px 8px; font-size: 12.5px; color: var(--muted);
    text-decoration: none; border-left: 2px solid transparent; border-radius: 0 4px 4px 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .nav-sub:hover { color: var(--accent); background: #eaeef2; border-left-color: var(--accent); }

  #content { flex: 1 1 auto; min-width: 0; padding: 32px 48px 120px; max-width: 900px; }
  .chapter { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 40px; }
  h1, h2, h3, h4 { line-height: 1.35; margin: 1.6em 0 0.6em; scroll-margin-top: 20px; }
  h1 { font-size: 2em; border-bottom: 2px solid var(--border); padding-bottom: .3em; margin-top: 2.2em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: .25em; }
  h3 { font-size: 1.22em; }
  h4 { font-size: 1.05em; }
  .chapter > h1:first-child, .chapter > h2:first-child { margin-top: 0; }
  a { color: var(--accent); }
  p { margin: 0.8em 0; }
  code {
    background: var(--code-bg); padding: .18em .38em; border-radius: 4px;
    font-family: "Cascadia Code", Consolas, "Courier New", monospace; font-size: .88em;
  }
  pre {
    background: var(--code-bg); padding: 14px 16px; border-radius: 8px;
    overflow-x: auto; border: 1px solid var(--border); line-height: 1.6;
  }
  pre code { background: none; padding: 0; font-size: 13.2px; }
  blockquote {
    margin: 1em 0; padding: .6em 1em; border-left: 4px solid var(--accent);
    background: #f6f8fa; color: #3b4149; border-radius: 0 6px 6px 0;
  }
  blockquote p { margin: .4em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 14.5px; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--border); padding: 7px 11px; text-align: left; vertical-align: top; }
  th { background: var(--code-bg); font-weight: 600; }
  tr:nth-child(even) td { background: #fbfcfd; }
  ul, ol { padding-left: 1.7em; }
  li { margin: .3em 0; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  mark.hit { background: var(--mark); }

  #top {
    position: fixed; right: 24px; bottom: 24px; width: 44px; height: 44px;
    border-radius: 50%; border: 1px solid var(--border); background: #fff;
    cursor: pointer; display: none; font-size: 18px; box-shadow: 0 2px 8px rgba(0,0,0,.12);
  }
  #progress {
    position: fixed; top: 0; left: 0; height: 3px; background: var(--accent);
    width: 0; z-index: 100; transition: width .1s;
  }

  @media (max-width: 900px) {
    #sidebar { display: none; }
    #content { padding: 20px 18px 80px; }
  }
  @media print {
    #sidebar, #top, #progress { display: none !important; }
    #content { max-width: none; padding: 0; }
    .chapter { page-break-after: always; border: none; }
    pre, blockquote, table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div id="progress"></div>
<div id="layout">
  <nav id="sidebar">
    <input id="search" type="search" placeholder="搜索目录…（回车跳转下一个）">
    ${navHtml}
  </nav>
  <main id="content">
${sections.join('\n')}
  </main>
</div>
<button id="top" title="回到顶部">↑</button>

<script>
(function () {
  var sidebar = document.getElementById('sidebar');
  var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        var idx = chapters.indexOf(e.target);
        groups.forEach(function (g, i) { g.classList.toggle('active', i === idx); });
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px' });
  chapters.forEach(function (c) { io.observe(c); });

  document.querySelectorAll('.nav-sub').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var group = a.closest('.nav-group');
      var idx = groups.indexOf(group);
      var chap = chapters[idx];
      if (!chap) return;
      var want = a.getAttribute('data-target');
      var heads = chap.querySelectorAll('h2, h3');
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].id === want) {
          ev.preventDefault();
          heads[i].scrollIntoView();
          history.replaceState(null, '', '#' + want);
          return;
        }
      }
    });
  });

  var search = document.getElementById('search');
  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    groups.forEach(function (g) {
      var hit = g.textContent.toLowerCase().indexOf(q) !== -1;
      g.style.display = hit ? '' : 'none';
      if (q) g.classList.add('active');
    });
  });
  search.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = document.querySelector('.nav-group:not([style*="display: none"]) .nav-chapter');
    if (first) first.click();
  });

  var top = document.getElementById('top');
  var bar = document.getElementById('progress');
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    top.style.display = window.scrollY > 600 ? 'block' : 'none';
  }, { passive: true });
  top.addEventListener('click', function () { window.scrollTo({ top: 0 }); });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('\n输出: ' + OUT);
console.log('大小: ' + (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
console.log('章节数: ' + sections.length);
