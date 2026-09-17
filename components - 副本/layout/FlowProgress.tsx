'use client';

import { Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const ids = ['safety', 'chat', 'analyzing', 'result'] as const;

export function FlowProgress({ current }: { current: typeof ids[number] }) {
  const { copy } = useI18n();
  const active = ids.indexOf(current);
  return (
    <nav className="flow-progress" aria-label={copy.progress.aria}>
      {ids.map((id, index) => (
        <div key={id} className={`progress-item ${index < active ? 'is-done' : ''} ${index === active ? 'is-current' : ''}`} aria-current={index === active ? 'step' : undefined}>
          <span>{index < active ? <Check aria-hidden="true" /> : index + 1}</span>
          <b>{copy.progress[id]}</b>
        </div>
      ))}
    </nav>
  );
}
