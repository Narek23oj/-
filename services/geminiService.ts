
import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

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
