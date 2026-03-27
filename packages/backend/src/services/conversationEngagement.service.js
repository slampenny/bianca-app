/**
 * Heuristic engagement signals for Bianca assistant turns (voice transcripts).
 * Used post-call to tag dead-end turns and aggregate rates for quality review.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'let', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'she', 'use', 'her', 'many', 'than', 'them', 'these', 'some', 'into', 'just', 'like', 'over', 'also', 'back', 'after', 'when', 'from', 'that', 'this', 'with', 'have', 'your', 'what', 'been', 'they', 'will', 'would', 'there', 'their', 'about', 'could', 'other',
]);

const QUESTION_PHRASE_RE =
  /\b(tell me more|what do you think|how does that sound|anything else|anything you'd like|anything you want|curious what|want to share|on your mind|how about|what about)\b/i;

const INVITATION_PHRASE_RE =
  /\b(let me know|happy to hear|I'd love to hear|we can talk|pick up next time|love to hear more|I'm here if)\b/i;

const CALLBACK_ACK_RE =
  /\b(sounds like|I hear you|makes sense|good to know|I understand|that's rough|that sounds|glad to hear|sorry to hear|oh no|I see|right,|okay,|ok,)\b/i;

const CLOSING_RE =
  /\b(take care|goodbye|good bye|\bbye\b|talk soon|nice talking|great talking|speak soon|call you again|call again|have a good|have a great|rest well|see you|until next time|nice to talk)\b/i;

function normalizeForTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü'\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasQuestionSignal(text) {
  const t = String(text || '');
  if (/\?/.test(t)) return true;
  return QUESTION_PHRASE_RE.test(t);
}

function hasInvitationSignal(text) {
  const t = String(text || '');
  return hasQuestionSignal(t) || INVITATION_PHRASE_RE.test(t);
}

function tokenAppearsAsWord(haystack, word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(haystack);
}

function hasCallbackSignal(assistantText, previousUserContent) {
  const a = String(assistantText || '');
  if (!previousUserContent || !String(previousUserContent).trim()) return false;
  if (CALLBACK_ACK_RE.test(a)) return true;
  const userTokens = normalizeForTokens(previousUserContent).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w)
  );
  for (const word of userTokens) {
    if (word.length < 4) continue;
    if (tokenAppearsAsWord(a, word)) return true;
  }
  return false;
}

function isLikelyClosingStatement(text) {
  return CLOSING_RE.test(String(text || ''));
}

/**
 * @param {Array<{ role: string, content?: string }>} messages Chronological messages
 * @returns {Object|null}
 */
function computeConversationEngagementMetrics(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const filtered = messages.filter((m) => m && (m.role === 'assistant' || m.role === 'client'));
  if (filtered.length === 0) return null;

  let lastAssistantIndex = -1;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (filtered[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  if (lastAssistantIndex < 0) {
    return {
      version: 1,
      assistantMessageCount: 0,
      lastAssistantPresent: false,
      lastTurnDeadEnd: null,
      turnsAfterClient: 0,
      deadEndTurnsAfterClient: 0,
    };
  }

  const assistantMessageCount = filtered.filter((m) => m.role === 'assistant').length;
  const lastText = String(filtered[lastAssistantIndex].content || '');
  let prevUserForLast = '';
  for (let i = lastAssistantIndex - 1; i >= 0; i--) {
    if (filtered[i].role === 'client') {
      prevUserForLast = String(filtered[i].content || '');
      break;
    }
  }

  const lastTurnIsClosing = isLikelyClosingStatement(lastText);
  const lastTurnHadQuestion = hasQuestionSignal(lastText);
  const lastTurnHadCallback = hasCallbackSignal(lastText, prevUserForLast);
  const lastTurnHadInvitation = hasInvitationSignal(lastText);
  const lastTurnEngaged =
    lastTurnHadQuestion || lastTurnHadCallback || lastTurnHadInvitation || lastTurnIsClosing;
  const lastTurnDeadEnd = !lastTurnEngaged;

  let turnsAfterClient = 0;
  let deadEndTurnsAfterClient = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i].role !== 'client') continue;
    const next = filtered[i + 1];
    if (next.role !== 'assistant') continue;
    turnsAfterClient++;
    const reply = String(next.content || '');
    const prevUser = String(filtered[i].content || '');
    const closing = isLikelyClosingStatement(reply);
    const q = hasQuestionSignal(reply);
    const inv = hasInvitationSignal(reply);
    const cb = hasCallbackSignal(reply, prevUser);
    if (!closing && !q && !inv && !cb) {
      deadEndTurnsAfterClient++;
    }
  }

  const excerpt = lastText.length > 220 ? `${lastText.slice(0, 217)}...` : lastText;

  return {
    version: 1,
    assistantMessageCount,
    lastAssistantPresent: true,
    lastAssistantExcerpt: excerpt,
    lastTurnIsClosing,
    lastTurnHadQuestion,
    lastTurnHadCallback,
    lastTurnHadInvitation,
    lastTurnDeadEnd,
    turnsAfterClient,
    deadEndTurnsAfterClient,
    deadEndRateAfterClient:
      turnsAfterClient > 0 ? Math.round((deadEndTurnsAfterClient / turnsAfterClient) * 1000) / 1000 : null,
  };
}

module.exports = {
  computeConversationEngagementMetrics,
  hasQuestionSignal,
  hasCallbackSignal,
  hasInvitationSignal,
  isLikelyClosingStatement,
};
