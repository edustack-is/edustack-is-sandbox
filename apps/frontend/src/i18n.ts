import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n.use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'cs',
        debug: false,
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
            // Locale JSON lives in public/ with a stable name, so browsers/CDN
            // cache it across deploys. The per-build id busts that cache so new
            // translation keys show up without a manual hard refresh.
            queryStringParams: { v: __BUILD_ID__ },
        },
        detection: {
            order: ['localStorage', 'cookie', 'htmlTag', 'navigator'],
            caches: ['localStorage', 'cookie'],
        },
    });

export default i18n;
