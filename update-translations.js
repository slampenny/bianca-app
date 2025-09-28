#!/usr/bin/env node

/**
 * Translation Update Script
 * 
 * This script updates all language files to include missing translations from en.ts
 * It preserves existing translations and only adds missing keys with placeholder values
 */

const fs = require('fs');
const path = require('path');

// Language mappings with their native names and common translations
const languages = {
  'ar': { name: 'Arabic', native: 'العربية' },
  'de': { name: 'German', native: 'Deutsch' },
  'es': { name: 'Spanish', native: 'Español' },
  'fr': { name: 'French', native: 'Français' },
  'it': { name: 'Italian', native: 'Italiano' },
  'ja': { name: 'Japanese', native: '日本語' },
  'ko': { name: 'Korean', native: '한국어' },
  'pt': { name: 'Portuguese', native: 'Português' },
  'ru': { name: 'Russian', native: 'Русский' },
  'zh': { name: 'Chinese', native: '中文' }
};

// Common translations for frequently used terms
const commonTranslations = {
  // Basic actions
  'cancel': {
    'ar': 'إلغاء', 'de': 'Abbrechen', 'es': 'Cancelar', 'fr': 'Annuler', 'it': 'Annulla',
    'ja': 'キャンセル', 'ko': '취소', 'pt': 'Cancelar', 'ru': 'Отмена', 'zh': '取消'
  },
  'save': {
    'ar': 'حفظ', 'de': 'Speichern', 'es': 'Guardar', 'fr': 'Enregistrer', 'it': 'Salva',
    'ja': '保存', 'ko': '저장', 'pt': 'Salvar', 'ru': 'Сохранить', 'zh': '保存'
  },
  'loading': {
    'ar': 'جارٍ التحميل...', 'de': 'Lädt...', 'es': 'Cargando...', 'fr': 'Chargement...', 'it': 'Caricamento...',
    'ja': '読み込み中...', 'ko': '로딩 중...', 'pt': 'Carregando...', 'ru': 'Загрузка...', 'zh': '加载中...'
  },
  'error': {
    'ar': 'خطأ', 'de': 'Fehler', 'es': 'Error', 'fr': 'Erreur', 'it': 'Errore',
    'ja': 'エラー', 'ko': '오류', 'pt': 'Erro', 'ru': 'Ошибка', 'zh': '错误'
  },
  'success': {
    'ar': 'نجح', 'de': 'Erfolg', 'es': 'Éxito', 'fr': 'Succès', 'it': 'Successo',
    'ja': '成功', 'ko': '성공', 'pt': 'Sucesso', 'ru': 'Успех', 'zh': '成功'
  },
  // Navigation
  'home': {
    'ar': 'الرئيسية', 'de': 'Start', 'es': 'Inicio', 'fr': 'Accueil', 'it': 'Home',
    'ja': 'ホーム', 'ko': '홈', 'pt': 'Início', 'ru': 'Главная', 'zh': '首页'
  },
  'profile': {
    'ar': 'الملف الشخصي', 'de': 'Profil', 'es': 'Perfil', 'fr': 'Profil', 'it': 'Profilo',
    'ja': 'プロフィール', 'ko': '프로필', 'pt': 'Perfil', 'ru': 'Профиль', 'zh': '个人资料'
  },
  'alerts': {
    'ar': 'التنبيهات', 'de': 'Benachrichtigungen', 'es': 'Alertas', 'fr': 'Alertes', 'it': 'Avvisi',
    'ja': 'アラート', 'ko': '알림', 'pt': 'Alertas', 'ru': 'Уведомления', 'zh': '提醒'
  },
  // Medical terms
  'patient': {
    'ar': 'مريض', 'de': 'Patient', 'es': 'Paciente', 'fr': 'Patient', 'it': 'Paziente',
    'ja': '患者', 'ko': '환자', 'pt': 'Paciente', 'ru': 'Пациент', 'zh': '患者'
  },
  'caregiver': {
    'ar': 'مقدم الرعاية', 'de': 'Pflegeperson', 'es': 'Cuidador', 'fr': 'Aidant', 'it': 'Badante',
    'ja': '介護者', 'ko': '간병인', 'pt': 'Cuidador', 'ru': 'Опекун', 'zh': '护理员'
  },
  // Time
  'daily': {
    'ar': 'يومي', 'de': 'Täglich', 'es': 'Diario', 'fr': 'Quotidien', 'it': 'Giornaliero',
    'ja': '毎日', 'ko': '매일', 'pt': 'Diário', 'ru': 'Ежедневно', 'zh': '每日'
  },
  'weekly': {
    'ar': 'أسبوعي', 'de': 'Wöchentlich', 'es': 'Semanal', 'fr': 'Hebdomadaire', 'it': 'Settimanale',
    'ja': '毎週', 'ko': '주간', 'pt': 'Semanal', 'ru': 'Еженедельно', 'zh': '每周'
  },
  'monthly': {
    'ar': 'شهري', 'de': 'Monatlich', 'es': 'Mensual', 'fr': 'Mensuel', 'it': 'Mensile',
    'ja': '毎月', 'ko': '월간', 'pt': 'Mensal', 'ru': 'Ежемесячно', 'zh': '每月'
  }
};

