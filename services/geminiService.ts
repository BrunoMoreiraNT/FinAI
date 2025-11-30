import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { Transaction, TransactionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const transactionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: [TransactionType.EXPENSE, TransactionType.INCOME],
      description: "Se é uma despesa (EXPENSE) ou receita (INCOME)."
    },
    amount: {
      type: Type.NUMBER,
      description: "O valor numérico da transação."
    },
    category: {
      type: Type.STRING,
      description: "A categoria da transação (ex: Alimentação, Transporte, Salário, Contas). Infira se não for explícito."
    },
    description: {
      type: Type.STRING,
      description: "Uma breve descrição do que foi comprado ou a fonte de renda."
    },
    date: {
      type: Type.STRING,
      description: "A data da transação no formato ISO 8601 (YYYY-MM-DD). Se o usuário disser 'hoje', use a data atual."
    }
  },
  required: ["type", "amount", "category", "description", "date"]
};

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const GeminiService = {
  /**
   * Parses natural language input into a structured transaction object.
   */
  parseTransaction: async (inputText: string): Promise<Partial<Transaction> | null> => {
    try {
      const model = "gemini-2.5-flash"; 
      
      const response = await ai.models.generateContent({
        model: model,
        contents: inputText,
        config: {
          systemInstruction: `
            Você é uma API assistente financeira. Seu trabalho é extrair detalhes de transações das mensagens do usuário em Português.
            Data Atual: ${new Date().toISOString().split('T')[0]}.
            
            Regras:
            1. Analise o texto do usuário para identificar se é uma despesa ou receita.
            2. Extraia o valor.
            3. Infira uma categoria padrão (ex: Alimentação, Transporte, Moradia, Contas, Lazer, Salário) se não especificado.
            4. Crie uma descrição curta em português.
            5. Determine a data.
            
            Exemplo Entrada: "Gastei 50 pila em sushi ontem"
            Exemplo Saída JSON: { "type": "EXPENSE", "amount": 50, "category": "Alimentação", "description": "Sushi", "date": "2023-10-26" ... }
          `,
          responseMimeType: "application/json",
          responseSchema: transactionSchema,
          temperature: 0.1 
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return {
          ...data,
          id: crypto.randomUUID(),
          date: new Date(data.date).toISOString() 
        };
      }
      return null;
    } catch (error) {
      console.error("Gemini Parse Error:", error);
      return null;
    }
  },

  /**
   * Transcribes audio blob to text using Gemini.
   */
  transcribeAudio: async (base64Audio: string, mimeType: string): Promise<string | null> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Audio
              }
            },
            {
              text: "Transcreva este áudio para português do Brasil. Retorne apenas o texto transcrito, sem explicações."
            }
          ]
        }
      });
      return response.text || null;
    } catch (error) {
      console.error("Transcription Error:", error);
      return null;
    }
  },

  /**
   * Generates a conversational response about the transaction and budget status.
   */
  generateFinancialAdvice: async (transaction: Transaction, budgetStatus: string): Promise<string> => {
    try {
       const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `
          O usuário acabou de registrar esta transação: ${JSON.stringify(transaction)}.
          Status do Orçamento: ${budgetStatus}.
          
          Gere uma resposta curta, amigável e útil em Português do Brasil confirmando que a transação foi salva.
          Se eles estiverem acima do orçamento ou perto, avise gentilmente.
          Se economizaram ou estão abaixo, incentive.
          Máximo 2 frases.
        `,
      });
      return response.text || "Transação registrada com sucesso.";
    } catch (error) {
      return "Transação registrada.";
    }
  },

  /**
   * Generates speech audio from text using Gemini TTS.
   */
  generateSpeech: async (text: string): Promise<AudioBuffer | null> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
      );
      
      return audioBuffer;

    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }
};
