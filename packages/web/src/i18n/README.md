# Web i18n

## Layout

| File | Role |
|------|------|
| `locales/en.ts` | English source (composed from `shell.ts`, `appLocalesAuth.ts`, `appLocalesPages.ts`) |
| `locales/es.ts`, `fr.ts`, … | Full translation tree per language |
| `locales/index.ts` | Registers all locales for i18next |
| `i18n.ts` | Initializes `react-i18next` (English only at startup) |
| `loadLocale.ts` | Dynamic `import()` per language (~50–80 KB gzip each) |
| `I18nProvider.tsx` | Loads stored/browser locale before first paint |

UI code uses `useTranslation()` and `t('namespace.key')` — same as standard i18next; there is no Ignite `tx` prop on web.

## Adding or changing copy

1. Edit English in `appLocalesAuth.ts`, `appLocalesPages.ts`, or `shell.ts` (picked up by `locales/en.ts`).
2. Add the same key path to each `locales/{lang}.ts` file you support.
3. Run `yarn workspace @bianca-app/web i18n:check` — fails if any non-English locale is missing keys.

## Scripts

- `yarn i18n:check` — compare all locales against English key paths (CI-friendly)
- `yarn tsx scripts/sync-missing-keys.ts` — copy missing keys from `en` into locale files (English placeholder)
- `yarn tsx scripts/export-untranslated.ts` — list keys whose value still equals English
- `scripts/.venv/bin/python scripts/translate-untranslated.py [es …]` — machine-translate (re-exports first)
- `yarn tsx scripts/apply-translated-fixes.ts [es …]` — write `translated-*.json` into locale files
- `yarn tsx scripts/apply-manual-overrides.ts` — apply `scripts/data/manual-overrides.json` (run after machine translation)
- `yarn tsx scripts/check-untranslated-values.ts` — fail if a locale value still equals English (with allowlist for brands/acronyms)

After adding English keys, prefer: `sync-missing-keys` → translate one locale → `apply-translated-fixes` → `apply-manual-overrides` → `check-untranslated-values`.

## Country / timezone dropdowns

Registration and org onboarding use `useRegistrationCountryOptions()` and `useOrgTimezoneOptions()` (`src/hooks/useGeoOptions.ts`). Labels come from the browser `Intl` APIs; only the pseudo-code `OTHER` is translated via `geo.countries.OTHER`.

## Lazy-loaded locales

Non-English bundles are not in the main JS chunk. Switch language with `changeWebLanguage()` from `i18n/i18n.ts` (loads the chunk, then calls `i18n.changeLanguage`).
