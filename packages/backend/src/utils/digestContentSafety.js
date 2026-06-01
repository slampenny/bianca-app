/**
 * Shared digest content-safety helpers for daily and family weekly digests.
 */

const FAMILY_SAFE_NO_SUMMARY_FALLBACK =
  'A wellness check-in was completed, but no family-ready summary is available yet.';

const FAMILY_AI_DISCLAIMER =
  'This digest is automatically generated from wellness check-in calls. It is not clinical advice and should be reviewed alongside care-team updates when decisions are needed.';

const FAMILY_CONFIDENTIAL_FOOTER =
  'Confidential — for the intended family contact only. Do not forward.';

const isUnsafeDigestText = (value) => {
  if (value == null || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('summary generation failed')) {
    return true;
  }
  if (lower.includes('manual review needed')) {
    return true;
  }
  if (lower.startsWith('error:') || lower.startsWith('internal error')) {
    return true;
  }
  if (/^exception[:\s]/i.test(trimmed) || /^at\s+\S+\s+\(/m.test(trimmed)) {
    return true;
  }
  return false;
};

/** Heuristic: dialogue/transcript-shaped text is not family-ready. */
const isTranscriptLikeText = (value) => {
  if (value == null || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(user|assistant|patient|caregiver|bianca|human|ai)\s*:/im.test(trimmed)) {
    return true;
  }
  if (/\[\d{4}-\d{2}-\d{2}/.test(trimmed) && trimmed.includes('\n')) {
    return true;
  }
  const lines = trimmed.split('\n').filter((l) => l.trim());
  if (lines.length >= 4 && trimmed.length > 300) {
    return true;
  }
  return false;
};

const sanitizeDigestText = (value, fallback) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  if (isUnsafeDigestText(value) || isTranscriptLikeText(value)) {
    return fallback;
  }
  return value;
};

module.exports = {
  FAMILY_SAFE_NO_SUMMARY_FALLBACK,
  FAMILY_AI_DISCLAIMER,
  FAMILY_CONFIDENTIAL_FOOTER,
  isUnsafeDigestText,
  isTranscriptLikeText,
  sanitizeDigestText,
};