// Function to get translation for a key
function getTranslation(key, lang) {
  if (commonTranslations[key] && commonTranslations[key][lang]) {
    return commonTranslations[key][lang];
  }
  
  // Fallback: return key with language prefix for manual translation
  return `[${lang.toUpperCase()}] ${key}`;
}

// Function to recursively merge objects
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else if (!(key in result)) {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Function to get all keys from an object recursively
function getAllKeys(obj, prefix = '') {
  let keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// Function to set a nested value in an object
function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

// Function to get a nested value from an object
function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

// Main function to update a language file
function updateLanguageFile(langCode) {
  const i18nDir = path.join(__dirname, 'app', 'i18n');
  const enFile = path.join(i18nDir, 'en.ts');
  const langFile = path.join(i18nDir, `${langCode}.ts`);
  
  try {
    // Read English file
    const enContent = fs.readFileSync(enFile, 'utf8');
    
    // Import the English translations directly
    const enModule = require('./app/i18n/en.ts');
    const enTranslations = enModule.default;
    const enKeys = getAllKeys(enTranslations);
    
    // Read existing language file if it exists
    let existingTranslations = {};
    if (fs.existsSync(langFile)) {
      const langContent = fs.readFileSync(langFile, 'utf8');
      const langMatch = langContent.match(/const \w+ = ({[\s\S]*});/);
      if (langMatch) {
        existingTranslations = eval(`(${langMatch[1]})`);
      }
    }
    
    // Create updated translations
    const updatedTranslations = { ...existingTranslations };
    let addedCount = 0;
    
    // Add missing keys
    for (const key of enKeys) {
      const existingValue = getNestedValue(existingTranslations, key);
      if (!existingValue) {
        const enValue = getNestedValue(enTranslations, key);
        const translatedValue = getTranslation(key.split('.').pop(), langCode);
        setNestedValue(updatedTranslations, key, translatedValue);
        addedCount++;
      }
    }
    
    // Generate new file content
    const langName = languages[langCode]?.name || langCode;
    const nativeName = languages[langCode]?.native || langCode;
    
    let fileContent = `import { Translations } from "./en"\n\n`;
    fileContent += `const ${langCode}: Translations = ${JSON.stringify(updatedTranslations, null, 2)};\n\n`;
    fileContent += `export default ${langCode}\n`;
    
    // Write updated file
    fs.writeFileSync(langFile, fileContent, 'utf8');
    
    console.log(`✅ Updated ${langName} (${nativeName}): Added ${addedCount} missing translations`);
    
  } catch (error) {
    console.error(`❌ Error updating ${langCode}:`, error.message);
  }
}

// Main execution
console.log('🚀 Starting translation update process...\n');

// Update all language files
for (const langCode of Object.keys(languages)) {
  updateLanguageFile(langCode);
}

console.log('\n🎉 Translation update complete!');
console.log('\n📝 Next steps:');
console.log('1. Review the updated files for any [LANG] placeholders');
console.log('2. Replace placeholders with proper translations');
console.log('3. Test the application with different languages');
console.log('4. Consider using professional translation services for production');
