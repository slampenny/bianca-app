// Core Services
module.exports.alertService = require('./alert.service');
module.exports.authService = require('./auth.service');
module.exports.chatService = require('./chat.service');
module.exports.caregiverService = require('./caregiver.service');
module.exports.conversationService = require('./conversation.service');
module.exports.emailService = require('./email.service');
module.exports.emergencyPhraseService = require('./emergencyPhrase.service');
module.exports.orgService = require('./org.service');
module.exports.patientService = require('./patient.service');
module.exports.paymentService = require('./payment.service');
module.exports.paymentMethodService = require('./paymentMethod.service');
module.exports.scheduleService = require('./schedule.service');
module.exports.testService = require('./test.service');
module.exports.tokenService = require('./token.service');
module.exports.twilioCallService = require('./twilioCall.service');
module.exports.callService = require('./call.service');

// AI Services
module.exports.openaiService = require('./openai.realtime.service');
module.exports.openaiSentimentService = require('./openai.sentiment.service');

// AI Analysis Services
module.exports.medicalPatternAnalyzer = require('./ai/medicalPatternAnalyzer.service');
module.exports.baselineManager = require('./ai/baselineManager.service');
module.exports.medicalAnalysisScheduler = require('./ai/medicalAnalysisScheduler.service');
module.exports.cognitiveDeclineDetector = require('./ai/cognitiveDeclineDetector.service');
module.exports.psychiatricMarkerAnalyzer = require('./ai/psychiatricMarkerAnalyzer.service');
module.exports.psychiatricPatternDetector = require('./ai/psychiatricPatternDetector.service');
module.exports.repetitionMemoryAnalyzer = require('./ai/repetitionMemoryAnalyzer.service');
module.exports.speechPatternAnalyzer = require('./ai/speechPatternAnalyzer.service');
module.exports.vocabularyAnalyzer = require('./ai/vocabularyAnalyzer.service');

// Voice & Audio Services
// Note: ari.client exports functions (startAriClient, getAriClientInstance, shutdownAriClient)
// and should be imported directly: const { startAriClient } = require('./services/ari.client');
module.exports.ariClient = require('./ari.client');
module.exports.rtpListenerService = require('./rtp.listener.service');
module.exports.rtpSenderService = require('./rtp.sender.service');
module.exports.portManagerService = require('./port.manager.service');
module.exports.audioDiagnosticService = require('./audio.diagnostic.service');

// Emergency Services
module.exports.emergencyProcessor = require('./emergencyProcessor.service');
module.exports.localizedEmergencyDetector = require('./localizedEmergencyDetector.service');

// Storage Services
module.exports.s3Service = require('./s3.service');
module.exports.snsService = require('./sns.service');

// Other Services
module.exports.channelTracker = require('./channel.tracker');
module.exports.etherealEmailRetriever = require('./etherealEmailRetriever.service');
module.exports.analysisService = require('./analysis.service');
module.exports.reportService = require('./report.service');
module.exports.cacheService = require('./cache.service');

// HIPAA Compliance Services
module.exports.mfaService = require('./mfa.service');
module.exports.breachDetectionService = require('./breachDetection.service');
