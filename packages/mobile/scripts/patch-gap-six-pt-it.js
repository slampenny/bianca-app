#!/usr/bin/env node
/** Fix French bleed in pt.json and it.json using es.json + manual overrides */
const fs = require("fs")
const path = require("path")

const GAP = path.join(__dirname, "gap-six")
const fr = require("../app/i18n/gaps/fr.json")
const es = require("../app/i18n/gaps/es.json")

const ptManual = {
  "homeScreen.glanceNoData": "—",
  "onboarding.aboutYou.agingInPlace": "Envelhecimento no lar",
  "onboarding.aboutYou.caregiver": "Cuidador",
  "onboarding.aboutYou.organization": "Organização",
  "onboarding.aboutYou.subtitle": "Isso nos ajuda a personalizar sua experiência.",
  "onboarding.aboutYou.title": "Conte-nos um pouco sobre você",
  "onboarding.orgInfo.countryLabel": "País",
  "onboarding.orgInfo.orgNameLabel": "Nome da organização",
  "onboarding.orgInfo.orgNamePlaceholder": "Digite o nome da sua organização",
  "onboarding.orgInfo.subtitle": "Conte-nos sobre sua organização.",
  "onboarding.orgInfo.timezoneLabel": "Fuso horário",
  "onboarding.orgInfo.title": "Informações da organização",
  "onboarding.termsAndConsent.acceptTerms": "Li e aceito os",
  "onboarding.termsAndConsent.acceptTermsLabel": "Aceitar Termos de Serviço e Política de Privacidade",
  "onboarding.termsAndConsent.and": "e a",
  "onboarding.termsAndConsent.no": "Não",
  "onboarding.termsAndConsent.privacyLink": "Política de Privacidade",
  "onboarding.termsAndConsent.saveAndContinue": "Salvar e continuar",
  "onboarding.termsAndConsent.singleConsentQuestion":
    "Você está em um estado de consentimento unilateral? (Apenas uma parte precisa consentir com a gravação.)",
  "onboarding.termsAndConsent.termsLink": "Termos de Serviço",
  "onboarding.termsAndConsent.title": "Termos e consentimento",
  "onboarding.termsAndConsent.whyImportant": "Por que isso é importante?",
  "onboarding.termsAndConsent.whyImportantBody":
    "As leis de gravação de chamadas variam por estado e país. Em estados de consentimento unilateral, apenas uma pessoa precisa concordar com a gravação. Em estados de duas partes, todos na chamada devem consentir. Configurar corretamente mantém você e sua organização em conformidade.",
  "onboarding.termsAndConsent.yes": "Sim",
  "orgScreen.alertOnAllMissedCallsHelper": "Enviar alertas para cada chamada perdida e tentativa de reenvio",
  "orgScreen.alertOnAllMissedCallsLabel": "Alertar em todas as chamadas perdidas",
  "orgScreen.callRetrySettings": "Configurações de reenvio de chamada",
  "orgScreen.clientConsentSettings": "Configurações de consentimento do cliente",
  "orgScreen.country": "País",
  "orgScreen.countryHelper":
    "Selecione o país da sua organização. Isso ajuda a determinar as regulamentações de privacidade aplicáveis.",
  "orgScreen.enableRetriesHelper": "Quando ativado, o sistema reenviará automaticamente chamadas com falha",
  "orgScreen.enableRetriesLabel": "Ativar reenvio de chamadas",
  "orgScreen.retryCountHelper": "Número de vezes para reenviar se a chamada não for atendida (1-5)",
  "orgScreen.retryCountLabel": "Número de reenvios",
  "orgScreen.retryIntervalMinutesHelper": "Tempo de espera entre tentativas (1-60 minutos, padrão: 15)",
  "orgScreen.retryIntervalMinutesLabel": "Intervalo de reenvio (minutos)",
  "orgScreen.timezone": "Fuso horário",
  "orgScreen.timezoneHelper":
    "Selecione o fuso horário da sua organização. Os horários da agenda serão baseados neste fuso horário.",
  "phoneVerificationScreen.codeResent": "Código de verificação reenviado!",
  "phoneVerificationScreen.codeSent": "Código de verificação enviado!",
  "phoneVerificationScreen.didntReceiveCode": "Não recebeu o código?",
  "phoneVerificationScreen.errorResendingCode": "Falha ao reenviar o código de verificação. Tente novamente.",
  "phoneVerificationScreen.errorSendingCode": "Falha ao enviar o código de verificação. Tente novamente.",
  "phoneVerificationScreen.errorVerifyingCode": "Código de verificação inválido. Tente novamente.",
  "phoneVerificationScreen.invalidCode": "Digite um código de 6 dígitos",
  "phoneVerificationScreen.message":
    "Enviamos um código de verificação de 6 dígitos para {{phone}}. Digite-o abaixo.",
  "phoneVerificationScreen.resendAvailableIn": "Reenvio disponível em",
  "phoneVerificationScreen.resendButton": "Reenviar código",
  "phoneVerificationScreen.sendCodeButton": "Enviar código de verificação",
  "phoneVerificationScreen.title": "Verifique seu telefone",
  "phoneVerificationScreen.verifyButton": "Verificar telefone",
  "privacyRequestScreen.accessMethodDownload": "Download",
  "privacyRequestScreen.accessMethodEmail": "E-mail",
  "privacyRequestScreen.accessMethodInfo": "Seus dados serão enviados por e-mail como anexo JSON.",
  "privacyRequestScreen.accessMethodLabel": "Como você gostaria de receber seus dados?",
  "privacyRequestScreen.additionalInformationLabel": "Informações adicionais (opcional)",
  "privacyRequestScreen.complaintDescriptionLabel": "Descrição *",
  "privacyRequestScreen.complaintDescriptionPlaceholder":
    "Forneça detalhes da sua reclamação, incluindo o que aconteceu e quando.",
  "privacyRequestScreen.complaintFieldsRequired": "Preencha o assunto e a descrição.",
  "privacyRequestScreen.complaintHistoryTitle": "Histórico de reclamações",
  "privacyRequestScreen.complaintRequestDescription":
    "Se você acredita que não tratamos suas informações pessoais de acordo com as leis de privacidade, pode registrar uma reclamação. Investigaremos e responderemos em 30 dias.",
  "privacyRequestScreen.complaintRequestTitle": "Reclamação de privacidade",
  "privacyRequestScreen.complaintSubjectLabel": "Assunto *",
  "privacyRequestScreen.complaintSubjectPlaceholder": "Breve descrição da sua reclamação",
  "privacyRequestScreen.complaintSubmitted":
    "Sua reclamação foi enviada. Investigaremos e responderemos em 30 dias.",
  "privacyRequestScreen.completedOn": "Concluído em",
  "privacyRequestScreen.confirmDelete": "Excluir",
  "privacyRequestScreen.correctionFieldLabel": "Campo a corrigir",
  "privacyRequestScreen.correctionFieldPlaceholder": "ex.: E-mail, Telefone, Nome",
  "privacyRequestScreen.correctionFieldsRequired": "Preencha o nome do campo e o valor solicitado.",
  "privacyRequestScreen.correctionNote":
    "Nota: A maioria dos dados pode ser editada diretamente no app. Use este formulário para dados que não podem ser editados, como registros históricos ou gerados pelo sistema.",
  "privacyRequestScreen.correctionReasonLabel": "Motivo da correção (opcional)",
  "privacyRequestScreen.correctionReasonPlaceholder": "Por que essas informações precisam ser corrigidas?",
  "privacyRequestScreen.correctionRequestDescription":
    "Solicite uma correção das suas informações pessoais. Informe o que precisa ser corrigido.",
  "privacyRequestScreen.correctionRequestSubmitted":
    "Sua solicitação de correção foi enviada. Analisaremos e processaremos em 30 dias.",
  "privacyRequestScreen.correctionRequestTitle": "Solicitação de correção de dados",
  "privacyRequestScreen.currentValue": "Valor atual",
  "privacyRequestScreen.currentValueLabel": "Valor atual (opcional)",
  "privacyRequestScreen.currentValuePlaceholder": "Qual é o valor atual?",
  "privacyRequestScreen.deletionCompleted": "Exclusão de dados concluída com sucesso.",
  "privacyRequestScreen.deletionConfirmMessage":
    "Isso excluirá permanentemente seus dados. Esta ação não pode ser desfeita. Tem certeza de que deseja continuar?",
  "privacyRequestScreen.deletionConfirmTitle": "Confirmar exclusão de dados",
  "privacyRequestScreen.deletionDataTypeLabel": "Quais dados você deseja excluir?",
  "privacyRequestScreen.deletionFailed":
    "Falha ao excluir dados. Isso pode não estar disponível na sua jurisdição devido a requisitos legais de retenção.",
  "privacyRequestScreen.deletionRequestDescription":
    "De acordo com a PIPEDA, você pode solicitar a exclusão das suas informações pessoais. Nota: a HIPAA exige retenção de 7 anos, portanto a exclusão pode não estar disponível em todas as jurisdições.",
  "privacyRequestScreen.deletionRequestTitle": "Solicitar exclusão de dados",
  "privacyRequestScreen.deletionTypeAll": "Todos os dados",
  "privacyRequestScreen.deletionTypeCalls": "Somente chamadas",
  "privacyRequestScreen.deletionTypeConversations": "Somente conversas",
  "privacyRequestScreen.deletionTypeMedicalAnalysis": "Somente análise médica",
  "privacyRequestScreen.field": "Campo",
  "privacyRequestScreen.filedOn": "Registrado em",
  "privacyRequestScreen.informationRequestedLabel": "Informações solicitadas",
  "privacyRequestScreen.informationRequestedPlaceholder":
    "Todas as minhas informações pessoais (ou especifique o que precisa)",
  "privacyRequestScreen.reason": "Motivo",
  "privacyRequestScreen.requestDataDescription":
    "Descreva quais informações você gostaria de acessar. Deixe em branco para solicitar todas as suas informações pessoais.",
  "privacyRequestScreen.requestDataTitle": "Solicitação de acesso a dados",
  "privacyRequestScreen.requestDeletion": "Solicitar exclusão de dados",
  "privacyRequestScreen.requestFailed": "Falha ao enviar a solicitação. Tente novamente.",
  "privacyRequestScreen.requestHistoryTitle": "Histórico de solicitações",
  "privacyRequestScreen.requestSubmitted":
    "Sua solicitação de dados foi enviada. Você receberá um e-mail com seus dados em breve.",
  "privacyRequestScreen.requestTypeAccess": "Solicitação de acesso",
  "privacyRequestScreen.requestTypeComplaint": "Registrar reclamação",
  "privacyRequestScreen.requestTypeCorrection": "Solicitação de correção",
  "privacyRequestScreen.requestedOn": "Solicitado em",
  "privacyRequestScreen.requestedValue": "Valor solicitado",
  "privacyRequestScreen.requestedValueLabel": "Valor solicitado *",
  "privacyRequestScreen.requestedValuePlaceholder": "Qual deve ser o valor corrigido?",
  "privacyRequestScreen.resolvedOn": "Resolvido em",
  "privacyRequestScreen.submitRequest": "Enviar solicitação",
  "privacyRequestScreen.subtitle":
    "De acordo com a PIPEDA, você tem o direito de acessar e corrigir suas informações pessoais. Envie uma solicitação para acessar ou corrigir seus dados.",
  "privacyRequestScreen.title": "Solicitar meus dados",
  "privacyRequestScreen.violationTypeAccess": "Problema de acesso",
  "privacyRequestScreen.violationTypeLabel": "Tipo de problema (opcional)",
  "privacyRequestScreen.violationTypeOther": "Outro",
  "profileScreen.emailManagedBySSO":
    "O e-mail é gerenciado pelo seu provedor de login e não pode ser alterado.",
  "profileScreen.requestMyData": "Solicitar meus dados",
  "profileScreen.verificationEmailFailed": "Falha ao enviar o e-mail de verificação. Tente novamente.",
  "profileScreen.verificationEmailSent": "E-mail de verificação enviado! Verifique sua caixa de entrada.",
  "profileScreen.verifyEmail": "Verificar e-mail",
  "profileScreen.verifyPhoneBannerMessage":
    "Verifique seu número de telefone para receber alertas de emergência e notificações importantes. Você pode continuar usando o app com um telefone não verificado.",
  "registerScreen.countryFieldLabel": "País",
  "schedulesScreen.errorSavingSchedule": "Erro ao salvar a agenda.",
  "schedulesScreen.invalidScheduleError":
    "Preencha todos os campos obrigatórios da agenda (frequência, horário e dias para agendas semanais/mensais).",
  "schedulesScreen.newSchedule": "Nova agenda",
  "sentimentAnalysis.noRecentCallButHaveCalls": "Chamadas recentes, sem análise de sentimento ainda",
  "sentimentAnalysis.noRecentCallButHaveCallsMessage":
    "Você tem chamadas recentes nos últimos 30 dias, mas nenhuma tem análise de sentimento ainda. Novas chamadas serão analisadas automaticamente ao terminar. Chamadas antigas podem precisar ser reprocessadas.",
  "themes.highcontrast.description": "Tema de máximo contraste para deficiência visual (WCAG AAA)",
  "themes.highcontrast.name": "Alto contraste",
}

