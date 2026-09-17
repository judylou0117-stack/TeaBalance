'use client';

import { mockApi } from '@/lib/mock-api';
import { storage } from '@/lib/storage';
import { useI18n } from '@/lib/i18n';
import { HardLink } from '@/components/layout/HardLink';
import { ArrowLeft, Check, Heart, Home, Leaf, RefreshCw, Send } from 'lucide-react';
import { useState } from 'react';

type FeedbackState = { understood: string; agree: string; tryTea: string; helpful: string[]; unclear: string; suggestion: string };
const initial: FeedbackState = { understood: '', agree: '', tryTea: '', helpful: [], unclear: '', suggestion: '' };

export function FeedbackForm() {
  const { copy } = useI18n();
  const [form, setForm] = useState(initial); const [submitted, setSubmitted] = useState(false); const [sending, setSending] = useState(false);
  const choices = [copy.feedback.yes, copy.feedback.partly, copy.feedback.no, copy.feedback.unsure];
  const choiceGroup = (key: 'understood' | 'agree' | 'tryTea') => <div className="rating-row">{choices.map((label, index) => <button type="button" key={label} className={form[key] === String(index) ? 'is-selected' : ''} onClick={() => setForm({ ...form, [key]: String(index) })}><span>{index + 1}</span>{label}</button>)}</div>;
  const toggleHelpful = (label: string) => setForm((current) => ({ ...current, helpful: current.helpful.includes(label) ? current.helpful.filter((item) => item !== label) : [...current.helpful, label] }));
  const submit = async () => { setSending(true); await mockApi.submitFeedback(form); setSubmitted(true); setSending(false); };
  const restart = () => { storage.resetFlow(); window.location.assign('/safety'); };

  if (submitted) return <div className="feedback-success"><span><Heart /></span><p>{copy.common.demoBadge}</p><h1>{copy.feedback.thanksTitle}</h1><div>{copy.feedback.thanksDescription}</div><div className="success-actions"><HardLink className="button button-primary" href="/result"><ArrowLeft />{copy.feedback.backResult}</HardLink><button type="button" className="button button-secondary" onClick={restart}><RefreshCw />{copy.common.restart}</button><HardLink className="button button-secondary" href="/"><Home />{copy.common.home}</HardLink></div></div>;

  return <div className="feedback-layout"><div className="feedback-intro"><div className="eyebrow"><Leaf />{copy.feedback.eyebrow}</div><h1>{copy.feedback.title}</h1><p>{copy.feedback.description}</p><HardLink className="back-link" href="/result"><ArrowLeft />{copy.feedback.backResult}</HardLink></div>
    <form className="feedback-form" onSubmit={(event) => event.preventDefault()}>
      <section><span className="feedback-index">01</span><div><h2>{copy.feedback.understood}</h2>{choiceGroup('understood')}</div></section>
      <section><span className="feedback-index">02</span><div><h2>{copy.feedback.agree}</h2>{choiceGroup('agree')}</div></section>
      <section><span className="feedback-index">03</span><div><h2>{copy.feedback.tryTea}</h2>{choiceGroup('tryTea')}</div></section>
      <section><span className="feedback-index">04</span><div><h2>{copy.feedback.helpful}</h2><div className="helpful-tags">{copy.feedback.helpfulOptions.map((item) => <button type="button" key={item} className={form.helpful.includes(item) ? 'is-selected' : ''} onClick={() => toggleHelpful(item)}>{form.helpful.includes(item) && <Check />}{item}</button>)}</div></div></section>
      <section><span className="feedback-index">05</span><div><h2>{copy.feedback.unclear}</h2><textarea aria-label={copy.feedback.unclear} rows={3} value={form.unclear} onChange={(e) => setForm({ ...form, unclear: e.target.value })} placeholder={copy.feedback.unclearPlaceholder} /></div></section>
      <section><span className="feedback-index">06</span><div><h2>{copy.feedback.suggestion}</h2><textarea aria-label={copy.feedback.suggestion} rows={4} value={form.suggestion} onChange={(e) => setForm({ ...form, suggestion: e.target.value })} placeholder={copy.feedback.suggestionPlaceholder} /></div></section>
      <button type="button" className="button button-primary feedback-submit" onClick={submit} disabled={sending}>{copy.feedback.submit}<Send /></button>
    </form>
  </div>;
}
