const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

// Hindi phrases
const hindiPhrases = [
  { phrase: 'दिल का दौरा', pattern: 'दिल का दौरा', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'मायोकार्डियल इन्फार्क्शन', pattern: 'मायोकार्डियल इन्फार्क्शन', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'सांस नहीं आ रही', pattern: 'सांस नहीं आ रही', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'दम घुट रहा है', pattern: 'दम घुट रहा है', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'स्ट्रोक', pattern: 'स्ट्रोक', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'चेहरे का लकवा', pattern: 'चेहरे का लकवा', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'दौरा', pattern: 'दौरा', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'एनाफिलैक्सिस', pattern: 'एनाफिलैक्सिस', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'ओवरडोज', pattern: 'ओवरडोज', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'जहर', pattern: 'जहर', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'बेहोशी', pattern: 'बेहोशी', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'भारी खून बह रहा है', pattern: 'भारी खून बह रहा है', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'रक्तस्राव', pattern: 'रक्तस्राव', severity: 'CRITICAL', category: 'Medical', language: 'hi' },
  { phrase: 'आत्महत्या', pattern: 'आत्महत्या', severity: 'CRITICAL', category: 'Safety', language: 'hi' },
  { phrase: 'आत्मघात', pattern: 'आत्मघात', severity: 'CRITICAL', category: 'Safety', language: 'hi' },
  { phrase: 'गिर गया', pattern: 'गिर गया', severity: 'HIGH', category: 'Physical', language: 'hi' },
  { phrase: 'उठ नहीं सकता', pattern: 'उठ नहीं सकता', severity: 'HIGH', category: 'Physical', language: 'hi' },
  { phrase: 'सिर में चोट', pattern: 'सिर में चोट', severity: 'HIGH', category: 'Physical', language: 'hi' },
  { phrase: 'हड्डी टूटी', pattern: 'हड्डी टूटी', severity: 'HIGH', category: 'Physical', language: 'hi' },
  { phrase: 'तीव्र दर्द', pattern: 'तीव्र दर्द', severity: 'HIGH', category: 'Medical', language: 'hi' },
  { phrase: 'आपातकालीन दर्द', pattern: 'आपातकालीन दर्द', severity: 'HIGH', category: 'Medical', language: 'hi' },
  { phrase: 'छाती में दर्द', pattern: 'छाती में दर्द', severity: 'HIGH', category: 'Medical', language: 'hi' },
  { phrase: 'छाती में दबाव', pattern: 'छाती में दबाव', severity: 'HIGH', category: 'Medical', language: 'hi' },
  { phrase: 'घुसपैठिया', pattern: 'घुसपैठिया', severity: 'HIGH', category: 'Safety', language: 'hi' },
  { phrase: 'घर में घुसपैठिया', pattern: 'घर में घुसपैठिया', severity: 'HIGH', category: 'Safety', language: 'hi' },
  { phrase: 'बीमार महसूस कर रहा हूं', pattern: 'बीमार महसूस कर रहा हूं', severity: 'MEDIUM', category: 'Medical', language: 'hi' },
  { phrase: 'चक्कर आ रहा है', pattern: 'चक्कर आ रहा है', severity: 'MEDIUM', category: 'Medical', language: 'hi' },
  { phrase: 'उल्टी आ रही है', pattern: 'उल्टी आ रही है', severity: 'MEDIUM', category: 'Medical', language: 'hi' },
  { phrase: 'सांस लेने में तकलीफ', pattern: 'सांस लेने में तकलीफ', severity: 'MEDIUM', category: 'Medical', language: 'hi' },
  { phrase: 'गंभीर एलर्जी', pattern: 'गंभीर एलर्जी', severity: 'MEDIUM', category: 'Medical', language: 'hi' },
  { phrase: 'मदद चाहिए', pattern: 'मदद चाहिए', severity: 'MEDIUM', category: 'Request', language: 'hi' },
  { phrase: 'एम्बुलेंस बुलाओ', pattern: 'एम्बुलेंस बुलाओ', severity: 'MEDIUM', category: 'Request', language: 'hi' },
  { phrase: 'आपातकालीन सेवाएं', pattern: 'आपातकालीन सेवाएं', severity: 'MEDIUM', category: 'Request', language: 'hi' },
  { phrase: 'चिकित्सा आपातकाल', pattern: 'चिकित्सा आपातकाल', severity: 'HIGH', category: 'Medical', language: 'hi' },
  { phrase: 'जीवन के लिए खतरा', pattern: 'जीवन के लिए खतरा', severity: 'CRITICAL', category: 'Medical', language: 'hi' }
];

