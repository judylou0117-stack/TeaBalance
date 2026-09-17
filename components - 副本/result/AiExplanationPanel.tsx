import type { ExplanationResult, ExplanationSourceCitation } from '@/types/ai-explanation';
import type { Language } from '@/types/constitution';
import { localizedCitation } from '@/lib/result-localization';
import { BookOpenCheck, Bot, ExternalLink, LoaderCircle, Sparkles } from 'lucide-react';

type ResultCopy = {
  aiTitle: string;
  aiDescription: string;
  aiGenerate: string;
  aiRegenerate: string;
  aiLoading: string;
  aiConstitution: string;
  aiEvidence: string;
  aiTeaReasons: string;
  aiInsufficiency: string;
  aiSources: string;
  aiSourceNoUrl: string;
  aiSourceOpen: string;
};

type Props = {
  explanation: ExplanationResult | null;
  loading: boolean;
  sources: ExplanationSourceCitation[];
  teaNames: Record<string, string>;
  language: Language;
  copy: ResultCopy;
  onGenerate: () => void;
};

export function AiExplanationPanel({ explanation, loading, sources, teaNames, language, copy, onGenerate }: Props) {
  const visibleSources = (explanation?.sources.length ? explanation.sources : sources).map((source) => localizedCitation(source, language));
  const explanationDraft = explanation?.status === 'ready' ? explanation.explanation : null;
  const ready = Boolean(explanationDraft);
  return <section className="result-section ai-explanation-section">
    <div className="result-section-heading"><div><p>02B · AI EXPLANATION</p><h2>{copy.aiTitle}</h2><span>{copy.aiDescription}</span></div>
      <button type="button" className="text-button" onClick={onGenerate} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" /> : <Bot />}{loading ? copy.aiLoading : explanation ? copy.aiRegenerate : copy.aiGenerate}</button>
    </div>
    {loading && <div className="ai-explanation-state"><LoaderCircle className="is-spinning" /><p>{copy.aiLoading}</p></div>}
    {!loading && explanation && !ready && <div className="ai-explanation-state is-notice"><Sparkles /><p>{explanation.message}</p></div>}
    {ready && <div className="ai-explanation-content">
      <article><span>01</span><h3>{copy.aiConstitution}</h3><p>{explanationDraft?.constitutionTendencyExplanation}</p></article>
      <article><span>02</span><h3>{copy.aiEvidence}</h3><p>{explanationDraft?.evidenceExplanation}</p></article>
      {(explanationDraft?.teaRecommendations.length ?? 0) > 0 && <article className="ai-tea-reasons"><span>03</span><h3>{copy.aiTeaReasons}</h3>{explanationDraft?.teaRecommendations.map((item) => <p key={item.teaId}><b>{teaNames[item.teaId] ?? item.teaId}</b>{item.explanation}</p>)}</article>}
      {(explanationDraft?.dataInsufficiency.length ?? 0) > 0 && <article className="ai-insufficiency"><span>04</span><h3>{copy.aiInsufficiency}</h3>{explanationDraft?.dataInsufficiency.map((item) => <p key={item}>{item}</p>)}</article>}
    </div>}
    {visibleSources.length > 0 && <div className="ai-source-area"><h3><BookOpenCheck />{copy.aiSources}</h3><div className="ai-source-grid">{visibleSources.map((source) => <SourceCard key={source.knowledgeId} source={source} copy={copy} />)}</div></div>}
  </section>;
}

function SourceCard({ source, copy }: { source: ExplanationSourceCitation; copy: Pick<ResultCopy, 'aiSourceNoUrl' | 'aiSourceOpen'> }) {
  return <article className="ai-source-card"><small>{source.knowledgeId} · {source.type === 'tea' ? 'TEA' : 'CONSTITUTION'}</small><h4>{source.title}</h4><p>{source.sourceName ?? copy.aiSourceNoUrl}{source.sourceSection ? ` · ${source.sourceSection}` : ''}</p>{source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink />{copy.aiSourceOpen}</a> : <span>{copy.aiSourceNoUrl}</span>}</article>;
}
