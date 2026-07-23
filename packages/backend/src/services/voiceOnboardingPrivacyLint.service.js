/**
 * Lint org-authored voice onboarding text for phrases that conflict with the
 * resident-facing privacy / no-caregiver-mention rules.
 *
 * Enforcement is role-aware (passed from the PATCH caller):
 * - orgAdmin (and any non-superAdmin editor) → hard block
 * - superAdmin → warn (save allowed, warnings returned), unless
 *   VOICE_ONBOARDING_PRIVACY_LINT_MODE=block forces block for everyone
 */

const CONFLICT_PATTERNS = [
  { id: 'tell_family', re: /\btell\s+your\s+family\b/i, label: 'tell your family' },
  { id: 'share_with_staff', re: /\bwe'?ll\s+share\s+with\s+staff\b/i, label: "we'll share with staff" },
  { id: 'share_with_care', re: /\bshare\s+with\s+(your\s+)?(care\s*team|caregiver|staff|family)\b/i, label: 'share with care team/staff/family' },
  { id: 'care_team_will_know', re: /\b(your\s+)?care\s*team\s+will\s+know\b/i, label: 'your care team will know' },
  { id: 'people_caring', re: /\bpeople\s+caring\s+for\s+you\b/i, label: 'people caring for you' },
  { id: 'pass_along', re: /\bpass\s+(this|it|that)\s+along\b/i, label: 'pass along' },
  { id: 'for_your_caregiver', re: /\bfor\s+your\s+caregiver\b/i, label: 'for your caregiver' },
  { id: 'update_your_family', re: /\bupdate\s+your\s+family\b/i, label: 'update your family' },
  { id: 'report_to', re: /\breport(?:ed|ing)?\s+to\s+(your\s+)?(caregiver|family|staff|care\s*team)\b/i, label: 'report to caregiver/family/staff' },
];

/**
 * Env override — used for superAdmin (and callers with no role).
 * @returns {'warn'|'block'}
 */
function getPrivacyLintMode() {
  const raw = String(process.env.VOICE_ONBOARDING_PRIVACY_LINT_MODE || 'warn').toLowerCase();
  return raw === 'block' ? 'block' : 'warn';
}

/**
 * Role-aware lint mode for save-time enforcement.
 * Facility orgAdmins cannot save privacy-conflicting phrasing; Bianca
 * superAdmins keep warn-by-default so they can review and iterate.
 *
 * @param {string|null|undefined} role
 * @returns {'warn'|'block'}
 */
function getPrivacyLintModeForRole(role) {
  if (role && role !== 'superAdmin') {
    return 'block';
  }
  return getPrivacyLintMode();
}

/**
 * @param {string} text
 * @param {string} path
 * @returns {{ path: string, phrase: string, id: string }[]}
 */
function lintText(text, path) {
  if (!text || typeof text !== 'string') return [];
  const hits = [];
  for (const p of CONFLICT_PATTERNS) {
    if (p.re.test(text)) {
      hits.push({ path, phrase: p.label, id: p.id });
    }
  }
  return hits;
}

/**
 * @param {{ useDefault?: boolean, days?: object[] }|null|undefined} voiceOnboarding
 * @returns {{ path: string, phrase: string, id: string }[]}
 */
function lintVoiceOnboardingPrivacy(voiceOnboarding) {
  if (!voiceOnboarding || voiceOnboarding.useDefault !== false) {
    return [];
  }
  const warnings = [];
  const days = Array.isArray(voiceOnboarding.days) ? voiceOnboarding.days : [];
  days.forEach((day, di) => {
    const dayLabel = day.dayNumber != null ? `day ${day.dayNumber}` : `days[${di}]`;
    warnings.push(...lintText(day.opening, `${dayLabel} opening`));
    warnings.push(...lintText(day.theme, `${dayLabel} theme`));
    (day.questions || []).forEach((q, qi) => {
      const qLabel = q.id ? `${dayLabel} question "${q.id}"` : `${dayLabel} questions[${qi}]`;
      warnings.push(...lintText(q.prompt, qLabel));
    });
  });
  return warnings;
}

module.exports = {
  CONFLICT_PATTERNS,
  getPrivacyLintMode,
  getPrivacyLintModeForRole,
  lintVoiceOnboardingPrivacy,
};
