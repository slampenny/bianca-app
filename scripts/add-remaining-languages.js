const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

// German phrases
const germanPhrases = [
  { phrase: 'Herzinfarkt', pattern: '\\b(herzinfarkt|infarkt)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Myokardinfarkt', pattern: '\\b(myokardinfarkt|mi)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'ich kann nicht atmen', pattern: '\\b(ich\\s+kann\\s+nicht\\s+atmen|ich\\s+atme\\s+nicht)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'ersticken', pattern: '\\b(ersticken|ersticke)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Schlaganfall', pattern: '\\b(schlaganfall|schlaganfall\\s+symptome)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Gesichtslähmung', pattern: '\\b(gesichtslähmung|hängendes\\s+gesicht)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Krampfanfall', pattern: '\\b(krampfanfall|krampfanfälle|ich\\s+habe\\s+einen\\s+krampfanfall)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Anaphylaxie', pattern: '\\b(anaphylaxie|anaphylaktischer\\s+schock)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Überdosis', pattern: '\\b(überdosis|überdosiert|drogenüberdosis)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Vergiftung', pattern: '\\b(vergiftet|vergiftung|gift\\s+verschluckt)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Bewusstlosigkeit', pattern: '\\b(ohnmächtig|bewusstlos|bewusstsein\\s+verloren)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'starke Blutung', pattern: '\\b(starke\\s+blutung|schwere\\s+blutung|blute\\s+stark)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Blutung', pattern: '\\b(blutung|blutungen)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' },
  { phrase: 'Selbstmord', pattern: '\\b(selbstmord|mich\\s+umbringen|sterben\\s+wollen)\\b', severity: 'CRITICAL', category: 'Safety', language: 'de' },
  { phrase: 'Selbstverletzung', pattern: '\\b(selbstverletzung|mich\\s+schneiden|mich\\s+verletzen)\\b', severity: 'CRITICAL', category: 'Safety', language: 'de' },
  { phrase: 'ich bin hingefallen', pattern: '\\b(ich\\s+bin\\s+hingefallen|ich\\s+bin\\s+gestolpert|ich\\s+bin\\s+ausgerutscht)\\b', severity: 'HIGH', category: 'Physical', language: 'de' },
  { phrase: 'ich kann nicht aufstehen', pattern: '\\b(ich\\s+kann\\s+nicht\\s+aufstehen|unfähig\\s+aufzustehen)\\b', severity: 'HIGH', category: 'Physical', language: 'de' },
  { phrase: 'ich habe mir den Kopf gestoßen', pattern: '\\b(ich\\s+habe\\s+mir\\s+den\\s+kopf\\s+gestoßen|kopfverletzung)\\b', severity: 'HIGH', category: 'Physical', language: 'de' },
  { phrase: 'gebrochener Knochen', pattern: '\\b(gebrochener\\s+knochen|fraktur|gebrochener\\s+arm|gebrochenes\\s+bein)\\b', severity: 'HIGH', category: 'Physical', language: 'de' },
  { phrase: 'starke Schmerzen', pattern: '\\b(starke\\s+schmerzen|unerträgliche\\s+schmerzen)\\b', severity: 'HIGH', category: 'Medical', language: 'de' },
  { phrase: 'Notfallschmerzen', pattern: '\\b(notfallschmerzen|dringende\\s+schmerzen)\\b', severity: 'HIGH', category: 'Medical', language: 'de' },
  { phrase: 'Brustschmerzen', pattern: '\\b(brustschmerzen|brustschmerz|brustdruck)\\b', severity: 'HIGH', category: 'Medical', language: 'de' },
  { phrase: 'Brustdruck', pattern: '\\b(druck\\s+in\\s+der\\s+brust|enge\\s+in\\s+der\\s+brust)\\b', severity: 'HIGH', category: 'Medical', language: 'de' },
  { phrase: 'Eindringling', pattern: '\\b(eindringling|einbrecher|einbruch)\\b', severity: 'HIGH', category: 'Safety', language: 'de' },
  { phrase: 'Eindringling im Haus', pattern: '\\b(jemand\\s+in\\s+meinem\\s+haus|fremder\\s+im\\s+haus)\\b', severity: 'HIGH', category: 'Safety', language: 'de' },
  { phrase: 'ich fühle mich krank', pattern: '\\b(ich\\s+fühle\\s+mich\\s+krank|ich\\s+fühle\\s+mich\\s+nicht\\s+wohl)\\b', severity: 'MEDIUM', category: 'Medical', language: 'de' },
  { phrase: 'schwindelig', pattern: '\\b(schwindelig|schwindel|vertigo)\\b', severity: 'MEDIUM', category: 'Medical', language: 'de' },
  { phrase: 'Übelkeit', pattern: '\\b(übelkeit|erbrechen|sich\\s+übergeben)\\b', severity: 'MEDIUM', category: 'Medical', language: 'de' },
  { phrase: 'Atembeschwerden', pattern: '\\b(atembeschwerden|probleme\\s+beim\\s+atmen|kurzatmigkeit)\\b', severity: 'MEDIUM', category: 'Medical', language: 'de' },
  { phrase: 'schwere allergische Reaktion', pattern: '\\b(schwere\\s+allergische\\s+reaktion)\\b', severity: 'MEDIUM', category: 'Medical', language: 'de' },
  { phrase: 'ich brauche hilfe', pattern: '\\b(ich\\s+brauche\\s+hilfe|hilf\\s+mir)\\b', severity: 'MEDIUM', category: 'Request', language: 'de' },
  { phrase: 'Rettungswagen rufen', pattern: '\\b(rettungswagen\\s+rufen|ich\\s+brauche\\s+jetzt\\s+hilfe|das\\s+ist\\s+dringend)\\b', severity: 'MEDIUM', category: 'Request', language: 'de' },
  { phrase: 'Notruf', pattern: '\\b(notruf|notfall\\s+rufen|notdienste)\\b', severity: 'MEDIUM', category: 'Request', language: 'de' },
  { phrase: 'Notdienste', pattern: '\\b(rettungswagen|rettungssanitäter|notaufnahme)\\b', severity: 'MEDIUM', category: 'Request', language: 'de' },
  { phrase: 'medizinischer Notfall', pattern: '\\b(medizinischer\\s+notfall|gesundheitsnotfall)\\b', severity: 'HIGH', category: 'Medical', language: 'de' },
  { phrase: 'lebensbedrohlich', pattern: '\\b(lebensbedrohlich|leben\\s+oder\\s+tod)\\b', severity: 'CRITICAL', category: 'Medical', language: 'de' }
];

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

// Add German phrases
addLanguagePhrases(germanPhrases, 'de').then(() => {
  // Add Hindi phrases
  return addLanguagePhrases(hindiPhrases, 'hi');
}).catch(error => {
  logger.error('Error in script:', error);
  process.exit(1);
});
