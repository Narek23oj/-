import React, { useState, useEffect, useRef } from 'react';
import { 
    getAllSessions, 
    getStudents, 
    deleteSession, 
    toggleStudentBlockStatus, 
    saveStudent, 
    findStudentByNameAndGrade, 
    generateId, 
    deleteStudent,
    bulkImportStudents,
    exportDatabase,
    restoreDatabase
} from '../services/storageService';
import { ChatSession, StudentProfile } from '../types';
import Button from './Button';
import Input from './Input';
import MarkdownRenderer from './MarkdownRenderer';

// Predefined fun avatars for students
const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Timi',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Narek',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Ana',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Dav'
];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'students'>('sessions');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  // Add/Edit Student Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentAvatar, setStudentAvatar] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [studentError, setStudentError] = useState('');

  // Camera & Upload State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bulk Import Refs
  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshData();
    // Cleanup stream on unmount
    return () => {
      stopCamera();
    };
  }, []);

  const refreshData = () => {
    setSessions(getAllSessions().sort((a, b) => b.startTime - a.startTime));
    setStudents(getStudents());
  };

  // --- Backup / Restore Logic ---
  
  const handleExportData = () => {
      const jsonString = exportDatabase();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timi_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
              const success = restoreDatabase(content);
              if (success) {
                  alert('Տվյալների բազան հաջողությամբ վերականգնվել է։');
                  refreshData();
              } else {
                  alert('Սխալ՝ ֆայլը վնասված է կամ սխալ ֆորմատի։');
              }
          }
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = '';
  };

  // --- Bulk CSV Import ---

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
              const result = bulkImportStudents(content);
              if (result.added > 0) {
                  alert(`Հաջողությամբ ավելացվեց ${result.added} աշակերտ։`);
                  refreshData();
              }
              
              if (result.errors.length > 0) {
                  alert(`Որոշ տողեր չհաջողվեց ներբեռնել:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...' : ''}`);
              }
              
              if (result.added === 0 && result.errors.length === 0) {
                  alert('Ֆայլը դատարկ է կամ սխալ ֆորմատի։');
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      deleteSession(id);
      refreshData();
      if (selectedSession?.id === id) setSelectedSession(null);
    }
  };

  const handleToggleBlock = (studentId: string) => {
      toggleStudentBlockStatus(studentId);
      refreshData();
  };

  const handleDeleteStudent = (studentId: string) => {
      if (confirm('Դուք համոզվա՞ծ եք: Աշակերտի բոլոր տվյալները կջնջվեն:')) {
          deleteStudent(studentId);
          refreshData();
      }
  };

  // --- Camera Logic ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setIsCameraOpen(true);
      // Wait for state update then set srcObject
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setStudentError("Տեսախցիկը հասանելի չէ։ Ստուգեք թույլտվությունները։");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const video = videoRef.current;
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        let sourceWidth = video.videoWidth;
        let sourceHeight = video.videoHeight;
        let startX = 0;
        let startY = 0;

        if (aspectRatio > 1) {
            sourceWidth = sourceHeight;
            startX = (video.videoWidth - sourceWidth) / 2;
        } else {
            sourceHeight = sourceWidth;
            startY = (video.videoHeight - sourceHeight) / 2;
        }

        ctx.drawImage(video, startX, startY, sourceWidth, sourceHeight, 0, 0, size, size);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCustomAvatarUrl(dataUrl);
        setStudentAvatar('');
        stopCamera();
      }
    }
  };

  // --- File Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 400;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                const aspectRatio = img.width / img.height;
                let sourceWidth = img.width;
                let sourceHeight = img.height;
                let startX = 0;
                let startY = 0;

                if (aspectRatio > 1) {
                    sourceWidth = sourceHeight;
                    startX = (img.width - sourceWidth) / 2;
                } else {
                    sourceHeight = sourceWidth;
                    startY = (img.height - sourceHeight) / 2;
                }

                ctx.drawImage(img, startX, startY, sourceWidth, sourceHeight, 0, 0, size, size);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setCustomAvatarUrl(dataUrl);
                setStudentAvatar('');
            }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
      setEditingStudentId(null);
      setStudentName('');
      setStudentGrade('');
      setStudentPassword('');
      setStudentAvatar('');
      setCustomAvatarUrl('');
      setStudentError('');
      setIsStudentModalOpen(true);
      stopCamera();
  };

  const openEditModal = (student: StudentProfile) => {
      setEditingStudentId(student.id);
      setStudentName(student.name);
      setStudentGrade(student.grade);
      setStudentPassword(student.password || '');
      
      const avatar = student.avatar || '';
      if (AVATAR_PRESETS.includes(avatar)) {
          setStudentAvatar(avatar);
          setCustomAvatarUrl('');
      } else {
          setStudentAvatar('');
          setCustomAvatarUrl(avatar);
      }
      
      setStudentError('');
      setIsStudentModalOpen(true);
      stopCamera();
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentGrade.trim() || !studentPassword.trim()) {
        setStudentError('Խնդրում ենք լրացնել բոլոր դաշտերը');
        return;
    }

    if (!editingStudentId) {
        const existing = findStudentByNameAndGrade(studentName.trim(), studentGrade.trim());
        if (existing) {
            setStudentError('Այս անունով և դասարանով աշակերտ արդեն գրանցված է');
            return;
        }
    }

    const finalAvatar = customAvatarUrl.trim() || studentAvatar;

    let studentToSave: StudentProfile;

    if (editingStudentId) {
        const originalStudent = students.find(s => s.id === editingStudentId);
        if (!originalStudent) return;

        studentToSave = {
            ...originalStudent,
            name: studentName.trim(),
            grade: studentGrade.trim(),
            password: studentPassword.trim(),
            avatar: finalAvatar,
        };
    } else {
        studentToSave = {
            id: generateId(),
            name: studentName.trim(),
            grade: studentGrade.trim(),
            password: studentPassword.trim(),
            avatar: finalAvatar,
            joinedAt: Date.now(),
            isBlocked: false,
            score: 0
        };
    }

    saveStudent(studentToSave);
    refreshData();
    closeModal();
  };

  const closeModal = () => {
    stopCamera();
    setIsStudentModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500">Վերահսկման վահանակ</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleExportData} className="text-gray-600 bg-white border border-gray-200">
                💾 Backup (Արտահանել)
            </Button>
            <Button variant="ghost" onClick={() => backupInputRef.current?.click()} className="text-gray-600 bg-white border border-gray-200">
                📥 Restore (Վերականգնել)
            </Button>
            <input 
                type="file" 
                ref={backupInputRef}
                onChange={handleRestoreData}
                className="hidden" 
                accept=".json"
            />
            <Button variant="ghost" onClick={refreshData}>Թարմացնել</Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
            <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'sessions' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
            >
            Հարցեր / Սեսիաներ
            </button>
            <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'students' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
            >
            Աշակերտներ ({students.length})
            </button>
        </div>
        
        {activeTab === 'students' && (
            <div className="flex gap-2">
                <Button onClick={() => csvInputRef.current?.click()} variant="secondary">
                    📄 Import CSV (Ներբեռնել)
                </Button>
                <input 
                    type="file" 
                    ref={csvInputRef}
                    onChange={handleCSVUpload}
                    className="hidden" 
                    accept=".csv"
                />
                <Button onClick={openAddModal}>
                    + Գրանցել Աշակերտ
                </Button>
            </div>
        )}
      </div>

      {activeTab === 'students' && (
           <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded text-sm border border-blue-100 flex items-center">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               CSV ֆայլի ֆորմատը պետք է լինի՝ <strong>Անուն, Դասարան, Գաղտնաբառ</strong> (յուրաքանչյուրը նոր տողից)։
           </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* List View */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-700">
                    {activeTab === 'sessions' ? 'Վերջին ակտիվությունը' : 'Գրանցված աշակերտներ'}
                </h3>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {activeTab === 'sessions' ? (
                    sessions.length === 0 ? <p className="text-center text-gray-400 mt-4">Տվյալներ չկան</p> :
                    sessions.map(session => (
                        <div 
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                                selectedSession?.id === session.id 
                                ? 'bg-primary/10 border-primary' 
                                : 'bg-white border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="font-medium text-gray-900">{session.studentName}</span>
                                <span className="text-xs text-gray-500">{new Date(session.startTime).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">Դասարան: {session.studentGrade}</p>
                            <div className="text-sm text-gray-600 line-clamp-2">
                                <MarkdownRenderer content={session.messages.find(m => m.role === 'user')?.text || '(Դատարկ)'} />
                            </div>
                            <div className="mt-2 flex justify-end">
                                <button 
                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                                >
                                    Ջնջել
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    students.map(student => (
                        <div key={student.id} className={`p-3 border rounded-lg ${student.isBlocked ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                             <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                    {student.avatar ? (
                                      <img src={student.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                                        {student.name.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`font-medium ${student.isBlocked ? 'text-red-800' : 'text-gray-900'}`}>{student.name}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                                        {student.grade}-րդ դասարան
                                    </span>
                                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                                        {student.score || 0} միավոր
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-2 pl-10">
                                <div className="text-xs text-gray-400">
                                    <div className="mb-1">Pass: <span className="font-mono text-gray-600 bg-gray-100 px-1 rounded">{student.password || 'N/A'}</span></div>
                                    
                                    <div className="flex space-x-2 mt-2">
                                        <button 
                                            onClick={() => openEditModal(student)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                            title="Խմբագրել"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteStudent(student.id)}
                                            className="text-red-600 hover:text-red-800 font-medium"
                                            title="Ջնջել"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <Button 
                                    variant={student.isBlocked ? 'secondary' : 'ghost'}
                                    className={`py-1 px-2 text-xs border ${student.isBlocked ? '' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                                    onClick={() => handleToggleBlock(student.id)}
                                >
                                    {student.isBlocked ? 'Ապաարգելափակել' : 'Արգելափակել'}
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Detail View (Session messages) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
            {selectedSession ? (
                <>
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-800">{selectedSession.studentName}</h3>
                            <p className="text-sm text-gray-500">{selectedSession.studentGrade}-րդ դասարան | ID: {selectedSession.id}</p>
                        </div>
                        <div className="text-xs text-gray-400">
                            {new Date(selectedSession.startTime).toLocaleString()}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                        {selectedSession.messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] px-4 py-2 rounded-lg text-sm ${
                                        msg.role === 'user'
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'bg-white border border-gray-200 text-gray-800'
                                    }`}
                                >
                                    <span className="text-xs font-bold block mb-1 opacity-50">
                                        {msg.role === 'user' ? 'Աշակերտ' : 'ԹԻՄԻ'}
                                    </span>
                                    <MarkdownRenderer content={msg.text} />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p>Ընտրեք սեսիան ձախ կողմից՝ մանրամասները տեսնելու համար</p>
                </div>
            )}
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {isStudentModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] overflow-y-auto p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-auto my-8">
                  <h2 className="text-2xl font-bold mb-6 text-gray-800">
                      {editingStudentId ? 'Խմբագրել Աշակերտին' : 'Գրանցել Նոր Աշակերտ'}
                  </h2>
                  
                  {studentError && (
                      <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">
                          {studentError}
                      </div>
                  )}

                  <form onSubmit={handleSaveStudent} className="space-y-4">
                      <Input 
                          label="Անուն Ազգանուն" 
                          placeholder="Օրինակ՝ Արամ Արամյան"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                      />
                      <Input 
                          label="Դասարան" 
                          type="number"
                          placeholder="9"
                          min="1"
                          max="12"
                          value={studentGrade}
                          onChange={(e) => setStudentGrade(e.target.value)}
                      />
                      <Input 
                          label="Գաղտնաբառ" 
                          type="text" 
                          placeholder="Ստեղծեք գաղտնաբառ"
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                      />
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Ընտրել Ավատար (Պրոֆիլի նկար)</label>
                        
                        {/* Main Avatar Preview and Actions */}
                        <div className="flex flex-col items-center p-4 border border-gray-200 rounded-lg bg-gray-50">
                           {isCameraOpen ? (
                              <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden mb-3">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                                    <button type="button" onClick={stopCamera} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                    <button type="button" onClick={capturePhoto} className="bg-white text-primary p-3 rounded-full shadow-lg hover:bg-gray-100 ring-4 ring-primary/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                </div>
                              </div>
                           ) : (
                              <>
                                <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-4 ring-white shadow-md bg-gray-200">
                                  {(customAvatarUrl || studentAvatar) ? (
                                      <img src={customAvatarUrl || studentAvatar} alt="Preview" className="w-full h-full object-cover" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                      </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                   <button 
                                      type="button"
                                      onClick={startCamera}
                                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                                   >
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      Լուսանկարել
                                   </button>
                                   <button 
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="flex items-center px-3 py-1.5 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition"
                                   >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                      </svg>
                                      Բեռնել նկար
                                   </button>
                                   <input 
                                      type="file" 
                                      ref={fileInputRef} 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={handleFileUpload}
                                   />
                                </div>
                              </>
                           )}
                        </div>

                        {/* Presets */}
                        {!isCameraOpen && (
                          <>
                            <div className="flex gap-2 justify-between mt-3 overflow-x-auto pb-2">
                              {AVATAR_PRESETS.map((url, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => { setStudentAvatar(url); setCustomAvatarUrl(''); }}
                                  className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 transition-all ${studentAvatar === url && !customAvatarUrl ? 'border-primary ring-2 ring-primary ring-offset-2 scale-110' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                  <img src={url} alt={`Preset ${index}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                            <div className="mt-2">
                               <Input 
                                  placeholder="կամ մուտքագրեք նկարի հղում (URL)..."
                                  value={customAvatarUrl.startsWith('data:') ? '(Բեռնված նկար)' : customAvatarUrl}
                                  onChange={(e) => { 
                                      // Only allow editing if it's not a data URL (uploaded image)
                                      if (!e.target.value.startsWith('data:')) {
                                          setCustomAvatarUrl(e.target.value); 
                                          setStudentAvatar(''); 
                                      } else {
                                          // If they try to edit a data url text, just clear it
                                          setCustomAvatarUrl('');
                                      }
                                  }}
                                  className="text-xs"
                                  disabled={customAvatarUrl.startsWith('data:')}
                              />
                              {customAvatarUrl.startsWith('data:') && (
                                  <button 
                                      type="button" 
                                      onClick={() => setCustomAvatarUrl('')}
                                      className="text-xs text-red-500 hover:underline mt-1"
                                  >
                                      Ջնջել բեռնված նկարը
                                  </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex space-x-3 mt-8 pt-4 border-t">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="flex-1"
                            onClick={closeModal}
                          >
                              Չեղարկել
                          </Button>
                          <Button type="submit" className="flex-1">
                              {editingStudentId ? 'Պահպանել' : 'Գրանցել'}
                          </Button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
