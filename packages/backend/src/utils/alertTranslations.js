/**
 * Alert Message Translations
 * Provides translations for alert messages based on caregiver's preferred language
 */

const translations = {
  en: {
    urgency: {
      CRITICAL: '🚨 CRITICAL',
      HIGH: '⚠️ HIGH PRIORITY',
      MEDIUM: '📢 ALERT'
    },
    category: {
      Medical: 'Medical',
      Safety: 'Safety',
      Physical: 'Physical',
      Request: 'Request'
    },
    emergency: 'Emergency',
    reported: 'reported',
    originalMessage: 'Original message'
  },
  es: {
    urgency: {
      CRITICAL: '🚨 CRÍTICO',
      HIGH: '⚠️ ALTA PRIORIDAD',
      MEDIUM: '📢 ALERTA'
    },
    category: {
      Medical: 'Médico',
      Safety: 'Seguridad',
      Physical: 'Físico',
      Request: 'Solicitud'
    },
    emergency: 'Emergencia',
    reported: 'reportó',
    originalMessage: 'Mensaje original'
  },
  fr: {
    urgency: {
      CRITICAL: '🚨 CRITIQUE',
      HIGH: '⚠️ HAUTE PRIORITÉ',
      MEDIUM: '📢 ALERTE'
    },
    category: {
      Medical: 'Médical',
      Safety: 'Sécurité',
      Physical: 'Physique',
      Request: 'Demande'
    },
    emergency: 'Urgence',
    reported: 'a signalé',
    originalMessage: 'Message original'
  },
  de: {
    urgency: {
      CRITICAL: '🚨 KRITISCH',
      HIGH: '⚠️ HOHE PRIORITÄT',
      MEDIUM: '📢 WARNUNG'
    },
    category: {
      Medical: 'Medizinisch',
      Safety: 'Sicherheit',
      Physical: 'Körperlich',
      Request: 'Anfrage'
    },
    emergency: 'Notfall',
    reported: 'gemeldet',
    originalMessage: 'Ursprüngliche Nachricht'
  },
  zh: {
    urgency: {
      CRITICAL: '🚨 严重',
      HIGH: '⚠️ 高优先级',
      MEDIUM: '📢 警报'
    },
    category: {
      Medical: '医疗',
      Safety: '安全',
      Physical: '身体',
      Request: '请求'
    },
    emergency: '紧急情况',
    reported: '报告',
    originalMessage: '原始消息'
  },
  ja: {
    urgency: {
      CRITICAL: '🚨 緊急',
      HIGH: '⚠️ 高優先度',
      MEDIUM: '📢 警告'
    },
    category: {
      Medical: '医療',
      Safety: '安全',
      Physical: '身体的',
      Request: 'リクエスト'
    },
    emergency: '緊急事態',
    reported: '報告',
    originalMessage: '元のメッセージ'
  },
  pt: {
    urgency: {
      CRITICAL: '🚨 CRÍTICO',
      HIGH: '⚠️ ALTA PRIORIDADE',
      MEDIUM: '📢 ALERTA'
    },
    category: {
      Medical: 'Médico',
      Safety: 'Segurança',
      Physical: 'Físico',
      Request: 'Solicitação'
    },
    emergency: 'Emergência',
    reported: 'relatou',
    originalMessage: 'Mensagem original'
  },
  it: {
    urgency: {
      CRITICAL: '🚨 CRITICO',
      HIGH: '⚠️ ALTA PRIORITÀ',
      MEDIUM: '📢 ALLERTA'
    },
    category: {
      Medical: 'Medico',
      Safety: 'Sicurezza',
      Physical: 'Fisico',
      Request: 'Richiesta'
    },
    emergency: 'Emergenza',
    reported: 'ha segnalato',
    originalMessage: 'Messaggio originale'
  },
  ru: {
    urgency: {
      CRITICAL: '🚨 КРИТИЧНО',
      HIGH: '⚠️ ВЫСОКИЙ ПРИОРИТЕТ',
      MEDIUM: '📢 ПРЕДУПРЕЖДЕНИЕ'
    },
    category: {
      Medical: 'Медицинский',
      Safety: 'Безопасность',
      Physical: 'Физический',
      Request: 'Запрос'
    },
    emergency: 'Чрезвычайная ситуация',
    reported: 'сообщил',
    originalMessage: 'Исходное сообщение'
  },
  ko: {
    urgency: {
      CRITICAL: '🚨 긴급',
      HIGH: '⚠️ 높은 우선순위',
      MEDIUM: '📢 경고'
    },
    category: {
      Medical: '의료',
      Safety: '안전',
      Physical: '신체',
      Request: '요청'
    },
    emergency: '비상',
    reported: '보고함',
    originalMessage: '원본 메시지'
  },
  ar: {
    urgency: {
      CRITICAL: '🚨 حرج',
      HIGH: '⚠️ أولوية عالية',
      MEDIUM: '📢 تنبيه'
    },
    category: {
      Medical: 'طبي',
      Safety: 'سلامة',
      Physical: 'جسدي',
      Request: 'طلب'
    },
    emergency: 'طوارئ',
    reported: 'أبلغ عن',
    originalMessage: 'الرسالة الأصلية'
  }
};

