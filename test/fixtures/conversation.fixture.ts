// conversation.fixture.ts
import { Conversation, Message } from '../../app/services/api/api.types';

export function newConversation(patientId: string): Partial<Conversation> {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 60000); // 1 minute later

  // Create some default messages
  const messages: Message[] = [
    { role: 'patient', content: 'Hello, I need some assistance.' },
    { role: 'doctor', content: 'Sure, how can I help you today?' },
  ];

  return {
    callSid: `TEST_CALL_SID_${Date.now()}`,
    patientId,
    lineItemId: null,
    messages,
    history: 'Test conversation history',
    analyzedData: {},
    metadata: {},
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: 60,
  };
}
