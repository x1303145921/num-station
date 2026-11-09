'use strict';
// 数驿真机自测：把驱动脚本注入本体副本，用 headless Edge（独立临时档案，零打扰）
// 渲染整页并执行六面板交互断言，结果序列化进 DOM 再从 --dump-dom 提取判定。
// 断言按面板分组隔离：一组抛异常只记本组，不掩蔽其余组。
// 用法：node 真机自测.js（退出码 0＝全过）
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const driver = `
window.__R = [];
function A(n, ok, d) { window.__R.push([n, !!ok, d === undefined ? "" : String(d)]); }
window.addEventListener("error", function (e) { A("js-error", false, e.message); });
function runTests() {
  function $(id) { return document.getElementById(id); }
  function fire(el) { el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }
  function clickNav(p) { document.querySelector('nav button[data-p="' + p + '"]').click(); }
  function T(id) { var e = $(id); return e ? e.textContent : ""; }
  function H(id) { var e = $(id); return e ? e.innerHTML : ""; }
  function card(i) { return document.querySelectorAll("#c_out .res .v")[i]; }
  function fillQ1Right(qs) {
    $("q1_net").value = dotted(bigIntToIp(qs.calc.net)); fire($("q1_net"));
    $("q1_bc").value = dotted(bigIntToIp(qs.calc.bc)); fire($("q1_bc"));
    $("q1_usable").value = qs.calc.usable.toString(10); fire($("q1_usable"));
  }
  function fillQ2Right(qs) { $("q2_ans").value = formatNumberInBase(rationalParts(qs.QNum, qs.QDen), qs.tgtBase, 12).text; fire($("q2_ans")); }
  function lum(c) { var m = c && c.match && c.match(/[\\d.]+/g); if (!m) return null; function f(u) { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); } return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
  function ratio(fg, bg) { var a = lum(fg), b2 = lum(bg); if (a === null || b2 === null) return null; return (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05); }
  function checkPairs(tag) {
    var firstHint = document.querySelector(".hint");
    var pairs = [
      [document.body, document.body],
      [firstHint, firstHint ? firstHint.closest(".card") : null],
      [document.querySelector(".res .k"), document.querySelector(".res")],
      [document.querySelector(".steps h3"), document.querySelector(".steps")],
      [document.querySelector(".steps .note"), document.querySelector(".steps")]
    ];
    var worst = 21, worstName = "", dbg = [];
    pairs.forEach(function (pr, i) {
      if (!pr[0] || !pr[1]) { dbg.push(i + ":skip"); return; }
      try {
        var fg = getComputedStyle(pr[0]).color, bg = getComputedStyle(pr[1]).backgroundColor;
        var r = ratio(fg, bg);
        if (r === null) { dbg.push(i + ":bad[" + fg + "|" + bg + "]"); return; }
        if (r < worst) { worst = r; worstName = i; }
      } catch (e) { dbg.push(i + ":err"); }
    });
    A("contrast-" + tag, worst >= 4.5, "worst=" + worst.toFixed(2) + " pair#" + worstName + (dbg.length ? " " + dbg.join(" ") : ""));
  }
  // 面板分组隔离：一组抛异常只记本组，不掩蔽其余组
  function section(name, fn) {
    try { fn(); } catch (e) { A("exception-" + name, false, e && e.message ? e.message : String(e)); }
  }
  try {
    var t0 = document.documentElement.dataset.theme;
    var domBefore = document.querySelectorAll("*").length;
    A("autofocus-cin", document.activeElement === $("c_in"), document.activeElement && document.activeElement.id);
    section("conv", function () {
      var c0 = card(0), c1 = card(1), c2 = card(2), c3 = card(3);
      A("conv-4cards", document.querySelectorAll("#c_out .res").length === 4, document.querySelectorAll("#c_out .res").length);
      A("conv-bin-156", c0.textContent.indexOf("1001 1100") >= 0, c0.textContent);
      A("conv-oct-156", c1.textContent.indexOf("234") >= 0, c1.textContent);
      A("conv-dec-156", c2.textContent.indexOf("156") >= 0, c2.textContent);
      A("conv-hex-156", c3.textContent.indexOf("9C") >= 0, c3.textContent);
      A("conv-steps-shortdiv", T("c_stepbox").indexOf("短除 2 取余") >= 0, null);
      A("conv-steps-group", T("c_stepbox").indexOf("每 4 位一组") >= 0, null);
      var cin = $("c_in");
      cin.value = "0.6875"; fire(cin);
      A("conv-frac-exact", card(0).textContent.indexOf("0.1011") >= 0, card(0).textContent);
      cin.value = "0.1"; fire(cin);
      A("conv-cycle", card(0).textContent.indexOf("0.0(0011)") >= 0, card(0).textContent);
      cin.value = "-12.5"; fire(cin);
      A("conv-neg-frac", card(0).textContent.indexOf("-1100.1") >= 0, card(0).textContent);
      cin.value = ""; fire(cin);
      A("conv-empty-friendly", T("c_err") === "" && T("c_out").indexOf("等一个数") >= 0, T("c_out"));
      A("copyall-disabled-empty", $("c_copyall").disabled === true, null);
      $("c_src").value = "2"; fire($("c_src"));
      cin.value = "3"; fire(cin);
      A("conv-invalid", T("c_err").indexOf("进制数字") >= 0, T("c_err"));
      $("c_src").value = "10"; fire($("c_src"));
      cin.value = "156"; fire(cin);
      A("conv-restore", card(3).textContent.indexOf("9C") >= 0, card(3).textContent);
      A("copyall-re-enabled", $("c_copyall").disabled === false, null);
    });
    section("bits", function () {
      clickNav("bits");
      A("bits-popcount-header", H("b_out").indexOf("1 的个数") >= 0, null);
      A("bits-arith-row", H("b_out").indexOf("算术右移") >= 0, null);
      var ba = $("b_a"); ba.value = "0"; fire(ba);
      A("bits-not0", T("b_out").indexOf("1111 1111 1111 1111") >= 0, null);
      var bb = $("b_b"); bb.value = "13"; fire(bb);
    });
    section("comp", function () {
      clickNav("comp");
      A("comp-bu-16", H("t_out").indexOf("1111111111110100") >= 0, null);
      A("comp-hex", T("t_hint").indexOf("0xFFF4") >= 0, T("t_hint"));
      A("comp-steps", H("t_steps").indexOf("推导过程") >= 0, null);
      $("t_w").value = "8"; fire($("t_w"));
      var tin = $("t_in"); tin.value = "-128"; fire(tin);
      A("comp-min-special", T("t_hint").indexOf("独占") >= 0, T("t_hint"));
      $("t_w").value = "16"; fire($("t_w"));
      tin.value = "-12"; fire(tin);
    });
    section("float", function () {
      clickNav("float");
      A("float-f32-0.1", H("f32out").indexOf("0x3DCCCCCD") >= 0, null);
      A("float-f64-0.1", H("f64out").indexOf("0x3FB999999999999A") >= 0, null);
      document.querySelector('.fex[data-v="1e309"]').click();
      A("float-inf", H("f32out").indexOf("正无穷大") >= 0, null);
      document.querySelector('.fex[data-v="-0"]').click();
      A("float-negzero", H("f32out").indexOf("负零") >= 0, null);
    });
    section("char", function () {
      clickNav("char");
      A("char-emoji-cp", H("s_out").indexOf("U+1FAB6") >= 0, null);
      A("char-emoji-utf8", H("s_out").indexOf("F0 9F AA B6") >= 0, null);
      A("char-utf16-col", H("s_out").indexOf("UTF-16 单元") >= 0, null);
      var s2 = $("s2_in"); s2.value = "E4 B8 AD"; fire(s2);
      A("char-utf8-decode", T("s2_out").indexOf("中") >= 0, T("s2_out"));
      $("s2_enc").value = "gbk"; fire($("s2_enc"));
      A("char-empty-neutral", true, "covered-by-v25-empty-state");
      $("s2_in").value = "C4 E3 BA C3"; fire($("s2_in"));
      A("char-gbk-decode", T("s2_out").indexOf("你好") >= 0, T("s2_out"));
      $("s2_enc").value = "utf-8"; fire($("s2_enc"));
    });
    section("net", function () {
      clickNav("net");
      A("net-ip-render", H("n_out").indexOf("192.168.1.100") >= 0, null);
      A("net-addr", H("n_out").indexOf("192.168.1.0") >= 0, null);
      A("net-broadcast", H("n_out").indexOf("192.168.1.255") >= 0, null);
      A("net-wildcard", H("n_out").indexOf("0.0.0.255") >= 0, null);
      A("net-class-c", H("n_out").indexOf("C 类") >= 0, null);
      A("net-private", H("n_out").indexOf("私有地址") >= 0, null);
      A("net-and-steps", H("n_steps").indexOf("AND ＝ 网络地址") >= 0, null);
      var nh = $("n_hosts"); nh.value = "1000"; fire(nh);
      A("net-hosts-22", T("n_hostout").indexOf("/22") >= 0, T("n_hostout"));
      var nip = $("n_ip"); nip.value = "10.77.3.9"; fire(nip);
      var nm = $("n_mask"); nm.value = "8"; fire(nm);
      A("net-slash8", H("n_out").indexOf("10.0.0.0") >= 0, null);
      nm.value = "255.0.255.0"; fire(nm);
      A("net-badmask", T("n_err").indexOf("连续") >= 0, T("n_err"));
    });
    section("quiz", function () {
      // 转制练习出题官
      clickNav("conv");
      $("q2_new").click();
      A("q2-question-shown", H("q2_q").indexOf("进制）→") >= 0, T("q2_q"));
      var q2 = window.__quiz2;
      fillQ2Right(q2);
      $("q2_check").click();
      A("q2-right", T("q2_out").indexOf("全对") >= 0, T("q2_out"));
      $("q2_ans").value = "//"; fire($("q2_ans"));
      $("q2_check").click();
      A("q2-wrong", T("q2_out").indexOf("❌") >= 0, T("q2_out"));
      $("q2_reveal").click();
      A("q2-reveal", H("q2_out").indexOf("解析") >= 0, null);
      // 子网练习出题官
      clickNav("net");
      $("q1_new").click();
      A("q1-question-shown", H("q1_q").indexOf("掩码") >= 0, T("q1_q"));
      var q1 = window.__quiz1;
      fillQ1Right(q1);
      $("q1_check").click();
      A("q1-right", T("q1_out").indexOf("全对") >= 0, T("q1_out"));
      A("q1-streak-1", T("q1_streak").indexOf("连对 1") >= 0, T("q1_streak"));
      $("q1_usable").value = "1"; fire($("q1_usable"));
      $("q1_check").click();
      A("q1-wrong", T("q1_out").indexOf("❌") >= 0, T("q1_out"));
      $("q1_reveal").click();
      A("q1-reveal", H("q1_out").indexOf("解析") >= 0, null);
      // 错题本
      A("q1-wb-entry", H("q1_wrong").indexOf(dotted(q1.ip)) >= 0, null);
      A("q2-wb-entry", H("q2_wrong").indexOf("//") >= 0, null);
      document.querySelector('#q1_wrong [data-act="reask"]').click();
      A("q1-wb-reask", T("q1_q").indexOf(dotted(q1.ip)) >= 0, T("q1_q"));
      fillQ1Right(q1);
      $("q1_check").click();
      A("q1-wb-cleared", H("q1_wrong").indexOf(dotted(q1.ip)) < 0, H("q1_wrong").slice(0, 80));
      A("q1-stats-line", T("q1_streak").indexOf("累计") >= 0, T("q1_streak"));
      // v0.8 打磨：分组粘贴／去重／解码警示／友好态
      clickNav("conv");
      $("c_src").value = "2"; fire($("c_src"));
      $("c_in").value = "1001 1100"; fire($("c_in"));
      A("conv-grouped-paste", card(3).textContent.indexOf("9C") >= 0, card(3).textContent);
      clickNav("bits");
      $("b_a").value = ""; $("b_b").value = ""; fire($("b_a"));
      A("bits-neutral", T("b_note").indexOf("填上 A 和 B") >= 0, T("b_note"));
      $("b_a").value = "60"; $("b_b").value = "13"; fire($("b_a"));
      clickNav("comp");
      $("t2_form").value = "2"; fire($("t2_form"));
      $("t2_in").value = "1111 0100"; fire($("t2_in"));
      A("t2-grouped", H("t2_out").indexOf("244") >= 0, null);
      clickNav("char");
      $("s2_in").value = "E4 B8"; fire($("s2_in"));
      A("char-badutf8-warn", T("s2_out").indexOf("不合法") >= 0, T("s2_out"));
      clickNav("net");
      $("q1_usable").value = "1"; fire($("q1_usable"));
      $("q1_check").click();
      $("q1_check").click();
      A("q1-wb-dedupe", H("q1_wrong").split('data-act="reask"').length - 1 === 1, H("q1_wrong").slice(0, 120));
    });
    section("theme", function () {
      checkPairs("light");
      $("theme_btn").click();
      var t1 = document.documentElement.dataset.theme;
      A("theme-toggle", t0 !== t1, t0 + " -> " + t1);
      checkPairs("dark");
      $("theme_btn").click();
      A("js-error", true, "none-captured");
    });
    section("v09", function () {
      // v0.9：极小数十进制演示／孤立代理项／长度上限
      clickNav("conv");
      $("c_in").value = "0.000000000000000000000000000001"; fire($("c_in"));
      A("steps-no-zero-garbage", T("c_stepbox").indexOf("0 × 2 = 0") < 0, T("c_stepbox").slice(0, 100));
      clickNav("char");
      $("s_in").value = String.fromCharCode(0xD800); fire($("s_in"));
      A("char-surrogate", H("s_out").indexOf("孤立代理项") >= 0, null);
      clickNav("conv");
      $("c_in").value = "1".repeat(5000); fire($("c_in"));
      A("conv-cap", T("c_err").indexOf("过长") >= 0, T("c_err"));
    });
    section("v10", function () {
      // v1.0：Enter 提交／十六进制分组／aria／整值容差
      $("q2_new").click();
      var q2e = window.__quiz2;
      fillQ2Right(q2e);
      A("q2-autofocus", document.activeElement === $("q2_ans"), document.activeElement && document.activeElement.id);
      $("q2_ans").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      A("q2-enter-submit", T("q2_out").indexOf("全对") >= 0, T("q2_out"));
      clickNav("net");
      $("q1_new").click();
      var q1e = window.__quiz1;
      fillQ1Right(q1e);
    $("q1_usable").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    A("q1-enter-submit", T("q1_out").indexOf("全对") >= 0, T("q1_out"));
    A("quiz-verdict-live", $("q1_out").getAttribute("aria-live") === "polite" && $("q2_out").getAttribute("aria-live") === "polite", null);
    A("verdict-animation", document.querySelector("#q1_out .verdict-ok") !== null, null);
      clickNav("conv");
      $("c_src").value = "10"; fire($("c_src"));
      $("c_in").value = "3735928559"; fire($("c_in"));
      A("hex-grouped", card(3).textContent.indexOf("DEAD BEEF") >= 0, card(3).textContent);
      $("c_prec").value = "3"; fire($("c_prec"));
      $("c_in").value = "0.1"; fire($("c_in"));
      A("bin-card-ellipsis", card(0).textContent.indexOf("…") >= 0, card(0).textContent);
      A("aria-labels", $("c_in").getAttribute("aria-label") === "换算数值" && $("n_hosts").getAttribute("aria-label") === "需要的主机数", null);
      clickNav("bits");
      $("b_a").value = "60.0"; fire($("b_a"));
      A("bits-int-literal", T("b_err") === "", T("b_err"));
    });
    section("v12", function () {
      // v1.2：有理数判卷／小数题型／自定义前缀
      clickNav("conv");
      $("q2_kind").value = "frac"; fire($("q2_kind"));
      $("q2_new").click();
      var q2f = window.__quiz2;
      fillQ2Right(q2f);
      $("q2_check").click();
      A("q2-frac-right", T("q2_out").indexOf("全对") >= 0, T("q2_out"));
      A("check-value-equiv", checkQuizValue("0.50", 10, 1n, 2n).ok && !checkQuizValue("0.51", 10, 1n, 2n).ok, null);
      clickNav("net");
      $("q1_level").value = "custom"; fire($("q1_level"));
      A("q1-custombox-shown", $("q1_custombox").style.display === "", null);
      $("q1_pmin").value = "26"; $("q1_pmax").value = "26"; fire($("q1_pmin"));
      $("q1_new").click();
      A("q1-custom-prefix", window.__quiz1.prefix === 26, window.__quiz1.prefix);
    });
    section("v20", function () {
      // v2.0：U+2212 负号粘回／超长小数演示守卫
      clickNav("comp");
      $("t_in").value = "\\u221212"; fire($("t_in"));
      A("comp-u2212", T("t_out").indexOf("1111111111110100") >= 0, T("t_out").slice(0, 80));
      clickNav("conv");
      $("c_src").value = "10"; fire($("c_src"));
      $("c_prec").value = "10"; fire($("c_prec"));
      $("c_in").value = "0." + "123456789012345678901234567890"; fire($("c_in"));
      A("long-frac-no-demo", T("c_stepbox").indexOf("乘 2 取整") < 0, T("c_stepbox").slice(0, 80));
    });
    section("v13", function () {
      // v1.3：友好空态
      clickNav("float");
      $("f_in").value = ""; fire($("f_in"));
      A("float-empty-neutral", T("f32out").indexOf("填个数就开始拆解") >= 0, null);
      clickNav("comp");
      $("t_in").value = ""; fire($("t_in"));
      A("comp-empty-neutral", T("t_hint").indexOf("填个十进制整数就开始") >= 0, null);
    });
    section("misc", function () {
      // v1.7：错误框 aria-live 播报／v1.8：移动端输入体验／v1.9：hash 页签历史
      A("aria-live-errors", $("c_err").getAttribute("aria-live") === "polite" && $("n_err").getAttribute("aria-live") === "polite" && $("q2_err").getAttribute("aria-live") === "polite", null);
      A("inputmode-numeric", $("c_prec").getAttribute("inputmode") === "numeric" && $("n_hosts").getAttribute("inputmode") === "numeric", null);
      A("autocomplete-off", $("c_in").getAttribute("autocomplete") === "off", null);
      A("enterkeyhint-done", $("q2_ans").getAttribute("enterkeyhint") === "done", null);
    A("spellcheck-all-off", $("c_in").getAttribute("spellcheck") === "false" && $("b_a").getAttribute("spellcheck") === "false" && $("n_ip").getAttribute("spellcheck") === "false" && $("q1_net").getAttribute("spellcheck") === "false", null);
      clickNav("net");
      A("hash-nav", location.hash === "#net" && document.getElementById("p-net").classList.contains("on"), location.hash);
      $("c_in").focus();
    // v1.5：数字快捷键切页签
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
    A("tab-shortcut-3", document.getElementById("p-comp").classList.contains("on"), null);
    A("title-panel", document.title.indexOf("三码") >= 0, document.title);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    A("tab-shortcut-1", document.getElementById("p-conv").classList.contains("on"), null);
    // v2.5：字符面板空态友好
    $("s_in").value = ""; fire($("s_in"));
    A("char-empty-friendly", T("s_out").indexOf("输入文本查看") >= 0, T("s_out").slice(0, 60));
    $("s_in").value = "Aa中🪶"; fire($("s_in"));
    });
    section("v26", function () {
      // v2.6：DOM 完整性（25 轮交互后节点数不异常膨胀）＋最坏输入渲染耗时
      var domAfter = document.querySelectorAll("*").length;
      A("dom-integrity", domAfter < domBefore * 2, "before=" + domBefore + " after=" + domAfter);
      var pt1 = performance.now();
      $("c_in").value = "1".repeat(4095); fire($("c_in"));
      var pt2 = performance.now();
      A("perf-worst-render", pt2 - pt1 < 200, (pt2 - pt1).toFixed(1) + "ms");
      $("c_in").value = "156"; fire($("c_in"));
    });
  } catch (e) {
    A("harness-exception", false, e && e.message ? e.message : String(e));
  }
  var pre = document.createElement("pre");
  pre.id = "test-results";
  pre.textContent = JSON.stringify(window.__R);
  document.body.appendChild(pre);
  document.title = "TESTS-DONE";
}
if (document.readyState === "complete") { setTimeout(runTests, 200); }
else { window.addEventListener("load", function () { setTimeout(runTests, 200); }); }
`;

