'use client';

import { HardLink } from '@/components/layout/HardLink';
import { requestConversationTurn, ConversationRequestError } from '@/lib/client-chat';
import { profileFromSafety } from '@/lib/client-analysis';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import type { ChatMessage } from '@/types/conversation';
import type { ConversationMode, ConversationQuestion, ConversationReviewItem, ConversationState, ConversationTurnRequest, ConversationTurnResponse } from '@/types/conversation-module';
import { ArrowLeft, ArrowRight, Bot, Check, Leaf, LockKeyhole, Send, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function assistantMessage(content: string): ChatMessage { return { id: `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'assistant', content }; }
function userMessage(content: string): ChatMessage { return { id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'user', content }; }
type UserAction = Exclude<ConversationTurnRequest['action'], 'start'>;

export function ChatPanel() {
  const { copy, language } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ConversationState | null>(null);
  const [question, setQuestion] = useState<ConversationQuestion | null>(null);
  const [reviewItems, setReviewItems] = useState<ConversationReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<ConversationMode>('mock');
  const endRef = useRef<HTMLDivElement>(null);

  const applyTurn = (turn: ConversationTurnResponse, nextMessages?: ChatMessage[]) => {
    setState(turn.state); setQuestion(turn.question); setReviewItems(turn.reviewItems); setMode(turn.mode);
    setTotal((current) => turn.question?.total ?? (turn.reviewItems.length || current));
    storage.setConversationState(turn.state);
    if (nextMessages) { setMessages(nextMessages); storage.setMessages(nextMessages); }
  };

  useEffect(() => {
    const safety = storage.getSafety();
    if (!safety) { setError(copy.chat.startError); return; }
    const profile = profileFromSafety(safety);
    setSending(true); setError('');
    void requestConversationTurn({ profile: { sex: profile.sex }, language, state: storage.getConversationState(), action: 'start' })
      .then((turn) => applyTurn(turn, [assistantMessage(turn.assistantMessage)]))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : copy.chat.startError))
      .finally(() => setSending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, sending]);

  const run = async (action: UserAction, message?: string, value?: number, questionId?: string): Promise<ConversationTurnResponse | null> => {
    const safety = storage.getSafety();
    if (!safety || !state) { setError(copy.chat.startError); return null; }
    setSending(true); setError('');
    const profile = profileFromSafety(safety);
    const visibleMessage = action === 'interpret' || action === 'select' ? message : undefined;
    const pendingMessages = visibleMessage ? [...messages, userMessage(visibleMessage)] : messages;
    if (pendingMessages !== messages) setMessages(pendingMessages);
    try {
      const turn = await requestConversationTurn({ profile: { sex: profile.sex }, language, state, action, message, value, questionId });
      applyTurn(turn, [...pendingMessages, assistantMessage(turn.assistantMessage)]);
      if (action === 'interpret') setInput('');
      return turn;
    } catch (reason) {
      setMessages(messages);
      if (action === 'interpret' && message) setInput(message);
      setError(reason instanceof ConversationRequestError ? reason.message : copy.chat.emptyError);
      return null;
    } finally { setSending(false); }
  };

  const send = () => {
    const answer = input.trim();
    if (!answer) { setError(copy.chat.emptyError); return; }
    void run('interpret', answer);
  };
  const reviseAnswer = (item: ConversationReviewItem, value: number) => void run('revise-answer', undefined, value, item.questionId);
  const finalize = async () => {
    const turn = await run('finalize');
    if (turn?.completion.readyForAnalysis) window.location.assign('/analyzing');
  };

  const recordedCount = state ? Object.keys(state.confirmedAnswers).length : 0;
  const progress = total ? recordedCount / total * 100 : 0;
  const reviewing = Boolean(state && !state.currentQuestionId && !state.reviewConfirmedAt);
  const finished = Boolean(state?.reviewConfirmedAt);
  const modeLabel = mode === 'live' ? copy.chat.liveMode : mode === 'not-configured' ? copy.chat.notConfiguredMode : copy.chat.simulatedMode;

  return (
    <div className="chat-layout">
      <aside className="chat-context">
        <div className="eyebrow"><Leaf />{copy.chat.eyebrow}</div><h1>{copy.chat.title}</h1><p>{copy.chat.description}</p>
        <span className="conversation-mode"><Sparkles />{modeLabel}</span>
        <div className="chat-progress-card"><div><span>{copy.chat.round}</span><b>{copy.chat.roundValue.replace('{current}', String(recordedCount)).replace('{total}', String(total || '—'))}</b></div><div className="chat-progress-track"><i style={{ width: `${progress}%` }} /></div></div>
        <div className="chat-question-summary"><small>{copy.chat.questionLabel}</small><strong>{question ? `${question.id} · ${question.text}` : reviewing ? copy.chat.reviewTitle : finished ? copy.chat.completeHint : copy.chat.incompleteHint}</strong><span>{copy.chat.answerLabel} · {recordedCount}{total ? ` / ${total}` : ''}</span></div>
        <div className="chat-privacy"><LockKeyhole /><span>{copy.chat.privacy}</span></div>
        <HardLink className="back-link" href="/safety"><ArrowLeft />{copy.common.back}</HardLink>
      </aside>
      <section className="chat-card" aria-label={copy.chat.title}>
        {!reviewing && !finished && <div className="chat-messages" aria-live="polite">
          {messages.map((item) => <article key={item.id} className={`message-row ${item.role}`}><span className="message-avatar">{item.role === 'assistant' ? <Bot /> : <UserRound />}</span><div><small>{item.role === 'assistant' ? copy.chat.assistant : copy.chat.you}</small><p>{item.content}</p></div></article>)}
          {sending && <article className="message-row assistant"><span className="message-avatar"><Bot /></span><div className="typing" aria-label="Typing"><i /><i /><i /></div></article>}
          <div ref={endRef} />
        </div>}
        {!reviewing && !finished && state?.currentQuestionId && <div className="chat-compose">
          <div className="quick-tags" aria-label={copy.chat.quickLabel}>{copy.chat.quickTags.map((tag, index) => <button type="button" key={tag} onClick={() => void run('select', tag, index + 1)} disabled={sending}>{tag}</button>)}</div>
          <div className={`input-row ${error ? 'has-error' : ''}`}><textarea value={input} onChange={(event) => { setInput(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={2} placeholder={copy.chat.placeholder} aria-label={copy.chat.placeholder} /><button type="button" onClick={send} disabled={sending} aria-label={copy.chat.send}><Send /></button></div>
          {error && <p className="chat-error" role="alert">{error}</p>}
        </div>}
        {(reviewing || finished) && <div className="answer-review">
          <div className="answer-review-header"><span className="message-avatar"><Check /></span><div><h2>{copy.chat.reviewTitle}</h2><p>{finished ? copy.chat.completeHint : copy.chat.reviewDescription}</p></div></div>
          <div className="answer-review-list">
            {reviewItems.map((item) => <article className="answer-review-row" key={item.questionId}>
              <div><small>{item.questionId}</small><strong>{item.questionText}</strong><p>{copy.chat.reviewQuote}：{item.sourceQuote}</p></div>
              <label><span>{copy.chat.reviewFrequency}</span><select value={item.value} disabled={sending || finished} onChange={(event) => reviseAnswer(item, Number(event.target.value))}>{copy.chat.quickTags.map((tag, index) => <option key={tag} value={index + 1}>{tag}（{index + 1}）</option>)}</select></label>
            </article>)}
          </div>
          {error && <p className="chat-error" role="alert">{error}</p>}
          <div className="complete-actions">{finished ? <button type="button" className="button button-primary" onClick={() => window.location.assign('/analyzing')}>{copy.chat.continue}<ArrowRight /></button> : <button type="button" className="button button-primary" onClick={() => void finalize()} disabled={sending}><Check />{copy.chat.reviewConfirm}</button>}</div>
        </div>}
      </section>
    </div>
  );
}
