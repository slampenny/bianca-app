import i18n from "i18next"
import type { LangCode } from "./locales"

const LOADABLE: LangCode[] = ["es", "fr", "de", "zh", "ja", "pt", "it", "ru", "ar", "ko", "hu"]

const loaders: Record<LangCode, () => Promise<{ translation: Record<string, unknown> }>> = {
  es: () => import("./locales/es").then((m) => ({ translation: m.es as Record<string, unknown> })),
  fr: () => import("./locales/fr").then((m) => ({ translation: m.fr as Record<string, unknown> })),
  de: () => import("./locales/de").then((m) => ({ translation: m.de as Record<string, unknown> })),
  zh: () => import("./locales/zh").then((m) => ({ translation: m.zh as Record<string, unknown> })),
  ja: () => import("./locales/ja").then((m) => ({ translation: m.ja as Record<string, unknown> })),
  pt: () => import("./locales/pt").then((m) => ({ translation: m.pt as Record<string, unknown> })),
  it: () => import("./locales/it").then((m) => ({ translation: m.it as Record<string, unknown> })),
  ru: () => import("./locales/ru").then((m) => ({ translation: m.ru as Record<string, unknown> })),
  ar: () => import("./locales/ar").then((m) => ({ translation: m.ar as Record<string, unknown> })),
  ko: () => import("./locales/ko").then((m) => ({ translation: m.ko as Record<string, unknown> })),
  hu: () => import("./locales/hu").then((m) => ({ translation: m.hu as Record<string, unknown> })),
}

const loaded = new Set<string>(["en"])
const inflight = new Map<string, Promise<void>>()

export function normalizeWebLang(code: string): string {
  const lang = code.slice(0, 2).toLowerCase()
  return lang === "en" ? "en" : lang
}

export function isWebLocaleLoaded(code: string): boolean {
  return loaded.has(normalizeWebLang(code))
}

/** Fetches and registers a locale bundle if not already loaded. English is bundled at init. */
export async function ensureWebLocaleLoaded(code: string): Promise<void> {
  const lang = normalizeWebLang(code)
  if (loaded.has(lang)) return

  const pending = inflight.get(lang)
  if (pending) {
    await pending
    return
  }

  if (lang === "en" || !LOADABLE.includes(lang as LangCode)) {
    loaded.add(lang)
    return
  }

  const promise = (async () => {
    const { translation } = await loaders[lang as LangCode]()
    if (!i18n.hasResourceBundle(lang, "translation")) {
      i18n.addResourceBundle(lang, "translation", translation, true, true)
    }
    loaded.add(lang)
  })()

  inflight.set(lang, promise)
  try {
    await promise
  } finally {
    inflight.delete(lang)
  }
}

/** Loads the bundle then switches language (use instead of `i18n.changeLanguage` for non-English). */
export async function changeWebLanguage(code: string): Promise<void> {
  const lang = normalizeWebLang(code)
  await ensureWebLocaleLoaded(lang)
  await i18n.changeLanguage(lang)
}
