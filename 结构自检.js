'use strict';
// 数驿结构自检：对本体做机械交叉核对——id 唯一性／JS 引用 id 全存在／data-p↔section／
// CORE 导出完整性／脚本语法编译／标签平衡／JS 生成类名全有样式。
// 用法：node 结构自检.js（退出码 0＝全过）
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '数驿.html'), 'utf8');

let fail = 0, n = 0;
function ok(name, cond, detail) {
  n++;
  if (cond) console.log('✓ ' + name);
  else { fail++; console.log('✗ ' + name + (detail ? '｜' + detail : '')); }
}

// 1. id 唯一性
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
ok('id 唯一性（' + ids.length + ' 个）', dup.length === 0, dup.join(','));

// 2. 脚本块提取＋语法编译（页面脚本＋三个 JS 资产自身都过编译）
const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scriptBlocks.forEach((b, i) => {
  try { new Function(b); ok('script#' + (i + 1) + ' 语法编译', true); }
  catch (e) { ok('script#' + (i + 1) + ' 语法编译', false, e.message); }
});
for (const f of ['自测-核心.js', '真机自测.js', '结构自检.js']) {
  try { new Function(fs.readFileSync(path.join(__dirname, f), 'utf8')); ok(f + ' 语法编译', true); }
  catch (e) { ok(f + ' 语法编译', false, e.message); }
}
const js = scriptBlocks.join('\n');

// 3. JS 引用的 id 全存在（字面量引用；动态拼接不在列）
const idSet = new Set(ids);
const refs = new Set();
for (const m of js.matchAll(/\$\("([^"]+)"\)/g)) refs.add(m[1]);
for (const m of js.matchAll(/getElementById\("([^"]+)"\)/g)) refs.add(m[1]);
for (const m of js.matchAll(/'([a-z]{1,2}_[a-z0-9_]+)'/g)) refs.add(m[1]);
const missingRefs = [...refs].filter(r => r && !idSet.has(r));
ok('JS 引用 id 全存在（' + refs.size + ' 个引用）', missingRefs.length === 0, missingRefs.join(','));

// 4. data-p ↔ section 全对应
const ps = [...html.matchAll(/data-p="([^"]+)"/g)].map(m => m[1]);
const missingSec = ps.filter(p => !ids.includes('p-' + p));
ok('data-p ↔ section 全对应（' + ps.length + ' 个）', missingSec.length === 0, missingSec.join(','));

// 5. CORE 导出完整性：自测-核心.js 的 return 清单 ⊆ CORE 定义的函数与常量
const core = html.match(/\/\/<CORE>([\s\S]*?)\/\/<\/CORE>/)[1];
const coreFns = new Set([
  ...[...core.matchAll(/function ([A-Za-z_][A-Za-z0-9_]*)\(/g)].map(m => m[1]),
  ...[...core.matchAll(/const ([A-Za-z_][A-Za-z0-9_]*) =/g)].map(m => m[1]),
]);
const testSrc = fs.readFileSync(path.join(__dirname, '自测-核心.js'), 'utf8');
const retM = testSrc.match(/return \{([^}]*)\};/);
const retFns = retM ? retM[1].split(',').map(s => s.trim()).filter(Boolean) : [];
const missingFns = retFns.filter(f => !coreFns.has(f));
ok('自测导出全在 CORE（' + retFns.length + ' 个）', missingFns.length === 0, missingFns.join(','));

// 6. 标签平衡
for (const tag of ['div', 'section', 'details', 'table', 'span', 'button']) {
  const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  ok('<' + tag + '> 开闭平衡（' + open + '/' + close + '）', open === close, open + ' vs ' + close);
}

// 6b. CSS 括号平衡
const cssAll = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const cssOpen = (cssAll.match(/{/g) || []).length;
const cssClose = (cssAll.match(/}/g) || []).length;
ok('CSS 括号平衡（' + cssOpen + '/' + cssClose + '）', cssOpen === cssClose, cssOpen + ' vs ' + cssClose);

// 6c. 无内联 on*= 事件处理器（CSP 环境下会静默失效，防未来引入）
const inlineHandlers = (html.match(/\son[a-z]+\s*=\s*["']/gi) || []).length;
ok('无内联 on* 事件处理器', inlineHandlers === 0, inlineHandlers + ' 处');

// 6d. 版本串一致性：sub 与 footer 的版本号必须一致
const subs = [...html.matchAll(/青鸾造 · v([\d.]+)</g)].map(m => m[1]);
const ftrs = [...html.matchAll(/数驿 v([\d.]+) ·/g)].map(m => m[1]);
ok('版本串一致（sub=' + subs.join(',') + ' footer=' + ftrs.join(',') + '）',
  subs.length === 1 && ftrs.length === 1 && subs[0] === ftrs[0],
  'sub=' + subs.join(',') + ' footer=' + ftrs.join(','));

// 7. JS 生成类名全有样式（copy/feed/qb/fex 为 JS 事件委托钩子类，样式挂在元素选择器上，不在此列）
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const usedClasses = ['res', 'k', 'v', 'foot', 'steps', 'many', 'note', 'hint', 'err',
  'grid', 'row', 'card', 'meta', 'b1', 'os', 'oe', 'om', 'pill', 'act', 'on', 'cols', 'cheat', 'sub', 'toprow'];
const missingCss = usedClasses.filter(c => !css.includes('.' + c));
ok('JS 生成类名全有样式（' + usedClasses.length + ' 个）', missingCss.length === 0, missingCss.join(','));

// 8. 重复函数定义（同名 function 在页面脚本中出现两次＝脏）
const fns = [...js.matchAll(/^function ([A-Za-z_][A-Za-z0-9_]*)\(/gm)].map(m => m[1]);
const dupFns = fns.filter((x, i) => fns.indexOf(x) !== i);
ok('页面函数无重复定义（' + fns.length + ' 个）', dupFns.length === 0, dupFns.join(','));

console.log(fail === 0 ? '\n结构全过：' + n + ' 项核对' : '\n结构失败 ' + fail + ' / ' + n + ' 项');
process.exit(fail === 0 ? 0 : 1);
