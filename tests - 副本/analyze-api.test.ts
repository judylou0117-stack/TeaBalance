import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { POST } from '../app/api/analyze/route.ts';
import { analyzePayload } from '../lib/analysis-service.ts';
import { getDemoFixture } from '../lib/demo-fixtures.ts';
import { getResultPageState } from '../lib/analysis-view.ts';
import type { AnalyzeResponse } from '../types/analysis.ts';

type Question = { id: string; gender: string | null };
const questions = (JSON.parse(readFileSync(new URL('../data/generated/questions.json', import.meta.url), 'utf8')) as { items: Question[] }).items;

function answersFor(sex: 'female' | 'male', value = 1): Record<string, number> {
  return Object.fromEntries(questions.filter((question) => question.gender === 'all' || question.gender === sex).map((question) => [question.id, value]));
}

function request(payload: unknown): Request {
  return new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
}

async function body(response: Response): Promise<AnalyzeResponse | { success: false; error: { message: string; fields?: string[] } }> {
  return response.json() as Promise<AnalyzeResponse | { success: false; error: { message: string; fields?: string[] } }>;
}

void test('正常输入返回 200 与结构化规则结果', async () => {
  const answers = answersFor('female');
  answers.Q001 = 5; answers.Q002 = 5; answers.Q005 = 5; answers.Q006 = 5; answers.Q004 = 3; answers.Q007 = 3; answers.Q008 = 3;
  const response = await POST(request({ profile: { ageRange: '18-25', sex: 'female', allergies: [], medications: [], pregnancyOrBreastfeeding: false, conditions: [], acuteDiscomfort: false, caffeineSensitive: false, flavorPreferences: ['清'], sugarFree: true }, answers }));
  const result = await body(response);
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.scores.length, 9);
    assert.equal(result.primaryConstitution?.code, 'B');
    assert.ok(Array.isArray(result.recommendations));
    assert.ok(result.knowledge.constitutions.some((item) => item.knowledge_id === 'KB-C-B'));
    assert.ok(result.knowledge.teas.every((item) => result.recommendations.some((tea) => tea.id === String(Number(item.tea_id?.replace(/^T0*/, '') ?? '')))));
    assert.equal(getResultPageState(result), result.recommendations.length ? 'ready' : 'no-recommendations');
  }
});

void test('答案超出 1—5 返回 400', async () => {
  const answers = answersFor('female');
  answers.Q001 = 6;
  const response = await POST(request({ profile: { sex: 'female' }, answers }));
  const result = await body(response);
  assert.equal(response.status, 400);
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error.message, /1 至 5/);
});

void test('缺少当前性别分支的必要题目返回 400', async () => {
  const answers = answersFor('female');
  delete answers.Q017;
  const response = await POST(request({ profile: { sex: 'female' }, answers }));
  const result = await body(response);
  assert.equal(response.status, 400);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.fields?.includes('Q017'));
});

void test('女性仅使用 Q017，男性仅使用 Q018', async () => {
  const femaleAnswers = answersFor('female');
  const maleAnswers = answersFor('male');
  femaleAnswers.Q017 = 5;
  maleAnswers.Q018 = 5;
  const femaleResponse = await POST(request({ profile: { sex: 'female' }, answers: femaleAnswers }));
  const maleResponse = await POST(request({ profile: { sex: 'male' }, answers: maleAnswers }));
  const female = await body(femaleResponse);
  const male = await body(maleResponse);
  assert.equal(female.success, true);
  assert.equal(male.success, true);
  if (female.success && male.success) {
    const femaleWetHeat = female.scores.find((score) => score.code === 'F');
    const maleWetHeat = male.scores.find((score) => score.code === 'F');
    assert.deepEqual(femaleWetHeat?.evidence.map((item) => item.questionId), ['Q015', 'Q016', 'Q017']);
    assert.deepEqual(maleWetHeat?.evidence.map((item) => item.questionId), ['Q015', 'Q016', 'Q018']);
  }
});

