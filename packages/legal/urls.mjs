import pages from "./pages.json" with { type: "json" }

const PUBLIC_BASE = "https://biancawellness.com"

/** @type {Record<string, string>} slug → public URL on biancawellness.com */
export const urls = Object.fromEntries(
  pages.map((page) => [page.slug, `${PUBLIC_BASE}/${page.slug}/`]),
)
