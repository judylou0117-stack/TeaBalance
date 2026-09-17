import { AnalyzeInputError, analyzePayload } from '../../../lib/analysis-service.ts';
import type { AnalyzeErrorResponse } from '../../../types/analysis.ts';

function errorResponse(code: AnalyzeErrorResponse['error']['code'], message: string, fields?: string[], status = 400): Response {
  return Response.json({ success: false, error: { code, message, ...(fields?.length ? { fields } : {}) } } satisfies AnalyzeErrorResponse, { status });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', '请求体必须是有效 JSON。');
  }
  try {
    return Response.json(analyzePayload(payload));
  } catch (error) {
    if (error instanceof AnalyzeInputError) return errorResponse('INVALID_INPUT', error.message, error.fields);
    return errorResponse('ANALYSIS_UNAVAILABLE', '当前无法完成规则分析，请返回上一步检查信息后重试。', undefined, 500);
  }
}
