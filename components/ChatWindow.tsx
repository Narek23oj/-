
import React, { useState, useRef, useEffect } from 'react';
import { Message, StudentProfile, ChatSession, AVAILABLE_BACKGROUNDS } from '../types';
import { sendMessageToGemini, generateImage } from '../services/geminiService';
import { saveSession, generateId, subscribeToStudentSessions } from '../services/storageService';
import Button from './Button';
import MarkdownRenderer from './MarkdownRenderer';
import Avatar from './Avatar'; // Import Avatar

interface ChatWindowProps {
  student: StudentProfile;
  onSessionUpdate: () => void;
}

// --- PROMPT LIBRARY DATA ---
interface PromptTemplate {
    id: number;
    title: string;
    description: string;
    icon: string;
    template: string;
    inputs: { key: string; label: string; placeholder?: string }[];
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        id: 1,
        title: "Բացատրիր երեխայի պես",
        description: "Բարդ թեմաները պարզ բառերով",
        icon: "👶",
        template: "Բացատրիր «{topic}»-ն այնպես, ինչպես կբացատրեիր {age} տարեկան երեխայի։ Օգտագործիր պարզ բառեր, օրինակներ և վերջում տուր 3 հարց, որպեսզի ստուգեմ հասկացել եմ թե ոչ։",
        inputs: [
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Ֆոտոսինթեզ' },
            { key: 'age', label: 'Տարիք', placeholder: 'Օրինակ՝ 10' }
        ]
    },
    {
        id: 2,
        title: "Ուսուցիչ և Թեստ",
        description: "Սովորիր և ստուգիր գիտելիքդ",
        icon: "👩‍🏫",
        template: "Պատկերացրու, որ դու {subject}-ի ուսուցիչ ես։ Բացատրիր «{topic}»-ն քայլ առ քայլ։ Հետո տուր ինձ 5 թեստային հարց և վերջում գրիր ճիշտ պատասխանները։",
        inputs: [
            { key: 'subject', label: 'Առարկա', placeholder: 'Օրինակ՝ Ֆիզիկա' },
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Նյուտոնի օրենքները' }
        ]
    },
    {
        id: 3,
        title: "Հեքիաթային Ուսուցում",
        description: "Սովորիր պատմության միջոցով",
        icon: "📖",
        template: "Գրիր հետաքրքիր պատմություն, որտեղ գլխավոր հերոսը {name} է։ Պատմությունը պետք է կապված լինի «{topic}»-ի հետ։ Թող պատմության ընթացքում բացատրվի թեման պարզ ձևով։ Վերջում ավելացրու բարոյական միտք։",
        inputs: [
            { key: 'name', label: 'Հերոսի Անունը', placeholder: 'Օրինակ՝ Արամ' },
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Ընկերություն' }
        ]
    },
    {
        id: 4,
        title: "Ստեղծիր Quiz",
        description: "10 հարցանոց թեստ",
        icon: "❓",
        template: "Ստեղծիր 10 հարցանոց quiz «{topic}»-ի վերաբերյալ։ Հարցերը լինեն տարբեր դժվարության։ Վերջում գրիր պատասխանների բանալին։",
        inputs: [
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Տիեզերք' }
        ]
    },
    {
        id: 5,
        title: "Ստուգիր Տեքստս",
        description: "Գտիր սխալները և ուղղիր",
        icon: "✍️",
        template: "Ես գրելու եմ տեքստ։ Գտիր իմ սխալները և բացատրիր, թե ինչու են դրանք սխալ։\n\nՏեքստ՝\n{text}",
        inputs: [
            { key: 'text', label: 'Քո Տեքստը', placeholder: 'Գրիր կամ տեղադրիր տեքստը այստեղ...' }
        ]
    },
    {
        id: 6,
        title: "Խաղանք",
        description: "Ինտերակտիվ խաղ գիտելիքով",
        icon: "🎮",
        template: "Եկ խաղ խաղանք։ Դու տուր ինձ «{topic}»-ի վերաբերյալ հարցեր։ Եթե սխալ պատասխանեմ, բացատրիր ճիշտը։ Պահիր միավորներ։",
        inputs: [
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Հայոց Պատմություն' }
        ]
    },
    {
        id: 7,
        title: "Օգնական",
        description: "Բացատրություն և օրինակներ",
        icon: "🤖",
        template: "Դու իմ AI ուսումնական օգնականն ես։ Օգնիր ինձ սովորել «{topic}»-ն։ Տուր բացատրություն, օրինակ, փոքր առաջադրանք, և ստուգողական հարց։",
        inputs: [
            { key: 'topic', label: 'Թեմա', placeholder: 'Օրինակ՝ Բազմապատկում' }
        ]
    }
];

