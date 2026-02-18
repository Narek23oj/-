
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
    getTeacherAvatar
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

const TIMI_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=Timi';

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
  const [studentTeacher, setStudentTeacher] = useState(adminUsername || ''); 
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
      setStudentTeacher(adminUsername || ''); 
      setStudentPassword(''); 
      setStudentAvatar(''); 
      setCustomAvatarUrl('');
      setIsStudentModalOpen(true); stopCamera();
  };

  const openEditModal = (student: StudentProfile) => {
      setEditingStudentId(student.id);
      setStudentName(student.name); 
      setStudentGrade(student.grade); 
      setStudentTeacher(student.teacherName || adminUsername || '');
      setStudentPassword(student.password || '');
      if (AVATAR_PRESETS.includes(student.avatar || '')) { setStudentAvatar(student.avatar || ''); setCustomAvatarUrl(''); }
      else { setStudentAvatar(''); setCustomAvatarUrl(student.avatar || ''); }
      setIsStudentModalOpen(true); stopCamera();
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentGrade.trim()) { setStudentError('Անունը և Դասարանը պարտադիր են'); return; }
    
    const gradeNum = parseInt(studentGrade);
    if (gradeNum < 1 || gradeNum > 9) { setStudentError('Դասարանը պետք է լինի 1-ից 9։'); return; }

    const finalAvatar = customAvatarUrl.trim() || studentAvatar;
    const studentToSave: StudentProfile = {
        id: editingStudentId || generateId(),
        name: studentName.trim(),
        grade: studentGrade.trim(),
        teacherName: studentTeacher.trim(),
        password: studentPassword.trim(), 
        avatar: finalAvatar,
        joinedAt: Date.now(),
        isBlocked: false,
        score: editingStudentId ? (students.find(s=>s.id===editingStudentId)?.score) : 0
    };
    await saveStudent(studentToSave);
    setIsStudentModalOpen(false); stopCamera();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          {adminUsername && <p className="text-gray-500 font-medium">Welcome, {adminUsername}</p>}
        </div>
        <div className="flex gap-2">
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

      {/* ... Rest of existing dashboard code ... */}
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

      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Session List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold">Active Chats</h3>
                    <input 
                        placeholder="Search..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="text-sm border rounded px-2 py-1 w-32"
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredSessions.map(session => {
                        const sProfile = students.find(st => st.id === session.studentId);
                        const avatar = sProfile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${session.studentName}`;
                        
                        return (
                        <div 
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className={`p-3 rounded-lg cursor-pointer border transition-colors relative flex gap-3 items-start ${
                                selectedSession?.id === session.id 
                                ? 'bg-primary/10 border-primary' 
                                : session.isFlagged ? 'bg-red-50 border-red-300' : 'bg-white hover:bg-gray-50'
                            }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300">
                                <img src={avatar} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                {session.isFlagged && <span className="absolute top-2 right-2 text-xs bg-red-600 text-white px-1.5 rounded">18+ ALERT</span>}
                                <div className="font-medium truncate">{session.studentName}</div>
                                <div className="text-xs text-gray-500">{new Date(session.startTime).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-400 mt-1 line-clamp-1">{session.messages[session.messages.length-1]?.text}</div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* Chat Monitor */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                {selectedSession ? (
                    <>
                        <div className={`p-4 border-b flex justify-between items-center ${selectedSession.isFlagged ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <div>
                                <h3 className="font-bold">{selectedSession.studentName}</h3>
                                <p className="text-sm text-gray-500">{selectedSession.studentGrade}-րդ դասարան</p>
                            </div>
                            <Button variant="danger" onClick={(e) => handleDeleteSession(selectedSession.id, e)} className="text-xs py-1">Delete Chat</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {selectedSession.messages.map(msg => {
                                const isUser = msg.role === 'user';
                                const avatar = isUser 
                                    ? (students.find(s => s.id === selectedSession.studentId)?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedSession.studentName}`)
                                    : TIMI_AVATAR;

                                return (
                                <div key={msg.id} className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300">
                                        <img src={avatar} className="w-full h-full object-cover" />
                                    </div>
                                    <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${isUser ? 'bg-blue-100 text-blue-900 rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                                        <span className="text-xs font-bold block mb-1 opacity-50">{isUser ? 'Student' : 'TIMI AI'}</span>
                                        <MarkdownRenderer content={msg.text} />
                                    </div>
                                </div>
                            )})}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">Select a session to monitor</div>
                )}
            </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isStudentModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">{editingStudentId ? 'Edit Student' : 'Register New Student'}</h2>
                  {studentError && <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm">{studentError}</div>}
                  <form onSubmit={handleSaveStudent} className="space-y-4">
                      <Input label="Full Name" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Name Surname" />
                      <Input label="Grade (1-9)" type="number" min="1" max="9" value={studentGrade} onChange={e => setStudentGrade(e.target.value)} />
                      
                      {/* Teacher Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                        <select 
                            value={studentTeacher} 
                            onChange={(e) => setStudentTeacher(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        >
                            {ADMIN_USERNAMES.map(admin => (
                                <option key={admin} value={admin}>{admin}</option>
                            ))}
                        </select>
                      </div>

                      <Input label="Password (Optional - Student can set it)" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} />
                      
                      {/* Avatar UI */}
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Profile Picture</label>
                          <div className="flex items-center justify-center p-4 border rounded bg-gray-50 flex-col">
                              {isCameraOpen ? (
                                  <div className="relative w-full bg-black rounded overflow-hidden">
                                      <video ref={videoRef} autoPlay playsInline className="w-full" />
                                      <button type="button" onClick={capturePhoto} className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full p-2 shadow-lg z-10">📸</button>
                                  </div>
                              ) : (
                                  <div className="text-center w-full">
                                      <div className="w-24 h-24 mx-auto rounded-full bg-gray-200 overflow-hidden mb-3 ring-4 ring-white shadow-md relative group">
                                          {(customAvatarUrl || studentAvatar) ? (
                                             <img src={customAvatarUrl || studentAvatar} className="w-full h-full object-cover" />
                                          ) : (
                                             <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                          )}
                                          {(customAvatarUrl || studentAvatar) && (
                                              <button 
                                                type="button" 
                                                onClick={() => { setCustomAvatarUrl(''); setStudentAvatar(''); }}
                                                className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center font-bold text-xs"
                                              >
                                                  Remove
                                              </button>
                                          )}
                                      </div>
                                      <div className="flex justify-center gap-2">
                                          <button type="button" onClick={startCamera} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition">Camera</button>
                                          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm bg-gray-700 text-white px-3 py-1.5 rounded hover:bg-gray-800 transition">Upload</button>
                                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
                                      </div>
                                  </div>
                              )}
                          </div>
                          {!isCameraOpen && (
                              <div className="mt-2">
                                  <p className="text-xs text-gray-500 mb-1">Or choose a preset:</p>
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                      {AVATAR_PRESETS.map(url => (
                                          <button 
                                            key={url} 
                                            type="button" 
                                            onClick={() => {setStudentAvatar(url); setCustomAvatarUrl('')}} 
                                            className={`w-10 h-10 rounded-full border-2 overflow-hidden hover:scale-110 transition shrink-0 ${studentAvatar === url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                                          >
                                              <img src={url} className="w-full h-full object-cover" />
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-3 pt-4">
                          <Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)} className="flex-1">Cancel</Button>
                          <Button type="submit" className="flex-1">Save</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
