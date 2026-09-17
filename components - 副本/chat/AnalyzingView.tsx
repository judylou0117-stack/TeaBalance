'use client';

import { mockApi } from '@/lib/mock-api';
import { useI18n } from '@/lib/i18n';
import { HardLink } from '@/components/layout/HardLink';
import { AlertCircle, ArrowLeft, Check, Leaf, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AnalyzingView() {
  const { copy } = useI18n();
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; setReduced(reduce); setError(''); setActive(0);
    const duration = reduce ? 260 : 850;
    const stepCount = copy.analyzing.steps.length;
    const timers = Array.from({ length: stepCount }, (_, index) => index + 1).map((step) => window.setTimeout(() => setActive(step), duration * step));
    const final = window.setTimeout(() => {
      void mockApi.analyze()
        .then(() => window.location.replace('/result'))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : copy.analyzing.failedDescription));
    }, duration * stepCount + 350);
    return () => { timers.forEach(clearTimeout); clearTimeout(final); };
  }, [attempt, copy.analyzing.failedDescription, copy.analyzing.steps.length]);

  return (
    <div className="analyzing-view">
      <div className="analysis-visual" aria-hidden="true"><div className="tea-ripple"><i /><i /><i /><span><Leaf /></span></div><Sparkles className="analysis-sparkle" /></div>
      <div className="analysis-copy"><div className="eyebrow"><Leaf />{copy.analyzing.eyebrow}</div><h1>{copy.analyzing.title}</h1><p>{copy.analyzing.description}</p>
        <div className="analysis-steps">{copy.analyzing.steps.map((label, index) => { const done = active > index; const running = active === index; return <div key={label} className={`${done ? 'is-done' : ''} ${running ? 'is-running' : ''}`}><span>{done ? <Check /> : running ? <LoaderCircle /> : index + 1}</span><strong>{label}</strong><small>{done ? copy.analyzing.done : running ? copy.analyzing.running : copy.analyzing.waiting}</small></div>; })}</div>
        {error && <div className="analysis-error" role="alert"><AlertCircle /><div><strong>{copy.analyzing.failedTitle}</strong><p>{error}</p><div><button type="button" className="button button-primary" onClick={() => setAttempt((value) => value + 1)}><RefreshCw />{copy.analyzing.retry}</button><HardLink className="button button-secondary" href="/safety"><ArrowLeft />{copy.analyzing.backToSafety}</HardLink></div></div></div>}
        {reduced && <p className="reduced-note">{copy.analyzing.reduced}</p>}
      </div>
    </div>
  );
}
