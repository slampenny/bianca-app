const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

// Portuguese phrases
const portuguesePhrases = [
  { phrase: 'ataque cardíaco', pattern: '\\b(ataque\\s+cardíaco|infarto)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'infarto do miocárdio', pattern: '\\b(infarto\\s+do\\s+miocárdio|im)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'não consigo respirar', pattern: '\\b(não\\s+consigo\\s+respirar)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'estou me engasgando', pattern: '\\b(estou\\s+me\\s+engasgando|engasgando)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'derrame cerebral', pattern: '\\b(derrame\\s+cerebral|acidente\\s+vascular\\s+cerebral)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'paralisia facial', pattern: '\\b(paralisia\\s+facial|rosto\\s+caído)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'convulsão', pattern: '\\b(convulsão|convulsões|estou\\s+tendo\\s+uma\\s+convulsão)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'anafilaxia', pattern: '\\b(anafilaxia|choque\\s+anafilático)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'overdose', pattern: '\\b(overdose|superdose|overdose\\s+de\\s+droga)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'envenenamento', pattern: '\\b(envenenado|envenenamento|ingeri\\s+veneno)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'perda de consciência', pattern: '\\b(desmaiei|desmaiado|inconsciente|perdi\\s+a\\s+consciência)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'sangramento severo', pattern: '\\b(sangramento\\s+severo|sangramento\\s+abundante|sangrando\\s+muito)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'hemorragia', pattern: '\\b(hemorragia|hemorragias)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' },
  { phrase: 'suicídio', pattern: '\\b(suicídio|me\\s+matar|quero\\s+morrer)\\b', severity: 'CRITICAL', category: 'Safety', language: 'pt' },
  { phrase: 'automutilação', pattern: '\\b(automutilação|me\\s+cortar|me\\s+machucar)\\b', severity: 'CRITICAL', category: 'Safety', language: 'pt' },
  { phrase: 'eu caí', pattern: '\\b(eu\\s+caí|caí\\s+no\\s+chão|eu\\s+escorreguei)\\b', severity: 'HIGH', category: 'Physical', language: 'pt' },
  { phrase: 'não consigo levantar', pattern: '\\b(não\\s+consigo\\s+levantar|não\\s+posso\\s+levantar)\\b', severity: 'HIGH', category: 'Physical', language: 'pt' },
  { phrase: 'bati a cabeça', pattern: '\\b(bati\\s+a\\s+cabeça|machuquei\\s+a\\s+cabeça)\\b', severity: 'HIGH', category: 'Physical', language: 'pt' },
  { phrase: 'osso quebrado', pattern: '\\b(osso\\s+quebrado|fratura|braço\\s+quebrado|perna\\s+quebrada)\\b', severity: 'HIGH', category: 'Physical', language: 'pt' },
  { phrase: 'dor severa', pattern: '\\b(dor\\s+severa|dor\\s+insuportável)\\b', severity: 'HIGH', category: 'Medical', language: 'pt' },
  { phrase: 'dor de emergência', pattern: '\\b(dor\\s+de\\s+emergência|dor\\s+urgente)\\b', severity: 'HIGH', category: 'Medical', language: 'pt' },
  { phrase: 'dor no peito', pattern: '\\b(dor\\s+no\\s+peito|dor\\s+torácica)\\b', severity: 'HIGH', category: 'Medical', language: 'pt' },
  { phrase: 'pressão no peito', pattern: '\\b(pressão\\s+no\\s+peito|aperto\\s+no\\s+peito)\\b', severity: 'HIGH', category: 'Medical', language: 'pt' },
  { phrase: 'intruso', pattern: '\\b(intruso|alguém\\s+entrando|ladrão)\\b', severity: 'HIGH', category: 'Safety', language: 'pt' },
  { phrase: 'intruso em casa', pattern: '\\b(alguém\\s+na\\s+minha\\s+casa|estranho\\s+na\\s+casa)\\b', severity: 'HIGH', category: 'Safety', language: 'pt' },
  { phrase: 'me sinto mal', pattern: '\\b(me\\s+sinto\\s+mal|não\\s+me\\s+sinto\\s+bem)\\b', severity: 'MEDIUM', category: 'Medical', language: 'pt' },
  { phrase: 'tonto', pattern: '\\b(tonto|tontura|vertigem)\\b', severity: 'MEDIUM', category: 'Medical', language: 'pt' },
  { phrase: 'náusea', pattern: '\\b(náusea|náuseas|vomitando)\\b', severity: 'MEDIUM', category: 'Medical', language: 'pt' },
  { phrase: 'dificuldade para respirar', pattern: '\\b(dificuldade\\s+para\\s+respirar|problemas\\s+para\\s+respirar)\\b', severity: 'MEDIUM', category: 'Medical', language: 'pt' },
  { phrase: 'reação alérgica severa', pattern: '\\b(reação\\s+alérgica\\s+severa)\\b', severity: 'MEDIUM', category: 'Medical', language: 'pt' },
  { phrase: 'preciso de ajuda', pattern: '\\b(preciso\\s+de\\s+ajuda|me\\s+ajude)\\b', severity: 'MEDIUM', category: 'Request', language: 'pt' },
  { phrase: 'chamar ambulância', pattern: '\\b(chamar\\s+ambulância|preciso\\s+de\\s+ajuda\\s+agora|isto\\s+é\\s+urgente)\\b', severity: 'MEDIUM', category: 'Request', language: 'pt' },
  { phrase: 'chamar emergência', pattern: '\\b(chamar\\s+emergência|serviços\\s+de\\s+emergência)\\b', severity: 'MEDIUM', category: 'Request', language: 'pt' },
  { phrase: 'serviços de emergência', pattern: '\\b(ambulância|paramédicos|pronto\\s+socorro)\\b', severity: 'MEDIUM', category: 'Request', language: 'pt' },
  { phrase: 'emergência médica', pattern: '\\b(emergência\\s+médica|emergência\\s+de\\s+saúde)\\b', severity: 'HIGH', category: 'Medical', language: 'pt' },
  { phrase: 'ameaça à vida', pattern: '\\b(ameaça\\s+à\\s+vida|vida\\s+ou\\s+morte)\\b', severity: 'CRITICAL', category: 'Medical', language: 'pt' }
];

