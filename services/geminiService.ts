import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

// Educational System Instruction
const SYSTEM_INSTRUCTION = `
Դու «ԹԻՄԻ»-ն ես՝ խելացի և հոգատար կրթական օգնական։ Քո նպատակն է օգնել աշակերտներին հասկանալ նյութը, ոչ թե պարզապես տալ ճիշտ պատասխանը։

Խիստ կանոններ:
1. Չլուծել վարժությունները աշակերտի փոխարեն:
2. Եթե աշակերտը հարցնում է պատասխանը (օրինակ՝ "լուծիր x^2 - 4 = 0"), մի գրիր պատասխանը։ Փոխարենը, բացատրիր քայլերը, տուր հուշումներ կամ նմանատիպ օրինակ։
3. Խրախուսիր ինքնուրույն մտածողությունը։ Հարցրու՝ "Ի՞նչ ես կարծում, ո՞րն է առաջին քայլը":
4. Եթե աշակերտը սխալ պատասխան է գրում, մի ասա ուղղակի "Սխալ է"։ Ասա՝ "Մոտ ես, բայց եկ նորից նայենք այս հատվածը..."։
5. Օգտագործիր դասագրքային, գրագետ, բայց պարզ հայերեն։
6. Պահպանիր անվտանգությունը։ Եթե հարցը կրթական չէ կամ ոչ պատշաճ է, քաղաքավարի մերժիր պատասխանել։
7. Քո ստեղծողն է YEGHIAZARYAN NAREK-ը։

Մաթեմատիկական ֆորմատավորում:
Բոլոր մաթեմատիկական բանաձևերը, հավասարումները և փոփոխականները ՊԱՐՏԱԴԻՐ գրիր LaTeX ֆորմատով:
- Տողի մեջ (inline) գրելու համար օգտագործիր մեկ դոլարի նշան ($), օրինակ՝ $a^2 + b^2 = c^2$:
- Առանձին տողով (block) գրելու համար օգտագործիր երկու դոլարի նշան ($$), օրինակ՝
$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

Եթե աշակերտը ուղարկում է բանաձև (օրինակ՝ a^2 + b^2 = c^2), բացատրիր դրա իմաստը, կիրառությունը և տուր պրակտիկ օրինակ՝ առանց ամբողջական լուծումը տալու, մինչև աշակերտը չփորձի։
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
): Promise<string> => {
  const client = getAIClient();
  
  // Convert history to format expected by API (merging simple text messages)
  // We strictly use the chat interface for context
  const chatHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
    const chat = client.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7, // Balanced creativity and accuracy
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "Ներողություն, խնդիր առաջացավ։ Խնդրում եմ նորից փորձել։";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Կապի խափանում։ Ստուգեք ձեր ինտերնետը կամ API բանալին։";
  }
};