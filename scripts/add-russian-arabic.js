const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

// Russian phrases
const russianPhrases = [
  { phrase: 'сердечный приступ', pattern: 'сердечный приступ', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'инфаркт миокарда', pattern: 'инфаркт миокарда', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'не могу дышать', pattern: 'не могу дышать', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'задыхаюсь', pattern: 'задыхаюсь', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'инсульт', pattern: 'инсульт', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'паралич лица', pattern: 'паралич лица', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'судороги', pattern: 'судороги', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'анафилаксия', pattern: 'анафилаксия', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'передозировка', pattern: 'передозировка', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'отравление', pattern: 'отравление', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'потеря сознания', pattern: 'потеря сознания', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'сильное кровотечение', pattern: 'сильное кровотечение', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'кровотечение', pattern: 'кровотечение', severity: 'CRITICAL', category: 'Medical', language: 'ru' },
  { phrase: 'самоубийство', pattern: 'самоубийство', severity: 'CRITICAL', category: 'Safety', language: 'ru' },
  { phrase: 'самоповреждение', pattern: 'самоповреждение', severity: 'CRITICAL', category: 'Safety', language: 'ru' },
  { phrase: 'я упал', pattern: 'я упал|я упала', severity: 'HIGH', category: 'Physical', language: 'ru' },
  { phrase: 'не могу встать', pattern: 'не могу встать', severity: 'HIGH', category: 'Physical', language: 'ru' },
  { phrase: 'ударился головой', pattern: 'ударился головой', severity: 'HIGH', category: 'Physical', language: 'ru' },
  { phrase: 'сломанная кость', pattern: 'сломанная кость', severity: 'HIGH', category: 'Physical', language: 'ru' },
  { phrase: 'сильная боль', pattern: 'сильная боль', severity: 'HIGH', category: 'Medical', language: 'ru' },
  { phrase: 'экстренная боль', pattern: 'экстренная боль', severity: 'HIGH', category: 'Medical', language: 'ru' },
  { phrase: 'боль в груди', pattern: 'боль в груди', severity: 'HIGH', category: 'Medical', language: 'ru' },
  { phrase: 'давление в груди', pattern: 'давление в груди', severity: 'HIGH', category: 'Medical', language: 'ru' },
  { phrase: 'злоумышленник', pattern: 'злоумышленник', severity: 'HIGH', category: 'Safety', language: 'ru' },
  { phrase: 'злоумышленник в доме', pattern: 'злоумышленник в доме', severity: 'HIGH', category: 'Safety', language: 'ru' },
  { phrase: 'плохо себя чувствую', pattern: 'плохо себя чувствую', severity: 'MEDIUM', category: 'Medical', language: 'ru' },
  { phrase: 'головокружение', pattern: 'головокружение', severity: 'MEDIUM', category: 'Medical', language: 'ru' },
  { phrase: 'тошнота', pattern: 'тошнота', severity: 'MEDIUM', category: 'Medical', language: 'ru' },
  { phrase: 'затрудненное дыхание', pattern: 'затрудненное дыхание', severity: 'MEDIUM', category: 'Medical', language: 'ru' },
  { phrase: 'тяжелая аллергическая реакция', pattern: 'тяжелая аллергическая реакция', severity: 'MEDIUM', category: 'Medical', language: 'ru' },
  { phrase: 'мне нужна помощь', pattern: 'мне нужна помощь', severity: 'MEDIUM', category: 'Request', language: 'ru' },
  { phrase: 'вызвать скорую', pattern: 'вызвать скорую', severity: 'MEDIUM', category: 'Request', language: 'ru' },
  { phrase: 'экстренные службы', pattern: 'экстренные службы', severity: 'MEDIUM', category: 'Request', language: 'ru' },
  { phrase: 'медицинская чрезвычайная ситуация', pattern: 'медицинская чрезвычайная ситуация', severity: 'HIGH', category: 'Medical', language: 'ru' },
  { phrase: 'угроза жизни', pattern: 'угроза жизни', severity: 'CRITICAL', category: 'Medical', language: 'ru' }
];

