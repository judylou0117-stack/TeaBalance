import { analyzePayload } from '../lib/analysis-service.ts';
import { getDemoFixture } from '../lib/demo-fixtures.ts';
import { generateResultExplanation } from '../lib/ai/explanation-service.ts';
import { openRouterRuntime } from '../lib/openrouter/client.ts';
import { runConversationTurn } from '../lib/conversation/service.ts';
import type { AnalyzeProfile } from '../types/analysis.ts';

type SmokeResult = {
  model: string | null;
  moduleA: { attempted: true; status: 'success' | 'failed'; mode?: string; outcome?: string; candidateQuestionId?: string; candidateValue?: number; autoRecorded?: boolean; error?: string };
  moduleB: { attempted: true; status: 'success' | 'failed'; mode?: string; explanationStatus?: string; teaIdsValidated?: boolean; sourceIdsValidated?: boolean; error?: string };
};

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return '未知错误。';
  if (error.message === 'MODEL_TIMEOUT') return '请求超时。';
  const status = error.message.match(/HTTP \d{3}/)?.[0];
  return status ? `模型服务请求失败（${status}）。` : '模型调用或校验未完成。';
}

const runtimeA = openRouterRuntime('a');
const runtimeB = openRouterRuntime('b');
const result: SmokeResult = {
  model: runtimeA.model ?? runtimeB.model,
  moduleA: { attempted: true, status: 'failed' },
  moduleB: { attempted: true, status: 'failed' },
};

// Exactly one live Module A request: `interpret` only. A valid candidate is auto-recorded locally.
try {
  const started = await runConversationTurn({ profile: { sex: 'female' }, language: 'zh', action: 'start' });
  const interpreted = await runConversationTurn({
    profile: { sex: 'female' }, language: 'zh', action: 'interpret', state: started.state,
    message: '这是虚构测试：近一年我经常感到疲劳。',
  });
  const candidate = interpreted.state.confirmedAnswers.Q001;
  if (!candidate) throw new Error('NO_RECORDED_ANSWER');
  result.moduleA = {
    attempted: true, status: 'success', mode: interpreted.mode, outcome: interpreted.outcome,
    candidateQuestionId: candidate.questionId, candidateValue: candidate.value,
    autoRecorded: candidate.value === 4 && interpreted.state.currentQuestionId === 'Q002',
  };
} catch (error) {
  result.moduleA.error = safeError(error);
}

// Exactly one live Module B request. Rule analysis stays local and uses a fictional profile.
try {
  const profile: AnalyzeProfile = {
    ageRange: '18-59', sex: 'female', allergies: [], medications: [], pregnancyOrBreastfeeding: false,
    conditions: [], acuteDiscomfort: false, caffeineSensitive: false, flavorPreferences: ['清'], sugarFree: true,
  };
  const analysis = analyzePayload({ profile, answers: getDemoFixture(profile).answers });
  const explanation = await generateResultExplanation(analysis);
  if (explanation.status !== 'ready' || !explanation.explanation) throw new Error(`EXPLANATION_${explanation.status}`);
  const allowedTeaIds = new Set(analysis.recommendations.map((item) => item.id));
  const availableKnowledgeIds = new Set([...analysis.knowledge.constitutions, ...analysis.knowledge.teas].map((item) => item.knowledge_id));
  const teaIdsValidated = explanation.explanation.teaRecommendations.every((item) => allowedTeaIds.has(item.teaId));
  const sourceIds = [...explanation.explanation.sourceKnowledgeIds, ...explanation.explanation.teaRecommendations.flatMap((item) => item.sourceKnowledgeIds)];
  const sourceIdsValidated = sourceIds.every((id) => availableKnowledgeIds.has(id));
  if (!teaIdsValidated || !sourceIdsValidated) throw new Error('VALIDATION_FAILED');
  result.moduleB = {
    attempted: true, status: 'success', mode: explanation.mode, explanationStatus: explanation.status,
    teaIdsValidated, sourceIdsValidated,
  };
} catch (error) {
  result.moduleB.error = safeError(error);
}

console.log(JSON.stringify(result));