const ChatWindow: React.FC<ChatWindowProps> = ({ student, onSessionUpdate }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(generateId());
  const [isFlagged, setIsFlagged] = useState(false);
  
  // Image Generation State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Prompt Library State
  const [isPromptLibOpen, setIsPromptLibOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({});

  // History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // For Mobile

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const TIMI_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=Timi';

  // Determine Background Style
  const activeBg = AVAILABLE_BACKGROUNDS.find(bg => bg.id === student.equippedBackground);
  const containerStyle = activeBg ? { background: activeBg.cssValue } : { backgroundColor: '#f9fafb' }; // Default gray-50
  
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load chat history for sidebar
  useEffect(() => {
    const unsub = subscribeToStudentSessions(student.id, (loadedSessions) => {
        setSessions(loadedSessions);
    });
    return () => unsub();
  }, [student.id]);

  // Initial Welcome Message
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{
            id: generateId(),
            role: 'model',
            text: `Բարև ${student.name}! Ես Թիմին եմ՝ քո օգնականը։
Կարող ենք սովորել Մաթեմատիկա, Հայոց լեզու և այլն։
Ինչպե՞ս կարող եմ օգնել այսօր։`,
            timestamp: Date.now()
        }]);
    }
  }, [student.name]);

  const handleStartNewChat = async () => {
    if (messages.length > 1) {
        await saveCurrentSession(); 
    }
    const newId = generateId();
    setSessionId(newId);
    setIsFlagged(false);
    setMessages([{ id: generateId(), role: 'model', text: `Նոր թեմա։ Ինչի՞ մասին խոսենք։`, timestamp: Date.now() }]);
    setIsHistoryOpen(false); // Close mobile menu
    onSessionUpdate();
  };

  const loadSession = (session: ChatSession) => {
      setSessionId(session.id);
      setMessages(session.messages);
      setIsFlagged(!!session.isFlagged);
      setIsHistoryOpen(false); // Close mobile menu
  };

  const saveCurrentSession = async (overrideMessages?: Message[], flaggedStatus?: boolean) => {
    const msgs = overrideMessages || messages;
    if (msgs.length <= 1) return;

    const session: ChatSession = {
      id: sessionId,
      studentId: student.id,
      studentName: student.name,
      studentGrade: student.grade,
      startTime: sessions.find(s => s.id === sessionId)?.startTime || Date.now(),
      messages: msgs,
      isFlagged: flaggedStatus !== undefined ? flaggedStatus : isFlagged
    };
    await saveSession(session);
    onSessionUpdate();
  };

  const executeSend = async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = { id: generateId(), role: 'user', text: text.trim(), timestamp: Date.now() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputText('');
      setIsLoading(true);

      // Progressive save
      await saveCurrentSession(newMessages);

      try {
        const response = await sendMessageToGemini(newMessages, userMsg.text);
        
        const aiMsg: Message = {
          id: generateId(),
          role: 'model',
          text: response.text,
          timestamp: Date.now()
        };

        const finalMessages = [...newMessages, aiMsg];
        setMessages(finalMessages);
        
        const newFlaggedStatus = isFlagged || response.isSafetyViolation;
        if (response.isSafetyViolation) setIsFlagged(true);

        await saveCurrentSession(finalMessages, newFlaggedStatus);

      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
  };

  const handleSend = () => executeSend(inputText);

  const handleGenerateImage = async () => {
      if (!imagePrompt.trim()) return;
      
      setIsImageModalOpen(false); // Close modal first
      setIsGeneratingImage(true);

      // Add user request message
      const userMsg: Message = { 
          id: generateId(), 
          role: 'user', 
          text: `Draw: ${imagePrompt}`, 
          timestamp: Date.now() 
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      await saveCurrentSession(newMessages);

      try {
          const imageUrl = await generateImage(imagePrompt);
          
          if (imageUrl) {
              const aiMsg: Message = {
                  id: generateId(),
                  role: 'model',
                  text: `Ահա քո նկարը՝ "${imagePrompt}"`,
                  image: imageUrl,
                  timestamp: Date.now()
              };
              const finalMessages = [...newMessages, aiMsg];
              setMessages(finalMessages);
              await saveCurrentSession(finalMessages);
          } else {
              // Error message
              const errorMsg: Message = {
                  id: generateId(),
                  role: 'model',
                  text: "Ներողություն, չկարողացա նկարել այս պահին։ Փորձիր ավելի պարզ նկարագրել։",
                  timestamp: Date.now()
              };
              setMessages([...newMessages, errorMsg]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingImage(false);
          setImagePrompt('');
      }
  };

  // --- Prompt Library Logic ---
  const handleUseTemplate = () => {
      if (!selectedTemplate) return;
      
      let finalPrompt = selectedTemplate.template;
      let allFilled = true;

      selectedTemplate.inputs.forEach(input => {
          const val = templateInputs[input.key] || '';
          if (!val.trim()) allFilled = false;
          finalPrompt = finalPrompt.replace(`{${input.key}}`, val);
      });

      if (!allFilled) {
          alert("Խնդրում ենք լրացնել բոլոր դաշտերը։");
          return;
      }

      setIsPromptLibOpen(false);
      setSelectedTemplate(null);
      setTemplateInputs({});
      executeSend(finalPrompt);
  };

  return (
    <div className="flex h-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 relative">
      
      {/* Mobile History Toggle Overlay */}
      {isHistoryOpen && (
          <div className="absolute inset-0 z-20 bg-black/50 md:hidden" onClick={() => setIsHistoryOpen(false)}></div>
      )}

      {/* History Sidebar */}
      <div className={`absolute md:relative z-30 h-full w-64 bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
         <div className="p-4 border-b border-gray-200 bg-white">
             <Button variant="secondary" onClick={handleStartNewChat} className="w-full shadow-sm text-sm py-2">
                 + New Chat
             </Button>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {sessions.length === 0 && (
                 <p className="text-center text-gray-400 text-xs mt-4">No history yet</p>
             )}
             {sessions.map(s => {
                 const date = new Date(s.startTime).toLocaleDateString();
                 const lastMsg = s.messages[s.messages.length - 1]?.text || "Empty chat";
                 const isActive = s.id === sessionId;

                 return (
                     <button 
                        key={s.id} 
                        onClick={() => loadSession(s)}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-colors group ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                     >
                         <div className={`text-xs font-bold mb-1 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>{date}</div>
                         <div className="truncate opacity-90">{lastMsg}</div>
                     </button>
                 )
             })}
         </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Chat Header */}
        <div className="bg-primary px-4 py-3 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsHistoryOpen(true)} className="md:hidden text-white/80 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        TIMI AI 
                        {isFlagged && <span className="text-[10px] bg-red-500 px-1 rounded">FLAGGED</span>}
                    </h2>
                    <p className="text-xs opacity-80 hidden sm:block">Educational Assistant (Grades 1-9)</p>
                </div>
            </div>
            {/* Start New Chat Icon for Mobile */}
            <button onClick={handleStartNewChat} className="md:hidden text-white/90">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                 </svg>
            </button>
        </div>

        {/* Messages */}
        <div 
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
            style={containerStyle}
        >
            {messages.map((msg) => {
            const isUser = msg.role === 'user';
            
            return (
                <div key={msg.id} className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {isUser ? (
                        <Avatar 
                           src={student.avatar} 
                           name={student.name} 
                           frameId={student.equippedFrame} 
                           size="sm" 
                           className="mb-1"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm mb-1">
                             <img src={TIMI_AVATAR} alt="TIMI" className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl leading-relaxed shadow-sm text-sm md:text-base ${
                        isUser ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                    }`}>
                        <MarkdownRenderer content={msg.text} isUser={isUser} />
                        {msg.image && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                                <img src={msg.image} alt="AI Generated" className="w-full h-auto" />
                            </div>
                        )}
                    </div>
                </div>
            );
            })}
            
            {(isLoading || isGeneratingImage) && (
            <div className="flex items-end gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm">
                    <img src={TIMI_AVATAR} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className="bg-white px-5 py-3 rounded-2xl border border-gray-200 shadow-sm rounded-bl-none">
                <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
                {isGeneratingImage && <span className="text-xs text-gray-500 mt-1 block">Նկարում եմ...</span>}
                </div>
            </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 md:p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2 items-center">
            
            {/* Draw Button */}
            <button 
                onClick={() => setIsImageModalOpen(true)}
                className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full transition"
                title="Generate Image"
            >
                🎨
            </button>

            {/* Prompt Library Button */}
            <button 
                onClick={() => { setIsPromptLibOpen(true); setSelectedTemplate(null); }}
                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition"
                title="Պրոմպտադարան"
            >
                🪄
            </button>

            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Հարցրու ինձ..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary h-[44px] text-sm md:text-base"
            />
            <Button onClick={handleSend} disabled={isLoading || !inputText.trim()} className="px-4">
                <span className="hidden md:inline">Send</span>
                <span className="md:hidden">➤</span>
            </Button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
            Strictly for educational use. 18+ content reported.
            </p>
        </div>

        {/* Image Generation Modal */}
        {isImageModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 animate-float">
                    <h3 className="font-bold text-lg mb-2">Նկարիր ինձ համար...</h3>
                    <textarea 
                        className="w-full border rounded p-2 mb-4 text-sm" 
                        rows={3}
                        placeholder="Օր.՝ Կապույտ կատու տիեզերքում"
                        value={imagePrompt}
                        onChange={e => setImagePrompt(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsImageModalOpen(false)}>Չեղարկել</Button>
                        <Button onClick={handleGenerateImage}>Նկարել</Button>
                    </div>
                </div>
            </div>
        )}

        {/* Prompt Library Modal (Promptadaran) */}
        {isPromptLibOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] animate-float overflow-hidden">
                    {/* Header */}
                    <div className="p-4 md:p-5 border-b bg-gradient-to-r from-purple-600 to-indigo-600 flex justify-between items-center text-white shrink-0">
                        <h3 className="font-bold text-lg md:text-xl flex items-center gap-2">
                            🪄 Պրոմպտադարան
                        </h3>
                        <button onClick={() => setIsPromptLibOpen(false)} className="text-white/80 hover:text-white text-xl">✕</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                        {!selectedTemplate ? (
                            // LIST VIEW
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {PROMPT_TEMPLATES.map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t)}
                                        className="bg-white p-4 rounded-xl border border-gray-200 hover:border-purple-400 hover:shadow-md transition text-left flex items-start gap-3 group"
                                    >
                                        <div className="text-3xl bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">{t.icon}</div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">{t.title}</h4>
                                            <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // DETAIL/INPUT VIEW
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="text-4xl">{selectedTemplate.icon}</div>
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">{selectedTemplate.title}</h3>
                                        <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {selectedTemplate.inputs.map(input => (
                                        <div key={input.key}>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                                {input.label}
                                            </label>
                                            {input.key === 'text' ? (
                                                <textarea 
                                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none text-sm min-h-[100px]"
                                                    placeholder={input.placeholder}
                                                    value={templateInputs[input.key] || ''}
                                                    onChange={e => setTemplateInputs({...templateInputs, [input.key]: e.target.value})}
                                                />
                                            ) : (
                                                <input 
                                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                                    placeholder={input.placeholder}
                                                    value={templateInputs[input.key] || ''}
                                                    onChange={e => setTemplateInputs({...templateInputs, [input.key]: e.target.value})}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 mt-8 pt-4 border-t">
                                    <Button variant="ghost" onClick={() => setSelectedTemplate(null)} className="flex-1">
                                        ← Ետ
                                    </Button>
                                    <Button onClick={handleUseTemplate} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                                        Ուղարկել ✨
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default ChatWindow;
