import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import { retrieveKnowledge } from '../lib/knowledge/retriever.ts';
import knowledgeJson from '../data/generated/knowledge.json' with { type: 'json' };
import dailyExpressionsJson from '../data/generated/daily-expressions.json' with { type: 'json' };

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('需要输入表与输出表路径。');

const knowledge = knowledgeJson;
const dailyExpressions = dailyExpressionsJson;
const now = 'Codex / 2026-09-17 / 本地检索 v1';

const directCases = [
  ['A', ['T001']], ['B', ['T002', 'T003']], ['C', ['T004', 'T005']],
  ['D', ['T006', 'T007']], ['E', ['T008', 'T009']], ['F', ['T010', 'T011']],
  ['G', ['T012', 'T013']], ['H', ['T014']], ['I', ['T015', 'T016']],
];

function resultIds(result) {
  return [...result.constitutions, ...result.teas].map((item) => item.knowledge_id);
}

function sourceComplete(result) {
  return [...result.constitutions, ...result.teas].every((item) => Boolean(item.source.file && item.source.sheet && item.source.row));
}

function checkedDirect(code, allowedTeaIds) {
  const result = retrieveKnowledge({ constitutionCodes: [code], allowedTeaIds }, knowledge, dailyExpressions);
  const ids = resultIds(result);
  const expected = [`KB-C-${code}`, ...allowedTeaIds.map((id) => `KB-T-${id.slice(1)}`)];
  const pass = ids.length === expected.length && expected.every((id) => ids.includes(id)) && sourceComplete(result) && result.emptyReasons.length === 0;
  return {
    knowledgeIds: ids.join('、'),
    details: '无；本例未执行安全判断。空结果原因：无。',
    outcome: pass ? '通过' : '失败',
    note: pass ? '实际知识 ID、范围与来源字段均符合 C、D、I 列。' : `实际 ID：${ids.join('、') || '空列表'}；空结果原因：${result.emptyReasons.map((item) => item.reason).join('；') || '无'}。`,
  };
}

function reviewStatusCase() {
  const statuses = ['needs_review', 'excluded'];
  const checks = statuses.map((reviewStatus) => {
    const isolated = {
      ...knowledge,
      items: knowledge.items.map((item) => item.knowledge_id === 'KB-C-B' ? { ...item, review_status: reviewStatus } : item),
    };
    return { reviewStatus, result: retrieveKnowledge({ constitutionCodes: ['B'], allowedTeaIds: [] }, isolated, dailyExpressions) };
  });
  const pass = checks.every(({ result }) => result.constitutions.length === 0 && result.teas.length === 0 && result.emptyReasons.some((item) => item.scope === 'constitution') && result.emptyReasons.some((item) => item.scope === 'tea'));
  const reasons = checks.map(({ reviewStatus, result }) => `${reviewStatus}：${result.emptyReasons.map((item) => `${item.scope}=${item.reason}`).join('；')}`).join(' / ');
  return {
    knowledgeIds: '空列表（needs_review、excluded 均为空）',
    details: reasons,
    outcome: pass ? '通过' : '失败',
    note: pass ? '仅在内存隔离副本修改 review_status；正式知识 JSON 未改动。' : '隔离副本结果未满足预期，需检查 verified 过滤逻辑。',
  };
}

const pendingQuestion = {
  10: '待组员确认：菊花过敏阻断规则与 T015 是否可自动推荐；随后补齐确切预期 ID。',
  11: '待组员确认：柑橘过敏是否映射陈皮，以及 T008/T009 的阻断结论。',
  12: '待组员确认：人参与生晒参名称映射，以及 T003 的自动推荐资格。',
  13: '待组员确认：桂圆与龙眼名称映射，以及 T004 的自动推荐资格。',
  14: '待组员确认：正式安全规则是否要求孕期停止全部自动茶饮推荐。',
  15: '待组员确认：正式安全规则是否要求孕期停止全部自动茶饮推荐。',
  16: '待组员确认：正式安全规则是否要求孕期停止全部自动茶饮推荐。',
  19: '待组员确认：血糖相关规则与候选配方的审核结论，不能以“未列禁忌”视为安全。',
};

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem('Sheet1');

for (let index = 0; index < directCases.length; index += 1) {
  const [code, allowedTeaIds] = directCases[index];
  const test = checkedDirect(code, allowedTeaIds);
  const row = index + 2;
  sheet.getRange(`K${row}:P${row}`).values = [[test.knowledgeIds, test.details, test.outcome, test.note, '不适用', now]];
}

for (const row of [10, 11, 12, 13, 14, 15, 16, 19]) {
  const sheetRow = row + 1;
  sheet.getRange(`K${sheetRow}:P${sheetRow}`).values = [[
    '未执行',
    '未执行；预期尚待组员确认。',
    '待确认预期（未执行）',
    pendingQuestion[row],
    '不适用',
    now,
  ]];
}

for (const row of [17, 18]) {
  const sheetRow = row + 1;
  sheet.getRange(`K${sheetRow}:P${sheetRow}`).values = [[
    '未执行',
    '当前不支持独立日常表述检索；未产生实际知识 ID、安全提醒或空结果。',
    '当前不支持',
    '现有检索函数必须先收到体质编码；queryTerms 只能扩展已知编码的检索，尚无“日常表述→知识”独立入口。',
    '不适用',
    now,
  ]];
}

const review = reviewStatusCase();
sheet.getRange('K21:P21').values = [[review.knowledgeIds, review.details, review.outcome, review.note, '不适用', now]];

const check = await workbook.inspect({ kind: 'table', range: 'Sheet1!K1:P21', include: 'values,formulas', tableMaxRows: 21, tableMaxCols: 6 });
console.log(check.ndjson);
const output = await SpreadsheetFile.exportXlsx(workbook);
await fs.mkdir(new URL('.', `file:///${outputPath.replaceAll('\\', '/')}`).pathname, { recursive: true }).catch(() => undefined);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, directExecuted: 10, passed: directCases.length + (review.outcome === '通过' ? 1 : 0), failed: directCases.filter(([code, teas]) => checkedDirect(code, teas).outcome === '失败').length + (review.outcome === '失败' ? 1 : 0), pending: 8, unsupported: 2 }));
