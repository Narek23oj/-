
import React, { useState, useRef, useEffect } from 'react';
import { Message, StudentProfile, ChatSession } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { saveSession, generateId } from '../services/storageService';
import Button from './Button';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatWindowProps {
  student: StudentProfile;
  onSessionUpdate: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ student, onSessionUpdate }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(generateId());
  const [isFlagged, setIsFlagged] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const TIMI_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=Timi';

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    setMessages([{
      id: generateId(),
      role: 'model',
      text: `Hello ${student.name}! I am TIMI, your school assistant.
We can learn Math, Armenian, English, and more!
I can explain concepts, but I won't do your homework for you. What shall we learn today?`,
      timestamp: Date.now()
    }]);
  }, [student.name]);

  const handleStartNewChat = async () => {
    if (messages.length > 1) await saveCurrentSession();
    setSessionId(generateId());
    setIsFlagged(false);
    setMessages([{ id: generateId(), role: 'model', text: `New topic started. How can I help?`, timestamp: Date.now() }]);
    onSessionUpdate();
  };

  const saveCurrentSession = async (overrideMessages?: Message[], flaggedStatus?: boolean) => {
    const session: ChatSession = {
      id: sessionId,
      studentId: student.id,
      studentName: student.name,
      studentGrade: student.grade,
      startTime: messages[0]?.timestamp || Date.now(),
      messages: overrideMessages || messages,
      isFlagged: flaggedStatus !== undefined ? flaggedStatus : isFlagged
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

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="bg-primary px-6 py-4 flex justify-between items-center text-white">
        <div>
          <h2 className="text-xl font-bold">TIMI AI</h2>
          <p className="text-sm opacity-90">Educational Assistant (Grades 1-9)</p>
        </div>
        <Button variant="secondary" onClick={handleStartNewChat} className="text-sm py-1 px-3">+ New Chat</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const avatar = isUser ? (student.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`) : TIMI_AVATAR;
          
          return (
            <div key={msg.id} className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm">
                   <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className={`max-w-[85%] px-5 py-3 rounded-2xl leading-relaxed shadow-sm ${
                    isUser ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}>
                <MarkdownRenderer content={msg.text} isUser={isUser} />
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

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask a question about your homework..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary h-[50px]"
          />
          <Button onClick={handleSend} disabled={isLoading || !inputText.trim()}>Send</Button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
           Strictly for educational use. 18+ content will be reported.
        </p>
      </div>
    </div>
  );
};

export default ChatWindow;
