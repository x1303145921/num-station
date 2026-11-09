'use strict';
// 数驿核心函数自测：从 数驿.html 抽 //<CORE>…//</CORE> 段在 node 里跑断言。
// 用法：node 自测-核心.js（与本文件同目录的 数驿.html）
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '数驿.html'), 'utf8');
const m = html.match(/\/\/<CORE>([\s\S]*?)\/\/<\/CORE>/);
if (!m) { console.error('✗ 未找到 CORE 标记'); process.exit(1); }
const api = new Function(m[1] +
  '\n;return {DIGITS, digitVal, isValidDigits, parseDigits, bigToBase, parseNumber, firstBadDigit, allowedHint, fracCycle, formatNumberInBase, dispThousands, groupBinary, shortDivisionSteps, expansionTerms, complementTriple, interpretBits, decomposeFloat32, decomposeFloat64, utf8Encode, parseIPv4, parseMask, prefixToMask, ipToBigInt, bigIntToIp, subnetCalc, hostsToPrefix, popcount, genQuestion, genConvQuestion, rationalParts, stripNum, checkQuizIp, checkQuizValue, accText, groupFromRight};')();

let fail = 0, n = 0;
const ser = (x) => JSON.stringify(x, (k, v) => typeof v === 'bigint' ? v.toString() + 'n' : v);
function eq(name, got, want) {
  n++;
  const ok = ser(got) === ser(want);
  if (!ok) { fail++; console.log('✗ ' + name + '｜got=' + ser(got) + ' want=' + ser(want)); }
  else console.log('✓ ' + name);
}

