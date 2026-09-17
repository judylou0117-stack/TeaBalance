'use client';

import { mockApi } from '@/lib/mock-api';
import { useI18n } from '@/lib/i18n';
import { HardLink } from '@/components/layout/HardLink';
import type { HistoryRecord } from '@/types/result';
import { ArrowUpRight, Bot, BookOpenCheck, GitCompareArrows, Leaf, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const innovationIcons = [Bot, GitCompareArrows, BookOpenCheck, ShieldCheck];

export function InnovationSection() {
  const { copy } = useI18n();
  return (
    <section className="content-section innovation-section"><div className="shell">
      <div className="section-heading center"><p>{copy.home.innovationEyebrow}</p><h2>{copy.home.innovationTitle}</h2></div>
      <div className="innovation-grid">{copy.home.innovations.map((item, index) => { const Icon = innovationIcons[index]; return <article key={item.title} className="innovation-card"><span><Icon aria-hidden="true" /></span><p>0{index + 1}</p><h3>{item.title}</h3><div>{item.description}</div></article>; })}</div>
    </div></section>
  );
}

export function WorkflowSection() {
  const { copy } = useI18n();
  return (
    <section className="content-section workflow-section"><div className="shell workflow-layout">
      <div className="section-heading"><p>{copy.home.workflowEyebrow}</p><h2>{copy.home.workflowTitle}</h2></div>
      <div className="workflow-list">{copy.home.workflow.map((item, index) => <article key={item.title}><span>{index + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><Leaf aria-hidden="true" /></article>)}</div>
    </div></section>
  );
}

export function HistorySection() {
  const { copy, language } = useI18n();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void mockApi.getHistory().then((items) => { setRecords(items); setLoading(false); }); }, []);
  const remove = async (id: string) => setRecords(await mockApi.deleteHistory(id));

  return (
    <section className="content-section history-section"><div className="shell">
      <div className="history-heading"><div className="section-heading"><p>{copy.home.historyEyebrow}</p><h2>{copy.home.historyTitle}</h2><span>{copy.home.historyDescription}</span></div><span className="session-pill"><i />{copy.common.sessionOnly}</span></div>
      {loading ? <div className="history-skeleton" aria-label="Loading"><i /><i /></div> : records.length === 0 ? <div className="history-empty"><Leaf /><p>{copy.home.historyEmpty}</p></div> : <div className="history-grid">{records.map((record) => <article className="history-card" key={record.id}><div><time>{record.date}</time>{record.isNew && <span>NEW</span>}</div><h3>{record.tendency[language]}</h3><p><b>{copy.home.recommendedTea}</b>{record.tea[language]}</p><footer><HardLink href="/result?history=1">{copy.home.historyView}<ArrowUpRight /></HardLink><button type="button" onClick={() => void remove(record.id)} aria-label={`${copy.home.historyDeleteLabel} ${record.date}`}><Trash2 /><span>{copy.home.historyDelete}</span></button></footer></article>)}</div>}
    </div></section>
  );
}

export function HomeFooter() {
  const { copy } = useI18n();
  return <footer className="home-footer"><div className="shell"><div><ShieldCheck /><p>{copy.home.footerSafety}</p></div><div><BookOpenCheck /><p>{copy.home.footerPrivacy}</p></div><span>Tea Balance · {copy.common.demoBadge}</span></div></footer>;
}
