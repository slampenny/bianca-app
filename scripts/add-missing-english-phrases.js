const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

const missingEnglishPhrases = [
  // Missing CRITICAL Medical phrases
  { phrase: 'myocardial infarction', pattern: '\\b(myocardial\\s+infarction|mi)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'facial droop', pattern: '\\b(facial\\s+droop|drooping\\s+face)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'anaphylaxis', pattern: '\\b(anaphylaxis|anaphylactic\\s+shock)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'overdose', pattern: '\\b(overdose|overdosed|drug\\s+overdose)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'poisoning', pattern: '\\b(poisoned|poisoning|ingested\\s+poison)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'loss of consciousness', pattern: '\\b(passed\\s+out|fainted|unconscious|lost\\s+consciousness)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'severe bleeding', pattern: '\\b(severe\\s+bleeding|heavy\\s+bleeding|bleeding\\s+heavily)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'hemorrhage', pattern: '\\b(hemorrhage|hemorrhaging)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'self harm', pattern: '\\b(self\\s+harm|cutting\\s+myself|hurting\\s+myself)\\b', severity: 'CRITICAL', category: 'Safety', language: 'en' },
  
  // Missing HIGH Medical phrases
  { phrase: 'severe pain', pattern: '\\b(severe\\s+pain|excruciating\\s+pain|unbearable\\s+pain)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'emergency pain', pattern: '\\b(emergency\\s+pain|urgent\\s+pain)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'chest pressure', pattern: '\\b(pressure\\s+in\\s+chest|tightness\\s+in\\s+chest|pressure\\s+in\\s+my\\s+chest)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  
  // Missing HIGH Physical phrases
  { phrase: 'hit my head', pattern: '\\b(hit\\s+my\\s+head|bumped\\s+my\\s+head|head\\s+injury)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
  { phrase: 'broken bone', pattern: '\\b(broken\\s+bone|fracture|broken\\s+arm|broken\\s+leg)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
  
  // Missing HIGH Safety phrases
  { phrase: 'intruder', pattern: '\\b(intruder|someone\\s+breaking\\s+in|burglar|break\\s+in)\\b', severity: 'HIGH', category: 'Safety', language: 'en' },
  { phrase: 'intruder in house', pattern: '\\b(someone\\s+in\\s+my\\s+house|stranger\\s+in\\s+house)\\b', severity: 'HIGH', category: 'Safety', language: 'en' },
  
  // Missing MEDIUM Medical phrases
  { phrase: 'feel sick', pattern: '\\b(feel\\s+sick|feeling\\s+sick|not\\s+feeling\\s+well)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'dizzy', pattern: '\\b(dizzy|lightheaded|vertigo)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'nausea', pattern: '\\b(nauseous|nausea|throwing\\s+up|vomiting)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'breathing difficulty', pattern: '\\b(difficulty\\s+breathing|trouble\\s+breathing|shortness\\s+of\\s+breath)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'severe allergic reaction', pattern: '\\b(severe\\s+allergic\\s+reaction)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  
  // Missing MEDIUM Request phrases
  { phrase: 'call ambulance', pattern: '\\b(call\\s+ambulance|get\\s+help\\s+now|this\\s+is\\s+urgent)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  { phrase: 'emergency services', pattern: '\\b(ambulance|paramedics|emergency\\s+room|er)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  
  // Missing general phrases
  { phrase: 'medical emergency', pattern: '\\b(medical\\s+emergency|health\\s+emergency)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'life threatening', pattern: '\\b(life\\s+threatening|life\\s+or\\s+death)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' }
];

const addMissingPhrases = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  logger.info('Connected to MongoDB');

  try {
    // Create a system user ID for default phrases
    const systemUserId = '000000000000000000000000';

    const phrasesToCreate = missingEnglishPhrases.map(phrase => ({
      ...phrase,
      createdBy: systemUserId,
      lastModifiedBy: systemUserId,
      isActive: true,
      description: `Default ${phrase.severity} ${phrase.category} phrase in ${phrase.language}`
    }));

    // Check which phrases already exist
    const existingPhrases = await EmergencyPhrase.find({ language: 'en' }).select('phrase');
    const existingPhraseTexts = existingPhrases.map(p => p.phrase);
    
    const newPhrases = phrasesToCreate.filter(phrase => !existingPhraseTexts.includes(phrase.phrase));
    
    if (newPhrases.length > 0) {
      await EmergencyPhrase.insertMany(newPhrases);
      logger.info(`Added ${newPhrases.length} missing English emergency phrases`);
    } else {
      logger.info('All English phrases already exist');
    }
    
    // Log summary
    const totalEnglish = await EmergencyPhrase.countDocuments({ language: 'en' });
    logger.info(`Total English phrases in database: ${totalEnglish}`);
    
  } catch (error) {
    logger.error('Error adding missing phrases:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

addMissingPhrases();
