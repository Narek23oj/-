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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    setMessages([{
      id: generateId(),
      role: 'model',
      text: `Ողջույն, ${student.name}։ Ես ԹԻՄԻ-ն եմ։ Ի՞նչ թեմա ենք այսօր ուսումնասիրելու։
Հիշիր, ես այստեղ եմ օգնելու քեզ հասկանալ, այլ ոչ թե քո փոխարեն լուծելու։
Օրինակ, եթե գրես $a^2+b^2=c^2$, մենք կքննարկենք Պյութագորասի թեորեմը։`,
      timestamp: Date.now()
    }]);
  }, [student.name]);

  const handleStartNewChat = () => {
    // Save current session before starting new if it has user messages
    if (messages.length > 1) {
       saveCurrentSession();
    }
    
    setSessionId(generateId());
    setMessages([{
      id: generateId(),
      role: 'model',
      text: `Նոր զրույց։ Ինչո՞վ կարող եմ օգնել։`,
      timestamp: Date.now()
    }]);
    onSessionUpdate();
  };

  const saveCurrentSession = () => {
    const session: ChatSession = {
      id: sessionId,
      studentId: student.id,
      studentName: student.name,
      studentGrade: student.grade,
      startTime: messages[0]?.timestamp || Date.now(),
      messages: messages
    };
    saveSession(session);
    onSessionUpdate();
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      text: inputText.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    // Save progressively
    const tempSession: ChatSession = {
        id: sessionId,
        studentId: student.id,
        studentName: student.name,
        studentGrade: student.grade,
        startTime: messages[0]?.timestamp || Date.now(),
        messages: newMessages
    };
    saveSession(tempSession);

    try {
      const responseText = await sendMessageToGemini(newMessages, userMsg.text);
      
      const aiMsg: Message = {
        id: generateId(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      
      // Save final state of turn
      saveSession({
        ...tempSession,
        messages: finalMessages
      });
      onSessionUpdate();

    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-primary px-6 py-4 flex justify-between items-center text-white">
        <div>
          <h2 className="text-xl font-bold">ԹԻՄԻ</h2>
          <p className="text-sm opacity-90">by YEGHIAZARYAN NAREK</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={handleStartNewChat}
          className="text-sm py-1 px-3"
        >
          + New Chat
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-5 py-3 rounded-2xl leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}
            >
              <MarkdownRenderer content={msg.text} isUser={msg.role === 'user'} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-5 py-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm">
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

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Գրեք ձեր հարցը այստեղ..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-[50px] max-h-[150px]"
          />
          <Button onClick={handleSend} disabled={isLoading || !inputText.trim()}>
            Ուղարկել
          </Button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
           Հարթակը նախատեսված է միայն կրթական նպատակների համար։
        </p>
      </div>
    </div>
  );
};

export default ChatWindow;