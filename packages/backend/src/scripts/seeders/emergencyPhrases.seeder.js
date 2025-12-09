// seeders/emergencyPhrases.seeder.js
/**
 * Seeds emergency phrases into the database for all supported languages
 * These phrases are used by the localized emergency detector
 * 
 * Supports: en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn
 */

const { EmergencyPhrase } = require('../../models');
const logger = require('../../config/logger');

// System user ID for seeding
const SYSTEM_USER_ID = '000000000000000000000000';

/**
 * Get emergency phrases for a specific language
 * Returns array of phrase objects with translations
 */
function getPhrasesForLanguage(language) {
  const phrasesByLanguage = {
    en: [
      // CRITICAL - Medical
      { phrase: 'heart attack', pattern: '\\b(heart\\s+attack|heartattack|having\\s+a\\s+heart\\s+attack|i\'?m\\s+having\\s+a\\s+heart\\s+attack|i\\s+am\\s+having\\s+a\\s+heart\\s+attack)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Cardiac emergency - heart attack' },
      { phrase: "can't breathe", pattern: '\\b(can\'?t\\s+breathe|cannot\\s+breathe|can\'t\\s+breath|cannot\\s+breath)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Breathing emergency' },
      { phrase: 'choking', pattern: '\\b(choking|choke)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Choking emergency' },
      { phrase: 'stroke', pattern: '\\b(stroke|stroke\\s+symptoms)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Stroke emergency' },
      { phrase: 'seizure', pattern: '\\b(seizure|seizing|having\\s+a\\s+seizure)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Seizure emergency' },
      // CRITICAL - Safety
      { phrase: 'suicide', pattern: '\\b(suicide|killing\\s+myself|kill\\s+myself|want\\s+to\\s+die|end\\s+my\\s+life)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Suicide threat' },
      // HIGH - Physical
      { phrase: 'fell down', pattern: '\\b(i\\s+fell|fell\\s+down|i\\s+tripped|i\\s+slipped)\\b', severity: 'HIGH', category: 'Physical', description: 'Fall incident' },
      { phrase: "can't get up", pattern: '\\b(can\'?t\\s+get\\s+up|unable\\s+to\\s+get\\s+up|cannot\\s+get\\s+up)\\b', severity: 'HIGH', category: 'Physical', description: 'Unable to get up after fall' },
      // HIGH - Medical
      { phrase: 'chest pain', pattern: '\\b(chest\\s+pain|chest\\s+ache|chest\\s+pressure)\\b', severity: 'HIGH', category: 'Medical', description: 'Chest pain or pressure' },
      // MEDIUM - Request
      { phrase: 'call 911', pattern: '\\b(call\\s+911|call\\s+emergency|emergency\\s+services)\\b', severity: 'MEDIUM', category: 'Request', description: 'Request for emergency services' },
      { phrase: 'need help', pattern: '\\b(need\\s+help|i\\s+need\\s+help|help\\s+me)\\b', severity: 'MEDIUM', category: 'Request', description: 'Request for help' }
    ],
    es: [
      // CRITICAL - Medical (Spanish)
      { phrase: 'ataque al corazón', pattern: '\\b(ataque\\s+al\\s+corazón|ataque\\s+cardiaco|infarto|infarto\\s+de\\s+miocardio|estoy\\s+teniendo\\s+un\\s+ataque\\s+al\\s+corazón)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergencia cardíaca - ataque al corazón' },
      { phrase: 'no puedo respirar', pattern: '\\b(no\\s+puedo\\s+respirar|me\\s+falta\\s+el\\s+aire)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergencia respiratoria' },
      { phrase: 'ahogándose', pattern: '\\b(ahogándose|ahogando|me\\s+estoy\\s+ahogando)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergencia de asfixia' },
      { phrase: 'derrame cerebral', pattern: '\\b(derrame\\s+cerebral|accidente\\s+cerebrovascular|acv)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergencia de derrame cerebral' },
      // CRITICAL - Safety
      { phrase: 'suicidio', pattern: '\\b(suicidio|matarme|quiero\\s+morir|acabar\\s+con\\s+mi\\s+vida)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Amenaza de suicidio' },
      // HIGH - Physical
      { phrase: 'me caí', pattern: '\\b(me\\s+caí|me\\s+tropiezo|me\\s+resbalé)\\b', severity: 'HIGH', category: 'Physical', description: 'Incidente de caída' },
      { phrase: 'no puedo levantarme', pattern: '\\b(no\\s+puedo\\s+levantarme|no\\s+puedo\\s+pararme)\\b', severity: 'HIGH', category: 'Physical', description: 'No puedo levantarme después de caer' },
      // HIGH - Medical
      { phrase: 'dolor en el pecho', pattern: '\\b(dolor\\s+en\\s+el\\s+pecho|dolor\\s+de\\s+pecho|presión\\s+en\\s+el\\s+pecho)\\b', severity: 'HIGH', category: 'Medical', description: 'Dolor o presión en el pecho' },
      // MEDIUM - Request
      { phrase: 'llamar al 911', pattern: '\\b(llamar\\s+al\\s+911|llamar\\s+emergencias|servicios\\s+de\\s+emergencia)\\b', severity: 'MEDIUM', category: 'Request', description: 'Solicitud de servicios de emergencia' },
      { phrase: 'necesito ayuda', pattern: '\\b(necesito\\s+ayuda|ayuda|ayúdame)\\b', severity: 'MEDIUM', category: 'Request', description: 'Solicitud de ayuda' }
    ],
    fr: [
      // CRITICAL - Medical (French)
      { phrase: 'crise cardiaque', pattern: '\\b(crise\\s+cardiaque|infarctus|infarctus\\s+du\\s+myocarde|je\\s+fais\\s+une\\s+crise\\s+cardiaque)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Urgence cardiaque - crise cardiaque' },
      { phrase: "je ne peux pas respirer", pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+respirer|j\\'ai\\s+du\\s+mal\\s+à\\s+respirer)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Urgence respiratoire' },
      { phrase: 'étouffement', pattern: '\\b(étouffement|je\\s+m\\'étouffe|étouffe)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Urgence d\'étouffement' },
      { phrase: 'accident vasculaire cérébral', pattern: '\\b(accident\\s+vasculaire\\s+cérébral|avc|attaque\\s+cérébrale)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Urgence d\'accident vasculaire cérébral' },
      // CRITICAL - Safety
      { phrase: 'suicide', pattern: '\\b(suicide|me\\s+tuer|je\\s+veux\\s+mourir|mettre\\s+fin\\s+à\\s+ma\\s+vie)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Menace de suicide' },
      // HIGH - Physical
      { phrase: 'je suis tombé', pattern: '\\b(je\\s+suis\\s+tombé|je\\s+suis\\s+tombée|j\\'ai\\s+glissé)\\b', severity: 'HIGH', category: 'Physical', description: 'Incident de chute' },
      { phrase: 'je ne peux pas me lever', pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+me\\s+lever|je\\s+ne\\s+peux\\s+pas\\s+me\\s+relever)\\b', severity: 'HIGH', category: 'Physical', description: 'Je ne peux pas me lever après une chute' },
      // HIGH - Medical
      { phrase: 'douleur à la poitrine', pattern: '\\b(douleur\\s+à\\s+la\\s+poitrine|douleur\\s+thoracique|pression\\s+dans\\s+la\\s+poitrine)\\b', severity: 'HIGH', category: 'Medical', description: 'Douleur ou pression dans la poitrine' },
      // MEDIUM - Request
      { phrase: 'appeler le 911', pattern: '\\b(appeler\\s+le\\s+911|appeler\\s+les\\s+urgences|services\\s+d\\'urgence)\\b', severity: 'MEDIUM', category: 'Request', description: 'Demande de services d\'urgence' },
      { phrase: 'besoin d\'aide', pattern: '\\b(besoin\\s+d\\'aide|j\\'ai\\s+besoin\\s+d\\'aide|aidez-moi)\\b', severity: 'MEDIUM', category: 'Request', description: 'Demande d\'aide' }
    ],
    de: [
      // CRITICAL - Medical (German)
      { phrase: 'Herzinfarkt', pattern: '\\b(Herzinfarkt|Herzanfall|Myokardinfarkt|ich\\s+habe\\s+einen\\s+Herzinfarkt)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Herznotfall - Herzinfarkt' },
      { phrase: 'ich kann nicht atmen', pattern: '\\b(ich\\s+kann\\s+nicht\\s+atmen|Atemnot|ich\\s+bekomme\\s+keine\\s+Luft)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Atemnotfall' },
      { phrase: 'Erstickung', pattern: '\\b(Erstickung|ich\\s+ersticke|würge)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Erstickungsnotfall' },
      { phrase: 'Schlaganfall', pattern: '\\b(Schlaganfall|Hirnschlag|Apoplexie)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Schlaganfallnotfall' },
      // CRITICAL - Safety
      { phrase: 'Selbstmord', pattern: '\\b(Selbstmord|mich\\s+umbringen|ich\\s+will\\s+sterben|meinem\\s+Leben\\s+ein\\s+Ende\\s+setzen)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Selbstmorddrohung' },
      // HIGH - Physical
      { phrase: 'ich bin gefallen', pattern: '\\b(ich\\s+bin\\s+gefallen|ich\\s+bin\\s+gestürzt|ich\\s+bin\\s+ausgerutscht)\\b', severity: 'HIGH', category: 'Physical', description: 'Sturzvorfall' },
      { phrase: 'ich kann nicht aufstehen', pattern: '\\b(ich\\s+kann\\s+nicht\\s+aufstehen|ich\\s+kann\\s+mich\\s+nicht\\s+erheben)\\b', severity: 'HIGH', category: 'Physical', description: 'Ich kann nach einem Sturz nicht aufstehen' },
      // HIGH - Medical
      { phrase: 'Brustschmerzen', pattern: '\\b(Brustschmerzen|Schmerzen\\s+in\\s+der\\s+Brust|Druck\\s+auf\\s+der\\s+Brust)\\b', severity: 'HIGH', category: 'Medical', description: 'Brustschmerzen oder Druck' },
      // MEDIUM - Request
      { phrase: '112 anrufen', pattern: '\\b(112\\s+anrufen|Notruf|Notdienste)\\b', severity: 'MEDIUM', category: 'Request', description: 'Anfrage nach Notdiensten' },
      { phrase: 'Hilfe brauchen', pattern: '\\b(Hilfe\\s+brauchen|ich\\s+brauche\\s+Hilfe|hilf\\s+mir)\\b', severity: 'MEDIUM', category: 'Request', description: 'Hilfeanfrage' }
    ],
    pt: [
      // CRITICAL - Medical (Portuguese)
      { phrase: 'ataque cardíaco', pattern: '\\b(ataque\\s+cardíaco|infarto|infarto\\s+do\\s+miocárdio|estou\\s+tendo\\s+um\\s+ataque\\s+cardíaco)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergência cardíaca - ataque cardíaco' },
      { phrase: 'não consigo respirar', pattern: '\\b(não\\s+consigo\\s+respirar|falta\\s+de\\s+ar)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergência respiratória' },
      { phrase: 'engasgando', pattern: '\\b(engasgando|engasgo|estou\\s+engasgando)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergência de engasgo' },
      { phrase: 'derrame cerebral', pattern: '\\b(derrame\\s+cerebral|acidente\\s+vascular\\s+cerebral|avc)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergência de derrame cerebral' },
      // CRITICAL - Safety
      { phrase: 'suicídio', pattern: '\\b(suicídio|me\\s+matar|quero\\s+morrer|acabar\\s+com\\s+minha\\s+vida)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Ameaça de suicídio' },
      // HIGH - Physical
      { phrase: 'caí', pattern: '\\b(caí|tropecei|escorreguei)\\b', severity: 'HIGH', category: 'Physical', description: 'Incidente de queda' },
      { phrase: 'não consigo me levantar', pattern: '\\b(não\\s+consigo\\s+me\\s+levantar|não\\s+consigo\\s+me\\s+erguer)\\b', severity: 'HIGH', category: 'Physical', description: 'Não consigo me levantar após queda' },
      // HIGH - Medical
      { phrase: 'dor no peito', pattern: '\\b(dor\\s+no\\s+peito|dor\\s+torácica|pressão\\s+no\\s+peito)\\b', severity: 'HIGH', category: 'Medical', description: 'Dor ou pressão no peito' },
      // MEDIUM - Request
      { phrase: 'ligar para 911', pattern: '\\b(ligar\\s+para\\s+911|ligar\\s+emergência|serviços\\s+de\\s+emergência)\\b', severity: 'MEDIUM', category: 'Request', description: 'Solicitação de serviços de emergência' },
      { phrase: 'preciso de ajuda', pattern: '\\b(preciso\\s+de\\s+ajuda|ajuda|me\\s+ajude)\\b', severity: 'MEDIUM', category: 'Request', description: 'Solicitação de ajuda' }
    ],
    it: [
      // CRITICAL - Medical (Italian)
      { phrase: 'attacco di cuore', pattern: '\\b(attacco\\s+di\\s+cuore|infarto|infarto\\s+del\\s+miocardio|sto\\s+avendo\\s+un\\s+attacco\\s+di\\s+cuore)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergenza cardiaca - attacco di cuore' },
      { phrase: 'non riesco a respirare', pattern: '\\b(non\\s+riesco\\s+a\\s+respirare|mancanza\\s+di\\s+fiato)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergenza respiratoria' },
      { phrase: 'soffocamento', pattern: '\\b(soffocamento|sto\\s+soffocando|soffoco)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergenza di soffocamento' },
      { phrase: 'ictus', pattern: '\\b(ictus|ictus\\s+cerebrale|colpo\\s+apoplettico)\\b', severity: 'CRITICAL', category: 'Medical', description: 'Emergenza di ictus' },
      // CRITICAL - Safety
      { phrase: 'suicidio', pattern: '\\b(suicidio|uccidermi|voglio\\s+morire|porre\\s+fine\\s+alla\\s+mia\\s+vita)\\b', severity: 'CRITICAL', category: 'Safety', description: 'Minaccia di suicidio' },
      // HIGH - Physical
      { phrase: 'sono caduto', pattern: '\\b(sono\\s+caduto|sono\\s+caduta|sono\\s+inciampato)\\b', severity: 'HIGH', category: 'Physical', description: 'Incidente di caduta' },
      { phrase: 'non riesco ad alzarmi', pattern: '\\b(non\\s+riesco\\s+ad\\s+alzarmi|non\\s+riesco\\s+a\\s+rialzarmi)\\b', severity: 'HIGH', category: 'Physical', description: 'Non riesco ad alzarmi dopo una caduta' },
      // HIGH - Medical
      { phrase: 'dolore al petto', pattern: '\\b(dolore\\s+al\\s+petto|dolore\\s+toracico|pressione\\s+al\\s+petto)\\b', severity: 'HIGH', category: 'Medical', description: 'Dolore o pressione al petto' },
      // MEDIUM - Request
      { phrase: 'chiamare il 911', pattern: '\\b(chiamare\\s+il\\s+911|chiamare\\s+emergenze|servizi\\s+di\\s+emergenza)\\b', severity: 'MEDIUM', category: 'Request', description: 'Richiesta di servizi di emergenza' },
      { phrase: 'ho bisogno di aiuto', pattern: '\\b(ho\\s+bisogno\\s+di\\s+aiuto|aiuto|aiutami)\\b', severity: 'MEDIUM', category: 'Request', description: 'Richiesta di aiuto' }
    ],
    zh: [
      // CRITICAL - Medical (Chinese Traditional/Simplified)
      { phrase: '心脏病发作', pattern: '(心脏病发作|心肌梗死|心梗|我心脏病发作了|心脏病)', severity: 'CRITICAL', category: 'Medical', description: '心脏急症 - 心脏病发作' },
      { phrase: '无法呼吸', pattern: '(无法呼吸|不能呼吸|呼吸困难|喘不过气)', severity: 'CRITICAL', category: 'Medical', description: '呼吸急症' },
      { phrase: '窒息', pattern: '(窒息|被噎住|呛到)', severity: 'CRITICAL', category: 'Medical', description: '窒息急症' },
      { phrase: '中风', pattern: '(中风|脑卒中|脑血管意外)', severity: 'CRITICAL', category: 'Medical', description: '中风急症' },
      { phrase: '癫痫发作', pattern: '(癫痫发作|抽风|抽搐)', severity: 'CRITICAL', category: 'Medical', description: '癫痫发作急症' },
      // CRITICAL - Safety
      { phrase: '自杀', pattern: '(自杀|想死|结束生命|不想活了)', severity: 'CRITICAL', category: 'Safety', description: '自杀威胁' },
      // HIGH - Physical
      { phrase: '摔倒了', pattern: '(摔倒了|跌倒了|滑倒了)', severity: 'HIGH', category: 'Physical', description: '摔倒事件' },
      { phrase: '站不起来', pattern: '(站不起来|起不来|无法起身)', severity: 'HIGH', category: 'Physical', description: '摔倒后无法起身' },
      // HIGH - Medical
      { phrase: '胸痛', pattern: '(胸痛|胸口疼|胸部疼痛|胸闷)', severity: 'HIGH', category: 'Medical', description: '胸痛或胸闷' },
      // MEDIUM - Request
      { phrase: '打911', pattern: '(打911|叫救护车|紧急服务)', severity: 'MEDIUM', category: 'Request', description: '请求紧急服务' },
      { phrase: '需要帮助', pattern: '(需要帮助|帮帮我|救命)', severity: 'MEDIUM', category: 'Request', description: '请求帮助' }
    ],
    'zh-cn': [
      // CRITICAL - Medical (Chinese Simplified - same as zh but separate for clarity)
      { phrase: '心脏病发作', pattern: '(心脏病发作|心肌梗死|心梗|我心脏病发作了|心脏病)', severity: 'CRITICAL', category: 'Medical', description: '心脏急症 - 心脏病发作' },
      { phrase: '无法呼吸', pattern: '(无法呼吸|不能呼吸|呼吸困难|喘不过气)', severity: 'CRITICAL', category: 'Medical', description: '呼吸急症' },
      { phrase: '窒息', pattern: '(窒息|被噎住|呛到)', severity: 'CRITICAL', category: 'Medical', description: '窒息急症' },
      { phrase: '中风', pattern: '(中风|脑卒中|脑血管意外)', severity: 'CRITICAL', category: 'Medical', description: '中风急症' },
      { phrase: '癫痫发作', pattern: '(癫痫发作|抽风|抽搐)', severity: 'CRITICAL', category: 'Medical', description: '癫痫发作急症' },
      // CRITICAL - Safety
      { phrase: '自杀', pattern: '(自杀|想死|结束生命|不想活了)', severity: 'CRITICAL', category: 'Safety', description: '自杀威胁' },
      // HIGH - Physical
      { phrase: '摔倒了', pattern: '(摔倒了|跌倒了|滑倒了)', severity: 'HIGH', category: 'Physical', description: '摔倒事件' },
      { phrase: '站不起来', pattern: '(站不起来|起不来|无法起身)', severity: 'HIGH', category: 'Physical', description: '摔倒后无法起身' },
      // HIGH - Medical
      { phrase: '胸痛', pattern: '(胸痛|胸口疼|胸部疼痛|胸闷)', severity: 'HIGH', category: 'Medical', description: '胸痛或胸闷' },
      // MEDIUM - Request
      { phrase: '打911', pattern: '(打911|叫救护车|紧急服务)', severity: 'MEDIUM', category: 'Request', description: '请求紧急服务' },
      { phrase: '需要帮助', pattern: '(需要帮助|帮帮我|救命)', severity: 'MEDIUM', category: 'Request', description: '请求帮助' }
    ],
    ja: [
      // CRITICAL - Medical (Japanese)
      { phrase: '心臓発作', pattern: '(心臓発作|心筋梗塞|心臓麻痺|心臓発作が起きている)', severity: 'CRITICAL', category: 'Medical', description: '心臓の緊急事態 - 心臓発作' },
      { phrase: '息ができない', pattern: '(息ができない|呼吸困難|息苦しい|呼吸できない)', severity: 'CRITICAL', category: 'Medical', description: '呼吸の緊急事態' },
      { phrase: '窒息', pattern: '(窒息|喉に詰まった|詰まっている)', severity: 'CRITICAL', category: 'Medical', description: '窒息の緊急事態' },
      { phrase: '脳卒中', pattern: '(脳卒中|脳梗塞|脳血管障害)', severity: 'CRITICAL', category: 'Medical', description: '脳卒中の緊急事態' },
      { phrase: '発作', pattern: '(発作|けいれん|てんかん発作)', severity: 'CRITICAL', category: 'Medical', description: '発作の緊急事態' },
      // CRITICAL - Safety
      { phrase: '自殺', pattern: '(自殺|死にたい|命を終わらせたい|生きる気力がない)', severity: 'CRITICAL', category: 'Safety', description: '自殺の脅威' },
      // HIGH - Physical
      { phrase: '転んだ', pattern: '(転んだ|転倒した|滑って転んだ)', severity: 'HIGH', category: 'Physical', description: '転倒事故' },
      { phrase: '起き上がれない', pattern: '(起き上がれない|立ち上がれない|立てない)', severity: 'HIGH', category: 'Physical', description: '転倒後起き上がれない' },
      // HIGH - Medical
      { phrase: '胸の痛み', pattern: '(胸の痛み|胸痛|胸部の圧迫感)', severity: 'HIGH', category: 'Medical', description: '胸の痛みや圧迫感' },
      // MEDIUM - Request
      { phrase: '119番に電話', pattern: '(119番に電話|救急車を呼ぶ|緊急サービス)', severity: 'MEDIUM', category: 'Request', description: '緊急サービスの要請' },
      { phrase: '助けが必要', pattern: '(助けが必要|助けて|手伝って)', severity: 'MEDIUM', category: 'Request', description: '助けの要請' }
    ],
    ru: [
      // CRITICAL - Medical (Russian)
      { phrase: 'сердечный приступ', pattern: '(сердечный\\s+приступ|инфаркт|инфаркт\\s+миокарда|у\\s+меня\\s+сердечный\\s+приступ)', severity: 'CRITICAL', category: 'Medical', description: 'Сердечная неотложная помощь - сердечный приступ' },
      { phrase: 'не могу дышать', pattern: '(не\\s+могу\\s+дышать|не\\s+хватает\\s+воздуха|затрудненное\\s+дыхание)', severity: 'CRITICAL', category: 'Medical', description: 'Дыхательная неотложная помощь' },
      { phrase: 'удушье', pattern: '(удушье|задыхаюсь|подавился)', severity: 'CRITICAL', category: 'Medical', description: 'Неотложная помощь при удушье' },
      { phrase: 'инсульт', pattern: '(инсульт|мозговой\\s+удар|цереброваскулярный\\s+инцидент)', severity: 'CRITICAL', category: 'Medical', description: 'Неотложная помощь при инсульте' },
      { phrase: 'припадок', pattern: '(припадок|судороги|эпилептический\\s+припадок)', severity: 'CRITICAL', category: 'Medical', description: 'Неотложная помощь при припадке' },
      // CRITICAL - Safety
      { phrase: 'суицид', pattern: '(суицид|покончить\\s+с\\s+собой|хочу\\s+умереть|покончить\\s+жизнь)', severity: 'CRITICAL', category: 'Safety', description: 'Угроза суицида' },
      // HIGH - Physical
      { phrase: 'упал', pattern: '(упал|упала|поскользнулся|споткнулся)', severity: 'HIGH', category: 'Physical', description: 'Инцидент с падением' },
      { phrase: 'не могу встать', pattern: '(не\\s+могу\\s+встать|не\\s+могу\\s+подняться)', severity: 'HIGH', category: 'Physical', description: 'Не могу встать после падения' },
      // HIGH - Medical
      { phrase: 'боль в груди', pattern: '(боль\\s+в\\s+груди|грудная\\s+боль|давление\\s+в\\s+груди)', severity: 'HIGH', category: 'Medical', description: 'Боль или давление в груди' },
      // MEDIUM - Request
      { phrase: 'позвонить 112', pattern: '(позвонить\\s+112|вызвать\\s+скорую|экстренные\\s+службы)', severity: 'MEDIUM', category: 'Request', description: 'Запрос экстренных служб' },
      { phrase: 'нужна помощь', pattern: '(нужна\\s+помощь|помогите|помощь)', severity: 'MEDIUM', category: 'Request', description: 'Запрос помощи' }
    ],
    ar: [
      // CRITICAL - Medical (Arabic)
      { phrase: 'نوبة قلبية', pattern: '(نوبة\\s+قلبية|أزمة\\s+قلبية|احتشاء\\s+عضلة\\s+القلب|أعاني\\s+من\\s+نوبة\\s+قلبية)', severity: 'CRITICAL', category: 'Medical', description: 'طوارئ قلبية - نوبة قلبية' },
      { phrase: 'لا أستطيع التنفس', pattern: '(لا\\s+أستطيع\\s+التنفس|صعوبة\\s+في\\s+التنفس|ضيق\\s+نفس)', severity: 'CRITICAL', category: 'Medical', description: 'طوارئ تنفسية' },
      { phrase: 'اختناق', pattern: '(اختناق|أختنق|شرقة)', severity: 'CRITICAL', category: 'Medical', description: 'طوارئ اختناق' },
      { phrase: 'سكتة دماغية', pattern: '(سكتة\\s+دماغية|جلطة\\s+دماغية|نوبة\\s+دماغية)', severity: 'CRITICAL', category: 'Medical', description: 'طوارئ سكتة دماغية' },
      { phrase: 'نوبة صرع', pattern: '(نوبة\\s+صرع|تشنج|صرع)', severity: 'CRITICAL', category: 'Medical', description: 'طوارئ نوبة صرع' },
      // CRITICAL - Safety
      { phrase: 'انتحار', pattern: '(انتحار|قتل\\s+نفسي|أريد\\s+الموت|إنهاء\\s+حياتي)', severity: 'CRITICAL', category: 'Safety', description: 'تهديد بالانتحار' },
      // HIGH - Physical
      { phrase: 'سقطت', pattern: '(سقطت|تعثرت|انزلقت)', severity: 'HIGH', category: 'Physical', description: 'حادث سقوط' },
      { phrase: 'لا أستطيع النهوض', pattern: '(لا\\s+أستطيع\\s+النهوض|لا\\s+أستطيع\\s+الوقوف)', severity: 'HIGH', category: 'Physical', description: 'لا أستطيع النهوض بعد السقوط' },
      // HIGH - Medical
      { phrase: 'ألم في الصدر', pattern: '(ألم\\s+في\\s+الصدر|ألم\\s+صدري|ضغط\\s+في\\s+الصدر)', severity: 'HIGH', category: 'Medical', description: 'ألم أو ضغط في الصدر' },
      // MEDIUM - Request
      { phrase: 'اتصل بـ 911', pattern: '(اتصل\\s+بـ\\s+911|اتصل\\s+بالطوارئ|خدمات\\s+الطوارئ)', severity: 'MEDIUM', category: 'Request', description: 'طلب خدمات الطوارئ' },
      { phrase: 'أحتاج مساعدة', pattern: '(أحتاج\\s+مساعدة|مساعدة|ساعدني)', severity: 'MEDIUM', category: 'Request', description: 'طلب المساعدة' }
    ],
    hi: [
      // CRITICAL - Medical (Hindi)
      { phrase: 'दिल का दौरा', pattern: '(दिल\\s+का\\s+दौरा|हृदयाघात|मायोकार्डियल\\s+इन्फार्क्शन|मुझे\\s+दिल\\s+का\\s+दौरा\\s+पड़\\s+रहा\\s+है)', severity: 'CRITICAL', category: 'Medical', description: 'हृदय आपातकाल - दिल का दौरा' },
      { phrase: 'सांस नहीं ले सकता', pattern: '(सांस\\s+नहीं\\s+ले\\s+सकता|सांस\\s+नहीं\\s+ले\\s+सकती|सांस\\s+लेने\\s+में\\s+कठिनाई)', severity: 'CRITICAL', category: 'Medical', description: 'श्वसन आपातकाल' },
      { phrase: 'दम घुट रहा है', pattern: '(दम\\s+घुट\\s+रहा\\s+है|सांस\\s+अटक\\s+गई|गला\\s+अटक\\s+गया)', severity: 'CRITICAL', category: 'Medical', description: 'दम घुटने का आपातकाल' },
      { phrase: 'स्ट्रोक', pattern: '(स्ट्रोक|मस्तिष्काघात|सेरेब्रोवास्कुलर\\s+दुर्घटना)', severity: 'CRITICAL', category: 'Medical', description: 'स्ट्रोक आपातकाल' },
      { phrase: 'दौरा', pattern: '(दौरा|मिर्गी\\s+का\\s+दौरा|ऐंठन)', severity: 'CRITICAL', category: 'Medical', description: 'दौरे का आपातकाल' },
      // CRITICAL - Safety
      { phrase: 'आत्महत्या', pattern: '(आत्महत्या|खुदकुशी|मरना\\s+चाहता\\s+हूं|जीवन\\s+समाप्त\\s+करना)', severity: 'CRITICAL', category: 'Safety', description: 'आत्महत्या की धमकी' },
      // HIGH - Physical
      { phrase: 'गिर गया', pattern: '(गिर\\s+गया|गिर\\s+गई|फिसल\\s+गया)', severity: 'HIGH', category: 'Physical', description: 'गिरने की घटना' },
      { phrase: 'उठ नहीं सकता', pattern: '(उठ\\s+नहीं\\s+सकता|उठ\\s+नहीं\\s+सकती|खड़ा\\s+नहीं\\s+हो\\s+सकता)', severity: 'HIGH', category: 'Physical', description: 'गिरने के बाद उठ नहीं सकता' },
      // HIGH - Medical
      { phrase: 'सीने में दर्द', pattern: '(सीने\\s+में\\s+दर्द|छाती\\s+में\\s+दर्द|सीने\\s+में\\s+दबाव)', severity: 'HIGH', category: 'Medical', description: 'सीने में दर्द या दबाव' },
      // MEDIUM - Request
      { phrase: '911 पर कॉल करें', pattern: '(911\\s+पर\\s+कॉल\\s+करें|एम्बुलेंस\\s+बुलाएं|आपातकालीन\\s+सेवाएं)', severity: 'MEDIUM', category: 'Request', description: 'आपातकालीन सेवाओं का अनुरोध' },
      { phrase: 'मदद चाहिए', pattern: '(मदद\\s+चाहिए|मदद|बचाओ)', severity: 'MEDIUM', category: 'Request', description: 'मदद का अनुरोध' }
    ]
  };

  return phrasesByLanguage[language] || [];
}