// Arabic phrases
const arabicPhrases = [
  { phrase: 'نوبة قلبية', pattern: 'نوبة قلبية', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'احتشاء عضلة القلب', pattern: 'احتشاء عضلة القلب', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'لا أستطيع التنفس', pattern: 'لا أستطيع التنفس', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'أختنق', pattern: 'أختنق', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'سكتة دماغية', pattern: 'سكتة دماغية', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'شلل في الوجه', pattern: 'شلل في الوجه', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'نوبة صرع', pattern: 'نوبة صرع', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'الحساسية المفرطة', pattern: 'الحساسية المفرطة', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'جرعة زائدة', pattern: 'جرعة زائدة', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'تسمم', pattern: 'تسمم', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'فقدان الوعي', pattern: 'فقدان الوعي', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'نزيف شديد', pattern: 'نزيف شديد', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'نزيف', pattern: 'نزيف', severity: 'CRITICAL', category: 'Medical', language: 'ar' },
  { phrase: 'انتحار', pattern: 'انتحار', severity: 'CRITICAL', category: 'Safety', language: 'ar' },
  { phrase: 'إيذاء النفس', pattern: 'إيذاء النفس', severity: 'CRITICAL', category: 'Safety', language: 'ar' },
  { phrase: 'لقد سقطت', pattern: 'لقد سقطت', severity: 'HIGH', category: 'Physical', language: 'ar' },
  { phrase: 'لا أستطيع النهوض', pattern: 'لا أستطيع النهوض', severity: 'HIGH', category: 'Physical', language: 'ar' },
  { phrase: 'ضربت رأسي', pattern: 'ضربت رأسي', severity: 'HIGH', category: 'Physical', language: 'ar' },
  { phrase: 'عظم مكسور', pattern: 'عظم مكسور', severity: 'HIGH', category: 'Physical', language: 'ar' },
  { phrase: 'ألم شديد', pattern: 'ألم شديد', severity: 'HIGH', category: 'Medical', language: 'ar' },
  { phrase: 'ألم طارئ', pattern: 'ألم طارئ', severity: 'HIGH', category: 'Medical', language: 'ar' },
  { phrase: 'ألم في الصدر', pattern: 'ألم في الصدر', severity: 'HIGH', category: 'Medical', language: 'ar' },
  { phrase: 'ضغط في الصدر', pattern: 'ضغط في الصدر', severity: 'HIGH', category: 'Medical', language: 'ar' },
  { phrase: 'متسلل', pattern: 'متسلل', severity: 'HIGH', category: 'Safety', language: 'ar' },
  { phrase: 'متسلل في المنزل', pattern: 'متسلل في المنزل', severity: 'HIGH', category: 'Safety', language: 'ar' },
  { phrase: 'أشعر بالمرض', pattern: 'أشعر بالمرض', severity: 'MEDIUM', category: 'Medical', language: 'ar' },
  { phrase: 'دوار', pattern: 'دوار', severity: 'MEDIUM', category: 'Medical', language: 'ar' },
  { phrase: 'غثيان', pattern: 'غثيان', severity: 'MEDIUM', category: 'Medical', language: 'ar' },
  { phrase: 'صعوبة في التنفس', pattern: 'صعوبة في التنفس', severity: 'MEDIUM', category: 'Medical', language: 'ar' },
  { phrase: 'رد فعل تحسسي شديد', pattern: 'رد فعل تحسسي شديد', severity: 'MEDIUM', category: 'Medical', language: 'ar' },
  { phrase: 'أحتاج مساعدة', pattern: 'أحتاج مساعدة', severity: 'MEDIUM', category: 'Request', language: 'ar' },
  { phrase: 'استدعاء سيارة إسعاف', pattern: 'استدعاء سيارة إسعاف', severity: 'MEDIUM', category: 'Request', language: 'ar' },
  { phrase: 'خدمات الطوارئ', pattern: 'خدمات الطوارئ', severity: 'MEDIUM', category: 'Request', language: 'ar' },
  { phrase: 'طوارئ طبية', pattern: 'طوارئ طبية', severity: 'HIGH', category: 'Medical', language: 'ar' },
  { phrase: 'تهديد للحياة', pattern: 'تهديد للحياة', severity: 'CRITICAL', category: 'Medical', language: 'ar' }
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

// Add Russian phrases
addLanguagePhrases(russianPhrases, 'ru').then(() => {
  // Add Arabic phrases
  return addLanguagePhrases(arabicPhrases, 'ar');
}).catch(error => {
  logger.error('Error in script:', error);
  process.exit(1);
});