const itManual = {
  "homeScreen.glanceNoData": "—",
  "onboarding.aboutYou.agingInPlace": "Invecchiamento a domicilio",
  "onboarding.aboutYou.caregiver": "Caregiver",
  "onboarding.aboutYou.organization": "Organizzazione",
  "onboarding.aboutYou.subtitle": "Ci aiuta a personalizzare la tua esperienza.",
  "onboarding.aboutYou.title": "Raccontaci qualcosa di te",
  "onboarding.orgInfo.countryLabel": "Paese",
  "onboarding.orgInfo.orgNameLabel": "Nome organizzazione",
  "onboarding.orgInfo.orgNamePlaceholder": "Inserisci il nome della tua organizzazione",
  "onboarding.orgInfo.subtitle": "Parlaci della tua organizzazione.",
  "onboarding.orgInfo.timezoneLabel": "Fuso orario",
  "onboarding.orgInfo.title": "Informazioni sull'organizzazione",
  "onboarding.termsAndConsent.acceptTerms": "Ho letto e accetto i",
  "onboarding.termsAndConsent.acceptTermsLabel": "Accetta Termini di servizio e Informativa sulla privacy",
  "onboarding.termsAndConsent.and": "e l'",
  "onboarding.termsAndConsent.no": "No",
  "onboarding.termsAndConsent.privacyLink": "Informativa sulla privacy",
  "onboarding.termsAndConsent.saveAndContinue": "Salva e continua",
  "onboarding.termsAndConsent.singleConsentQuestion":
    "Sei in uno stato con consenso unilaterale? (Solo una parte deve acconsentire alla registrazione.)",
  "onboarding.termsAndConsent.termsLink": "Termini di servizio",
  "onboarding.termsAndConsent.title": "Termini e consenso",
  "onboarding.termsAndConsent.whyImportant": "Perché è importante?",
  "onboarding.termsAndConsent.whyImportantBody":
    "Le leggi sulla registrazione delle chiamate variano per stato e paese. Negli stati a consenso unilaterale, solo una persona deve acconsentire. Negli stati a due parti, tutti devono acconsentire. Impostarlo correttamente mantiene la conformità.",
  "onboarding.termsAndConsent.yes": "Sì",
  "orgScreen.alertOnAllMissedCallsHelper":
    "Invia avvisi per ogni chiamata persa e ogni tentativo di richiamata",
  "orgScreen.alertOnAllMissedCallsLabel": "Avvisa per tutte le chiamate perse",
  "orgScreen.callRetrySettings": "Impostazioni richiamata",
  "orgScreen.clientConsentSettings": "Impostazioni consenso cliente",
  "orgScreen.country": "Paese",
  "orgScreen.countryHelper":
    "Seleziona il paese della tua organizzazione. Aiuta a determinare le normative sulla privacy applicabili.",
  "orgScreen.enableRetriesHelper":
    "Quando attivato, il sistema richiama automaticamente le chiamate non riuscite",
  "orgScreen.enableRetriesLabel": "Attiva richiamate",
  "orgScreen.retryCountHelper": "Numero di tentativi se la chiamata non viene risposta (1-5)",
  "orgScreen.retryCountLabel": "Numero di richiamate",
  "orgScreen.retryIntervalMinutesHelper":
    "Tempo di attesa tra i tentativi (1-60 minuti, predefinito: 15)",
  "orgScreen.retryIntervalMinutesLabel": "Intervallo richiamata (minuti)",
  "orgScreen.timezone": "Fuso orario",
  "orgScreen.timezoneHelper":
    "Seleziona il fuso orario della tua organizzazione. Gli orari del programma saranno basati su questo fuso orario.",
  "phoneVerificationScreen.codeResent": "Codice di verifica reinviato!",
  "phoneVerificationScreen.codeSent": "Codice di verifica inviato!",
  "phoneVerificationScreen.didntReceiveCode": "Non hai ricevuto il codice?",
  "phoneVerificationScreen.errorResendingCode": "Impossibile rinviare il codice di verifica. Riprova.",
  "phoneVerificationScreen.errorSendingCode": "Impossibile inviare il codice di verifica. Riprova.",
  "phoneVerificationScreen.errorVerifyingCode": "Codice di verifica non valido. Riprova.",
  "phoneVerificationScreen.invalidCode": "Inserisci un codice a 6 cifre",
  "phoneVerificationScreen.message":
    "Abbiamo inviato un codice di verifica a 6 cifre a {{phone}}. Inseriscilo di seguito.",
  "phoneVerificationScreen.resendAvailableIn": "Reinvio disponibile tra",
  "phoneVerificationScreen.resendButton": "Reinvia codice",
  "phoneVerificationScreen.sendCodeButton": "Invia codice di verifica",
  "phoneVerificationScreen.title": "Verifica il telefono",
  "phoneVerificationScreen.verifyButton": "Verifica telefono",
  "privacyRequestScreen.accessMethodDownload": "Download",
  "privacyRequestScreen.accessMethodEmail": "E-mail",
  "privacyRequestScreen.accessMethodInfo": "I tuoi dati ti saranno inviati via e-mail come allegato JSON.",
  "privacyRequestScreen.accessMethodLabel": "Come desideri ricevere i tuoi dati?",
  "privacyRequestScreen.additionalInformationLabel": "Informazioni aggiuntive (facoltativo)",
  "privacyRequestScreen.complaintDescriptionLabel": "Descrizione *",
  "privacyRequestScreen.complaintDescriptionPlaceholder":
    "Fornisci i dettagli del reclamo, incluso cosa è successo e quando.",
  "privacyRequestScreen.complaintFieldsRequired": "Compila oggetto e descrizione.",
  "privacyRequestScreen.complaintHistoryTitle": "Cronologia reclami",
  "privacyRequestScreen.complaintRequestDescription":
    "Se ritieni che non abbiamo trattato i tuoi dati personali conformemente alle leggi sulla privacy, puoi presentare un reclamo. Indagheremo e risponderemo entro 30 giorni.",
  "privacyRequestScreen.complaintRequestTitle": "Reclamo sulla privacy",
  "privacyRequestScreen.complaintSubjectLabel": "Oggetto *",
  "privacyRequestScreen.complaintSubjectPlaceholder": "Breve descrizione del reclamo",
  "privacyRequestScreen.complaintSubmitted":
    "Il reclamo è stato inviato. Indagheremo e risponderemo entro 30 giorni.",
  "privacyRequestScreen.completedOn": "Completato il",
  "privacyRequestScreen.confirmDelete": "Elimina",
  "privacyRequestScreen.correctionFieldLabel": "Campo da correggere",
  "privacyRequestScreen.correctionFieldPlaceholder": "es. E-mail, Telefono, Nome",
  "privacyRequestScreen.correctionFieldsRequired": "Compila il nome del campo e il valore richiesto.",
  "privacyRequestScreen.correctionNote":
    "Nota: La maggior parte dei dati può essere modificata direttamente nell'app. Usa questo modulo per dati non modificabili, come registri storici o generati dal sistema.",
  "privacyRequestScreen.correctionReasonLabel": "Motivo della correzione (facoltativo)",
  "privacyRequestScreen.correctionReasonPlaceholder": "Perché queste informazioni devono essere corrette?",
  "privacyRequestScreen.correctionRequestDescription":
    "Richiedi una correzione dei tuoi dati personali. Indica cosa deve essere corretto.",
  "privacyRequestScreen.correctionRequestSubmitted":
    "La richiesta di correzione è stata inviata. La esamineremo e la elaboreremo entro 30 giorni.",
  "privacyRequestScreen.correctionRequestTitle": "Richiesta di correzione dati",
  "privacyRequestScreen.currentValue": "Valore attuale",
  "privacyRequestScreen.currentValueLabel": "Valore attuale (facoltativo)",
  "privacyRequestScreen.currentValuePlaceholder": "Qual è il valore attuale?",
  "privacyRequestScreen.deletionCompleted": "Eliminazione dati completata con successo.",
  "privacyRequestScreen.deletionConfirmMessage":
    "Questo eliminerà permanentemente i tuoi dati. Questa azione non può essere annullata. Sei sicuro di voler procedere?",
  "privacyRequestScreen.deletionConfirmTitle": "Conferma eliminazione dati",
  "privacyRequestScreen.deletionDataTypeLabel": "Quali dati desideri eliminare?",
  "privacyRequestScreen.deletionFailed":
    "Impossibile eliminare i dati. Potrebbe non essere disponibile nella tua giurisdizione a causa di requisiti legali di conservazione.",
  "privacyRequestScreen.deletionRequestDescription":
    "Ai sensi della PIPEDA, puoi richiedere l'eliminazione dei tuoi dati personali. Nota: HIPAA richiede la conservazione per 7 anni, quindi l'eliminazione potrebbe non essere disponibile in tutte le giurisdizioni.",
  "privacyRequestScreen.deletionRequestTitle": "Richiedi eliminazione dati",
  "privacyRequestScreen.deletionTypeAll": "Tutti i dati",
  "privacyRequestScreen.deletionTypeCalls": "Solo chiamate",
  "privacyRequestScreen.deletionTypeConversations": "Solo conversazioni",
  "privacyRequestScreen.deletionTypeMedicalAnalysis": "Solo analisi medica",
  "privacyRequestScreen.field": "Campo",
  "privacyRequestScreen.filedOn": "Presentato il",
  "privacyRequestScreen.informationRequestedLabel": "Informazioni richieste",
  "privacyRequestScreen.informationRequestedPlaceholder":
    "Tutti i miei dati personali (o specifica cosa ti serve)",
  "privacyRequestScreen.reason": "Motivo",
  "privacyRequestScreen.requestDataDescription":
    "Descrivi a quali informazioni desideri accedere. Lascia vuoto per richiedere tutti i tuoi dati personali.",
  "privacyRequestScreen.requestDataTitle": "Richiesta di accesso ai dati",
  "privacyRequestScreen.requestDeletion": "Richiedi eliminazione dati",
  "privacyRequestScreen.requestFailed": "Impossibile inviare la richiesta. Riprova.",
  "privacyRequestScreen.requestHistoryTitle": "Cronologia richieste",
  "privacyRequestScreen.requestSubmitted":
    "La richiesta dati è stata inviata. Riceverai presto un'e-mail con i tuoi dati.",
  "privacyRequestScreen.requestTypeAccess": "Richiesta di accesso",
  "privacyRequestScreen.requestTypeComplaint": "Presenta reclamo",
  "privacyRequestScreen.requestTypeCorrection": "Richiesta di correzione",
  "privacyRequestScreen.requestedOn": "Richiesto il",
  "privacyRequestScreen.requestedValue": "Valore richiesto",
  "privacyRequestScreen.requestedValueLabel": "Valore richiesto *",
  "privacyRequestScreen.requestedValuePlaceholder": "Qual deve essere il valore corretto?",
  "privacyRequestScreen.resolvedOn": "Risolto il",
  "privacyRequestScreen.submitRequest": "Invia richiesta",
  "privacyRequestScreen.subtitle":
    "Ai sensi della PIPEDA, hai il diritto di accedere e correggere i tuoi dati personali. Invia una richiesta per accedere o correggere i tuoi dati.",
  "privacyRequestScreen.title": "Richiedi i miei dati",
  "privacyRequestScreen.violationTypeAccess": "Problema di accesso",
  "privacyRequestScreen.violationTypeLabel": "Tipo di problema (facoltativo)",
  "privacyRequestScreen.violationTypeOther": "Altro",
  "profileScreen.emailManagedBySSO":
    "L'e-mail è gestita dal tuo provider di accesso e non può essere modificata.",
  "profileScreen.requestMyData": "Richiedi i miei dati",
  "profileScreen.verificationEmailFailed": "Impossibile inviare l'e-mail di verifica. Riprova.",
  "profileScreen.verificationEmailSent": "E-mail di verifica inviata! Controlla la posta in arrivo.",
  "profileScreen.verifyEmail": "Verifica e-mail",
  "profileScreen.verifyPhoneBannerMessage":
    "Verifica il tuo numero di telefono per ricevere avvisi di emergenza e notifiche importanti. Puoi continuare a usare l'app con un numero non verificato.",
  "registerScreen.countryFieldLabel": "Paese",
  "schedulesScreen.errorSavingSchedule": "Errore durante il salvataggio del programma.",
  "schedulesScreen.invalidScheduleError":
    "Compila tutti i campi obbligatori del programma (frequenza, ora e giorni per programmi settimanali/mensili).",
  "schedulesScreen.newSchedule": "Nuovo programma",
  "sentimentAnalysis.noRecentCallButHaveCalls": "Chiamate recenti, sentimento non ancora disponibile",
  "sentimentAnalysis.noRecentCallButHaveCallsMessage":
    "Hai chiamate recenti negli ultimi 30 giorni, ma nessuna ha ancora analisi del sentimento. Le nuove chiamate saranno analizzate automaticamente al termine. Le più vecchie potrebbero richiedere rielaborazione.",
  "themes.highcontrast.description": "Tema a massimo contrasto per deficit visivo (WCAG AAA)",
  "themes.highcontrast.name": "Alto contrasto",
}

function patch(code, manual) {
  const file = path.join(GAP, `${code}.json`)
  const data = JSON.parse(fs.readFileSync(file, "utf8"))
  let fixed = 0
  for (const k of Object.keys(data)) {
    if (data[k] === fr[k] && manual[k]) {
      data[k] = manual[k]
      fixed++
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
  const remaining = Object.keys(data).filter((k) => data[k] === fr[k]).length
  console.log(`${code}.json: fixed ${fixed}, fr bleed remaining: ${remaining}`)
}

patch("pt", ptManual)
patch("it", itManual)
