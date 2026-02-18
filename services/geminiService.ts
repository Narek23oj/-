
import { GoogleGenAI, Type } from "@google/genai";
import { Message, QuizQuestion } from "../types";

// Educational System Instruction
const SYSTEM_INSTRUCTION = `
You are "TIMI", an educational AI assistant for school students in Grades 1 through 9 only.
Your creator is YEGHIAZARYAN NAREK.

CRITICAL SAFETY & BEHAVIOR RULES:
1.  **AGE RESTRICTION**: You are strictly for Grades 1-9. If a topic is too advanced (High school/University level) or inappropriate, politely refuse.
2.  **18+ CONTENT IS FORBIDDEN**: If a user asks ANYTHING related to violence, sexual content, drugs, or self-harm, you must IMMEDIATELY refuse with the exact phrase: "SECURITY_ALERT: Content not allowed." Do not answer the question.
3.  **NO DIRECT ANSWERS**: Never solve homework directly. Explain the *method*.
    *   Bad: "The answer is 5."
    *   Good: "To solve this, first add 2 to both sides. What do you get?"
4.  **Tone**: Encouraging, safe, simple, and educational.

FORMATTING:
*   Use LaTeX for math: $x^2$.
*   Use simple Armenian (unless the user speaks English/Russian).
`;

let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string
): Promise<{ text: string; isSafetyViolation: boolean }> => {
  const client = getAIClient();
  
  const chatHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
    const chat = client.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: newMessage });
    const responseText = result.text || "";

    // Check for our specific safety flag or general refusal
    if (responseText.includes("SECURITY_ALERT") || responseText.includes("Content not allowed")) {
      return { 
        text: "⚠️ Այս հարցը պարունակում է անթույլատրելի բովանդակություն (18+ կամ ոչ կրթական)։ Ադմինիստրատորը տեղեկացված է։", 
        isSafetyViolation: true 
      };
    }

    return { text: responseText, isSafetyViolation: false };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Կապի խափանում։", isSafetyViolation: false };
  }
};

export const generateQuizQuestions = async (
  subject: string,
  topic: string,
  grade: string,
  count: number = 5
): Promise<QuizQuestion[]> => {
    const client = getAIClient();
    
    // Explicitly ask for Armenian
    const prompt = `Generate ${count} multiple choice questions (A, B, C, D) for ${grade} grade students.
    Subject: "${subject}"
    Topic: "${topic}"
    Language: Armenian (Հայերեն)
    
    Ensure the questions are educational, clear, and appropriate for the grade level.
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.INTEGER, description: "Index 0-3" },
                            points: { type: Type.INTEGER },
                            subject: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const questions = JSON.parse(text) as any[];
        
        // Post-process to ensure IDs and correct structure
        return questions.map(q => ({
            id: Math.random().toString(36).substring(2, 15),
            subject: subject, // Ensure subject matches requested
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 10
        }));

    } catch (e) {
        console.error("AI Generation Error", e);
        return [];
    }
};

export const generateAIAvatar = async (description: string, style: string): Promise<string | null> => {
  const client = getAIClient();
  
  const prompt = `A cool, friendly ${style} avatar for a school student profile picture. 
  Description: ${description}. 
  Ensure it is safe, appropriate for school, colorful, white or simple background, centered face.`;

  try {
    const response = await client.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg'
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64String = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64String}`;
    }
    return null;
  } catch (error) {
    console.error("Avatar Generation Error:", error);
    return null;
  }
};
