'use client';

import { ChevronDown, Languages } from 'lucide-react';
import { languageNames, useI18n, type Language } from '@/lib/i18n';

export function LanguageSwitch() {
  const { copy, language, setLanguage } = useI18n();
  return (
    <label className="language-switch" aria-label={copy.common.switchLabel}>
      <Languages aria-hidden="true" />
      <span>{languageNames[language]}</span>
      <ChevronDown className="language-switch-chevron" aria-hidden="true" />
      <select aria-label={copy.common.switchLabel} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
  );
}
