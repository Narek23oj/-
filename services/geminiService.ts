
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
    // Uses the API key from vite.config.ts (process.env.API_KEY)
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  isTeacherMode: boolean = false,
  studentContext: string = "" 
): Promise<{ text: string; isSafetyViolation: boolean; relatedStudentId?: string }> => {
  const client = getAIClient();
  
  let systemInstruction = SYSTEM_INSTRUCTION;

  if (isTeacherMode) {
      systemInstruction = `You are "TIMI", a helpful AI colleague inside the Teachers' Room. 
      Your personality: Friendly, professional but warm, helpful, and organized. You are talking to teachers.
      
      RULES FOR TEACHER MODE:
      1. If they greet you or ask "How are you?" (e.g., "timi jan vonc es", "բարև", "ոնց ես"), respond warmly in Armenian. 
         Example: "Լավ եմ, շնորհակալություն, սիրելի ուսուցիչ։ Դուք ինչպե՞ս եք։ Ինչո՞վ կարող եմ օգնել դասապրոցեսին։"
      2. If they ask for student info, check the database provided below.
      3. Keep responses concise and professional.
      
      ${studentContext ? `
      --- STUDENT DATABASE START ---
      ${studentContext}
      --- STUDENT DATABASE END ---
      
      INSTRUCTION FOR STUDENT INFO:
      If the teacher asks for information about a specific student (e.g., "bring me info about Aram", "show Test's info", "տուր Արամի ինֆոն"), 
      you MUST find the student in the list above.
      
      If found:
      1. Respond politely (e.g., "Ահա [Name]-ի տվյալները։").
      2. CRITICAL: Append the following tag to the VERY END of your response: "[[SHOW_STUDENT_CARD: <student_id>]]".
         Replace <student_id> with the actual ID from the list.
      
      If not found:
      Politely say you couldn't find a student with that name in the database.
      ` : ''}
      `;
  }

  const chatHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
    const chat = client.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7, 
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: newMessage });
    let responseText = result.text;

    // Handle empty/blocked response
    if (!responseText) {
        return { text: "Ներողություն, չկարողացա պատասխանել (հնարավոր է անվտանգության ֆիլտր կամ սխալ)։", isSafetyViolation: false };
    }

    // Check for Student Card Tag
    let finalText = responseText;
    let relatedStudentId = undefined;
    const tagMatch = responseText.match(/\[\[SHOW_STUDENT_CARD:\s*(.+?)\]\]/);
    
    if (tagMatch) {
        relatedStudentId = tagMatch[1].trim();
        // Remove the tag from the visible text so it looks clean
        finalText = responseText.replace(tagMatch[0], "").trim();
    }

    // Check for our specific safety flag or general refusal
    if (responseText.includes("SECURITY_ALERT") || responseText.includes("Content not allowed")) {
      return { 
        text: "⚠️ Այս հարցը պարունակում է անթույլատրելի բովանդակություն (18+ կամ ոչ կրթական)։ Ադմինիստրատորը տեղեկացված է։", 
        isSafetyViolation: true 
      };
    }

    return { text: finalText, isSafetyViolation: false, relatedStudentId };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errParams = error?.message || "";
    if (errParams.includes("API key")) {
        return { text: "API Key Error. Խնդրում ենք թարմացնել բանալին։", isSafetyViolation: false };
    }
    return { text: "Կապի խափանում։ Խնդրում ենք ստուգել ինտերնետը կամ API կարգավորումները։", isSafetyViolation: false };
  }
};

export const generateQuizQuestions = async (
  subject: string,
  topic: string,
  grade: string,
  count: number = 5
): Promise<QuizQuestion[]> => {
    const client = getAIClient();
    
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
        
        return questions.map(q => ({
            id: Math.random().toString(36).substring(2, 15),
            subject: subject, 
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
  
  const prompt = `Generate a cool, friendly ${style} avatar for a school student profile picture. 
  Description: ${description}. 
  Ensure it is safe, appropriate for school, colorful, white or simple background, centered face.`;

  try {
    // Switched to gemini-2.5-flash-image for better compatibility with standard keys
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });

    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64EncodeString = part.inlineData.data;
                return `data:image/png;base64,${base64EncodeString}`;
            }
        }
    }
    return null;
  } catch (error) {
    console.error("Avatar Generation Error:", error);
    return null;
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
    const client = getAIClient();
    const safePrompt = `A child-safe, educational illustration. ${prompt}. No violence, no adult content.`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: safePrompt }]
            }
        });

        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    return `data:image/png;base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Image Gen Error:", error);
        return null;
    }
};