// Chinese (Mandarin) phrases
const chinesePhrases = [
  { phrase: '心脏病发作', pattern: '心脏病发作', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '心肌梗死', pattern: '心肌梗死', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '无法呼吸', pattern: '无法呼吸', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '窒息', pattern: '窒息', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '中风', pattern: '中风', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '面瘫', pattern: '面瘫', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '癫痫发作', pattern: '癫痫发作', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '过敏性休克', pattern: '过敏性休克', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '药物过量', pattern: '药物过量', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '中毒', pattern: '中毒', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '失去意识', pattern: '失去意识', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '大出血', pattern: '大出血', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '出血', pattern: '出血', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' },
  { phrase: '自杀', pattern: '自杀', severity: 'CRITICAL', category: 'Safety', language: 'zh-cn' },
  { phrase: '自残', pattern: '自残', severity: 'CRITICAL', category: 'Safety', language: 'zh-cn' },
  { phrase: '摔倒了', pattern: '摔倒了', severity: 'HIGH', category: 'Physical', language: 'zh-cn' },
  { phrase: '站不起来', pattern: '站不起来', severity: 'HIGH', category: 'Physical', language: 'zh-cn' },
  { phrase: '撞到头了', pattern: '撞到头了', severity: 'HIGH', category: 'Physical', language: 'zh-cn' },
  { phrase: '骨折', pattern: '骨折', severity: 'HIGH', category: 'Physical', language: 'zh-cn' },
  { phrase: '剧烈疼痛', pattern: '剧烈疼痛', severity: 'HIGH', category: 'Medical', language: 'zh-cn' },
  { phrase: '紧急疼痛', pattern: '紧急疼痛', severity: 'HIGH', category: 'Medical', language: 'zh-cn' },
  { phrase: '胸痛', pattern: '胸痛', severity: 'HIGH', category: 'Medical', language: 'zh-cn' },
  { phrase: '胸闷', pattern: '胸闷', severity: 'HIGH', category: 'Medical', language: 'zh-cn' },
  { phrase: '入侵者', pattern: '入侵者', severity: 'HIGH', category: 'Safety', language: 'zh-cn' },
  { phrase: '家里有入侵者', pattern: '家里有入侵者', severity: 'HIGH', category: 'Safety', language: 'zh-cn' },
  { phrase: '感觉不舒服', pattern: '感觉不舒服', severity: 'MEDIUM', category: 'Medical', language: 'zh-cn' },
  { phrase: '头晕', pattern: '头晕', severity: 'MEDIUM', category: 'Medical', language: 'zh-cn' },
  { phrase: '恶心', pattern: '恶心', severity: 'MEDIUM', category: 'Medical', language: 'zh-cn' },
  { phrase: '呼吸困难', pattern: '呼吸困难', severity: 'MEDIUM', category: 'Medical', language: 'zh-cn' },
  { phrase: '严重过敏反应', pattern: '严重过敏反应', severity: 'MEDIUM', category: 'Medical', language: 'zh-cn' },
  { phrase: '需要帮助', pattern: '需要帮助', severity: 'MEDIUM', category: 'Request', language: 'zh-cn' },
  { phrase: '叫救护车', pattern: '叫救护车', severity: 'MEDIUM', category: 'Request', language: 'zh-cn' },
  { phrase: '紧急服务', pattern: '紧急服务', severity: 'MEDIUM', category: 'Request', language: 'zh-cn' },
  { phrase: '医疗紧急情况', pattern: '医疗紧急情况', severity: 'HIGH', category: 'Medical', language: 'zh-cn' },
  { phrase: '生命威胁', pattern: '生命威胁', severity: 'CRITICAL', category: 'Medical', language: 'zh-cn' }
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

// Add Hindi phrases
addLanguagePhrases(hindiPhrases, 'hi').then(() => {
  // Add Chinese phrases
  return addLanguagePhrases(chinesePhrases, 'zh-cn');
}).catch(error => {
  logger.error('Error in script:', error);
  process.exit(1);
});
