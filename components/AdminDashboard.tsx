
import React, { useState, useEffect, useRef } from 'react';
import { 
    deleteSession, 
    toggleStudentBlockStatus, 
    saveStudent, 
    generateId, 
    deleteStudent,
    bulkImportStudents,
    exportDatabase,
    restoreDatabase,
    subscribeToStudents,
    subscribeToSessions,
    subscribeToQuestions,
    saveQuestion,
    deleteQuestion,
    setStudentScore,
    saveTeacherAvatar,
    getTeacherAvatar,
    migrateLocalToCloud
} from '../services/storageService';
import { generateQuizQuestions } from '../services/geminiService';
import { ChatSession, StudentProfile, QuizQuestion, ADMIN_USERNAMES, MAIN_ADMIN } from '../types';
import Button from './Button';
import Input from './Input';
import MarkdownRenderer from './MarkdownRenderer';

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Timi',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Narek',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Ana',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Dav'
];

interface AdminDashboardProps {
    adminUsername?: string | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUsername }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'students' | 'quizzes' | 'profile'>('sessions');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Student Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentTeacher, setStudentTeacher] = useState(adminUsername || ADMIN_USERNAMES[0]); 
  const [studentPassword, setStudentPassword] = useState('');
  const [studentAvatar, setStudentAvatar] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [studentError, setStudentError] = useState('');

  // Admin Profile State
  const [adminAvatar, setAdminAvatar] = useState('');
  const [adminAvatarPreview, setAdminAvatarPreview] = useState('');

  // Score Editing State
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<string>('');

  // Quiz Management State
  const [newSubject, setNewSubject] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [newPoints, setNewPoints] = useState(10);
  const [selectedFilterSubject, setSelectedFilterSubject] = useState<string>('All');

  // AI Generator State
  const [aiTopic, setAiTopic] = useState('');
  const [aiGrade, setAiGrade] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Camera & Refs
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminFileRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubStudents = subscribeToStudents(setStudents);
    const unsubSessions = subscribeToSessions(setSessions);
    const unsubQuestions = subscribeToQuestions(setQuestions);

    if (adminUsername) {
        getTeacherAvatar(adminUsername).then(url => {
            if (url) setAdminAvatar(url);
        });
    }

    return () => {
      stopCamera();
      unsubStudents();
      if(unsubSessions) unsubSessions();
      unsubQuestions();
    };
  }, [adminUsername]);

  // --- Filtering ---
  const filteredStudents = students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.grade.includes(searchTerm)
  );

  const filteredSessions = sessions.filter(s => 
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Migration Logic ---
  const handleMigrate = async () => {
      if(!window.confirm("Այս գործողությունը կուղարկի ձեր սարքի հին տվյալները Cloud: Շարունակե՞լ:")) return;
      setIsMigrating(true);
      const res = await migrateLocalToCloud();
      alert(res);
      setIsMigrating(false);
  };

  // --- Admin Profile Logic ---
  const handleAdminAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const result = event.target?.result as string;
              setAdminAvatarPreview(result);
          };
          reader.readAsDataURL(file);
      }
  };

  const saveAdminProfile = async () => {
      if (adminUsername && adminAvatarPreview) {
          await saveTeacherAvatar(adminUsername, adminAvatarPreview);
          setAdminAvatar(adminAvatarPreview);
          alert('Profile picture updated successfully!');
      }
  };

  // --- Quiz Logic ---
  const handleAddQuestion = async () => {
      if (!newSubject.trim() || !newQuestionText.trim() || newOptions.some(o => !o.trim())) {
          alert("Խնդրում ենք լրացնել բոլոր դաշտերը");
          return;
      }

      const question: QuizQuestion = {
          id: generateId(),
          subject: newSubject.trim(),
          question: newQuestionText.trim(),
          options: newOptions,
          correctAnswer: correctOption,
          points: newPoints
      };

      await saveQuestion(question);
      setNewQuestionText('');
      setNewOptions(['', '', '', '']);
      alert("Հարցը ավելացվեց!");
  };

  const handleGenerateQuestions = async () => {
      if (!newSubject.trim() || !aiTopic.trim()) {
          alert("Խնդրում ենք լրացնել Առարկան և Թեման (Subject & Topic)");
          return;
      }
      setIsGenerating(true);
      try {
          const genQuestions = await generateQuizQuestions(newSubject, aiTopic, aiGrade, 5);
          for (const q of genQuestions) {
              await saveQuestion(q);
          }
          if (genQuestions.length > 0) {
              alert(`Հաջողությամբ գեներացվեց ${genQuestions.length} հարց:`);
              setAiTopic('');
          } else {
              alert("Հարցեր չգեներացվեցին։ Փորձեք կրկին։");
          }
      } catch (error) {
          console.error(error);
          alert("Սխալ տեղի ունեցավ գեներացման ժամանակ։");
      } finally {
          setIsGenerating(false);
      }
  };
  
  const handleDeleteQuestion = async (id: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (window.confirm('Are you sure you want to delete this question?')) {
          await deleteQuestion(id);
      }
  };

  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject)));

  // --- Score Editing ---
  const startEditingScore = (student: StudentProfile) => {
      setEditingScoreId(student.id);
      setTempScore(student.score?.toString() || '0');
  };

  const saveScore = async (studentId: string) => {
      const score = parseInt(tempScore);
      if (!isNaN(score)) {
          await setStudentScore(studentId, score);
      }
      setEditingScoreId(null);
  };

  const viewStudentHistory = (studentName: string) => {
      setSearchTerm(studentName);
      setActiveTab('sessions');
  };

  // --- Session Flagging ---
  const flaggedSessionsCount = sessions.filter(s => s.isFlagged).length;

  // --- Existing Logic (Camera, Modals, Import/Export) ---
  const handleExportData = async () => {
      const jsonString = await exportDatabase();
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
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) await restoreDatabase(content);
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) await bulkImportStudents(content);
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleDeleteSession = async (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (window.confirm('Ջնջե՞լ այս սեսիան։')) {
      await deleteSession(id);
      if (selectedSession?.id === id) setSelectedSession(null);
    }
  };

  const handleToggleBlock = async (studentId: string) => await toggleStudentBlockStatus(studentId);
  
  const handleDeleteStudent = async (studentId: string, e?: React.MouseEvent) => { 
      e?.preventDefault();
      e?.stopPropagation();
      if (window.confirm('Ջնջե՞լ աշակերտին։')) {
          await deleteStudent(studentId);
      }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setIsCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) { setStudentError("Camera not available"); }
  };

  const stopCamera = () => {
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 400, 400); // Simplified crop
        setCustomAvatarUrl(canvas.toDataURL('image/jpeg', 0.8));
        setStudentAvatar('');
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { setCustomAvatarUrl(event.target?.result as string); setStudentAvatar(''); };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
      setEditingStudentId(null);
      setStudentName(''); 
      setStudentGrade(''); 
      setStudentTeacher(adminUsername || ADMIN_USERNAMES[0]); 
      setStudentPassword(''); 
      setStudentAvatar(''); 
      setCustomAvatarUrl('');
      setStudentError(''); // Reset error
      setIsStudentModalOpen(true); stopCamera();
  };

  const openEditModal = (student: StudentProfile) => {
      setEditingStudentId(student.id);
      setStudentName(student.name); 
      setStudentGrade(student.grade); 
      setStudentTeacher(student.teacherName || adminUsername || ADMIN_USERNAMES[0]);
      setStudentPassword(student.password || '');
      setStudentError(''); // Reset error
      if (AVATAR_PRESETS.includes(student.avatar || '')) { setStudentAvatar(student.avatar || ''); setCustomAvatarUrl(''); }
      else { setStudentAvatar(''); setCustomAvatarUrl(student.avatar || ''); }
      setIsStudentModalOpen(true); stopCamera();
  };

  const closeModal = () => {
    setIsStudentModalOpen(false);
    stopCamera();
  };

  const handleSaveStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStudentError('');

    if (!studentName.trim()) { setStudentError('Անունը պարտադիր է'); return; }
    if (!studentGrade.trim()) { setStudentError('Դասարանը պարտադիր է'); return; }
    
    const gradeNum = parseInt(studentGrade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 9) { setStudentError('Դասարանը պետք է լինի 1-ից 9 (թիվ)։'); return; }

    // Ensure teacher is set
    const finalTeacher = studentTeacher.trim() || ADMIN_USERNAMES[0];

    const finalAvatar = customAvatarUrl.trim() || studentAvatar;

    // Preserve existing data if editing
    const existingStudent = editingStudentId ? students.find(s => s.id === editingStudentId) : null;

    const studentToSave: StudentProfile = {
        id: editingStudentId || generateId(),
        name: studentName.trim(),
        grade: studentGrade.trim(),
        teacherName: finalTeacher,
        password: studentPassword.trim(), 
        avatar: finalAvatar,
        // Crucial: Preserve joinedAt if editing, or set new if adding
        joinedAt: existingStudent?.joinedAt || Date.now(),
        isBlocked: existingStudent?.isBlocked || false,
        score: existingStudent?.score || 0
    };
    
    try {
        // saveStudent now uses { merge: true }, ensuring we don't accidentally wipe
        // fields that might exist in DB but not in our interface (future-proofing)
        await saveStudent(studentToSave);
        closeModal();
    } catch (err) {
        console.error("Failed to save student", err);
        setStudentError("Սխալ տեղի ունեցավ պահպանելիս։");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          {adminUsername && <p className="text-gray-500 font-medium">Welcome, {adminUsername}</p>}
        </div>
        <div className="flex gap-2">
            <Button 
                variant="primary" 
                onClick={handleMigrate} 
                isLoading={isMigrating}
                className="bg-orange-600 hover:bg-orange-700 text-white"
            >
                ☁️ Sync Local Data
            </Button>
            <Button variant="ghost" onClick={handleExportData} className="bg-white border">Backup</Button>
            <Button variant="ghost" onClick={() => backupInputRef.current?.click()} className="bg-white border">Restore</Button>
            <input type="file" ref={backupInputRef} onChange={handleRestoreData} className="hidden" accept=".json" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-6 bg-gray-200 p-1 rounded-lg w-fit overflow-x-auto">
         {['sessions', 'students', 'quizzes', 'profile'].map(tab => (
             <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'bg-white shadow text-primary' : 'text-gray-600'}`}
             >
                 {tab === 'sessions' && flaggedSessionsCount > 0 ? `Chat Monitor (⚠️ ${flaggedSessionsCount})` : 
                  tab === 'students' ? 'Students & Scores' : 
                  tab === 'profile' ? 'My Profile' : 'Subjects & Quiz'}
             </button>
         ))}
      </div>

      {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow border p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Teacher Profile</h2>
              <div className="flex flex-col items-center space-y-6">
                  <div className="relative w-32 h-32">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 shadow-lg bg-gray-200">
                          <img 
                            src={adminAvatarPreview || adminAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${adminUsername}`} 
                            alt="Admin" 
                            className="w-full h-full object-cover" 
                          />
                      </div>
                      <button 
                        onClick={() => adminFileRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow hover:bg-indigo-700 transition"
                      >
                          ✏️
                      </button>
                  </div>
                  <input type="file" ref={adminFileRef} onChange={handleAdminAvatarUpload} className="hidden" accept="image/*" />
                  
                  <div className="text-center">
                      <h3 className="text-xl font-bold">{adminUsername}</h3>
                      <p className="text-gray-500">
                          {adminUsername === MAIN_ADMIN.username ? 'Principal / Main Administrator' : 'Teacher / Administrator'}
                      </p>
                      {adminUsername === MAIN_ADMIN.username && (
                          <p className="text-xs text-indigo-600 mt-1">
                              Email visible to all students: {MAIN_ADMIN.email}
                          </p>
                      )}
                  </div>

                  {adminAvatarPreview && (
                      <Button onClick={saveAdminProfile} className="w-full max-w-xs">
                          Save New Picture
                      </Button>
                  )}
              </div>
          </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[700px]">
           {/* Session List */}
           <div className="md:col-span-1 bg-white rounded-xl shadow border overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50">
                  <Input placeholder="Search students..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex-1 overflow-y-auto">
                 {filteredSessions.length === 0 && <p className="text-gray-400 p-4 text-center">No sessions found</p>}
                 {filteredSessions.map(session => (
                     <div 
                        key={session.id} 
                        onClick={() => setSelectedSession(session)}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${selectedSession?.id === session.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                     >
                         <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-gray-800">{session.studentName}</span>
                            {session.isFlagged && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">FLAGGED</span>}
                         </div>
                         <div className="text-xs text-gray-500 flex justify-between">
                            <span>{new Date(session.startTime).toLocaleString()}</span>
                            <span>{session.messages.length} msgs</span>
                         </div>
                     </div>
                 ))}
              </div>
           </div>

           {/* Chat View */}
           <div className="md:col-span-2 bg-white rounded-xl shadow border flex flex-col overflow-hidden">
               {selectedSession ? (
                   <>
                   <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                       <div>
                           <h3 className="font-bold">{selectedSession.studentName}</h3>
                           <p className="text-xs text-gray-500">{new Date(selectedSession.startTime).toLocaleString()}</p>
                       </div>
                       <Button variant="danger" onClick={(e) => handleDeleteSession(selectedSession.id, e)} className="text-sm px-3 py-1">Delete Log</Button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                       {selectedSession.messages.map(msg => (
                           <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                               <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900' : 'bg-white border text-gray-800'}`}>
                                   <p className="font-bold text-xs mb-1 opacity-50">{msg.role === 'user' ? selectedSession.studentName : 'TIMI AI'}</p>
                                   <div className="whitespace-pre-wrap"><MarkdownRenderer content={msg.text} /></div>
                               </div>
                           </div>
                       ))}
                   </div>
                   </>
               ) : (
                   <div className="flex-1 flex items-center justify-center text-gray-400">Select a session to view details</div>
               )}
           </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Input 
                    placeholder="Search students..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="max-w-xs"
                />
                <div className="flex gap-2">
                    <Button onClick={() => csvInputRef.current?.click()} variant="secondary">Import CSV</Button>
                    <input type="file" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" accept=".csv" />
                    <Button onClick={openAddModal}>+ Add Student</Button>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow border overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map(s => (
                            <tr key={s.id} className={s.isBlocked ? 'bg-red-50' : ''}>
                                <td className="px-6 py-4 whitespace-nowrap flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden mr-3">
                                        <img src={s.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} alt="" className="h-full w-full object-cover" />
                                    </div>
                                    <span className="font-medium text-gray-900">{s.name}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.grade}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.teacherName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{s.password || '<Not Set>'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {editingScoreId === s.id ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={tempScore} 
                                                onChange={(e) => setTempScore(e.target.value)}
                                                className="w-16 border rounded px-1 py-0.5"
                                            />
                                            <button onClick={() => saveScore(s.id)} className="text-green-600">✓</button>
                                            <button onClick={() => setEditingScoreId(null)} className="text-red-600">✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-yellow-600">{s.score || 0}</span>
                                            <button onClick={() => startEditingScore(s)} className="text-gray-400 hover:text-blue-600">✎</button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {s.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        type="button" 
                                        onClick={() => viewStudentHistory(s.name)} 
                                        className="text-blue-600 hover:text-blue-900 mr-4 bg-blue-50 px-2 py-1 rounded"
                                    >
                                        📜 History
                                    </button>
                                    <button type="button" onClick={() => openEditModal(s)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                    <button type="button" onClick={() => handleToggleBlock(s.id)} className="text-orange-600 hover:text-orange-900 mr-4">{s.isBlocked ? 'Unblock' : 'Block'}</button>
                                    <button type="button" onClick={(e) => handleDeleteStudent(s.id, e)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Quizzes Tab */}
      {activeTab === 'quizzes' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Forms */}
              <div className="space-y-6">
                  {/* AI Generator Box */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl shadow border border-indigo-100 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🤖</div>
                      <h3 className="text-lg font-bold mb-4 text-indigo-900 flex items-center gap-2">
                          <span>⚡</span> AI Question Generator
                      </h3>
                      <div className="space-y-4 relative z-10">
                          <Input 
                            label="Subject" 
                            value={newSubject} 
                            onChange={(e) => setNewSubject(e.target.value)} 
                            placeholder="e.g. Mathematics"
                            list="subjects-list"
                          />
                          <datalist id="subjects-list">
                            {uniqueSubjects.map(s => <option key={s} value={s} />)}
                          </datalist>

                          <div className="flex gap-4">
                              <div className="flex-1">
                                  <Input 
                                    label="Topic" 
                                    value={aiTopic} 
                                    onChange={(e) => setAiTopic(e.target.value)} 
                                    placeholder="e.g. Fractions"
                                  />
                              </div>
                              <div className="w-24">
                                  <Input 
                                    label="Grade" 
                                    type="number" 
                                    value={aiGrade} 
                                    onChange={(e) => setAiGrade(e.target.value)} 
                                  />
                              </div>
                          </div>
                          
                          <Button 
                            onClick={handleGenerateQuestions} 
                            isLoading={isGenerating} 
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                          >
                              {isGenerating ? 'Generating...' : '✨ Generate 5 Questions'}
                          </Button>
                      </div>
                  </div>

                  {/* Manual Add Form */}
                  <div className="bg-white p-6 rounded-xl shadow border">
                      <h3 className="text-lg font-bold mb-4">Manual Add</h3>
                      <div className="space-y-4">
                          <Input 
                            label="Subject" 
                            value={newSubject} 
                            onChange={(e) => setNewSubject(e.target.value)} 
                          />

                          <Input 
                            label="Question Text" 
                            value={newQuestionText} 
                            onChange={(e) => setNewQuestionText(e.target.value)} 
                          />
                          
                          <div className="space-y-2">
                              <label className="text-sm font-medium">Options</label>
                              {newOptions.map((opt, idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                      <input 
                                        type="radio" 
                                        name="correctOpt" 
                                        checked={correctOption === idx} 
                                        onChange={() => setCorrectOption(idx)}
                                        className="h-4 w-4 text-primary"
                                      />
                                      <input 
                                        className="flex-1 border rounded px-3 py-2 text-sm"
                                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                        value={opt}
                                        onChange={(e) => {
                                            const newOpts = [...newOptions];
                                            newOpts[idx] = e.target.value;
                                            setNewOptions(newOpts);
                                        }}
                                      />
                                  </div>
                              ))}
                          </div>

                          <Input 
                            label="Points" 
                            type="number" 
                            value={newPoints} 
                            onChange={(e) => setNewPoints(parseInt(e.target.value))} 
                          />

                          <Button onClick={handleAddQuestion} className="w-full" variant="secondary">Add Manually</Button>
                      </div>
                  </div>
              </div>

              {/* List Questions */}
              <div className="bg-white p-6 rounded-xl shadow border flex flex-col h-[800px]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">Question Bank ({questions.length})</h3>
                      <select 
                        value={selectedFilterSubject} 
                        onChange={(e) => setSelectedFilterSubject(e.target.value)}
                        className="border rounded px-2 py-1 max-w-[150px]"
                      >
                          <option value="All">All Subjects</option>
                          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {questions.length === 0 && <p className="text-gray-400 text-center mt-10">No questions yet.</p>}
                      {questions.filter(q => selectedFilterSubject === 'All' || q.subject === selectedFilterSubject).map(q => (
                          <div key={q.id} className="p-3 border rounded hover:bg-gray-50 group">
                              <div className="flex justify-between">
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{q.subject}</span>
                                  <button type="button" onClick={(e) => handleDeleteQuestion(q.id, e)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                              </div>
                              <p className="font-medium mt-1 text-sm">{q.question}</p>
                              <div className="text-xs text-gray-500 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {q.options.map((o, i) => (
                                      <span key={i} className={`truncate ${i === q.correctAnswer ? "text-green-600 font-bold" : ""}`}>
                                          {String.fromCharCode(65+i)}. {o}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Student Modal */}
      {isStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg">{editingStudentId ? 'Edit Student' : 'Add New Student'}</h3>
                      <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <form className="space-y-4">
                          <Input label="Name" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Full Name" />
                          <div className="grid grid-cols-2 gap-4">
                             <Input label="Grade" type="number" value={studentGrade} onChange={e => setStudentGrade(e.target.value)} min="1" max="9" />
                             <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                                <select 
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={studentTeacher}
                                    onChange={e => setStudentTeacher(e.target.value)}
                                >
                                    {ADMIN_USERNAMES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                             </div>
                          </div>
                          
                          <Input label="Password (Optional)" type="text" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} placeholder="Leave empty for student setup" />

                          {/* Avatar Section */}
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Photo / Avatar</label>
                              <div className="flex gap-4 items-start">
                                  <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300 relative">
                                      <img 
                                        src={customAvatarUrl || studentAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${studentName || 'New'}`} 
                                        className="w-full h-full object-cover" 
                                      />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                      {!isCameraOpen ? (
                                          <>
                                            <Button type="button" variant="secondary" onClick={startCamera} className="w-full text-sm">📸 Take Photo</Button>
                                            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()} className="w-full text-sm border">Upload File</Button>
                                          </>
                                      ) : (
                                          <div className="flex flex-col gap-2">
                                              <div className="aspect-square bg-black rounded overflow-hidden relative">
                                                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                              </div>
                                              <div className="flex gap-2">
                                                  <Button type="button" onClick={capturePhoto} className="flex-1 text-xs">Capture</Button>
                                                  <Button type="button" variant="danger" onClick={stopCamera} className="flex-1 text-xs">Cancel</Button>
                                              </div>
                                          </div>
                                      )}
                                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                                      
                                      <div className="flex gap-1 overflow-x-auto py-2">
                                          {AVATAR_PRESETS.map(url => (
                                              <img 
                                                key={url} 
                                                src={url} 
                                                onClick={() => { setStudentAvatar(url); setCustomAvatarUrl(''); }}
                                                className="w-8 h-8 rounded-full cursor-pointer border hover:border-primary"
                                              />
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                          
                          {studentError && <p className="text-red-600 text-sm font-bold bg-red-50 p-2 rounded">{studentError}</p>}

                          <div className="pt-4 flex gap-3">
                              <Button type="button" variant="ghost" onClick={closeModal} className="flex-1 border">Cancel</Button>
                              <Button type="button" onClick={(e) => handleSaveStudent(e)} className="flex-1">Save Student</Button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
