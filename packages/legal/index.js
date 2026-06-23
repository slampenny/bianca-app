const fs = require('fs');
const path = require('path');

const DIR = __dirname;

function readDoc(filename) {
  return fs.readFileSync(path.join(DIR, filename), 'utf8');
}

const pages = JSON.parse(fs.readFileSync(path.join(DIR, 'pages.json'), 'utf8'));

/** @type {Record<string, string>} slug → public path on biancawellness.com */
const PUBLIC_BASE = 'https://biancawellness.com';
const urls = Object.fromEntries(
  pages.map((page) => [page.slug, `${PUBLIC_BASE}/${page.slug}/`])
);

module.exports = {
  pages,
  urls,
  TERMS: readDoc('TERMS.md'),
  PRIVACY: readDoc('PRIVACY.md'),
  PRIVACY_PIPEDA: readDoc('PRIVACY_PIPEDA.md'),
  NOTICE_OF_PRIVACY_PRACTICES: readDoc('NOTICE_OF_PRIVACY_PRACTICES.md'),
  CROSS_BORDER_DATA_TRANSFERS: readDoc('CROSS_BORDER_DATA_TRANSFERS.md'),
  DATA_SAFETY: readDoc('DATA_SAFETY.md'),
};
