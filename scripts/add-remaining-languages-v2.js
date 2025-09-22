const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

// Chinese (zh) phrases
const chinesePhrases = [
  { phrase: '心脏病发作', pattern: '心脏病发作', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '心肌梗死', pattern: '心肌梗死', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '无法呼吸', pattern: '无法呼吸', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '窒息', pattern: '窒息', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '中风', pattern: '中风', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '面瘫', pattern: '面瘫', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '癫痫发作', pattern: '癫痫发作', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '过敏性休克', pattern: '过敏性休克', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '药物过量', pattern: '药物过量', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '中毒', pattern: '中毒', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '失去意识', pattern: '失去意识', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '大出血', pattern: '大出血', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '出血', pattern: '出血', severity: 'CRITICAL', category: 'Medical', language: 'zh' },
  { phrase: '自杀', pattern: '自杀', severity: 'CRITICAL', category: 'Safety', language: 'zh' },
  { phrase: '自残', pattern: '自残', severity: 'CRITICAL', category: 'Safety', language: 'zh' },
  { phrase: '摔倒了', pattern: '摔倒了', severity: 'HIGH', category: 'Physical', language: 'zh' },
  { phrase: '站不起来', pattern: '站不起来', severity: 'HIGH', category: 'Physical', language: 'zh' },
  { phrase: '撞到头了', pattern: '撞到头了', severity: 'HIGH', category: 'Physical', language: 'zh' },
  { phrase: '骨折', pattern: '骨折', severity: 'HIGH', category: 'Physical', language: 'zh' },
  { phrase: '剧烈疼痛', pattern: '剧烈疼痛', severity: 'HIGH', category: 'Medical', language: 'zh' },
  { phrase: '紧急疼痛', pattern: '紧急疼痛', severity: 'HIGH', category: 'Medical', language: 'zh' },
  { phrase: '胸痛', pattern: '胸痛', severity: 'HIGH', category: 'Medical', language: 'zh' },
  { phrase: '胸闷', pattern: '胸闷', severity: 'HIGH', category: 'Medical', language: 'zh' },
  { phrase: '入侵者', pattern: '入侵者', severity: 'HIGH', category: 'Safety', language: 'zh' },
  { phrase: '家里有入侵者', pattern: '家里有入侵者', severity: 'HIGH', category: 'Safety', language: 'zh' },
  { phrase: '感觉不舒服', pattern: '感觉不舒服', severity: 'MEDIUM', category: 'Medical', language: 'zh' },
  { phrase: '头晕', pattern: '头晕', severity: 'MEDIUM', category: 'Medical', language: 'zh' },
  { phrase: '恶心', pattern: '恶心', severity: 'MEDIUM', category: 'Medical', language: 'zh' },
  { phrase: '呼吸困难', pattern: '呼吸困难', severity: 'MEDIUM', category: 'Medical', language: 'zh' },
  { phrase: '严重过敏反应', pattern: '严重过敏反应', severity: 'MEDIUM', category: 'Medical', language: 'zh' },
  { phrase: '需要帮助', pattern: '需要帮助', severity: 'MEDIUM', category: 'Request', language: 'zh' },
  { phrase: '叫救护车', pattern: '叫救护车', severity: 'MEDIUM', category: 'Request', language: 'zh' },
  { phrase: '紧急服务', pattern: '紧急服务', severity: 'MEDIUM', category: 'Request', language: 'zh' },
  { phrase: '医疗紧急情况', pattern: '医疗紧急情况', severity: 'HIGH', category: 'Medical', language: 'zh' },
  { phrase: '生命威胁', pattern: '生命威胁', severity: 'CRITICAL', category: 'Medical', language: 'zh' }
];

