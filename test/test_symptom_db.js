// 测试症状数据库完整性和功能
const fs = require('fs');

global.window = {};
global.document = { addEventListener: () => {} };
global.fetch = () => {};
global.localStorage = {
  _data: {},
  getItem: (k) => global.localStorage._data[k] || null,
  setItem: (k, v) => { global.localStorage._data[k] = v; },
  removeItem: (k) => { delete global.localStorage._data[k]; },
  clear: () => { global.localStorage._data = {}; }
};

// eval 方式加载 - 将 const 变量导出到 globalThis
const scriptCode = fs.readFileSync('script.js', 'utf8');
eval(scriptCode + '\n//# sourceURL=script.js\n' +
  'globalThis.__symptomDatabase = symptomDatabase;\n' +
  'globalThis.__analyzeConsultation = analyzeConsultation;');

// 验证
if (typeof globalThis.__symptomDatabase === 'undefined') {
  console.error('ERROR: symptomDatabase not defined after eval');
  process.exit(1);
}
const symptomDatabase = globalThis.__symptomDatabase;
const analyzeConsultation = globalThis.__analyzeConsultation;

const db = symptomDatabase;
console.log(`症状类别总数: ${Object.keys(db).length}`);
console.log(`关键词总数: ${Object.values(db).reduce((s, e) => s + e.keywords.length, 0)}`);
console.log(`组合总数: ${Object.values(db).reduce((s, e) => s + Object.keys(e.combinations).length, 0)}`);

// 测试
function testSymptom(keywords) {
    const result = analyzeConsultation({symptoms: keywords, duration: '', otherSymptoms: ''});
    const ok = !!(result.possibleCause && result.department && result.treatment && result.medicine);
    return { ok, confidence: result.confidence, cause: (result.possibleCause || '').substring(0, 60) };
}

let pass = 0, fail = 0;
const failures = [];

// 1) 所有单个症状匹配
const tests = [
  '头痛 发烧','头晕 心慌','咳嗽 咳痰','腹痛 腹泻','胸痛 呼吸困难',
  '心跳过快 心慌','心跳过慢 头晕','消化不良 胃胀','食欲不振 不想吃饭',
  '吞咽困难 吃东西噎','痔疮 便血','晕厥 昏倒','记忆力减退 健忘',
  '抽筋 腿抽筋','手抖 手发抖','颈肩痛 脖子痛','背痛 后背痛',
  '肌肉酸痛 浑身疼','寒战 发冷 发抖','盗汗 夜间出汗',
  '体重下降 消瘦','体重增加 发胖','口渴多饮 总喝水',
  '情绪低落 不开心','烦躁易怒 脾气大','眼红 眼睛红',
  '听力下降 听不见','牙龈出血 刷牙出血','牙齿敏感 牙酸',
  '口角炎 嘴角烂','痤疮 青春痘','更年期 潮热 出汗',
  '盆腔痛 下腹痛','前列腺 排尿困难','过敏 荨麻疹',
  '多梦 做梦多','白天嗜睡 总想睡觉','怕热 怕热多汗',
  '手脚冰凉 手脚冷','口腔溃疡 嘴里疼','牙痛 牙龈痛',
  '鼻塞 流鼻涕','鼻出血 流鼻血','反酸 烧心',
  '嗳气 打饱嗝','打嗝 不停打嗝','腰痛 腰酸',
  '关节痛 膝盖痛','皮疹 瘙痒','失眠 睡不着',
  '心悸 心慌','发烧 发热','耳鸣 耳朵响',
  '口干 口干舌燥','尿频 尿急','月经不调 月经推迟',
  '脱发 掉头发','疲劳 没力气','腿脚无力 走路没劲'
];

console.log('\n=== 单个症状匹配测试 ===');
tests.forEach(input => {
    const r = testSymptom(input);
    console.log(`${r.ok ? '✓' : '✗'} [${r.confidence}%] ${input} -> ${r.cause}`);
    r.ok ? pass++ : (fail++, failures.push(input));
});

// 2) 组合匹配
console.log('\n=== 组合匹配测试 ===');
const combo = [
  ['心悸 胸闷 头晕', '心悸+胸闷组合'],
  ['恶心 呕吐 腹痛 腹泻', '恶心呕吐+腹痛腹泻组合'],
  ['呼吸困难 咳嗽 发烧', '呼吸困难+咳嗽组合'],
  ['头痛 恶心 视力模糊', '头痛+恶心+视力模糊组合']
];
combo.forEach(([input, desc]) => {
    const r = testSymptom(input);
    const ok = r.confidence >= 20;
    console.log(`${ok ? '✓' : '✗'} [${r.confidence}%] ${desc}`);
    ok ? pass++ : (fail++, failures.push(desc));
});

// 3) 重复条目覆盖
console.log('\n=== 重复条目覆盖测试 ===');
const dups = [
  ['恶心 呕吐 腹痛', '恶心呕吐覆盖'],
  ['呼吸困难 咳嗽 咳痰', '呼吸困难覆盖'],
  ['腹泻 发烧', '腹泻覆盖'],
  ['便秘 腹胀', '便秘覆盖'],
  ['视力模糊 眼干', '视力问题覆盖'],
  ['乏力 没精神', '乏力覆盖']
];
dups.forEach(([input, desc]) => {
    const r = testSymptom(input);
    const ok = r.confidence >= 15;
    console.log(`${ok ? '✓' : '✗'} [${r.confidence}%] ${desc}`);
    ok ? pass++ : (fail++, failures.push(desc));
});

console.log('\n========================================');
console.log(`测试完成 | ✓ ${pass} | ✗ ${fail} | 总计 ${pass+fail}`);

if (fail > 0) {
  console.log('\n失败项：');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}

// 列出所有类别
console.log('\n症状类别：');
Object.keys(db).sort().forEach(k => {
  const e = db[k];
  const cc = Object.keys(e.combinations).length;
  console.log(`  ${k} (${e.keywords.length}键,${cc}组合)`);
});
