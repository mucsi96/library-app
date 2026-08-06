import { EXTRACTIONS } from './data';

interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: string;
  content: string | ContentPart[];
}

const dataUrlToBase64 = (url: string): string => url.split(',')[1] ?? '';

export const processMessages = (messages: ChatMessage[]) => {
  const userMessage = messages.find((message) => message.role === 'user');

  if (!userMessage || !Array.isArray(userMessage.content)) {
    throw new Error('Expected a user message with photo attachments');
  }

  const images = userMessage.content
    .filter((part) => part.type === 'image_url')
    .map((part) => dataUrlToBase64(part.image_url?.url ?? ''));

  if (images.length !== 2) {
    throw new Error(`Expected front and back photos, got ${images.length} image(s)`);
  }

  const extraction = EXTRACTIONS.find(({ frontImage }) => frontImage === images[0]);

  if (!extraction) {
    throw new Error('Unknown front photo submitted');
  }

  return {
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-5',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify(extraction.result),
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
};