/**
 * Translate an alert message based on language
 * @param {string} message - Original English alert message
 * @param {string} language - Language code (default: 'en')
 * @param {Object} alertData - Alert data with severity, category, phrase, clientName/patientName, originalText
 * @returns {string} Translated alert message
 */
function translateAlertMessage(message, language = 'en', alertData = null) {
  // If no alert data provided, try to parse from existing message
  if (!alertData && message) {
    // Try to extract data from existing English message format
    // Format: "🚨 CRITICAL Medical Emergency: ClientName reported "phrase". Original message: "text""
    const match = message.match(/^([🚨⚠️📢][^\s]+)\s+([A-Za-z]+)\s+Emergency:\s+([^"]+?)\s+reported\s+"([^"]+)"\.\s+Original message:\s+"([^"]+)"/);
    if (match) {
      alertData = {
        urgency: match[1],
        category: match[2],
        clientName: match[3].trim(),
        patientName: match[3].trim(), // legacy alias
        phrase: match[4],
        originalText: match[5],
        severity: match[1].includes('CRITICAL') ? 'CRITICAL' : 
                  match[1].includes('HIGH') ? 'HIGH' : 'MEDIUM'
      };
    }
  }

  // If we have structured data, create translated message
  if (alertData && language !== 'en') {
    const t = translations[language] || translations.en;
    const urgency = t.urgency[alertData.severity] || alertData.severity;
    const category = t.category[alertData.category] || alertData.category;
    const clientName = alertData.clientName || alertData.patientName || 'Client';
    const phrase = alertData.phrase || '';
    const originalText = alertData.originalText || '';
    const truncatedText = originalText.length > 100 
      ? originalText.substring(0, 100) + '...' 
      : originalText;

    return `${urgency} ${category} ${t.emergency}: ${clientName} ${t.reported} "${phrase}". ${t.originalMessage}: "${truncatedText}"`;
  }

  // Fallback to original message if no structured data or English
  return message;
}

/**
 * Parse alert message to extract structured data
 * @param {string} message - Alert message
 * @returns {Object|null} Structured alert data or null
 */
function parseAlertMessage(message) {
  if (!message) return null;

  // Try to parse English format
  const match = message.match(/^([🚨⚠️📢][^\s]+)\s+([A-Za-z]+)\s+Emergency:\s+([^"]+?)\s+reported\s+"([^"]+)"\.\s+Original message:\s+"(.+)"/);
  if (match) {
    return {
      urgency: match[1],
      category: match[2],
      clientName: match[3].trim(),
        patientName: match[3].trim(), // legacy alias
      phrase: match[4],
      originalText: match[5],
      severity: match[1].includes('CRITICAL') ? 'CRITICAL' : 
                match[1].includes('HIGH') ? 'HIGH' : 'MEDIUM'
    };
  }

  return null;
}

module.exports = {
  translateAlertMessage,
  parseAlertMessage,
  translations
};

