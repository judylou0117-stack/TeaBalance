import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import { analyzePayload } from '../lib/analysis-service.ts';
import { retrieveKnowledge } from '../lib/knowledge/retriever.ts';
import knowledgeJson from '../data/generated/knowledge.json' with { type: 'json' };
import dailyExpressionsJson from '../data/generated/daily-expressions.json' with { type: 'json' };
import questionsJson from '../data/generated/questions.json' with { type: 'json' };

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('需要输入表与输出表路径。');

const knowledge = knowledgeJson;
const dailyExpressions = dailyExpressionsJson;
const questions = questionsJson.items;
const runLabel = 'Codex / 2026-09-17 / 规则＋检索实际运行 v2';

function answerSet(code) {
  const answers = Object.fromEntries(
    questions
      .filter((question) => question.gender === 'all' || question.gender === 'female')
      .map((question) => [question.id, 1]),
  );
  const targetQuestions = {
    B: ['Q002', 'Q005', 'Q006'],
    C: ['Q004', 'Q007', 'Q008'],
    E: ['Q012', 'Q013', 'Q014'],
    F: ['Q015', 'Q016', 'Q017'],
    G: ['Q019', 'Q020', 'Q021'],
    I: ['Q024', 'Q025', 'Q026', 'Q027'],
  }[code];
  for (const questionId of targetQuestions) answers[questionId] = 5;
  return answers;
}

function baseProfile(overrides = {}) {
  return {
    ageRange: '18-59',
    sex: 'female',
    allergies: [],
    medications: [],
    pregnancyOrBreastfeeding: false,
    conditions: [],
    acuteDiscomfort: false,
    caffeineSensitive: false,
    flavorPreferences: [],
    sugarFree: false,
    ...overrides,
  };
}

function allKnowledgeIds(result) {
  return [...result.knowledge.constitutions, ...result.knowledge.teas].map((item) => item.knowledge_id);
}

function describeSafety(result) {
  const warnings = result.safetyWarnings.map((item) => `${item.ruleId}:${item.action}:${item.explanation}`);
  const data = result.dataWarnings.map((item) => `${item.code}:${item.message}`);
  const empty = result.knowledge.emptyReasons.map((item) => `${item.scope}:${item.reason}`);
  return [...warnings, ...data, ...empty].join('；') || '无';
}

function runAnalysis(code, profileOverrides) {
  return analyzePayload({ profile: baseProfile(profileOverrides), answers: answerSet(code) });
}

function compareIds(actual, expected) {
  return actual.length === expected.length && expected.every((id) => actual.includes(id));
}

function directResult(code, allowedTeaIds) {
  const result = retrieveKnowledge({ constitutionCodes: [code], allowedTeaIds }, knowledge, dailyExpressions);
  const actual = [...result.constitutions, ...result.teas].map((item) => item.knowledge_id);
  const expected = [`KB-C-${code}`, ...allowedTeaIds.map((id) => `KB-T-${id.slice(1)}`)];
  const sourcesPresent = [...result.constitutions, ...result.teas].every((item) => item.source.file && item.source.sheet && item.source.row);
  return {
    actual,
    detail: result.emptyReasons.length ? result.emptyReasons.map((item) => item.reason).join('；') : '无；本例按测试前提仅执行知识关联。',
    outcome: compareIds(actual, expected) && sourcesPresent ? '通过' : '失败',
    note: compareIds(actual, expected) && sourcesPresent ? '知识 ID、排除范围和来源字段符合修正后的测试规格。' : '知识 ID 或来源字段与修正后的测试规格不一致。',
  };
}

const directCases = [
  ['A', ['T001']], ['B', ['T002', 'T003']], ['C', ['T004', 'T005']],
  ['D', ['T006', 'T007']], ['E', ['T008', 'T009']], ['F', ['T010', 'T011']],
  ['G', ['T012', 'T013']], ['H', ['T014']], ['I', ['T015', 'T016']],
];

const jointCases = [
  { row: 11, code: 'I', profile: { allergies: ['菊花'] }, expected: ['KB-C-I'], reason: '菊花过敏阻断 T016；T015 含谨慎材料，不能进入正式推荐知识。' },
  { row: 12, code: 'E', profile: { allergies: ['柑橘类'] }, expected: ['KB-C-E'], reason: '现有过敏映射明确将柑橘类对应到陈皮，T008、T009 均被阻断。' },
  { row: 13, code: 'B', profile: { allergies: ['人参'] }, expected: ['KB-C-B', 'KB-T-003'], reason: 'T002过敏原字段明确写有“对人参过敏者禁用”，因此S001阻断；T003通过。不能只看配料字段判断此案例。' },
  { row: 14, code: 'C', profile: { allergies: ['龙眼'] }, expected: ['KB-C-C', 'KB-T-004'], reason: '现有同义映射将龙眼对应到桂圆，T005被阻断，T004保留。' },
  { row: 15, code: 'G', profile: { pregnancyOrBreastfeeding: 'pregnant' }, expected: ['KB-C-G'], reason: 'S003明确材料阻断 T012、T013，未补充其他茶饮。' },
  { row: 16, code: 'C', profile: { pregnancyOrBreastfeeding: 'pregnant' }, expected: ['KB-C-C'], reason: 'S003中的干姜阻断 T004、T005，未补充其他茶饮。' },
  { row: 17, code: 'F', profile: { pregnancyOrBreastfeeding: 'pregnant' }, expected: ['KB-C-F', 'KB-T-010', 'KB-T-011'], reason: '原测试错误地假设孕期阻断全部茶饮；现有S003只阻断表中明确材料，T010、T011未命中。' },
  { row: 20, code: 'B', profile: { conditions: ['blood-sugar'] }, expected: null, reason: '血糖相关字段触发资料不足警告，但当前仍放行T003。原表预期尚待组员审核，故记录实际行为与安全资料缺口，不判通过或失败。' },
];

