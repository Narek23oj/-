
import React, { useState, useRef, useEffect } from 'react';
import { Message, StudentProfile, ChatSession, AVAILABLE_BACKGROUNDS } from '../types';

import { saveSession, generateId, subscribeToStudentSessions } from '../services/storageService';
import Button from './Button';
import MarkdownRenderer from './MarkdownRenderer';
import Avatar from './Avatar'; // Import Avatar

interface ChatWindowProps {
  student: StudentProfile;
  onSessionUpdate: () => void;
}

// --- PROMPT LIBRARY DATA ---


const ChatWindow: React.FC<ChatWindowProps> = ({ student, onSessionUpdate }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(generateId());
  const [isFlagged, setIsFlagged] = useState(false);
  
  // Image Generation State


  // Prompt Library State


  // Voice Input State


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
            text: `Բարև ${student.name}! Սպասում եմ ուսուցչի առաջադրանքներին։`,
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
      isFlagged: isFlagged
    };
    await saveSession(session);
    onSessionUpdate();
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg: Message = { id: generateId(), role: 'user', text: inputText.trim(), timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    await saveCurrentSession(newMessages);
    setIsLoading(false);
  };





  // --- Prompt Library Logic ---


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
            
            {isLoading && (
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

                </div>
            </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 md:p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2 items-center">
            






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





      </div>
    </div>
  );
};

export default ChatWindow;