void test('菊花过敏会阻断含菊花的湿热候选', async () => {
  const answers = answersFor('female');
  answers.Q015 = 5; answers.Q016 = 5; answers.Q017 = 5;
  const response = await POST(request({ profile: { sex: 'female', allergies: ['菊花'] }, answers }));
  const result = await body(response);
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.excludedTeas.some((tea) => tea.name.zh === '金银花菊花茶'));
    assert.ok(!result.knowledge.teas.some((item) => item.knowledge_id === 'KB-T-011'));
    assert.ok(result.safetyWarnings.some((warning) => warning.ruleId === 'S001'));
  }
});

void test('孕期规则阻断红花、桃仁与益母草候选，且不强行推荐', async () => {
  const answers = answersFor('female');
  answers.Q019 = 5; answers.Q020 = 5; answers.Q021 = 5;
  const response = await POST(request({ profile: { sex: 'female', pregnancyOrBreastfeeding: 'pregnant' }, answers }));
  const result = await body(response);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.excludedTeas.map((tea) => tea.id), ['12', '13']);
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.safetyStatus.noAutomaticRecommendation, true);
    assert.equal(getResultPageState(result), 'no-recommendations');
  }
});

void test('哺乳期规则会返回需要确认的候选与规则来源', async () => {
  const answers = answersFor('female');
  answers.Q003 = 5; answers.Q022 = 5; answers.Q023 = 5;
  const response = await POST(request({ profile: { sex: 'female', pregnancyOrBreastfeeding: 'breastfeeding' }, answers }));
  const result = await body(response);
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.cautiousTeas.some((tea) => tea.id === '14'));
    assert.ok(result.safetyWarnings.some((warning) => warning.ruleId === 'S004' && warning.source.file === '安全规则表.xlsx'));
  }
});

void test('急性明显不适进入停止推荐状态，结果页状态为 blocked', async () => {
  const answers = answersFor('female');
  const response = await POST(request({ profile: { sex: 'female', acuteDiscomfort: true }, answers }));
  const result = await body(response);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.safetyStatus.requiresProfessionalConsultation, true);
    assert.equal(getResultPageState(result), 'blocked');
  }
});

void test('前端演示夹具会因安全选择使用固定而非随机的测试答案', () => {
  const allergyCase = getDemoFixture({ sex: 'female', allergies: ['菊花'] });
  const pregnancyCase = getDemoFixture({ sex: 'female', pregnancyOrBreastfeeding: 'pregnant' });
  const caffeineCase = getDemoFixture({ sex: 'female', caffeineSensitive: true });
  assert.equal(allergyCase.id, 'damp-heat-allergy-demo');
  assert.equal(pregnancyCase.id, 'blood-stasis-pregnancy-demo');
  assert.equal(caffeineCase.id, 'phlegm-damp-caffeine-demo');
  assert.equal(allergyCase.answers.Q017, 5);
  assert.equal(pregnancyCase.answers.Q019, 5);
  assert.equal(caffeineCase.answers.Q012, 5);
});

void test('所有体质未达到阈值时不强行选择最高分，也不推荐茶饮', () => {
  const answers = { Q001:1,Q002:3,Q003:1,Q004:3,Q005:2,Q006:1,Q007:1,Q008:2,Q009:1,Q010:2,Q011:1,Q012:1,Q013:2,Q014:3,Q015:2,Q016:2,Q017:2,Q019:1,Q020:1,Q021:2,Q022:3,Q023:1,Q024:3,Q025:1,Q026:3,Q027:1 };
  const result = analyzePayload({ profile: { ageRange: '18-59', sex: 'female', allergies: [], medications: [], pregnancyOrBreastfeeding: false, conditions: [], acuteDiscomfort: false, caffeineSensitive: false, flavorPreferences: [], sugarFree: true }, answers });
  assert.equal(result.primaryConstitution, null);
  assert.deepEqual(result.secondaryConstitutions, []);
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.safetyStatus.noAutomaticRecommendation, true);
  assert.match(result.safetyStatus.message, /没有足够依据/);
  assert.ok(result.dataWarnings.some((item) => item.code === 'NO-CONSTITUTION-THRESHOLD'));
  assert.ok(result.scores.some((item) => item.conversionScore === 50));
});