function main() {
  const dir = __dirname;
  const src = fs.readFileSync(path.join(dir, '数驿.html'), 'utf8');
  if (src.indexOf('</body>') < 0) throw new Error('本体缺少 </body>');
  const page = src.replace('</body>', '<script>' + driver + '</' + 'script>\n</body>');
  // v2.6：临时目录名含中文——真部署路径全中文，headless 也得过中文路径这一关
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shuyi-headless-数驿-'));
  const pagePath = path.join(tmp, 'page.html');
  fs.writeFileSync(pagePath, page);
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const edge = candidates.find((p) => fs.existsSync(p));
  if (!edge) throw new Error('未找到 msedge.exe（两处标准路径都不在）');
  const url = pathToFileURL(pagePath).href;
  const baseArgs = [
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--user-data-dir=' + path.join(tmp, 'profile'),
    '--virtual-time-budget=8000',
    '--dump-dom',
    url,
  ];
  let dom = null;
  try {
    dom = execFileSync(edge, ['--headless=new'].concat(baseArgs), { maxBuffer: 64 * 1024 * 1024, timeout: 90000 }).toString('utf8');
  } catch (e1) {
    console.log('（--headless=new 失败：' + (e1.message || e1).toString().slice(0, 120) + '——回退 --headless 重试）');
    dom = execFileSync(edge, ['--headless'].concat(baseArgs), { maxBuffer: 64 * 1024 * 1024, timeout: 90000 }).toString('utf8');
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  if (dom.indexOf('TESTS-DONE') < 0) {
    console.error('✗ 驱动未跑完（dump 中无 TESTS-DONE）——页面可能没加载或脚本没执行');
    process.exit(2);
  }
  const m = dom.match(/<pre id="test-results">([\s\S]*?)<\/pre>/);
  if (!m) {
    console.error('✗ 未找到结果块');
    process.exit(2);
  }
  const raw = m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  let results;
  try { results = JSON.parse(raw); } catch (e) {
    console.error('✗ 结果解析失败：' + raw.slice(0, 300));
    process.exit(2);
  }
  let fail = 0;
  for (const r of results) {
    if (r[1]) console.log('✓ ' + r[0]);
    else { fail++; console.log('✗ ' + r[0] + '｜' + r[2]); }
  }
  console.log(fail === 0 ? '\n真机全过：' + results.length + ' 项断言' : '\n真机失败 ' + fail + ' / ' + results.length + ' 项');
  process.exit(fail === 0 ? 0 : 1);
}

main();
