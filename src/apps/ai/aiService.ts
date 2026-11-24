import { GoogleGenAI } from '@google/genai';

const MODEL_NAME = 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 30_000;

export class ConfigError extends Error {
  constructor(message = 'GEMINI_API_KEY is not configured.') {
    super(message);
    this.name = 'ConfigError';
  }
}

export class AiServiceError extends Error {
  constructor(message = 'Failed to generate answer from Gemini API.') {
    super(message);
    this.name = 'AiServiceError';
  }
}

export const generateAnswer = async (question: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new ConfigError();
  }

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: question,
      config: {
        abortSignal: controller.signal,
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      throw new AiServiceError('Empty response received from Gemini API.');
    }

    return answer;
  } catch (error) {
    console.error('[aiService] Gemini API Error:', error);
    if (error instanceof ConfigError || error instanceof AiServiceError) {
      throw error;
    }
    throw new AiServiceError();
  } finally {
    clearTimeout(timeoutId);
  }
};