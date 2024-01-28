const sinon = require('sinon');
const twilioCallService = require('../../../src/services/twilioCall.service');
const User = require('../../src/models/user.model');
const Call = require('../../src/models/call.model');
const twilioClient = twilioCallService.twilioClient;
const openAiService = require('../../src/services/openAi.service');

describe('twilioCallService', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('initiateCall', () => {
        it('should initiate a call and save call details', async () => {
            const user = { _id: 'userId', phoneNumber: '1234567890' };
            const call = { sid: 'callSid' };
            sinon.stub(User, 'findById').resolves(user);
            sinon.stub(twilioClient.calls, 'create').resolves(call);
            sinon.stub(Call.prototype, 'save').resolves();

            const result = await twilioCallService.initiateCall(user._id);

            expect(result).toEqual(call.sid);
            expect(User.findById.calledWith(user._id)).toBeTruthy();
            expect(twilioClient.calls.create.calledWith({
                to: user.phoneNumber,
                from: config.twilio.phoneNumber,
                url: config.twilio.voiceUrl
            })).toBeTruthy();
            expect(Call.prototype.save.calledOnce).toBeTruthy();
        });
    });

    describe('handleIncomingCall', () => {
        it('should handle an incoming call and generate TwiML instructions', async () => {
            const callData = { input: 'Hello' };
            const response = 'Hello, how can I help you?';
            sinon.stub(openAiService, 'getResponse').resolves(response);

            const result = await twilioCallService.handleIncomingCall(callData);

            expect(result).toContain(response);
            expect(openAiService.getResponse.calledWith(callData.input)).toBeTruthy();
        });
    });

    describe('handleRealTimeConversation', () => {
        it('should handle real-time conversation during the call', async () => {
            const callSid = 'callSid';
            const userInput = 'Hello';
            const transcribedText = 'Hello';
            const chatGptResponse = 'Hello, how can I help you?';
            const speechUrl = 'http://example.com/speech.mp3';
            sinon.stub(openAiService, 'transcribeSpeech').resolves(transcribedText);
            sinon.stub(openAiService, 'chatWithGpt').resolves(chatGptResponse);
            sinon.stub(openAiService, 'textToSpeech').resolves(speechUrl);
            sinon.stub(twilioClient.calls(callSid), 'update').resolves();

            await twilioCallService.handleRealTimeConversation(callSid, userInput);

            expect(openAiService.transcribeSpeech.calledWith(userInput)).toBeTruthy();
            expect(openAiService.chatWithGpt.calledWith(transcribedText)).toBeTruthy();
            expect(openAiService.textToSpeech.calledWith(chatGptResponse)).toBeTruthy();
            expect(twilioClient.calls(callSid).update.calledWith({ url: `${config.twilio.playbackUrl}?SpeechUrl=${encodeURIComponent(speechUrl)}` })).toBeTruthy();
        });
    });
});