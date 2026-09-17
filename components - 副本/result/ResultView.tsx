'use client';

import { HardLink } from '@/components/layout/HardLink';
import { AiExplanationPanel } from '@/components/result/AiExplanationPanel';
import { ConstitutionLeaf } from '@/components/result/ConstitutionLeaf';
import { TeaIngredientGallery } from '@/components/result/TeaIngredientGallery';
import { allKnowledgeSources } from '@/lib/ai/source-citations';
import { ExplanationRequestError, requestResultExplanation } from '@/lib/client-explanation';
import { getResultPageState } from '@/lib/analysis-view';
import { useI18n } from '@/lib/i18n';
import { mockApi } from '@/lib/mock-api';
import { localizedDataWarning, localizedDetermination, localizedReviewStatus, localizedSafetyMessage, localizedSafetyStatus, localizedSourceName, recommendationDisplay } from '@/lib/result-localization';
import { storage } from '@/lib/storage';
import { allowedTeaRecommendations, publicDataWarnings, publicSafetyMessages } from '@/lib/result-presentation';
import type { AnalyzeResponse, Recommendation } from '@/types/analysis';
import type { ExplanationResult } from '@/types/ai-explanation';
import type { SafetyData } from '@/types/safety';
import type { ConversationState } from '@/types/conversation-module';
import { localizedText, type Language } from '@/types/constitution';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronDown, CircleCheck, FileText, Leaf, RefreshCw, RotateCw, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

function ResultLoading() { return <div className="result-loading"><i /><i /><i /><span /></div>; }

const ageIds = ['under-14', '14-17', '18-59', '60-plus', 'undisclosed'];
const medicationIds = ['no', 'yes', 'unknown', 'undisclosed'];
const pregnancyIds = ['no', 'pregnant', 'breastfeeding', 'not-applicable', 'unknown', 'undisclosed'];
const caffeineIds = ['none', 'insomnia', 'palpitation', 'unknown', 'undisclosed'];
const acuteIds = ['none', 'cold-fever', 'vomiting', 'palpitation', 'other-discomfort'];
const conditionIds = ['none', 'blood-pressure', 'blood-sugar', 'cardiovascular', 'liver-kidney', 'gastrointestinal', 'bleeding', 'other', 'unknown', 'undisclosed'];

