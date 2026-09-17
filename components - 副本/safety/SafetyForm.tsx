'use client';

import { emptySafety } from '@/lib/safety-filter';
import { mockApi } from '@/lib/mock-api';
import { storage } from '@/lib/storage';
import { useI18n } from '@/lib/i18n';
import type { SafetyData } from '@/types/safety';
import { AlertCircle, ArrowRight, Check, Info, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';

const optionIds = {
  age: ['under-14', '14-17', '18-59', '60-plus', 'undisclosed'],
  sex: ['male', 'female', 'undisclosed'],
  allergies: ['none', 'chrysanthemum', 'pollen', 'nuts', 'legumes', 'citrus', 'other', 'unknown', 'undisclosed'],
  medication: ['no', 'yes', 'unknown', 'undisclosed'],
  pregnancy: ['no', 'pregnant', 'breastfeeding', 'not-applicable', 'unknown', 'undisclosed'],
  conditions: ['none', 'blood-pressure', 'blood-sugar', 'cardiovascular', 'liver-kidney', 'gastrointestinal', 'bleeding', 'other', 'unknown', 'undisclosed'],
  acute: ['none', 'cold-fever', 'vomiting', 'palpitation', 'other-discomfort'],
  caffeine: ['none', 'insomnia', 'palpitation', 'unknown', 'undisclosed'],
  flavors: ['fresh', 'sweet', 'bitter', 'sweet-tart', 'tea'],
  sugar: ['yes', 'no', 'either'],
} as const;

type SingleKey = 'age' | 'sex' | 'medication' | 'pregnancy' | 'acute' | 'caffeine' | 'sugar';
type MultiKey = 'allergies' | 'conditions' | 'flavors';

function Choice({ label, selected, onClick, danger = false }: { label: string; selected: boolean; onClick: () => void; danger?: boolean }) {
  return <button type="button" className={`choice-card ${selected ? 'is-selected' : ''} ${danger ? 'is-danger' : ''}`} aria-pressed={selected} onClick={onClick}><span>{selected && <Check />}</span>{label}</button>;
}

export function SafetyForm() {
  const { copy } = useI18n();
  const [form, setForm] = useState<SafetyData>(emptySafety);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { const stored = storage.getSafety(); if (stored) setForm(stored); }, []);

  const setSingle = (key: SingleKey, value: string) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => current.filter((item) => item !== key)); };
  const toggleMulti = (key: MultiKey, value: string) => setForm((current) => {
    const existing = current[key];
    const exclusive = ['none', 'unknown', 'undisclosed'];
    if (existing.includes(value)) return { ...current, [key]: existing.filter((item) => item !== value) };
    if (exclusive.includes(value)) return { ...current, [key]: [value] };
    return { ...current, [key]: [...existing.filter((item) => !exclusive.includes(item)), value] };
  });

  const renderSingle = (key: SingleKey) => <div className="choice-grid">{optionIds[key].map((id, index) => <Choice key={id} label={copy.safety.options[key][index]} selected={form[key] === id} danger={key === 'acute' && id !== 'none'} onClick={() => setSingle(key, id)} />)}</div>;
  const renderMulti = (key: MultiKey) => <div className="choice-grid">{optionIds[key].map((id, index) => <Choice key={id} label={copy.safety.options[key][index]} selected={form[key].includes(id)} onClick={() => toggleMulti(key, id)} />)}</div>;

  const submit = async () => {
    const missing = (['age', 'sex', 'acute'] as const).filter((key) => !form[key]);
    if (missing.length) { setErrors([...missing]); document.getElementById('safety-validation')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setSaving(true); await mockApi.submitSafety(form); window.location.assign('/chat');
  };

  const groups = [
    { key: 'age', content: renderSingle('age'), required: true },
    { key: 'sex', content: renderSingle('sex'), required: true },
    { key: 'allergies', content: renderMulti('allergies') },
    { key: 'medication', content: renderSingle('medication') },
    { key: 'pregnancy', content: renderSingle('pregnancy') },
    { key: 'conditions', content: renderMulti('conditions') },
    { key: 'acute', content: renderSingle('acute'), required: true },
    { key: 'caffeine', content: renderSingle('caffeine') },
    { key: 'flavors', content: renderMulti('flavors') },
    { key: 'sugar', content: renderSingle('sugar') },
  ] as const;

  return (
    <div>
      <div className="flow-intro"><div className="eyebrow"><LockKeyhole />{copy.safety.eyebrow}</div><h1>{copy.safety.title}</h1><p>{copy.safety.description}</p><div className="privacy-banner"><LockKeyhole />{copy.safety.privacy}</div></div>
      <form className="safety-form" onSubmit={(event) => event.preventDefault()} noValidate>
        {groups.map((group, index) => {
          const detail = copy.safety.groups[group.key];
          return <fieldset className={`form-section ${errors.includes(group.key) ? 'has-error' : ''}`} key={group.key}><legend><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{detail.title}{'required' in group && group.required && <i>*</i>}</strong><p>{detail.description}</p></div></legend>{group.content}
            {group.key === 'allergies' && form.allergies.includes('other') && <input className="text-input" value={form.otherAllergy} onChange={(e) => setForm({ ...form, otherAllergy: e.target.value })} placeholder={copy.safety.otherAllergy} aria-label={copy.safety.otherAllergy} />}
            {group.key === 'medication' && form.medication === 'yes' && <input className="text-input" value={form.medicineName} onChange={(e) => setForm({ ...form, medicineName: e.target.value })} placeholder={copy.safety.medicineName} aria-label={copy.safety.medicineName} />}
            {group.key === 'conditions' && form.conditions.includes('other') && <input className="text-input" value={form.otherCondition} onChange={(e) => setForm({ ...form, otherCondition: e.target.value })} placeholder={copy.safety.otherCondition} aria-label={copy.safety.otherCondition} />}
          </fieldset>;
        })}
        {errors.length > 0 && <div id="safety-validation" className="validation-box" role="alert"><AlertCircle /><div><strong>{copy.safety.validationTitle}</strong><p>{copy.safety.validationMessage}</p></div></div>}
        <div className="form-submit"><p><Info />{copy.safety.requiredHint}</p><button className="button button-primary" type="button" onClick={submit} disabled={saving}>{copy.safety.continue}<ArrowRight /></button></div>
      </form>
    </div>
  );
}