// 一、进制互转（v0.1 回归）
eq('255→hex', api.bigToBase(255n, 16), 'FF');
eq('255→bin', api.bigToBase(255n, 2), '11111111');
eq('8→八进制', api.bigToBase(8n, 8), '10');
eq('0→任意', api.bigToBase(0n, 7), '0');
eq('hex解析大小写', api.parseNumber('ff', 16).int, 255n);
eq('156→十六进制', api.formatNumberInBase(api.parseNumber('156', 10), 16, 10).text, '9C');
eq('二进制78→hex', api.formatNumberInBase(api.parseNumber('1001110', 2), 16, 10).text, '4E');
eq('二进制78→八进制', api.formatNumberInBase(api.parseNumber('1001110', 2), 8, 10).text, '116');
eq('二进制78→十进制', api.formatNumberInBase(api.parseNumber('1001110', 2), 10, 10).text, '78');
eq('负数带小数', api.formatNumberInBase(api.parseNumber('-12.5', 10), 2, 10).text, '-1100.1');
// 二、v0.1 漏洞回归：小数开头／前缀／非法字符定位
eq('.5 小数开头（v0.1 误拒）', api.parseNumber('.5', 10).fracNum, 5n);
eq('-.25 负小数', api.formatNumberInBase(api.parseNumber('-.25', 10), 2, 10).text, '-0.01');
eq('0x前缀', api.parseNumber('0x1F', 16).int, 31n);
eq('0b前缀', api.parseNumber('0b101', 2).int, 5n);
eq('0o前缀', api.parseNumber('0o17', 8).int, 15n);
eq('非法字符定位', api.firstBadDigit('12a', 10), { i: 2, ch: 'a' });
eq('非法字符定位基2', api.firstBadDigit('101x', 2), { i: 3, ch: 'x' });
eq('可用范围提示', api.allowedHint(2), '可用 0 ~ 1');
eq('可用范围提示36', api.allowedHint(36), '可用 0-9 与 A-Z（不分大小写）');
// 三、循环节检测（v0.2 新）
eq('10.6875→二进制精确', api.formatNumberInBase(api.parseNumber('10.6875', 10), 2, 10).text, '1010.1011');
eq('0.1→二进制循环节记法', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 10).text, '0.0(0011)');
eq('0.1 不精确', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 10).exact, false);
eq('截断 tail 标记出接口', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 3).tail, '…');
eq('1/3 循环节', api.fracCycle(1n, 3n, 10, 10), { terminates: false, cycleStart: 0, cycleLen: 1, digits: ['3'] });
eq('十六进制小数用字母位（v0.9 fuzz 抓获）', api.formatNumberInBase({ neg: false, int: 0n, fracNum: BigInt(3 * 9765625), fracDen: 10n ** 10n }, 16, 10).text, '0.00C');
eq('1/7 循环节长 6', api.fracCycle(1n, 7n, 10, 12).cycleLen, 6);
eq('0.5→二进制精确', api.fracCycle(5n, 10n, 2, 10).terminates, true);
// 四、千位分组（v0.2 新）
eq('千位分组', api.dispThousands('1048576'), '1\u202F048\u202F576');
eq('千位分组带小数负号', api.dispThousands('-1048576.25'), '-1\u202F048\u202F576.25');
eq('千位分组小值', api.dispThousands('999'), '999');
// 五、分组法
eq('分组16', api.groupBinary('10011100', 4).grouped, '1001 1100');
eq('分组映射', api.groupBinary('10011100', 4).mapLine, '1001→9  1100→C');
eq('分组带小数', api.groupBinary('1010.1011', 3).grouped, '001 010.101 100');
// 六、教学步骤
eq('短除法行数', api.shortDivisionSteps(156n, 2).lines.length, 8);
eq('短除法末行', api.shortDivisionSteps(156n, 2).lines[7], '1 ÷ 2 = 0 …… 余 1');
eq('156 不截断', api.shortDivisionSteps(156n, 2).truncated, false);
eq('2^53 截断标记', api.shortDivisionSteps(9007199254740991n, 2).truncated, true);
eq('按权展开', api.expansionTerms('9C', 16).terms, '9×16^1 + C×16^0');
eq('展开值', api.expansionTerms('9C', 16).value, '156');
eq('过大返回null', api.shortDivisionSteps(10000000000000000n, 2), null);
// 七、三码
eq('-1八位三码', api.complementTriple(-1n, 8), { yuan: '10000001', fan: '11111110', bu: '11111111' });
eq('-12十六位三码', api.complementTriple(-12n, 16), { yuan: '1000000000001100', fan: '1111111111110011', bu: '1111111111110100' });
eq('-128补码', api.complementTriple(-128n, 8).bu, '10000000');
eq('-128原码不可示', api.complementTriple(-128n, 8).yuan, null);
eq('+5三码相同', api.complementTriple(5n, 8), { yuan: '00000101', fan: '00000101', bu: '00000101' });
eq('超范围报错', api.complementTriple(128n, 8).err !== undefined, true);
eq('补码回读-1', api.interpretBits(255n, 8).signed, -1n);
eq('补码回读127', api.interpretBits(127n, 8).signed, 127n);
// 八、位运算负号（v0.1 被吞，v0.2 按补码截位）
eq('负数按补码截位', -5n & 0xFFFFn, 65531n);
eq('异或', 0b1100n ^ 0b1010n, 6n);
// 九、浮点
eq('f32 1.5 hex', api.decomposeFloat32(1.5).hex, '0x3FC00000');
eq('f32 0.1 hex', api.decomposeFloat32(0.1).hex, '0x3DCCCCCD');
eq('f32 0.1 有舍入', api.decomposeFloat32(0.1).stored !== 0.1, true);
eq('f64 0.1 hex', api.decomposeFloat64(0.1).hex, '0x3FB999999999999A');
eq('f64 0.1 精确', api.decomposeFloat64(0.1).stored === 0.1, true);
eq('f32 1.5 指数域', api.decomposeFloat32(1.5).e, 127);
eq('f32 1.5 尾数域', api.decomposeFloat32(1.5).m, 0x400000);
// 十、字符
eq('utf8 中', api.utf8Encode(0x4E2D), [0xE4, 0xB8, 0xAD]);
eq('utf8 A', api.utf8Encode(0x41), [0x41]);
eq('utf8 🐥 对照 Buffer', api.utf8Encode(0x1F425), [...Buffer.from('🐥', 'utf8')]);
// 十一、非法输入
eq('基2收3报错', api.parseNumber('3', 2).err !== undefined, true);
eq('空输入报错', api.parseNumber('', 10).err !== undefined, true);
eq('双点报错', api.parseNumber('1.2.3', 10).err !== undefined, true);
// 十二、循环节深检（v0.3 新：检测与显示解耦）
eq('1/2^30 二进制终止', api.fracCycle(1n, 2n ** 30n, 2, 96).terminates, true);
eq('1/2^30 终止于 30 位', api.fracCycle(1n, 2n ** 30n, 2, 96).digits.length, 30);
eq('1/41 循环节长 20', api.fracCycle(1n, 41n, 2, 96).cycleLen, 20);
eq('prec3 截断标记', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 3).text, '0.000…');
eq('prec3 循环节注记', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 3).detectNote.indexOf('循环节') >= 0, true);
eq('prec10 照旧括号记法', api.formatNumberInBase(api.parseNumber('0.1', 10), 2, 10).text, '0.0(0011)');
// 十三、网络（v0.3 新）
eq('IPv4 解析', api.parseIPv4('192.168.1.100').octets, [192, 168, 1, 100]);
eq('IPv4 超 255 报错', api.parseIPv4('256.1.1.1').err !== undefined, true);
eq('IPv4 段数报错', api.parseIPv4('1.2.3').err !== undefined, true);
eq('CIDR 掩码', api.parseMask('/24').prefix, 24);
eq('CIDR 无斜杠', api.parseMask('8').prefix, 8);
eq('点分掩码 24', api.parseMask('255.255.255.0').prefix, 24);
eq('点分掩码 16', api.parseMask('255.255.0.0').prefix, 16);
eq('不连续掩码报错', api.parseMask('255.0.255.0').err !== undefined, true);
eq('前缀 33 报错', api.parseMask('/33').err !== undefined, true);
eq('前缀转掩码 24', api.prefixToMask(24), [255, 255, 255, 0]);
eq('前缀转掩码 0', api.prefixToMask(0), [0, 0, 0, 0]);
eq('前缀转掩码 32', api.prefixToMask(32), [255, 255, 255, 255]);
eq('IP 往返', api.bigIntToIp(api.ipToBigInt([172, 16, 254, 9])), [172, 16, 254, 9]);
const s24 = api.subnetCalc([192, 168, 1, 100], 24);
eq('/24 网络地址', api.bigIntToIp(s24.net), [192, 168, 1, 0]);
eq('/24 广播地址', api.bigIntToIp(s24.bc), [192, 168, 1, 255]);
eq('/24 可用数', s24.usable, 254n);
eq('/24 分类 C', s24.cls, 'C 类');
eq('/24 私有', s24.priv.indexOf('私有') >= 0, true);
eq('/8 可用数', api.subnetCalc([10, 0, 0, 5], 8).usable, 16777214n);
eq('172.16 私有', api.subnetCalc([172, 16, 5, 9], 16).priv.indexOf('私有') >= 0, true);
eq('172.32 非私有', api.subnetCalc([172, 32, 0, 1], 16).priv.indexOf('私有') >= 0, false);
eq('127 环回', api.subnetCalc([127, 0, 0, 1], 8).priv.indexOf('环回') >= 0, true);
eq('/31 可用数', api.subnetCalc([10, 0, 0, 0], 31).usable, 2n);
eq('/32 可用数', api.subnetCalc([1, 2, 3, 4], 32).usable, 1n);
eq('掩码 10.0.0.0', api.bigIntToIp(api.subnetCalc([10, 77, 3, 9], 8).net), [10, 0, 0, 0]);
// 十四、popcount 与主机数反推（v0.4 新）
eq('popcount 0', api.popcount(0n), 0);
eq('popcount 1011', api.popcount(0b1011n), 3);
eq('popcount 255', api.popcount(255n), 8);
eq('popcount 高位单 1', api.popcount(2n ** 63n), 1);
eq('1 台→/30', api.hostsToPrefix(1n).prefix, 30);
eq('2 台→/30', api.hostsToPrefix(2n).prefix, 30);
eq('3 台→/29', api.hostsToPrefix(3n).prefix, 29);
eq('254 台→/24', api.hostsToPrefix(254n).prefix, 24);
eq('255 台→/23', api.hostsToPrefix(255n).prefix, 23);
eq('1000 台→/22', api.hostsToPrefix(1000n).prefix, 22);
eq('1000 台可用数', api.hostsToPrefix(1000n).usable, 1022n);
eq('超容量报错', api.hostsToPrefix(2n ** 32n).err !== undefined, true);
eq('0 台报错', api.hostsToPrefix(0n).err !== undefined, true);
eq('popcount 1', api.popcount(1n), 1);
eq('掩码 0 前缀', api.parseMask('0').prefix, 0);
eq('掩码 32 前缀', api.parseMask('32').prefix, 32);
// 十五、出题官（v0.6 新）
eq('出题 easy 零 rand', api.genQuestion('easy', () => 0), { ip: [0, 0, 0, 0], prefix: 8 });
eq('出题 easy 满 rand', api.genQuestion('easy', () => 0.999999), { ip: [255, 255, 255, 255], prefix: 24 });
const zh = api.genQuestion('hard', () => 0.499999);
eq('出题 hard 前缀在集内', [8, 12, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].indexOf(zh.prefix) >= 0, true);
const kg = api.genConvQuestion('easy', 'int', () => 0);
eq('转制出题 零 rand', kg, { srcBase: 2, tgtBase: 8, QNum: 1n, QDen: 1n });
eq('转制出题 异进制', kg.srcBase !== kg.tgtBase, true);
eq('stripNum 千位全角', api.stripNum('1 022，5'), '10225');
eq('判卷 IP 对', api.checkQuizIp('192.168.1.0', [192, 168, 1, 0]).ok, true);
eq('判卷 IP 带空格', api.checkQuizIp(' 192.168. 1.0 ', [192, 168, 1, 0]).ok, true);
eq('判卷 IP 错', api.checkQuizIp('10.0.0.1', [10, 0, 0, 0]).ok, false);
eq('判卷 IP 非法', api.checkQuizIp('abc', [1, 2, 3, 4]).msg !== undefined, true);
eq('战绩 零开局', api.accText(0, 0), '还没开练');
eq('战绩 七成一', api.accText(7, 5), '累计 7 题对 5 题（71%）');
eq('战绩 全对', api.accText(3, 3), '累计 3 题对 3 题（100%）');
// 十六、容错打磨（v0.8）
eq('分组粘贴 二进制', api.parseNumber('1001 1100', 2).int, 156n);
eq('分组粘贴 下划线', api.parseNumber('1_0111', 2).int, 23n);
eq('分组粘贴 千位逗号', api.parseNumber('12,345', 10).int, 12345n);
eq('前缀内空格', api.parseNumber('0x 1F', 16).int, 31n);
eq('双点仍报错', api.parseNumber('1. 2. 3', 10).err !== undefined, true);
eq('32 亿可用主机 前缀 0', api.hostsToPrefix(4294967294n).prefix, 0);
eq('超容量边界', api.hostsToPrefix(4294967295n).err !== undefined, true);
// 十七、往返不变量 fuzz（v0.9，确定性伪随机 LCG）
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let rtFails = 0, rtCases = 0;
for (let i = 0; i < 200; i++) {
  let v = 0n;
  for (let j = 0; j < 8; j++) v = (v << 16n) | BigInt(Math.floor(rnd() * 65536));
  if (rnd() < 0.3) v = v % (1n << BigInt(1 + Math.floor(rnd() * 64)));
  for (let b = 2; b <= 36; b++) {
    rtCases++;
    const s = api.bigToBase(v, b);
    if (api.parseDigits(s, b) !== v) rtFails++;
    const p = api.parseNumber(s, b);
    if (p.err || p.int !== v) rtFails++;
  }
}
eq('整数往返 ' + rtCases + ' 例', rtFails, 0);
// 第二种子批次（v2.6）：不同随机序列扩覆盖
seed = 12345;
rtFails = 0;
for (let i = 0; i < 200; i++) {
  let v = 0n;
  for (let j = 0; j < 8; j++) v = (v << 16n) | BigInt(Math.floor(rnd() * 65536));
  if (rnd() < 0.3) v = v % (1n << BigInt(1 + Math.floor(rnd() * 64)));
  for (let b = 2; b <= 36; b++) {
    rtCases++;
    const s = api.bigToBase(v, b);
    if (api.parseDigits(s, b) !== v) rtFails++;
    const p = api.parseNumber(s, b);
    if (p.err || p.int !== v) rtFails++;
  }
}
eq('整数往返二批 ' + rtCases + ' 例', rtFails, 0);
let frFails = 0, frCases = 0;
for (let k = 1; k <= 100; k++) {
  for (const b of [2, 4, 8, 10, 16, 32]) {
    frCases++;
    const p = { neg: false, int: 0n, fracNum: BigInt(k * 9765625), fracDen: 10n ** 10n };
    const t = api.formatNumberInBase(p, b, 30).text;
    const q = api.parseNumber(t, b);
    if (q.err || q.int !== 0n || q.fracNum * p.fracDen !== p.fracNum * q.fracDen) frFails++;
  }
}
eq('分数往返 ' + frCases + ' 例', frFails, 0);
// 十八、长度上限（v0.9）
eq('超长输入报错', api.parseNumber('1'.repeat(5000), 10).err !== undefined, true);
eq('超长判卷报错', api.checkQuizValue('1'.repeat(5000), 2, 1n).msg !== undefined, true);
// 十九、自右分组（v1.0）
eq('自右分组 8 位', api.groupFromRight('12345678', 4), '1234 5678');
eq('自右分组 短串不补', api.groupFromRight('9C', 4), '9C');
eq('自右分组 12 位', api.groupFromRight('123456789ABC', 4), '1234 5678 9ABC');
// 二十、出题扩展（v1.2：负数小数＋自定义前缀＋有理数判卷）
eq('有理数拆解 负分数', api.rationalParts(-21n, 2n), { neg: true, int: 10n, fracNum: 1n, fracDen: 2n });
eq('有理数拆解 正整数', api.rationalParts(255n, 1n), { neg: false, int: 255n, fracNum: 0n, fracDen: 1n });
eq('判值 负二进制小数', api.checkQuizValue('-1010.1', 2, -21n, 2n).ok, true);
eq('判值 等价形式 0.10', api.checkQuizValue('-1010.10', 2, -21n, 2n).ok, true);
eq('判值 符号错', api.checkQuizValue('1010.1', 2, -21n, 2n).ok, false);
eq('判值 十进制 0.125', api.checkQuizValue('0.125', 10, 1n, 8n).ok, true);
eq('判值 0.13 错', api.checkQuizValue('0.13', 10, 1n, 8n).ok, false);
eq('判值 整数 hex', api.checkQuizValue('FF', 16, 255n, 1n).ok, true);
eq('判值 非法字符', api.checkQuizValue('gg', 16, 255n, 1n).msg !== undefined, true);
// （v1.3：checkQuizBase 死代码移除，其整数判卷职责由 checkQuizValue 全覆盖）
eq('自定义前缀 末', api.genQuestion('custom', () => 0.9999, 26, 30).prefix, 30);
eq('自定义前缀 起', api.genQuestion('custom', () => 0, 26, 30).prefix, 26);
eq('自定义前缀 自动纠反', api.genQuestion('custom', () => 0.9999, 30, 26).prefix, 30);
let gFail = 0;
for (let i = 0; i < 30; i++) {
  const r = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const g = api.genConvQuestion(['easy', 'mid', 'hard'][i % 3], 'frac', r);
  if (g.srcBase === g.tgtBase) gFail++;
  if (g.QDen <= 0n) gFail++;
  let d = g.QDen;
  const pf = { 2: [2], 8: [2], 16: [2], 10: [2, 5] };
  for (const pr of pf[g.srcBase]) while (d % BigInt(pr) === 0n) d /= BigInt(pr);
  for (const pr of pf[g.tgtBase]) while (d % BigInt(pr) === 0n) d /= BigInt(pr);
  if (d !== 1n) gFail++;
}
eq('小数出题 30 例双基精确', gFail, 0);
// 二十一、U+2212 负号容差（v2.0）
eq('U+2212 负号解析', api.parseNumber('\u221212.5', 10), { neg: true, int: 12n, fracNum: 5n, fracDen: 10n, ok: true });
eq('U+2212 三码判卷', api.checkQuizValue('\u22121010.1', 2, -21n, 2n).ok, true);

console.log(fail === 0 ? '\n全部通过：' + n + ' 组断言' : '\n失败 ' + fail + ' / ' + n + ' 组');
process.exit(fail === 0 ? 0 : 1);
