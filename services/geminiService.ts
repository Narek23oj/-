
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
  const key = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: key || "dummy_key" });
};

// --- OFFLINE / MOCK FALLBACKS ---

const getOfflineResponse = (userMsg: string) => {
    return {
        text: `🔌 **Offline Mode (Simulated)**\n\nՆերողություն, «Generative Language API»-ն անհասանելի է կամ անջատված։\n\nԵս այժմ աշխատում եմ առանց AI-ի։ Դուք գրեցիք՝ *"${userMsg}"*։`,
        isSafetyViolation: false
    };
};

const getOfflineQuiz = (subject: string): QuizQuestion[] => {
    return [
        {
            id: 'off_1',
            subject: subject,
            question: `(Offline) Սա ավտոմատ հարց է ${subject}-ից, քանի որ AI-ն անջատված է։`,
            options: ['Պարզ է', 'Հասկանալի է', 'Լավ', 'Օքեյ'],
            correctAnswer: 0,
            points: 10
        },
        {
            id: 'off_2',
            subject: subject,
            question: `(Offline) 2 + 2 = ?`,
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
            points: 10
        }
    ];
};

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  isTeacherMode: boolean = false,
  studentContext: string = "" 
): Promise<{ text: string; isSafetyViolation: boolean; relatedStudentIds?: string[] }> => {
  const client = getAIClient();
  
  let systemInstruction = SYSTEM_INSTRUCTION;

  if (isTeacherMode) {
      systemInstruction = `You are "TIMI", a helpful AI colleague inside the Teachers' Room. 
      RULES: Always respond in Armenian. Context: Student Database available.
      
      IMPORTANT: When you mention or provide information about specific students, you MUST append the following tag for EACH student at the end of your message: [[SHOW_STUDENT_CARD: student_id]].
      Example: "Ահա տվյալները Արամի մասին: [[SHOW_STUDENT_CARD: aram_id_123]]"
      
      ${studentContext ? `STUDENTS: ${studentContext}` : ''}`;
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
        tools: [{ googleSearch: {} }]
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: newMessage });
    let responseText = result.text;

    if (!responseText) return { ...getOfflineResponse(newMessage), relatedStudentIds: [] };

    // Check for Student Card Tags (Multiple)
    let finalText = responseText;
    const relatedStudentIds: string[] = [];
    const tagRegex = /\[\[SHOW_STUDENT_CARD:\s*(.+?)\]\]/g;
    let match;
    
    while ((match = tagRegex.exec(responseText)) !== null) {
        relatedStudentIds.push(match[1].trim());
        finalText = finalText.replace(match[0], "");
    }
    
    finalText = finalText.trim();

    if (responseText.includes("SECURITY_ALERT")) {
      return { 
        text: "⚠️ Այս հարցը պարունակում է անթույլատրելի բովանդակություն։", 
        isSafetyViolation: true,
        relatedStudentIds: []
      };
    }

    return { text: finalText, isSafetyViolation: false, relatedStudentIds };

  } catch (error: any) {
    console.warn("[Gemini API Failed - Switching to Offline]:", error.message);
    return { ...getOfflineResponse(newMessage), relatedStudentIds: [] };
  }
};

export const generateQuizQuestions = async (
  subject: string,
  topic: string,
  grade: string,
  count: number = 5
): Promise<QuizQuestion[]> => {
    const client = getAIClient();
    const prompt = `Generate ${count} multiple choice questions for ${grade} grade about "${subject}: ${topic}". Language: Armenian. JSON format.`;

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
                            correctAnswer: { type: Type.INTEGER },
                            points: { type: Type.INTEGER },
                            subject: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return getOfflineQuiz(subject);
        
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
        console.warn("AI Quiz Generation Failed, using Mock:", e);
        return getOfflineQuiz(subject);
    }
};

export const generateAIAvatar = async (description: string, style: string): Promise<string | null> => {
  const client = getAIClient();
  const prompt = `Avatar: ${description}, Style: ${style}`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });

    if (response.candidates && response.candidates.length > 0 && response.candidates[0].content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
  } catch (error) {
    console.warn("Avatar Gen Failed:", error);
    // Return null so UI handles it gracefully (or shows error toast)
    return null;
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
    const client = getAIClient();
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] }
        });

        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (error) {
        console.warn("Image Gen Failed:", error);
        return null;
    }
};