export function ResultView() {
  const { copy, language } = useI18n();
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [safety, setSafety] = useState<SafetyData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [modal, setModal] = useState<'sources' | 'taste' | null>(null);
  const [selected, setSelected] = useState('');
  const [teas, setTeas] = useState<Recommendation[]>([]);
  const [aiExplanation, setAiExplanation] = useState<ExplanationResult | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);

  useEffect(() => {
    setSafety(storage.getSafety());
    setConversation(storage.getConversationState());
    void mockApi.getResult().then((data) => { setResult(data); setTeas(data ? allowedTeaRecommendations(data) : []); setLoaded(true); });
  }, []);

  const pageState = getResultPageState(result);
  const rotate = () => setTeas((current) => current.length > 1 ? [...current.slice(1), current[0]] : current);
  const generateAiExplanation = () => {
    if (!result || aiExplanationLoading) return;
    setAiExplanationLoading(true);
    void requestResultExplanation(result, language)
      .then(setAiExplanation)
      .catch((error) => {
        const message = error instanceof ExplanationRequestError ? error.message : 'AI 说明暂时无法生成，规则结果、原始来源和安全提醒仍可查看。';
        setAiExplanation({ status: 'failed', mode: 'unavailable', message, explanation: null, sources: allKnowledgeSources(result.knowledge), safetyNotices: result.safetyWarnings, dataWarnings: result.dataWarnings });
      })
      .finally(() => setAiExplanationLoading(false));
  };
  const option = (group: keyof typeof copy.safety.options, ids: readonly string[], id: string) => {
    const index = ids.indexOf(id);
    return index >= 0 ? copy.safety.options[group][index] : copy.result.notProvided;
  };

  if (!loaded) return <ResultLoading />;
  if (pageState === 'empty' || !result) {
    return <div className="result-view"><div className="blocked-state"><span><AlertTriangle /></span><div><h3>{copy.result.emptyTitle}</h3><p>{copy.result.emptyDescription}</p><HardLink className="button button-primary" href="/safety"><ArrowLeft />{copy.result.backToSafety}</HardLink></div></div></div>;
  }

  const primary = result.primaryConstitution;
  const allowedTeas = allowedTeaRecommendations(result);
  const visibleDataWarnings = publicDataWarnings(result.dataWarnings);
  const visibleSafetyMessages = publicSafetyMessages(result.safetyWarnings).map((message) => localizedSafetyMessage(message, language));
  const primaryScore = primary?.conversionScore ?? null;
  const primaryEvidence = primary ? result.scores.find((score) => score.code === primary.code)?.evidence ?? [] : [];
  const visibleEvidence = primaryEvidence.slice(0, evidenceOpen ? primaryEvidence.length : 1);
  const secondaryText = result.secondaryConstitutions.length ? result.secondaryConstitutions.map((item) => `${localizedText(item.name, language)} · ${item.conversionScore ?? '—'}`).join(' / ') : copy.result.none;
  const higherItems = [...result.scores].filter((item) => item.conversionScore !== null).sort((left, right) => (right.conversionScore ?? 0) - (left.conversionScore ?? 0)).slice(0, 3);
  const higherItemsText = higherItems.map((item) => `${localizedText(item.name, language)} · ${item.conversionScore ?? '—'}`).join(' / ');
  const strategyLabel = result.safetyStatus.strategy === 'normal' ? copy.result.normal : result.safetyStatus.strategy === 'blocked' ? copy.result.blocked : copy.result.conservative;
  const formatDate = new Intl.DateTimeFormat({ zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', hi: 'hi' }[language], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.completedAt));
  const safetyRows = [
    [copy.result.age, safety?.age ? option('age', ageIds, safety.age) : copy.result.notProvided, Boolean(safety?.age && safety.age !== 'undisclosed')],
    [copy.result.allergy, result.excludedTeas.length ? `${copy.result.blocked} · ${result.excludedTeas.length}` : copy.result.notFound, result.excludedTeas.length === 0],
    [copy.result.medication, safety?.medication ? option('medication', medicationIds, safety.medication) : copy.result.notProvided, safety?.medication === 'no'],
    [copy.result.pregnancy, safety?.pregnancy ? option('pregnancy', pregnancyIds, safety.pregnancy) : copy.result.notProvided, ['no', 'not-applicable'].includes(safety?.pregnancy ?? '')],
    [copy.result.conditions, safety?.conditions.length ? safety.conditions.map((id) => option('conditions', conditionIds, id)).join('、') : copy.result.notProvided, safety?.conditions.includes('none') ?? false],
    [copy.result.caffeine, safety?.caffeine ? option('caffeine', caffeineIds, safety.caffeine) : copy.result.notProvided, safety?.caffeine === 'none'],
    [copy.result.acute, safety?.acute ? option('acute', acuteIds, safety.acute) : copy.result.notProvided, safety?.acute === 'none'],
    [copy.result.strategy, strategyLabel, result.safetyStatus.strategy === 'normal'],
  ] as const;

  return (
    <div className="result-view">
      <div className="demo-notice"><Sparkles />{copy.result.demoNotice}</div>
      <div className="result-heading"><div className="eyebrow"><Leaf />{copy.result.eyebrow}</div><h1>{copy.result.title}</h1></div>

      <section className="result-overview">
        <div className="overview-main"><div className="overview-main-copy"><span>{copy.result.primary}</span><h2>{primary ? localizedText(primary.name, language) : copy.result.noPrimaryTitle}</h2><div className="status-line"><b>{primary ? localizedDetermination(primary.determination, language) : copy.result.noPrimaryStatus}</b><i /><span>{result.assessmentStatus === 'complete' ? copy.result.completed : copy.result.notProvided}</span></div>{!primary && <p className="no-primary-explanation">{copy.result.noPrimaryReason}</p>}</div>{primary && <ConstitutionLeaf code={primary.code} name={localizedText(primary.name, language)} label={copy.result.constitutionLeaf} />}</div>
        <div className="overview-score"><div><span>{copy.result.score}</span><b>{primaryScore ?? '—'}</b></div><div className="score-track"><i style={{ width: `${primaryScore ?? 0}%` }} /></div><small>{copy.result.scoreNote}</small></div>
        <div className="overview-secondary"><span>{primary ? copy.result.secondary : copy.result.higherItems}</span><strong>{primary ? secondaryText : higherItemsText}</strong><p>{primary ? copy.result.secondaryMatched : copy.result.higherItemsNote}</p></div>
        <dl><div><dt>{copy.result.complete}</dt><dd>{result.assessmentStatus === 'complete' ? copy.result.completed : copy.result.notProvided}</dd></div><div><dt>{copy.result.time}</dt><dd>{formatDate}</dd></div><div><dt>{copy.result.basis}</dt><dd>{copy.result.basisValue}</dd></div></dl>
      </section>

      <details className="result-score-details"><summary>{copy.result.allScores}</summary><div>{result.scores.map((score) => <span key={score.code}><b>{localizedText(score.name, language)}</b><i>{score.conversionScore ?? '—'}</i><small>{localizedDetermination(score.determination, language)}</small></span>)}</div></details>
      {conversation && <details className="result-score-details demo-answer-details"><summary>{copy.result.answerFixture}</summary><div>{Object.values(conversation.confirmedAnswers).map((answer) => <span key={answer.questionId}><b>{answer.questionId}</b><i>{copy.result.answer} {answer.value}</i><small>{copy.result.quote} · {answer.sourceQuote}</small></span>)}</div></details>}

      <section className="result-section evidence-section" id="evidence"><div className="result-section-heading"><div><p>01 · EVIDENCE</p><h2>{copy.result.evidenceTitle}</h2><span>{copy.result.evidenceDescription}</span></div>{primaryEvidence.length > 1 && <button type="button" className="text-button" onClick={() => setEvidenceOpen((current) => !current)}>{evidenceOpen ? copy.result.collapse : copy.result.expand}<ChevronDown className={evidenceOpen ? 'rotated' : ''} /></button>}</div>
        {primaryEvidence.length ? <div className="evidence-list">{visibleEvidence.map((item) => <article key={item.questionId}><blockquote>{item.questionId}</blockquote><div><span><small>{copy.result.answer}</small>{item.answer}</span><ArrowRight /><span><small>{copy.result.adjustedAnswer}</small>{item.adjustedAnswer}</span></div><p><b>{copy.result.reason}</b>{language === 'zh' ? (item.reverse ? '6 − 原始答案' : '原始答案直接参与规则计算') : (item.reverse ? '6 − original answer' : 'The original answer is used directly in scoring')} · {primary ? localizedText(primary.name, language) : ''}</p></article>)}</div> : <div className="blocked-state"><span><AlertTriangle /></span><div><h3>{copy.result.notProvided}</h3><p>{visibleDataWarnings.map((item) => localizedDataWarning(item.code, item.message, language)).join(' ') || copy.result.noPrimaryReason}</p></div></div>}
      </section>

      {result.explanation && <section className="result-section explanation-section"><div className="result-section-heading"><div><p>02 · CONSTITUTION</p><h2>{copy.result.explanationTitle}</h2></div></div><div className="explanation-grid"><article><span>01</span><h3>{copy.result.mainFeatures}</h3><p>{result.explanation.mainFeatures[language]}</p></article><article><span>02</span><h3>{copy.result.commonSigns}</h3><p>{result.explanation.commonManifestations[language]}</p></article><article><span>03</span><h3>{copy.result.plainExplanation}</h3><p>{result.explanation.plainExplanation[language]}</p></article></div><div className="source-line"><BookOpenCheck />{copy.result.source} · {result.explanation.source[language]}</div></section>}

      <AiExplanationPanel explanation={aiExplanation} loading={aiExplanationLoading} sources={allKnowledgeSources(result.knowledge)} teaNames={Object.fromEntries(allowedTeas.map((tea) => [tea.id, recommendationDisplay(tea, language).name]))} language={language} copy={copy.result} onGenerate={generateAiExplanation} />

      <section className="result-section safety-summary"><div className="result-section-heading"><div><p>03 · SAFETY FIRST</p><h2>{copy.result.safetyTitle}</h2><span>{localizedSafetyStatus(result, language)}</span></div><div className={`strategy-badge ${result.safetyStatus.strategy}`}><ShieldCheck />{strategyLabel}</div></div><div className="safety-grid">{safetyRows.map(([label, value, safe]) => <div key={label}><span className={safe ? 'is-safe' : ''}>{safe ? <CircleCheck /> : <AlertTriangle />}</span><div><small>{label}</small><strong>{value}</strong></div></div>)}</div>
        {(visibleSafetyMessages.length > 0 || visibleDataWarnings.length > 0) && <div className="rule-notices">{visibleSafetyMessages.length > 0 && <div><h3>{copy.result.safetyWarningsTitle}</h3>{visibleSafetyMessages.map((message) => <p key={message}>{message}</p>)}</div>}{visibleDataWarnings.length > 0 && <div><h3>{copy.result.dataWarningsTitle}</h3>{visibleDataWarnings.map((item) => <p key={item.code}>{localizedDataWarning(item.code, item.message, language)}</p>)}</div>}</div>}
      </section>

      <section className="result-section tea-section"><div className="result-section-heading"><div><p>04 · TEA MATCHING</p><h2>{copy.result.teaTitle}</h2><span>{copy.result.teaDescription}</span></div></div>
        {pageState !== 'ready' || teas.length === 0 ? <div className="blocked-state"><span><AlertTriangle /></span><div><h3>{copy.result.blockedTitle}</h3><p>{copy.result.noAllowedTea}</p></div></div> : <div className="tea-grid">{teas.map((tea, index) => <TeaCard key={`${tea.id}-${index}`} tea={tea} language={language} copy={copy} selected={selected === tea.id} onSelect={() => setSelected(tea.id)} onChange={rotate} />)}</div>}
      </section>

      <div className="result-actions"><button type="button" onClick={() => { setEvidenceOpen(true); document.getElementById('evidence')?.scrollIntoView({ behavior: 'smooth' }); }}><FileText />{copy.result.evidenceAction}</button><button type="button" onClick={() => setModal('taste')}><SlidersHorizontal />{copy.result.adjustTaste}</button><button type="button" onClick={rotate} disabled={teas.length < 2}><RotateCw />{copy.result.changeRecommendation}</button><button type="button" onClick={() => setModal('sources')}><BookOpenCheck />{copy.result.viewSources}</button><button type="button" onClick={() => { storage.restartAssessment(); window.location.assign('/safety'); }}><RefreshCw />{copy.result.reassess}</button><HardLink className="primary-action" href="/feedback">{copy.result.feedback}<ArrowRight /></HardLink></div>
      <HardLink className="back-link result-home" href="/"><ArrowLeft />{copy.common.home}</HardLink>

      {modal && <div className="modal-backdrop"><dialog open className="modal-card" aria-labelledby="modal-title"><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label={copy.common.close}><X /></button><span><Leaf /></span><h2 id="modal-title">{modal === 'sources' ? copy.result.sourcesTitle : copy.result.tasteTitle}</h2>{modal === 'sources' ? <div className="source-modal-list">{allowedTeas.length ? allowedTeas.map((tea) => <p key={tea.id}><b>{recommendationDisplay(tea, language).name}</b>{localizedSourceName(tea.sourceName, language) ?? copy.result.notProvided} · {localizedReviewStatus(tea.reviewStatus, language) ?? copy.result.notProvided}</p>) : <p>{copy.result.noAllowedTea}</p>}</div> : <p>{copy.result.tasteDescription}</p>}{modal === 'taste' && <HardLink className="button button-primary" href="/safety#flavors">{copy.result.adjustTaste}<ArrowRight /></HardLink>}<button type="button" className="button button-secondary" onClick={() => setModal(null)}>{copy.common.close}</button></dialog></div>}
    </div>
  );
}

function TeaCard({ tea, language, copy, selected, onSelect, onChange }: { tea: Recommendation; language: Language; copy: ReturnType<typeof useI18n>['copy']; selected: boolean; onSelect: () => void; onChange: () => void }) {
  const labels = copy.result;
  const display = recommendationDisplay(tea, language);
  const matched = tea.constitutionCodes.join(' / ');
  const selectable = tea.safetyStatus === 'allowed';
  return <article className={`tea-card ${tea.position === 'priority' ? 'is-priority' : ''}`}><header><span>{labels[tea.position]}</span><small>0{tea.position === 'priority' ? '1' : tea.position === 'tasteAlternative' ? '2' : '3'}</small></header><div className="tea-card-title"><div className="mini-cup" aria-hidden="true"><i /></div><div><p>{labels.matchedConstitution} · {matched}</p><h3>{display.name}</h3></div></div><TeaIngredientGallery teaId={tea.id} teaName={display.name} label={labels.ingredientPhotos} />
    <div className="tea-reason"><b>{labels.recommendationReason}</b><p>{display.reason || labels.notProvided}</p></div>
    <dl><div><dt>{labels.ingredients}</dt><dd>{display.ingredients || labels.notProvided}</dd></div><div><dt>{labels.taste}</dt><dd>{display.flavor || labels.notProvided}</dd></div><div><dt>{labels.brew}</dt><dd>{display.brewMethod || labels.notProvided}</dd></div><div><dt>{labels.risk}</dt><dd><span className={tea.safetyStatus === 'allowed' ? 'risk-low' : 'risk-medium'}>{tea.safetyStatus === 'allowed' ? labels.normal : labels.conservative}</span></dd></div><div><dt>{labels.safetyReminder}</dt><dd>{display.unsuitable || labels.notProvided}</dd></div><div><dt>{labels.review}</dt><dd><Check />{localizedReviewStatus(tea.reviewStatus, language) ?? labels.notProvided}</dd></div><div><dt>{labels.sourceLabel}</dt><dd>{localizedSourceName(tea.sourceName, language) ?? labels.notProvided}</dd></div></dl>
    {selectable ? <footer><button type="button" className={`button ${selected ? 'button-selected' : 'button-primary'}`} onClick={onSelect}>{selected ? <Check /> : <Leaf />}{selected ? labels.selected : labels.selectTea}</button><button type="button" className="button button-secondary" onClick={onChange}>{labels.changeTea}</button></footer> : <footer><span className="tea-confirmation">{labels.cautiousTitle}</span></footer>}
  </article>;
}
