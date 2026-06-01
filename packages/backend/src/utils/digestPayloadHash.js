const crypto = require('crypto');

const stableStringify = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'undefined') {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const canonicalizePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const { localeHint, ...rest } = payload;
  return JSON.parse(stableStringify(rest));
};

const hashPayload = (payload) =>
  crypto.createHash('sha256').update(stableStringify(canonicalizePayload(payload))).digest('hex');

module.exports = {
  stableStringify,
  canonicalizePayload,
  hashPayload,
};