// Italian phrases
const italianPhrases = [
  { phrase: 'attacco di cuore', pattern: '\\b(attacco\\s+di\\s+cuore|infarto)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'infarto del miocardio', pattern: '\\b(infarto\\s+del\\s+miocardio|im)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'non riesco a respirare', pattern: '\\b(non\\s+riesco\\s+a\\s+respirare)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'mi sto soffocando', pattern: '\\b(mi\\s+sto\\s+soffocando|soffocamento)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'ictus', pattern: '\\b(ictus|accidente\\s+vascolare\\s+cerebrale)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'paralisi facciale', pattern: '\\b(paralisi\\s+facciale|faccia\\s+cadente)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'convulsione', pattern: '\\b(convulsione|convulsioni|sto\\s+avendo\\s+una\\s+convulsione)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'anafilassi', pattern: '\\b(anafilassi|shock\\s+anafilattico)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'overdose', pattern: '\\b(overdose|sovradosaggio|overdose\\s+di\\s+droga)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'avvelenamento', pattern: '\\b(avvelenato|avvelenamento|ho\\s+ingerito\\s+veleno)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'perdita di coscienza', pattern: '\\b(svenuto|svenimento|inconscio|perso\\s+coscienza)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'sanguinamento severo', pattern: '\\b(sanguinamento\\s+severo|sanguinamento\\s+abbondante|sanguino\\s+molto)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'emorragia', pattern: '\\b(emorragia|emorragie)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' },
  { phrase: 'suicidio', pattern: '\\b(suicidio|uccidermi|voglio\\s+morire)\\b', severity: 'CRITICAL', category: 'Safety', language: 'it' },
  { phrase: 'autolesionismo', pattern: '\\b(autolesionismo|tagliarmi|farmi\\s+male)\\b', severity: 'CRITICAL', category: 'Safety', language: 'it' },
  { phrase: 'sono caduto', pattern: '\\b(sono\\s+caduto|sono\\s+caduta|sono\\s+inciampato|sono\\s+scivolato)\\b', severity: 'HIGH', category: 'Physical', language: 'it' },
  { phrase: 'non riesco ad alzarmi', pattern: '\\b(non\\s+riesco\\s+ad\\s+alzarmi|non\\s+posso\\s+alzarmi)\\b', severity: 'HIGH', category: 'Physical', language: 'it' },
  { phrase: 'mi sono colpito la testa', pattern: '\\b(mi\\s+sono\\s+colpito\\s+la\\s+testa|colpo\\s+alla\\s+testa)\\b', severity: 'HIGH', category: 'Physical', language: 'it' },
  { phrase: 'osso rotto', pattern: '\\b(osso\\s+rotto|frattura|braccio\\s+rotto|gamba\\s+rotta)\\b', severity: 'HIGH', category: 'Physical', language: 'it' },
  { phrase: 'dolore severo', pattern: '\\b(dolore\\s+severo|dolore\\s+insopportabile)\\b', severity: 'HIGH', category: 'Medical', language: 'it' },
  { phrase: 'dolore di emergenza', pattern: '\\b(dolore\\s+di\\s+emergenza|dolore\\s+urgente)\\b', severity: 'HIGH', category: 'Medical', language: 'it' },
  { phrase: 'dolore al petto', pattern: '\\b(dolore\\s+al\\s+petto|male\\s+al\\s+petto)\\b', severity: 'HIGH', category: 'Medical', language: 'it' },
  { phrase: 'pressione al petto', pattern: '\\b(pressione\\s+al\\s+petto|oppressione\\s+al\\s+petto)\\b', severity: 'HIGH', category: 'Medical', language: 'it' },
  { phrase: 'intruso', pattern: '\\b(intruso|qualcuno\\s+che\\s+entra|ladro)\\b', severity: 'HIGH', category: 'Safety', language: 'it' },
  { phrase: 'intruso in casa', pattern: '\\b(qualcuno\\s+in\\s+casa\\s+mia|straniero\\s+in\\s+casa)\\b', severity: 'HIGH', category: 'Safety', language: 'it' },
  { phrase: 'mi sento male', pattern: '\\b(mi\\s+sento\\s+male|non\\s+mi\\s+sento\\s+bene)\\b', severity: 'MEDIUM', category: 'Medical', language: 'it' },
  { phrase: 'vertigini', pattern: '\\b(vertigini|capogiro|vertigine)\\b', severity: 'MEDIUM', category: 'Medical', language: 'it' },
  { phrase: 'nausea', pattern: '\\b(nausea|vomito|sto\\s+vomitando)\\b', severity: 'MEDIUM', category: 'Medical', language: 'it' },
  { phrase: 'difficoltà respiratorie', pattern: '\\b(difficoltà\\s+respiratorie|problemi\\s+respiratori)\\b', severity: 'MEDIUM', category: 'Medical', language: 'it' },
  { phrase: 'reazione allergica severa', pattern: '\\b(reazione\\s+allergica\\s+severa)\\b', severity: 'MEDIUM', category: 'Medical', language: 'it' },
  { phrase: 'ho bisogno di aiuto', pattern: '\\b(ho\\s+bisogno\\s+di\\s+aiuto|aiutatemi)\\b', severity: 'MEDIUM', category: 'Request', language: 'it' },
  { phrase: 'chiamare ambulanza', pattern: '\\b(chiamare\\s+ambulanza|ho\\s+bisogno\\s+di\\s+aiuto\\s+ora|è\\s+urgente)\\b', severity: 'MEDIUM', category: 'Request', language: 'it' },
  { phrase: 'chiamare emergenze', pattern: '\\b(chiamare\\s+emergenze|servizi\\s+di\\s+emergenza)\\b', severity: 'MEDIUM', category: 'Request', language: 'it' },
  { phrase: 'servizi di emergenza', pattern: '\\b(ambulanza|paramedici|pronto\\s+soccorso)\\b', severity: 'MEDIUM', category: 'Request', language: 'it' },
  { phrase: 'emergenza medica', pattern: '\\b(emergenza\\s+medica|emergenza\\s+sanitaria)\\b', severity: 'HIGH', category: 'Medical', language: 'it' },
  { phrase: 'pericolo di vita', pattern: '\\b(pericolo\\s+di\\s+vita|vita\\s+o\\s+morte)\\b', severity: 'CRITICAL', category: 'Medical', language: 'it' }
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

// Add Portuguese phrases
addLanguagePhrases(portuguesePhrases, 'pt').then(() => {
  // Add Italian phrases
  return addLanguagePhrases(italianPhrases, 'it');
}).catch(error => {
  logger.error('Error in script:', error);
  process.exit(1);
});
