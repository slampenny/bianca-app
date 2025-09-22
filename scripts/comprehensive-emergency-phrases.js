const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const logger = require('../src/config/logger');

const comprehensivePhrases = [
  // English phrases (complete set from original emergencyDetector.js)
  { phrase: 'heart attack', pattern: '\\b(heart\\s+attack|heartattack)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'myocardial infarction', pattern: '\\b(myocardial\\s+infarction|mi)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: "can't breathe", pattern: "\\b(can'?t\\s+breathe|cannot\\s+breathe|can't\\s+breath|cannot\\s+breath)\\b", severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'choking', pattern: '\\b(choking|choke)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'stroke', pattern: '\\b(stroke|stroke\\s+symptoms)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'facial droop', pattern: '\\b(facial\\s+droop|drooping\\s+face)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'seizure', pattern: '\\b(seizure|seizing|having\\s+a\\s+seizure)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'anaphylaxis', pattern: '\\b(anaphylaxis|anaphylactic\\s+shock)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'overdose', pattern: '\\b(overdose|overdosed|drug\\s+overdose)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'poisoning', pattern: '\\b(poisoned|poisoning|ingested\\s+poison)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'loss of consciousness', pattern: '\\b(passed\\s+out|fainted|unconscious|lost\\s+consciousness)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'severe bleeding', pattern: '\\b(severe\\s+bleeding|heavy\\s+bleeding|bleeding\\s+heavily)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'hemorrhage', pattern: '\\b(hemorrhage|hemorrhaging)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
  { phrase: 'suicide', pattern: '\\b(suicide|killing\\s+myself|kill\\s+myself|want\\s+to\\s+die|end\\s+my\\s+life)\\b', severity: 'CRITICAL', category: 'Safety', language: 'en' },
  { phrase: 'self harm', pattern: '\\b(self\\s+harm|cutting\\s+myself|hurting\\s+myself)\\b', severity: 'CRITICAL', category: 'Safety', language: 'en' },
  { phrase: 'fell down', pattern: '\\b(i\\s+fell|fell\\s+down|i\\s+tripped|i\\s+slipped)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
  { phrase: "can't get up", pattern: "\\b(can'?t\\s+get\\s+up|unable\\s+to\\s+get\\s+up|cannot\\s+get\\s+up)\\b", severity: 'HIGH', category: 'Physical', language: 'en' },
  { phrase: 'hit my head', pattern: '\\b(hit\\s+my\\s+head|bumped\\s+my\\s+head|head\\s+injury)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
  { phrase: 'broken bone', pattern: '\\b(broken\\s+bone|fracture|broken\\s+arm|broken\\s+leg)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
  { phrase: 'severe pain', pattern: '\\b(severe\\s+pain|excruciating\\s+pain|unbearable\\s+pain)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'emergency pain', pattern: '\\b(emergency\\s+pain|urgent\\s+pain)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'chest pain', pattern: '\\b(chest\\s+pain|chest\\s+ache|chest\\s+aches|chest\\s+pressure)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'chest pressure', pattern: '\\b(pressure\\s+in\\s+chest|tightness\\s+in\\s+chest|pressure\\s+in\\s+my\\s+chest)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'intruder', pattern: '\\b(intruder|someone\\s+breaking\\s+in|burglar|break\\s+in)\\b', severity: 'HIGH', category: 'Safety', language: 'en' },
  { phrase: 'intruder in house', pattern: '\\b(someone\\s+in\\s+my\\s+house|stranger\\s+in\\s+house)\\b', severity: 'HIGH', category: 'Safety', language: 'en' },
  { phrase: 'feel sick', pattern: '\\b(feel\\s+sick|feeling\\s+sick|not\\s+feeling\\s+well)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'dizzy', pattern: '\\b(dizzy|lightheaded|vertigo)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'nausea', pattern: '\\b(nauseous|nausea|throwing\\s+up|vomiting)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'breathing difficulty', pattern: '\\b(difficulty\\s+breathing|trouble\\s+breathing|shortness\\s+of\\s+breath)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'severe allergic reaction', pattern: '\\b(severe\\s+allergic\\s+reaction)\\b', severity: 'MEDIUM', category: 'Medical', language: 'en' },
  { phrase: 'need help', pattern: '\\b(need\\s+help|i\\s+need\\s+help|help\\s+me)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  { phrase: 'call ambulance', pattern: '\\b(call\\s+ambulance|get\\s+help\\s+now|this\\s+is\\s+urgent)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  { phrase: 'call 911', pattern: '\\b(call\\s+911|call\\s+emergency|emergency\\s+services)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  { phrase: 'emergency services', pattern: '\\b(ambulance|paramedics|emergency\\s+room|er)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
  { phrase: 'medical emergency', pattern: '\\b(medical\\s+emergency|health\\s+emergency)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
  { phrase: 'life threatening', pattern: '\\b(life\\s+threatening|life\\s+or\\s+death)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },

  // Spanish phrases
  { phrase: 'ataque al corazón', pattern: '\\b(ataque\\s+al\\s+corazón|infarto)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'infarto de miocardio', pattern: '\\b(infarto\\s+de\\s+miocardio|im)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'no puedo respirar', pattern: '\\b(no\\s+puedo\\s+respirar)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'me estoy ahogando', pattern: '\\b(me\\s+estoy\\s+ahogando|ahogándome)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'derrame cerebral', pattern: '\\b(derrame\\s+cerebral|accidente\\s+cerebrovascular)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'caída facial', pattern: '\\b(caída\\s+facial|rostro\\s+caído)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'convulsión', pattern: '\\b(convulsión|convulsiones|tengo\\s+una\\s+convulsión)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'anafilaxis', pattern: '\\b(anafilaxis|shock\\s+anafiláctico)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'sobredosis', pattern: '\\b(sobredosis|sobredosis\\s+de\\s+droga)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'envenenamiento', pattern: '\\b(envenenado|envenenamiento|ingirió\\s+veneno)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'pérdida de conciencia', pattern: '\\b(se\\s+desmayó|desmayado|inconsciente|perdió\\s+el\\s+conocimiento)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'sangrado severo', pattern: '\\b(sangrado\\s+severo|sangrado\\s+abundante|sangrando\\s+mucho)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'hemorragia', pattern: '\\b(hemorragia|hemorragias)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
  { phrase: 'suicidio', pattern: '\\b(suicidio|matarme|quiero\\s+morir)\\b', severity: 'CRITICAL', category: 'Safety', language: 'es' },
  { phrase: 'autolesión', pattern: '\\b(autolesión|cortarme|lastimarme)\\b', severity: 'CRITICAL', category: 'Safety', language: 'es' },
  { phrase: 'me caí', pattern: '\\b(me\\s+caí|caí\\s+al\\s+suelo|me\\s+resbalé)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
  { phrase: 'no puedo levantarme', pattern: '\\b(no\\s+puedo\\s+levantarme|no\\s+me\\s+puedo\\s+levantar)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
  { phrase: 'me golpeé la cabeza', pattern: '\\b(me\\s+golpeé\\s+la\\s+cabeza|golpe\\s+en\\s+la\\s+cabeza)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
  { phrase: 'hueso roto', pattern: '\\b(hueso\\s+roto|fractura|brazo\\s+roto|pierna\\s+rota)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
  { phrase: 'dolor severo', pattern: '\\b(dolor\\s+severo|dolor\\s+insoportable)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
  { phrase: 'dolor de emergencia', pattern: '\\b(dolor\\s+de\\s+emergencia|dolor\\s+urgente)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
  { phrase: 'dolor en el pecho', pattern: '\\b(dolor\\s+en\\s+el\\s+pecho|dolor\\s+de\\s+pecho)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
  { phrase: 'presión en el pecho', pattern: '\\b(presión\\s+en\\s+el\\s+pecho|opresión\\s+en\\s+el\\s+pecho)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
  { phrase: 'intruso', pattern: '\\b(intruso|alguien\\s+entrando|ladrón)\\b', severity: 'HIGH', category: 'Safety', language: 'es' },
  { phrase: 'intruso en casa', pattern: '\\b(alguien\\s+en\\s+mi\\s+casa|extraño\\s+en\\s+casa)\\b', severity: 'HIGH', category: 'Safety', language: 'es' },
  { phrase: 'me siento mal', pattern: '\\b(me\\s+siento\\s+mal|no\\s+me\\s+siento\\s+bien)\\b', severity: 'MEDIUM', category: 'Medical', language: 'es' },
  { phrase: 'mareado', pattern: '\\b(mareado|mareos|vértigo)\\b', severity: 'MEDIUM', category: 'Medical', language: 'es' },
  { phrase: 'náuseas', pattern: '\\b(náuseas|vomitando|vómito)\\b', severity: 'MEDIUM', category: 'Medical', language: 'es' },
  { phrase: 'dificultad para respirar', pattern: '\\b(dificultad\\s+para\\s+respirar|problemas\\s+para\\s+respirar)\\b', severity: 'MEDIUM', category: 'Medical', language: 'es' },
  { phrase: 'reacción alérgica severa', pattern: '\\b(reacción\\s+alérgica\\s+severa)\\b', severity: 'MEDIUM', category: 'Medical', language: 'es' },
  { phrase: 'necesito ayuda', pattern: '\\b(necesito\\s+ayuda|ayúdame)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },
  { phrase: 'llamar ambulancia', pattern: '\\b(llamar\\s+ambulancia|necesito\\s+ayuda\\s+ahora|esto\\s+es\\s+urgente)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },
  { phrase: 'llamar emergencias', pattern: '\\b(llamar\\s+emergencias|servicios\\s+de\\s+emergencia)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },
  { phrase: 'servicios de emergencia', pattern: '\\b(ambulancia|paramédicos|sala\\s+de\\s+emergencias)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },
  { phrase: 'emergencia médica', pattern: '\\b(emergencia\\s+médica|emergencia\\s+de\\s+salud)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
  { phrase: 'amenaza de vida', pattern: '\\b(amenaza\\s+de\\s+vida|vida\\s+o\\s+muerte)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },

  // French phrases
  { phrase: 'crise cardiaque', pattern: '\\b(crise\\s+cardiaque|infarctus)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'infarctus du myocarde', pattern: '\\b(infarctus\\s+du\\s+myocarde|im)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'je ne peux pas respirer', pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+respirer|je\\s+peux\\s+pas\\s+respirer)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'je m\'étouffe', pattern: '\\b(je\\s+m\'étouffe|étouffement)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'accident vasculaire cérébral', pattern: '\\b(accident\\s+vasculaire\\s+cérébral|avc)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'paralysie faciale', pattern: '\\b(paralysie\\s+faciale|visage\\s+affaissé)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'convulsion', pattern: '\\b(convulsion|convulsions|j\'ai\\s+une\\s+convulsion)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'anaphylaxie', pattern: '\\b(anaphylaxie|choc\\s+anaphylactique)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'overdose', pattern: '\\b(overdose|surdose|overdose\\s+de\\s+drogue)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'empoisonnement', pattern: '\\b(empoisonné|empoisonnement|a\\s+ingéré\\s+du\\s+poison)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'perte de conscience', pattern: '\\b(s\'est\\s+évanoui|évanoui|inconscient|perdu\\s+connaissance)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'saignement sévère', pattern: '\\b(saignement\\s+sévère|saignement\\s+abondant|saigne\\s+beaucoup)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'hémorragie', pattern: '\\b(hémorragie|hémorragies)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
  { phrase: 'suicide', pattern: '\\b(suicide|me\\s+tuer|je\\s+veux\\s+mourir)\\b', severity: 'CRITICAL', category: 'Safety', language: 'fr' },
  { phrase: 'automutilation', pattern: '\\b(automutilation|me\\s+couper|me\\s+blesser)\\b', severity: 'CRITICAL', category: 'Safety', language: 'fr' },
  { phrase: 'je suis tombé', pattern: '\\b(je\\s+suis\\s+tombé|je\\s+suis\\s+tombée|je\\s+me\\s+suis\\s+cassé\\s+la\\s+figure)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
  { phrase: 'je ne peux pas me lever', pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+me\\s+lever|je\\s+peux\\s+pas\\s+me\\s+lever)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
  { phrase: 'je me suis cogné la tête', pattern: '\\b(je\\s+me\\s+suis\\s+cogné\\s+la\\s+tête|coup\\s+à\\s+la\\s+tête)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
  { phrase: 'os cassé', pattern: '\\b(os\\s+cassé|fracture|bras\\s+cassé|jambe\\s+cassée)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
  { phrase: 'douleur sévère', pattern: '\\b(douleur\\s+sévère|douleur\\s+insupportable)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
  { phrase: 'douleur d\'urgence', pattern: '\\b(douleur\\s+d\'urgence|douleur\\s+urgente)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
  { phrase: 'douleur à la poitrine', pattern: '\\b(douleur\\s+à\\s+la\\s+poitrine|mal\\s+à\\s+la\\s+poitrine)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
  { phrase: 'pression dans la poitrine', pattern: '\\b(pression\\s+dans\\s+la\\s+poitrine|oppression\\s+dans\\s+la\\s+poitrine)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
  { phrase: 'intrus', pattern: '\\b(intrus|quelqu\'un\\s+qui\\s+entre|cambrioleur)\\b', severity: 'HIGH', category: 'Safety', language: 'fr' },
  { phrase: 'intrus dans la maison', pattern: '\\b(quelqu\'un\\s+dans\\s+ma\\s+maison|étranger\\s+dans\\s+la\\s+maison)\\b', severity: 'HIGH', category: 'Safety', language: 'fr' },
  { phrase: 'je me sens mal', pattern: '\\b(je\\s+me\\s+sens\\s+mal|je\\s+ne\\s+me\\s+sens\\s+pas\\s+bien)\\b', severity: 'MEDIUM', category: 'Medical', language: 'fr' },
  { phrase: 'étourdi', pattern: '\\b(étourdi|étourdissements|vertige)\\b', severity: 'MEDIUM', category: 'Medical', language: 'fr' },
  { phrase: 'nausée', pattern: '\\b(nausée|nausées|vomir|vomissements)\\b', severity: 'MEDIUM', category: 'Medical', language: 'fr' },
  { phrase: 'difficulté à respirer', pattern: '\\b(difficulté\\s+à\\s+respirer|problème\\s+pour\\s+respirer)\\b', severity: 'MEDIUM', category: 'Medical', language: 'fr' },
  { phrase: 'réaction allergique sévère', pattern: '\\b(réaction\\s+allergique\\s+sévère)\\b', severity: 'MEDIUM', category: 'Medical', language: 'fr' },
  { phrase: 'j\'ai besoin d\'aide', pattern: '\\b(j\'ai\\s+besoin\\s+d\'aide|aidez-moi)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' },
  { phrase: 'appeler une ambulance', pattern: '\\b(appeler\\s+une\\s+ambulance|j\'ai\\s+besoin\\s+d\'aide\\s+maintenant|c\'est\\s+urgent)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' },
  { phrase: 'appeler les secours', pattern: '\\b(appeler\\s+les\\s+secours|services\\s+d\'urgence)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' },
  { phrase: 'services d\'urgence', pattern: '\\b(ambulance|paramédics|salle\\s+d\'urgence)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' },
  { phrase: 'urgence médicale', pattern: '\\b(urgence\\s+médicale|urgence\\s+de\\s+santé)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
  { phrase: 'menace de vie', pattern: '\\b(menace\\s+de\\s+vie|vie\\s+ou\\s+mort)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },

  // Hindi phrases
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
  { phrase: 'जीवन के लिए खतरा', pattern: 'जीवन के लिए खतरा', severity: 'CRITICAL', category: 'Medical', language: 'hi' },

  // Mandarin Chinese phrases (zh-cn)
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

const initializeComprehensivePhrases = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  logger.info('Connected to MongoDB');

  try {
    // Clear existing phrases
    await EmergencyPhrase.deleteMany({});
    logger.info('Cleared existing emergency phrases');

    // Create a system user ID for default phrases
    const systemUserId = '000000000000000000000000';

    const phrasesToCreate = comprehensivePhrases.map(phrase => ({
      ...phrase,
      createdBy: systemUserId,
      lastModifiedBy: systemUserId,
      isActive: true,
      description: `Default ${phrase.severity} ${phrase.category} phrase in ${phrase.language}`
    }));

    await EmergencyPhrase.insertMany(phrasesToCreate);
    logger.info(`Initialized ${phrasesToCreate.length} comprehensive emergency phrases across 12 languages`);
    
    // Log summary by language
    const summary = {};
    phrasesToCreate.forEach(phrase => {
      if (!summary[phrase.language]) {
        summary[phrase.language] = { total: 0, bySeverity: {} };
      }
      summary[phrase.language].total++;
      summary[phrase.language].bySeverity[phrase.severity] = (summary[phrase.language].bySeverity[phrase.severity] || 0) + 1;
    });
    
    logger.info('Phrase summary by language:', summary);
  } catch (error) {
    logger.error('Error initializing comprehensive phrases:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

initializeComprehensivePhrases();
