import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './en.json';
import fr from './fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
/** 'system' follows the device locale; otherwise a hard user override. */
export type LanguagePreference = 'system' | SupportedLanguage;

const FALLBACK: SupportedLanguage = 'en';

function isSupported(code: string | null | undefined): code is SupportedLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** First supported language from the device's ordered locale list, else English. */
export function detectSystemLanguage(): SupportedLanguage {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) return locale.languageCode;
  }
  return FALLBACK;
}

export function resolveLanguage(pref: LanguagePreference): SupportedLanguage {
  return pref === 'system' ? detectSystemLanguage() : pref;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: detectSystemLanguage(),
    fallbackLng: FALLBACK,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
}

export default i18n;