/**
 * Seed emergency phrases for all supported languages
 * This ensures the database has all the emergency patterns even if they're not manually added
 */
async function seedEmergencyPhrases() {
  try {
    console.log('Seeding emergency phrases for all languages...');

    // Check if phrases already exist
    const existingCount = await EmergencyPhrase.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing emergency phrases. Skipping seed.`);
      console.log('   (To re-seed, delete existing phrases first)');
      return;
    }

    const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'hi', 'zh-cn']; // All supported languages
    const allPhrases = [];

    // Build phrases for all languages
    for (const lang of supportedLanguages) {
      const phrases = getPhrasesForLanguage(lang);
      for (const phrase of phrases) {
        allPhrases.push({
          ...phrase,
          language: lang,
          isActive: true,
          caseSensitive: false,
          createdBy: SYSTEM_USER_ID,
          lastModifiedBy: SYSTEM_USER_ID
        });
      }
    }

    // Insert all phrases
    const inserted = await EmergencyPhrase.insertMany(allPhrases);
    console.log(`✅ Seeded ${inserted.length} emergency phrases across ${supportedLanguages.length} languages`);

    // Log summary by language
    const byLanguage = inserted.reduce((acc, p) => {
      acc[p.language] = (acc[p.language] || 0) + 1;
      return acc;
    }, {});
    console.log('   Breakdown by language:');
    Object.entries(byLanguage).forEach(([lang, count]) => {
      console.log(`   - ${lang}: ${count} phrases`);
    });

    // Log summary by severity
    const bySeverity = inserted.reduce((acc, p) => {
      acc[p.severity] = (acc[p.severity] || 0) + 1;
      return acc;
    }, {});
    console.log('   Breakdown by severity:');
    Object.entries(bySeverity).forEach(([severity, count]) => {
      console.log(`   - ${severity}: ${count} phrases`);
    });

    return inserted;
  } catch (error) {
    logger.error('Error seeding emergency phrases:', error);
    throw error;
  }
}

module.exports = {
  seedEmergencyPhrases
};
