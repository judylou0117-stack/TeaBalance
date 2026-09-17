import { runConversationTurn } from '../../../lib/conversation/service.ts';
import { conversationFailureMessage, conversationFailureStatus, isConversationModelError, type ConversationFailureCode } from '../../../lib/conversation/errors.ts';
import { OpenRouterRequestError } from '../../../lib/openrouter/client.ts';
import type { ConversationErrorResponse, ConversationTurnRequest } from '../../../types/conversation-module.ts';

function invalid(message: string): Response {
  const body: ConversationErrorResponse = { success: false, error: { code: 'INVALID_INPUT', message } };
  return Response.json(body, { status: 400 });
}

function validRequest(value: unknown): value is ConversationTurnRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ConversationTurnRequest>;
  return Boolean(item.profile)
    && (item.profile?.sex === 'female' || item.profile?.sex === 'male' || item.profile?.sex === 'undisclosed')
    && (item.language === 'zh' || item.language === 'en')
    && (item.action === 'start' || item.action === 'interpret' || item.action === 'select' || item.action === 'revise-answer' || item.action === 'finalize');
}

function safeFailure(error: unknown): ConversationFailureCode {
  if (isConversationModelError(error)) return error.code;
  if (error instanceof OpenRouterRequestError) return error.code === 'INVALID_RESPONSE' ? 'INVALID_MODEL_JSON' : error.code;
  return 'NETWORK_UNAVAILABLE';
}

/** Logs no messages, prompts, credentials, headers, or health information. */
function logSafeFailure(code: ConversationFailureCode, status: number) {
  console.warn(JSON.stringify({ area: 'module-a', code, status }));
}

/** Server-only Module A. It never logs health text; mock mode makes no provider request. */
export async function handleChatPost(request: Request, turn = runConversationTurn): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalid('请求体必须是有效 JSON。');
  }
  if (!validRequest(payload)) return invalid('需要提供生理性别、语言和有效的对话动作。');
  try {
    return Response.json(await turn(payload));
  } catch (error) {
    const code = safeFailure(error);
    const status = conversationFailureStatus(code);
    logSafeFailure(code, status);
    const body: ConversationErrorResponse = { success: false, error: { code, message: conversationFailureMessage(code, (payload as ConversationTurnRequest).language) } };
    return Response.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleChatPost(request);
}
