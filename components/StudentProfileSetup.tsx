
import React, { useState, useRef } from 'react';
import { StudentProfile, INITIAL_ADMINS } from '../types';
import { saveStudent } from '../services/storageService';
import { generateAIAvatar } from '../services/geminiService';
import Input from './Input';
import Button from './Button';

interface StudentProfileSetupProps {
  student: StudentProfile;
  onComplete: (updatedStudent: StudentProfile) => void;
}

const AVATAR_STYLES = ['Cartoon', '3D Render', 'Anime', 'Pixel Art', 'Watercolor', 'Sketch'];
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Timi',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Narek',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Ana',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Dav'
];

const StudentProfileSetup: React.FC<StudentProfileSetupProps> = ({ student, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teacherName, setTeacherName] = useState(student.teacherName || INITIAL_ADMINS[0]);
  
  // Avatar State
  const [avatarMode, setAvatarMode] = useState<'PRESET' | 'UPLOAD' | 'AI'>('PRESET');
  const [selectedAvatar, setSelectedAvatar] = useState(student.avatar || PRESET_AVATARS[0]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState('Cartoon');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedAvatar(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!aiPrompt.trim()) {
      setError('Please describe your avatar first.');
      return;
    }
    setIsGenerating(true);
    setError('');
    
    const generatedUrl = await generateAIAvatar(aiPrompt, aiStyle);
    if (generatedUrl) {
      setSelectedAvatar(generatedUrl);
    } else {
      setError('Failed to generate image. Please try again.');
    }
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Գաղտնաբառը պարտադիր է։');
      return;
    }
    if (password !== confirmPassword) {
      setError('Գաղտնաբառերը չեն համընկնում։');
      return;
    }
    if (!teacherName.trim()) {
      setError('Դասախոսի անունը պարտադիր է։');
      return;
    }

    const updatedStudent: StudentProfile = {
      ...student,
      password: password.trim(),
      teacherName: teacherName.trim(),
      avatar: selectedAvatar
    };

    await saveStudent(updatedStudent);
    onComplete(updatedStudent);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Summary */}
        <div className="bg-primary p-8 text-white md:w-1/3 flex flex-col justify-center items-center text-center">
           <h2 className="text-2xl font-bold mb-4">Բարի գալուստ, {student.name}!</h2>
           <p className="opacity-90 mb-6">Ավարտեք ձեր պրոֆիլի կարգավորումները սկսելու համար։</p>
           <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-lg mb-4">
              <img src={selectedAvatar} alt="Profile" className="w-full h-full object-cover" />
           </div>
           <p className="font-bold text-lg">{student.grade}-րդ դասարան</p>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 md:w-2/3">
           <h3 className="text-xl font-bold text-gray-800 mb-6">Կարգավորումներ</h3>
           
           {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

           <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Teacher Selection */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ընտրեք Ձեր Դասախոսին</label>
                  <select 
                    value={teacherName} 
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  >
                      {INITIAL_ADMINS.map(admin => (
                          <option key={admin} value={admin}>{admin}</option>
                      ))}
                  </select>
              </div>

              {/* Password Creation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input 
                    label="Ստեղծել Գաղտնաբառ" 
                    type="password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="******"
                 />
                 <Input 
                    label="Հաստատել Գաղտնաբառը" 
                    type="password"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="******"
                 />
              </div>

              {/* Avatar Selection */}
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Ընտրեք նկար (Avatar)</label>
                 <div className="flex space-x-2 mb-4 bg-gray-100 p-1 rounded-lg">
                    {['PRESET', 'UPLOAD', 'AI'].map(mode => (
                       <button
                         type="button"
                         key={mode}
                         onClick={() => setAvatarMode(mode as any)}
                         className={`flex-1 py-1 text-xs font-bold rounded ${avatarMode === mode ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                       >
                         {mode === 'PRESET' ? 'Պատրաստի' : mode === 'UPLOAD' ? 'Ներբեռնել' : 'AI ✨'}
                       </button>
                    ))}
                 </div>

                 <div className="p-4 border rounded-lg bg-gray-50 min-h-[150px] flex items-center justify-center">
                    {avatarMode === 'PRESET' && (
                       <div className="flex gap-2 overflow-x-auto w-full pb-2">
                           {PRESET_AVATARS.map(url => (
                               <img 
                                 key={url} 
                                 src={url} 
                                 onClick={() => setSelectedAvatar(url)}
                                 className={`w-12 h-12 rounded-full cursor-pointer border-2 hover:scale-110 transition ${selectedAvatar === url ? 'border-primary' : 'border-transparent'}`} 
                               />
                           ))}
                       </div>
                    )}

                    {avatarMode === 'UPLOAD' && (
                       <div className="text-center">
                          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Նկար ընտրել</Button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                       </div>
                    )}

                    {avatarMode === 'AI' && (
                       <div className="w-full space-y-3">
                          <div className="flex gap-2">
                             <input 
                                className="flex-1 border rounded px-3 py-2 text-sm"
                                placeholder="Նկարագրեք (օր.՝ տղա ակնոցով)"
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                             />
                             <select 
                                value={aiStyle} 
                                onChange={e => setAiStyle(e.target.value)}
                                className="border rounded text-sm px-1"
                             >
                                {AVATAR_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                          </div>
                          <Button 
                             onClick={handleGenerateAvatar} 
                             isLoading={isGenerating} 
                             className="w-full py-1 text-sm bg-indigo-600"
                          >
                             Գեներացնել
                          </Button>
                       </div>
                    )}
                 </div>
              </div>

              <Button type="submit" className="w-full py-3 text-lg">Պահպանել և Մուտք գործել</Button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileSetup;