// Japanese phrases
const japanesePhrases = [
  { phrase: '心臓発作', pattern: '心臓発作', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '心筋梗塞', pattern: '心筋梗塞', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '息ができない', pattern: '息ができない', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '窒息', pattern: '窒息', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '脳卒中', pattern: '脳卒中', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '顔面麻痺', pattern: '顔面麻痺', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: 'てんかん発作', pattern: 'てんかん発作', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: 'アナフィラキシー', pattern: 'アナフィラキシー', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '過量服用', pattern: '過量服用', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '中毒', pattern: '中毒', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '意識喪失', pattern: '意識喪失', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '大量出血', pattern: '大量出血', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '出血', pattern: '出血', severity: 'CRITICAL', category: 'Medical', language: 'ja' },
  { phrase: '自殺', pattern: '自殺', severity: 'CRITICAL', category: 'Safety', language: 'ja' },
  { phrase: '自傷', pattern: '自傷', severity: 'CRITICAL', category: 'Safety', language: 'ja' },
  { phrase: '転倒しました', pattern: '転倒しました', severity: 'HIGH', category: 'Physical', language: 'ja' },
  { phrase: '起き上がれません', pattern: '起き上がれません', severity: 'HIGH', category: 'Physical', language: 'ja' },
  { phrase: '頭を打ちました', pattern: '頭を打ちました', severity: 'HIGH', category: 'Physical', language: 'ja' },
  { phrase: '骨折', pattern: '骨折', severity: 'HIGH', category: 'Physical', language: 'ja' },
  { phrase: '激しい痛み', pattern: '激しい痛み', severity: 'HIGH', category: 'Medical', language: 'ja' },
  { phrase: '緊急の痛み', pattern: '緊急の痛み', severity: 'HIGH', category: 'Medical', language: 'ja' },
  { phrase: '胸の痛み', pattern: '胸の痛み', severity: 'HIGH', category: 'Medical', language: 'ja' },
  { phrase: '胸の圧迫感', pattern: '胸の圧迫感', severity: 'HIGH', category: 'Medical', language: 'ja' },
  { phrase: '侵入者', pattern: '侵入者', severity: 'HIGH', category: 'Safety', language: 'ja' },
  { phrase: '家に侵入者', pattern: '家に侵入者', severity: 'HIGH', category: 'Safety', language: 'ja' },
  { phrase: '気分が悪い', pattern: '気分が悪い', severity: 'MEDIUM', category: 'Medical', language: 'ja' },
  { phrase: 'めまい', pattern: 'めまい', severity: 'MEDIUM', category: 'Medical', language: 'ja' },
  { phrase: '吐き気', pattern: '吐き気', severity: 'MEDIUM', category: 'Medical', language: 'ja' },
  { phrase: '呼吸困難', pattern: '呼吸困難', severity: 'MEDIUM', category: 'Medical', language: 'ja' },
  { phrase: '重度のアレルギー反応', pattern: '重度のアレルギー反応', severity: 'MEDIUM', category: 'Medical', language: 'ja' },
  { phrase: '助けが必要です', pattern: '助けが必要です', severity: 'MEDIUM', category: 'Request', language: 'ja' },
  { phrase: '救急車を呼んで', pattern: '救急車を呼んで', severity: 'MEDIUM', category: 'Request', language: 'ja' },
  { phrase: '緊急サービス', pattern: '緊急サービス', severity: 'MEDIUM', category: 'Request', language: 'ja' },
  { phrase: '医療緊急事態', pattern: '医療緊急事態', severity: 'HIGH', category: 'Medical', language: 'ja' },
  { phrase: '生命の危険', pattern: '生命の危険', severity: 'CRITICAL', category: 'Medical', language: 'ja' }
];

const addLanguagePhrases = async (phrases, language) => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  logger.info(`Connected to MongoDB - Adding ${language} phrases`);

  try {
    // Create a system user ID for default phrases
    const systemUserId = '000000000000000000000000';

    const phrasesToCreate = phrases.map(phrase => ({
      ...phrase,
      createdBy: systemUserId,
      lastModifiedBy: systemUserId,
      isActive: true,
      description: `Default ${phrase.severity} ${phrase.category} phrase in ${phrase.language}`
    }));

    // Check which phrases already exist
    const existingPhrases = await EmergencyPhrase.find({ language }).select('phrase');
    const existingPhraseTexts = existingPhrases.map(p => p.phrase);
    
    const newPhrases = phrasesToCreate.filter(phrase => !existingPhraseTexts.includes(phrase.phrase));
    
    if (newPhrases.length > 0) {
      await EmergencyPhrase.insertMany(newPhrases);
      logger.info(`Added ${newPhrases.length} ${language} emergency phrases`);
    } else {
      logger.info(`All ${language} phrases already exist`);
    }
    
    // Log summary
    const totalInLanguage = await EmergencyPhrase.countDocuments({ language });
    logger.info(`Total ${language} phrases in database: ${totalInLanguage}`);
    
  } catch (error) {
    logger.error(`Error adding ${language} phrases:`, error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info(`Disconnected from MongoDB - ${language} complete`);
  }
};

// Add Chinese phrases
addLanguagePhrases(chinesePhrases, 'zh').then(() => {
  // Add Japanese phrases
  return addLanguagePhrases(japanesePhrases, 'ja');
}).catch(error => {
  logger.error('Error in script:', error);
  process.exit(1);
});