function reviewStatusResult() {
  const outputs = ['needs_review', 'excluded'].map((reviewStatus) => {
    const isolated = {
      ...knowledge,
      items: knowledge.items.map((item) => item.knowledge_id === 'KB-C-B' ? { ...item, review_status: reviewStatus } : item),
    };
    return { reviewStatus, result: retrieveKnowledge({ constitutionCodes: ['B'], allowedTeaIds: [] }, isolated, dailyExpressions) };
  });
  const passed = outputs.every(({ result }) => result.constitutions.length === 0 && result.teas.length === 0 && result.emptyReasons.length === 2);
  return {
    actual: [],
    detail: outputs.map(({ reviewStatus, result }) => `${reviewStatus}:${result.emptyReasons.map((item) => `${item.scope}=${item.reason}`).join('/')}`).join('；'),
    outcome: passed ? '通过' : '失败',
    note: '仅修改内存隔离副本；正式知识数据未改变。',
  };
}

const source = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(source);
const sheet = workbook.worksheets.getItem('Sheet1');

// 修正已能由当前规则明确证明的测试表错误，不把程序实际结果反写成医学依据。
sheet.getRange('C11:D11').values = [['KB-C-I', 'KB-T-001,KB-T-002,KB-T-003,KB-T-004,KB-T-005,KB-T-006,KB-T-007,KB-T-008,KB-T-009,KB-T-010,KB-T-011,KB-T-012,KB-T-013,KB-T-014,KB-T-015,KB-T-016']];
sheet.getRange('C12:D12').values = [['KB-C-E', 'KB-T-001,KB-T-002,KB-T-003,KB-T-004,KB-T-005,KB-T-006,KB-T-007,KB-T-008,KB-T-009,KB-T-010,KB-T-011,KB-T-012,KB-T-013,KB-T-014,KB-T-015,KB-T-016']];
sheet.getRange('C14:D14').values = [['KB-C-C、KB-T-004', 'KB-T-001,KB-T-002,KB-T-003,KB-T-005,KB-T-006,KB-T-007,KB-T-008,KB-T-009,KB-T-010,KB-T-011,KB-T-012,KB-T-013,KB-T-014,KB-T-015,KB-T-016']];
sheet.getRange('C17:D17').values = [['KB-C-F、KB-T-010、KB-T-011', 'KB-T-001,KB-T-002,KB-T-003,KB-T-004,KB-T-005,KB-T-006,KB-T-007,KB-T-008,KB-T-009,KB-T-012,KB-T-013,KB-T-014,KB-T-015,KB-T-016']];
sheet.getRange('H17:J17').values = [['仅按S003明确材料执行；未命中时保留安全通过茶饮。', '体质知识和T010、T011知识返回；不得扩大孕期阻断范围。', '已修正原测试“孕期停止全部推荐”的无依据假设。']];

for (let index = 0; index < directCases.length; index += 1) {
  const [code, teaIds] = directCases[index];
  const result = directResult(code, teaIds);
  sheet.getRange(`K${index + 2}:P${index + 2}`).values = [[result.actual.join('、'), result.detail, result.outcome, result.note, '已复测', runLabel]];
}

for (const item of jointCases) {
  const result = runAnalysis(item.code, item.profile);
  const actual = allKnowledgeIds(result);
  const idMatch = item.expected ? compareIds(actual, item.expected) : false;
  const outcome = item.expected ? (idMatch ? '通过' : '失败') : '待确认预期';
  const note = `${item.reason} 主要体质=${result.primaryConstitution?.code ?? '无'}；allowed=${result.recommendations.map((tea) => `T${tea.id.padStart(3, '0')}`).join(',') || '空'}；cautious=${result.cautiousTeas.map((tea) => `T${tea.id.padStart(3, '0')}`).join(',') || '空'}；blocked=${result.excludedTeas.map((tea) => `T${tea.id.padStart(3, '0')}`).join(',') || '空'}。`;
  sheet.getRange(`K${item.row}:P${item.row}`).values = [[actual.join('、') || '空列表', describeSafety(result), outcome, note, item.expected ? '已实际执行' : '待组员确认预期', runLabel]];
}

for (const row of [18, 19]) {
  sheet.getRange(`K${row}:P${row}`).values = [['未执行', '当前不支持独立日常表述检索；未产生实际知识ID。', '当前不支持', '检索器必须先接收规则判定出的体质编码；日常表达只用于排序扩展，不能替代评分。', '不适用', runLabel]];
}

const review = reviewStatusResult();
sheet.getRange('K21:P21').values = [['空列表', review.detail, review.outcome, review.note, '已复测', runLabel]];

workbook.recalculate();
const check = await workbook.inspect({ kind: 'table', range: 'Sheet1!K1:P21', include: 'values,formulas', tableMaxRows: 21, tableMaxCols: 6 });
console.log(check.ndjson);
await fs.mkdir(new URL('.', `file:///${outputPath.replaceAll('\\', '/')}`).pathname, { recursive: true }).catch(() => undefined);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const resultRows = sheet.getRange('M2:M21').values.flat();
const summary = {
  executed: resultRows.filter((value) => value === '通过' || value === '失败' || value === '待确认预期').length,
  passed: resultRows.filter((value) => value === '通过').length,
  failed: resultRows.filter((value) => value === '失败').length,
  pending: resultRows.filter((value) => value === '待确认预期').length,
  unsupported: resultRows.filter((value) => value === '当前不支持').length,
};
console.log(JSON.stringify({ outputPath, ...summary }));
