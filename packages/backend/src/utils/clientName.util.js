/**
 * @param {string|undefined|null} full
 * @returns {{ firstName: string, lastName: string }}
 */
function splitFullName(full) {
  const t = (full == null ? '' : String(full)).trim();
  if (!t) return { firstName: '', lastName: '' };
  const p = t.split(/\s+/);
  return { firstName: p[0] || '', lastName: p.slice(1).join(' ') || '' };
}

/**
 * @param {string|undefined|null} a
 * @param {string|undefined|null} b
 */
function fullNameFromParts(a, b) {
  const first = a == null ? '' : String(a).trim();
  const last = b == null ? '' : String(b).trim();
  return [first, last].filter((s) => s.length > 0).join(' ').trim();
}

module.exports = { splitFullName, fullNameFromParts };
