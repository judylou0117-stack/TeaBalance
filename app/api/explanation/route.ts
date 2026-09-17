import { generateResultExplanation } from '../../../lib/ai/explanation-service.ts';
import type { AnalyzeResponse } from '../../../types/analysis.ts';
import type { Language } from '../../../types/constitution.ts';

const languages = new Set<Language>(['zh', 'en', 'ja', 'ko', 'hi']);

function isAnalysisResponse(value: unknown): value is AnalyzeResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AnalyzeResponse>;
  return item.success === true
    && Array.isArray(item.scores)
    && Array.isArray(item.recommendations)
    && Array.isArray(item.safetyWarnings)
    && Boolean(item.knowledge)
    && Array.isArray(item.knowledge?.constitutions)
    && Array.isArray(item.knowledge?.teas)
    && Array.isArray(item.knowledge?.emptyReasons);
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ success: false, error: { code: 'INVALID_JSON', message: '请求体必须是有效 JSON。' } }, { status: 400 });
  }
  const body = payload && typeof payload === 'object' ? payload as { analysis?: unknown; language?: unknown } : {};
  const analysis = body.analysis;
  if (!isAnalysisResponse(analysis)) {
    return Response.json({ success: false, error: { code: 'INVALID_INPUT', message: 'analysis 必须是已有规则分析接口返回的完整结果。' } }, { status: 400 });
  }
  const language = typeof body.language === 'string' && languages.has(body.language as Language) ? body.language as Language : 'zh';
  return Response.json({ success: true, explanation: await generateResultExplanation(analysis, { language }) });
}
