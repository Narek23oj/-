
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
    migrateLocalToCloud,
    updateStudentFields,
    sendNotification,
    subscribeToTeachers,
    addTeacher,
    removeTeacher,
    subscribeToTeacherMessages,
    sendTeacherMessage
} from '../services/storageService';
import { sendMessageToGemini } from '../services/geminiService';
import { ChatSession, StudentProfile, QuizQuestion, SUPER_ADMINS, MAIN_ADMIN, Notification, TeacherProfile, INITIAL_ADMINS, TeacherMessage, Message } from '../types';
import Button from './Button';
import Input from './Input';
import MarkdownRenderer from './MarkdownRenderer';
import Avatar from './Avatar'; 

// Reuse Logo for Admin Dashboard (Purple text)
const TIMILogoAdmin = () => (
    <svg width="80" height="32" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="5" y="32" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="34" fill="#6020A0" letterSpacing="2">TIMI</text>
        <circle cx="92" cy="14" r="5" fill="#FF8000" />
        <rect x="88" y="22" width="8" height="10" fill="#FF8000" />
    </svg>
);

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Timi',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Narek',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Ana',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Dav'
];

const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 500; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Image load failed"));
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
    });
};

interface AdminDashboardProps {
    adminUsername?: string | null;
}

const ADMIN_TABS = (
  isSuperAdmin: boolean,
  flaggedSessionsCount: number
) => [
  { id: 'sessions', label: `Chat (⚠️ ${flaggedSessionsCount})` },
  { id: 'teachers_room', label: '☕ Ուսուցչանոց' },
  { id: 'students', label: 'Students' },
  { id: 'quizzes', label: 'Quiz' },
  { id: 'notifications', label: '🔔 Notifs' },
  { id: 'profile', label: 'Profile' },
  ...(isSuperAdmin ? [{ id: 'teachers', label: '👨‍🏫 Teachers' }] : []),
  { id: 'archive', label: '🗄️ Archive' }
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUsername }) => {
  const isSuperAdmin = adminUsername ? SUPER_ADMINS.includes(adminUsername) : false;

  const [activeTab, setActiveTab] = useState<'sessions' | 'students' | 'quizzes' | 'profile' | 'notifications' | 'teachers' | 'teachers_room' | 'archive'>('sessions');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Bulk Action State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Student Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [teacherList, setTeacherList] = useState<string[]>(INITIAL_ADMINS);
  const [studentTeacher, setStudentTeacher] = useState(adminUsername || INITIAL_ADMINS[0]); 
  const [studentPassword, setStudentPassword] = useState('');
  const [studentAvatar, setStudentAvatar] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [studentError, setStudentError] = useState('');

  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'ALL' | 'GRADE' | 'USER'>('ALL');
  const [notifTargetValue, setNotifTargetValue] = useState(''); 
  const [notifAttachment, setNotifAttachment] = useState<string>('');
  const [notifSending, setNotifSending] = useState(false);
  const notifFileRef = useRef<HTMLInputElement>(null);

  // Teacher Management State
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);

  // Teachers' Room (Chat) State
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [newTeacherMessage, setNewTeacherMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false); 
  const teacherChatEndRef = useRef<HTMLDivElement>(null);

  // Quick Message State
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTargetStudent, setMessageTargetStudent] = useState<StudentProfile | null>(null);
  const [quickMessage, setQuickMessage] = useState('');

  // Admin Profile State
  const [adminAvatar, setAdminAvatar] = useState('');
  const [adminAvatarPreview, setAdminAvatarPreview] = useState('');
  const [isAdminSaving, setIsAdminSaving] = useState(false);

  // Score Editing State
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<string>('');

  // Quiz Management State
  const [quizSearchTerm, setQuizSearchTerm] = useState('');
  const [selectedFilterSubject, setSelectedFilterSubject] = useState<string>('All');
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);


  const [newSubject, setNewSubject] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [newPoints, setNewPoints] = useState(10);


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
    const unsubTeacherMessages = subscribeToTeacherMessages(setTeacherMessages);
    
    const unsubTeachers = subscribeToTeachers((dbTeachers) => {
        const combinedTeachers: TeacherProfile[] = [...dbTeachers];
        const dbTeacherNames = new Set(dbTeachers.map(t => t.username));
        INITIAL_ADMINS.forEach(initialAdmin => {
            if (!dbTeacherNames.has(initialAdmin)) {
                combinedTeachers.push({
                    username: initialAdmin,
                    addedBy: 'SYSTEM',
                    joinedAt: 0, 
                    avatar: ''
                });
            }
        });
        combinedTeachers.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
        setTeachers(combinedTeachers);
        setTeacherList(combinedTeachers.map(t => t.username));
    });

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
      unsubTeachers();
      unsubTeacherMessages();
    };
  }, [adminUsername]);

  useEffect(() => {
      setSelectedStudentIds([]);
  }, [activeTab, searchTerm]);

  // AUTO SCROLL TO BOTTOM OF CHAT
  useEffect(() => {
      if (activeTab === 'teachers_room') {
          setTimeout(() => {
            teacherChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      }
  }, [teacherMessages, activeTab, isAiTyping]); 

  // --- Filtering ---
  const filteredStudents = students.filter(s => 
      (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.grade || "").toString().includes(searchTerm)
  );

  const filteredTeachers = teachers.filter(t => 
      (t.username || "").toLowerCase().includes(teacherSearchTerm.toLowerCase())
  );

  const filteredSessions = sessions.filter(s => 
      (s.studentName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject)));
  const filteredQuestions = questions.filter(q => {
      const matchesSearch = (q.question || "").toLowerCase().includes(quizSearchTerm.toLowerCase());
      const matchesSubject = selectedFilterSubject === 'All' || q.subject === selectedFilterSubject;
      return matchesSearch && matchesSubject;
  });

  // --- Teacher Chat Logic ---
  const handleSendTeacherMessage = async () => {
      if (!newTeacherMessage.trim()) return;
      
      const currentMsgText = newTeacherMessage.trim();
      const userMsg: TeacherMessage = {
          id: generateId(),
          sender: adminUsername || 'Unknown',
          text: currentMsgText,
          timestamp: Date.now(),
          avatar: adminAvatar
      };

      setNewTeacherMessage('');
      await sendTeacherMessage(userMsg);

      // Trigger AI if message contains keywords
      const lowerMsg = currentMsgText.toLowerCase();
      // Broad matching for Armenian users
      if (lowerMsg.includes('@ai') || lowerMsg.includes('timi') || lowerMsg.includes('թիմի') || lowerMsg.includes('տիմի')) {
          setIsAiTyping(true); // START TYPING
          
          try {
              // Prepare Student Context (Light version to save tokens)
              const studentContext = students.map(s => `Name: ${s.name}, Grade: ${s.grade}, ID: ${s.id}, Score: ${s.score}`).join('\n');
              
              // NEW: Prepare History with sender names
              // Take last 10 messages
              const recentHistory = teacherMessages.slice(-10);
              const formattedHistory: Message[] = recentHistory.map(m => ({
                  id: m.id,
                  role: m.sender === 'TIMI (AI)' ? 'model' : 'user',
                  // Inject sender name into text for context awareness
                  text: `${m.sender}: ${m.text}`,
                  timestamp: m.timestamp
              }));

              const response = await sendMessageToGemini(formattedHistory, currentMsgText, true, studentContext);
              
              const aiMsg: TeacherMessage = {
                  id: generateId(),
                  sender: 'TIMI (AI)',
                  text: response.text,
                  timestamp: Date.now(),
                  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Timi',
                  relatedStudentIds: response.relatedStudentIds || []
              };
              await sendTeacherMessage(aiMsg);
          } catch (e) {
              console.error(e);
              // Fallback error message in chat if something critical failed
              const errorMsg: TeacherMessage = {
                  id: generateId(),
                  sender: 'TIMI (System)',
                  text: '⚠️ Սխալ տեղի ունեցավ AI-ի հետ կապ հաստատելիս։',
                  timestamp: Date.now()
              };
              await sendTeacherMessage(errorMsg);
          } finally {
              setIsAiTyping(false); // STOP TYPING ALWAYS
          }
      }
  };

  // --- Notification Logic ---
  const handleNotifFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              if (file.type.startsWith('image/')) {
                  const url = await resizeImage(file);
                  setNotifAttachment(url);
              } else {
                  if (file.size > 500 * 1024) { 
                      alert("File too large. Max 500KB.");
                      return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                      setNotifAttachment(ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
              }
          } catch (e) {
              console.error(e);
              alert("Error reading file.");
          }
      }
  };

  const handleSendNotification = async () => {
      if (!notifTitle.trim() || !notifMessage.trim()) {
          alert("Title and Message are required.");
          return;
      }
      if (notifTarget === 'GRADE' && !notifTargetValue) {
          alert("Please specify a grade.");
          return;
      }
      if (notifTarget === 'USER' && !notifTargetValue) {
          alert("Please specify a user ID.");
          return;
      }

      setNotifSending(true);
      try {
          const newNotif: Notification = {
              id: generateId(),
              title: notifTitle,
              message: notifMessage,
              sender: adminUsername || 'Admin',
              targetType: notifTarget,
              targetValue: notifTargetValue,
              timestamp: Date.now(),
              readBy: []
          };

          if (notifAttachment) {
              newNotif.attachmentUrl = notifAttachment;
              newNotif.attachmentType = notifAttachment.startsWith('data:image') ? 'image' : 'file';
          }

          await sendNotification(newNotif);
          alert("Notification Sent!");
          setNotifTitle('');
          setNotifMessage('');
          setNotifAttachment('');
          if(notifFileRef.current) notifFileRef.current.value = '';
      } catch (e) {
          console.error(e);
          alert("Failed to send.");
      } finally {
          setNotifSending(false);
      }
  };

  const handleSendQuickMessage = async () => {
      if (!messageTargetStudent || !quickMessage.trim()) return;
      
      setNotifSending(true);
      try {
          const newNotif: Notification = {
              id: generateId(),
              title: `Հաղորդագրություն ${adminUsername}-ից`,
              message: quickMessage.trim(),
              sender: adminUsername || 'Admin',
              targetType: 'USER',
              targetValue: messageTargetStudent.id,
              timestamp: Date.now(),
              readBy: []
          };

          await sendNotification(newNotif);
          alert("Հաղորդագրությունը ուղարկվեց:");
          setQuickMessage('');
          setIsMessageModalOpen(false);
      } catch (e) {
          alert("Չհաջողվեց ուղարկել:");
      } finally {
          setNotifSending(false);
      }
  };

  // --- Bulk Action Logic ---
  const toggleSelectStudent = (id: string) => {
      setSelectedStudentIds(prev => 
          prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
  };

  const toggleSelectAll = () => {
      if (selectedStudentIds.length === filteredStudents.length) {
          setSelectedStudentIds([]);
      } else {
          setSelectedStudentIds(filteredStudents.map(s => s.id));
      }
  };

  const handleBulkDelete = async () => {
      if (!confirm(`Are you sure you want to DELETE ${selectedStudentIds.length} students? This cannot be undone.`)) return;
      try {
          await Promise.all(selectedStudentIds.map(id => deleteStudent(id)));
          setSelectedStudentIds([]);
      } catch (e) {
          alert("Error deleting students.");
      }
  };

  const handleBulkBlock = async (shouldBlock: boolean) => {
      try {
          await Promise.all(selectedStudentIds.map(id => updateStudentFields(id, { isBlocked: shouldBlock })));
          setSelectedStudentIds([]);
      } catch (e) {
          alert("Error updating status.");
      }
  };

  const handleBulkAssignTeacher = async () => {
      const newTeacher = prompt(`Enter teacher name to assign to ${selectedStudentIds.length} students:`, adminUsername || "");
      if (!newTeacher) return;
      try {
          await Promise.all(selectedStudentIds.map(id => updateStudentFields(id, { teacherName: newTeacher })));
          setSelectedStudentIds([]);
      } catch (e) {
          alert("Error assigning teacher.");
      }
  };

  // --- Migration Logic ---
  const handleMigrate = async () => {
      if(!window.confirm("Այս գործողությունը կուղարկի ձեր սարքի հին տվյալները Cloud: Շարունակե՞լ:")) return;
      setIsMigrating(true);
      const res = await migrateLocalToCloud();
      alert(res);
      setIsMigrating(false);
  };

  const handleReload = () => {
      window.location.reload();
  };

  // --- Admin Profile Logic ---
  const handleAdminAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const resizedUrl = await resizeImage(file);
              setAdminAvatarPreview(resizedUrl);
          } catch (error) {
              console.error("Error resizing image", error);
              alert("Error processing image. The file might be corrupted.");
          }
      }
  };

  const saveAdminProfile = async () => {
      if (adminUsername && adminAvatarPreview) {
          setIsAdminSaving(true);
          try {
            await saveTeacherAvatar(adminUsername, adminAvatarPreview);
            setAdminAvatar(adminAvatarPreview);
            setAdminAvatarPreview('');
            alert('Profile picture updated successfully!');
          } catch (e) {
            console.error(e);
            alert('Failed to save. Connection error or file too large.');
          } finally {
            setIsAdminSaving(false);
          }
      } else {
          alert("No new image selected or username missing.");
      }
  };

  // --- Teacher Management Logic ---
  const handleAddTeacher = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!newTeacherName.trim()) return;
      setIsAddingTeacher(true);
      try {
          await addTeacher(newTeacherName.trim(), adminUsername || 'SuperAdmin');
          setNewTeacherName('');
          setIsTeacherModalOpen(false);
      } catch (e) {
          console.error(e);
          alert("Failed to add teacher.");
      } finally {
          setIsAddingTeacher(false);
      }
  };

  const handleRemoveTeacher = async (username: string) => {
      if (SUPER_ADMINS.includes(username)) {
          alert("Cannot remove a Super Admin.");
          return;
      }
      if (window.confirm(`Are you sure you want to remove teacher ${username}?`)) {
          await removeTeacher(username);
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
      setIsQuestionModalOpen(false);
      alert("Հարցը ավելացվեց!");
  };


  
  const handleDeleteQuestion = async (id: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (window.confirm('Are you sure you want to delete this question?')) {
          await deleteQuestion(id);
      }
  };

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

  const flaggedSessionsCount = sessions.filter(s => s.isFlagged).length;

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
        ctx.drawImage(videoRef.current, 0, 0, 400, 400); 
        setCustomAvatarUrl(canvas.toDataURL('image/jpeg', 0.8));
        setStudentAvatar('');
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const resizedUrl = await resizeImage(file);
            setCustomAvatarUrl(resizedUrl);
            setStudentAvatar('');
        } catch (error) {
            console.error(error);
            alert("Error processing image");
        }
    }
  };

  const openAddModal = () => {
      setEditingStudentId(null);
      setStudentName(''); 
      setStudentGrade(''); 
      setStudentTeacher(adminUsername || teacherList[0]); 
      setStudentPassword(''); 
      setStudentAvatar(''); 
      setCustomAvatarUrl('');
      setStudentError(''); 
      setIsStudentModalOpen(true); stopCamera();
  };

  const openEditModal = (student: StudentProfile) => {
      setEditingStudentId(student.id);
      setStudentName(student.name); 
      setStudentGrade(student.grade); 
      setStudentTeacher(student.teacherName || adminUsername || teacherList[0]);
      setStudentPassword(student.password || '');
      setStudentError(''); 
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
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) { setStudentError('Դասարանը պետք է լինի 1-ից 12 (թիվ)։'); return; }

    const finalTeacher = studentTeacher.trim() || teacherList[0];
    const finalAvatar = customAvatarUrl.trim() || studentAvatar;
    const existingStudent = editingStudentId ? students.find(s => s.id === editingStudentId) : null;

    const studentToSave: StudentProfile = {
        id: editingStudentId || generateId(),
        name: studentName.trim(),
        grade: studentGrade.trim(),
        teacherName: finalTeacher,
        password: studentPassword.trim(), 
        avatar: finalAvatar,
        joinedAt: existingStudent?.joinedAt || Date.now(),
        isBlocked: existingStudent?.isBlocked || false,
        score: existingStudent?.score || 0
    };
    
    try {
        await saveStudent(studentToSave);
        closeModal();
    } catch (err: any) {
        console.error("Failed to save student", err);
        setStudentError(err.message || "Սխալ տեղի ունեցավ պահպանելիս։ (Ստուգեք կապը)");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white/50 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white">
        <div className="flex items-center gap-2">
          <TIMILogoAdmin />
          <div className="ml-2">
            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Admin Panel</h1>
            {adminUsername && <p className="text-xs md:text-sm text-gray-500 font-medium">Welcome, {adminUsername}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center md:justify-end">
            <Button 
                variant="primary" 
                onClick={handleMigrate} 
                isLoading={isMigrating}
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md text-xs md:text-sm py-1 md:py-2"
            >
                ☁️ Sync
            </Button>
            <Button variant="ghost" onClick={handleReload} className="bg-white border hover:bg-indigo-50 shadow-sm text-xs md:text-sm py-1 md:py-2">
                🔄 Reload
            </Button>
            <Button variant="ghost" onClick={handleExportData} className="bg-white border shadow-sm text-xs md:text-sm py-1 md:py-2">Backup</Button>
            <Button variant="ghost" onClick={() => backupInputRef.current?.click()} className="bg-white border shadow-sm text-xs md:text-sm py-1 md:py-2">Restore</Button>
            <input type="file" ref={backupInputRef} onChange={handleRestoreData} className="hidden" accept=".json" />
        </div>
      </div>

      <div className="flex mb-6 bg-white/60 p-1 rounded-lg w-full md:w-fit overflow-x-auto shadow-inner border border-white/50 backdrop-blur-sm">
         {[
             {id: 'sessions', label: `Chat (⚠️ ${flaggedSessionsCount})`},
             {id: 'teachers_room', label: '☕ Ուսուցչանոց'}, 
             {id: 'students', label: 'Students'},
             {id: 'quizzes', label: 'Quiz'},
             {id: 'notifications', label: '🔔 Notifs'},
             {id: 'profile', label: 'Profile'},
             ...(isSuperAdmin ? [{id: 'teachers', label: '👨‍🏫 Teachers'}] : [])
         ].map(tab => (
             <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium capitalize whitespace-nowrap transition-all duration-200 ${activeTab === tab.id ? 'bg-white shadow text-primary font-bold' : 'text-gray-600 hover:bg-gray-100/50'}`}
             >
                 {tab.label}
             </button>
         ))}
      </div>
      
      {activeTab === 'teachers_room' && (
          <div className="glass-panel rounded-xl shadow border h-[600px] flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Ընդհանուր Զրուցարան</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Նշիր @ai հարց տալու համար</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                  {teacherMessages.map(msg => {
                      return (
                      <div key={msg.id} className={`flex gap-3 ${msg.sender === adminUsername ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                              {msg.avatar ? (
                                  <img src={msg.avatar} alt={msg.sender} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-bold">{msg.sender[0]}</div>
                              )}
                          </div>
                          <div className={`max-w-[80%] rounded-xl p-3 text-sm shadow-sm ${msg.sender === 'TIMI (AI)' ? 'bg-purple-100 border-purple-200 text-purple-900' : (msg.sender === adminUsername ? 'bg-white border text-gray-800' : 'bg-indigo-50 text-gray-800')}`}>
                              <div className="flex justify-between items-center mb-1 gap-2">
                                  <span className="font-bold text-xs opacity-70">{msg.sender}</span>
                                  <span className="text-[10px] text-gray-400">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <MarkdownRenderer content={msg.text} />
                              
                              {msg.relatedStudentIds && msg.relatedStudentIds.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                      {msg.relatedStudentIds.map(sid => {
                                          const relatedStudent = students.find(s => s.id === sid);
                                          if (!relatedStudent) return null;
                                          return (
                                              <div key={sid} className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm flex items-center gap-3">
                                                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border">
                                                      <img src={relatedStudent.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${relatedStudent.name}`} className="w-full h-full object-cover" />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                      <h4 className="font-bold text-gray-800 truncate">{relatedStudent.name}</h4>
                                                      <p className="text-xs text-gray-500">Grade: {relatedStudent.grade}</p>
                                                      <div className="flex gap-2 mt-1">
                                                          <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">⭐ {relatedStudent.score || 0}</span>
                                                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${relatedStudent.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                              {relatedStudent.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                                                          </span>
                                                      </div>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                        setSearchTerm(relatedStudent.name);
                                                        setActiveTab('students');
                                                    }}
                                                    className="text-xs text-blue-600 hover:underline"
                                                  >
                                                      View Full
                                                  </button>
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                      </div>
                  )})}
                  
                  {isAiTyping && (
                      <div className="flex gap-3 flex-row">
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Timi" alt="AI" className="w-full h-full object-cover" />
                          </div>
                          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 shadow-sm flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                          </div>
                      </div>
                  )}
                  <div ref={teacherChatEndRef} />
              </div>

              <div className="p-3 bg-white border-t">
                  <div className="flex gap-2">
                      <input 
                        className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Գրեք հաղորդագրություն (կամ @ai...)"
                        value={newTeacherMessage}
                        onChange={e => setNewTeacherMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSendTeacherMessage(); }}
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => {
                            if (!newTeacherMessage.trim()) {
                                alert("Գրեք հարցը նախքան AI-ին դիմելը։");
                                return;
                            }
                            // Force AI trigger by adding @ai if not present
                            if (!newTeacherMessage.toLowerCase().includes('@ai')) {
                                setNewTeacherMessage(prev => prev + ' @ai');
                            }
                            setTimeout(handleSendTeacherMessage, 0);
                        }}
                        className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"
                      >
                          ✨ Ask AI
                      </Button>
                      <Button onClick={handleSendTeacherMessage}>➤</Button>
                  </div>
              </div>
          </div>
      )}
      {/* ... Other Tabs remain same ... */}
       {/* Teachers Tab (Exclusive to Super Admins) */}
      {activeTab === 'teachers' && isSuperAdmin && (
          <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                 <Input 
                   placeholder="Search teachers..." 
                   value={teacherSearchTerm} 
                   onChange={e => setTeacherSearchTerm(e.target.value)} 
                   className="max-w-xs font-medium text-gray-900 placeholder-gray-500"
                 />
                 <Button 
                    onClick={() => setIsTeacherModalOpen(true)} 
                    className="shadow-md text-xs md:text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                 >
                     + Add Teacher
                 </Button>
             </div>

             <div className="glass-panel rounded-xl shadow border overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 text-left text-sm font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Added By</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white/40">
                            {filteredTeachers.map(t => (
                                <tr key={t.username} className="hover:bg-indigo-50/50 transition duration-150">
                                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3 whitespace-nowrap">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 overflow-hidden border border-indigo-200 shadow-sm">
                                            {t.avatar ? (
                                                <img src={t.avatar} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-indigo-700">{t.username[0]}</div>
                                            )}
                                        </div>
                                        {t.username}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {SUPER_ADMINS.includes(t.username) ? (
                                            <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold border border-purple-200">SUPER ADMIN</span>
                                        ) : (
                                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold border border-blue-200">TEACHER</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap">{t.addedBy}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        {!SUPER_ADMINS.includes(t.username) && (
                                            <button 
                                            onClick={() => handleRemoveTeacher(t.username)}
                                            className="text-red-600 hover:text-red-800 text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
      )}
      
      {isTeacherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-float">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-gray-900">Add New Teacher</h3>
                      <button onClick={() => setIsTeacherModalOpen(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                  </div>
                  <div className="p-6">
                      <form onSubmit={handleAddTeacher} className="space-y-4">
                          <Input 
                            label="Username"
                            value={newTeacherName}
                            onChange={e => setNewTeacherName(e.target.value)}
                            placeholder="e.g. Sargsyan.A"
                            className="font-medium"
                          />
                          <div className="flex gap-3 pt-2">
                              <Button type="button" variant="ghost" onClick={() => setIsTeacherModalOpen(false)} className="flex-1 border">Cancel</Button>
                              <Button type="submit" isLoading={isAddingTeacher} className="flex-1 bg-indigo-600">Add</Button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
      
      {activeTab === 'quizzes' && (
          <div className="space-y-6">
               <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                   <div className="flex gap-2 w-full md:w-auto">
                       <Input 
                         placeholder="Search questions..." 
                         value={quizSearchTerm} 
                         onChange={e => setQuizSearchTerm(e.target.value)}
                         className="min-w-[200px]"
                       />
                       <select 
                        value={selectedFilterSubject} 
                        onChange={e => setSelectedFilterSubject(e.target.value)}
                        className="px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary h-[42px] bg-white text-sm"
                       >
                           <option value="All">All Subjects</option>
                           {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                   </div>
                   <div className="flex gap-2 w-full md:w-auto">
                       <Button onClick={() => setIsQuestionModalOpen(true)} className="flex-1 md:flex-none shadow-md">+ Add Question</Button>

                   </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredQuestions.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">No questions found.</p>}
                   {filteredQuestions.map(q => (
                       <div key={q.id} className="bg-white rounded-xl shadow border border-gray-100 p-4 relative group hover:shadow-md transition">
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                               <button onClick={(e) => handleDeleteQuestion(q.id, e)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                       <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                   </svg>
                               </button>
                           </div>
                           <div className="mb-2">
                               <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{q.subject}</span>
                               <span className="text-[10px] font-bold text-gray-500 ml-2">{q.points} pts</span>
                           </div>
                           <h4 className="font-bold text-gray-800 mb-3 text-sm line-clamp-2">{q.question}</h4>
                           <div className="space-y-1">
                               {q.options.map((opt, idx) => (
                                   <div key={idx} className={`text-xs px-2 py-1.5 rounded border ${idx === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-800 font-bold' : 'bg-gray-50 border-transparent text-gray-500'}`}>
                                       {opt}
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      )}

      {/* Add Question Modal */}
      {isQuestionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-float">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg">Add Manual Question</h3>
                      <button onClick={() => setIsQuestionModalOpen(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <Input label="Subject" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Math" />
                          <Input label="Points" type="number" value={newPoints} onChange={e => setNewPoints(Number(e.target.value))} />
                      </div>
                      <Input label="Question Text" value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} placeholder="What is 2+2?" />
                      <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Options</label>
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
                                    className="flex-1 px-3 py-2 border rounded-md text-sm" 
                                    value={opt} 
                                    onChange={e => {
                                        const next = [...newOptions];
                                        next[idx] = e.target.value;
                                        setNewOptions(next);
                                    }}
                                    placeholder={`Option ${String.fromCharCode(65+idx)}`}
                                  />
                              </div>
                          ))}
                      </div>
                      <Button onClick={handleAddQuestion} className="w-full mt-4">Save Question</Button>
                  </div>
              </div>
          </div>
      )}



      {activeTab === 'profile' && (
          <div className="glass-panel rounded-xl shadow border p-6 md:p-8 max-w-2xl mx-auto animate-float">
              <h2 className="text-xl md:text-2xl font-bold mb-6">Teacher Profile</h2>
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
                        type="button"
                        onClick={() => adminFileRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow hover:bg-indigo-700 transition"
                        title="Upload New Photo"
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
                      <Button onClick={saveAdminProfile} isLoading={isAdminSaving} className="w-full max-w-xs">
                          Save New Picture
                      </Button>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'notifications' && (
          <div className="glass-panel rounded-xl shadow border p-4 sm:p-6 md:p-8 w-full max-w-2xl mx-auto">
              <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">📢 Send Notification</h2>
              <div className="space-y-6">
                  <Input 
                    label="Title" 
                    value={notifTitle} 
                    onChange={e => setNotifTitle(e.target.value)} 
                    placeholder="e.g., Homework Reminder" 
                  />
                  
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea 
                        className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary h-32 resize-none"
                        value={notifMessage}
                        onChange={e => setNotifMessage(e.target.value)}
                        placeholder="Type your message here..."
                      />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                          <select 
                            value={notifTarget} 
                            onChange={e => {
                                setNotifTarget(e.target.value as any);
                                setNotifTargetValue('');
                            }}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                              <option value="ALL">Everyone</option>
                              <option value="GRADE">Specific Grade</option>
                              <option value="USER">Specific Student (ID)</option>
                          </select>
                      </div>

                      {notifTarget === 'GRADE' && (
                           <Input 
                            label="Grade Number"
                            type="number"
                            value={notifTargetValue}
                            onChange={e => setNotifTargetValue(e.target.value)}
                            placeholder="e.g. 9"
                           />
                      )}
                      
                      {notifTarget === 'USER' && (
                           <Input 
                            label="Student ID"
                            value={notifTargetValue}
                            onChange={e => setNotifTargetValue(e.target.value)}
                            placeholder="Enter Student ID"
                           />
                      )}
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (Image/File)</label>
                      <input 
                        type="file" 
                        ref={notifFileRef}
                        onChange={handleNotifFile}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100"
                      />
                      {notifAttachment && (
                          <div className="mt-2 text-xs text-green-600 font-bold">
                              ✓ Attachment Ready
                              {notifAttachment.startsWith('data:image') && (
                                  <img src={notifAttachment} alt="Preview" className="mt-1 h-16 w-16 object-cover rounded border" />
                              )}
                          </div>
                      )}
                  </div>

                  <Button 
                    onClick={handleSendNotification} 
                    isLoading={notifSending} 
                    className="w-full"
                  >
                      Send Notification
                  </Button>
              </div>
          </div>
      )}

      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[700px]">
           <div className="md:col-span-1 glass-panel rounded-xl shadow border overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50/50">
                  <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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

           <div className="md:col-span-2 glass-panel rounded-xl shadow border flex flex-col overflow-hidden">
               {selectedSession ? (
                   <>
                   <div className="p-4 border-b bg-gray-50/80 flex justify-between items-center">
                       <div>
                           <h3 className="font-bold">{selectedSession.studentName}</h3>
                           <p className="text-xs text-gray-500">{new Date(selectedSession.startTime).toLocaleString()}</p>
                       </div>
                       <Button variant="danger" onClick={(e) => handleDeleteSession(selectedSession.id, e)} className="text-sm px-3 py-1">Delete Log</Button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                       {selectedSession.messages.map(msg => {
                           const currentStudent = students.find(s => s.id === selectedSession.studentId);
                           
                           return (
                           <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                               {msg.role === 'model' && (
                                   <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm mb-1">
                                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Timi" alt="TIMI" className="w-full h-full object-cover" />
                                   </div>
                               )}
                               
                               <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900 shadow-sm' : 'bg-white border text-gray-800 shadow-sm'}`}>
                                   <p className="font-bold text-xs mb-1 opacity-50">{msg.role === 'user' ? selectedSession.studentName : 'TIMI AI'}</p>
                                   <div className="whitespace-pre-wrap"><MarkdownRenderer content={msg.text} /></div>
                                   {msg.image && (
                                       <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                                           <img src={msg.image} alt="Generated" className="w-full h-auto" />
                                       </div>
                                   )}
                               </div>

                               {msg.role === 'user' && (
                                   <Avatar 
                                        src={currentStudent?.avatar} 
                                        name={selectedSession.studentName} 
                                        frameId={currentStudent?.equippedFrame} 
                                        size="sm" 
                                        className="mb-1"
                                    />
                               )}
                           </div>
                       )})}
                   </div>
                   </>
               ) : (
                   <div className="flex-1 flex items-center justify-center text-gray-400">Select a session to view details</div>
               )}
           </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="mb-6 space-y-4 relative">
            {selectedStudentIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur shadow-2xl rounded-full px-4 py-2 md:px-6 md:py-3 flex gap-2 md:gap-4 items-center z-50 border border-gray-200 animate-float w-max max-w-[90vw] overflow-x-auto">
                    <span className="font-bold text-indigo-800 text-xs md:text-sm whitespace-nowrap">{selectedStudentIds.length} Selected</span>
                    <div className="h-4 w-px bg-gray-300 shrink-0"></div>
                    <button onClick={() => handleBulkBlock(true)} className="text-xs md:text-sm font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1" title="Block Selected">
                        🔒 <span className="hidden sm:inline">Block</span>
                    </button>
                    <button onClick={() => handleBulkBlock(false)} className="text-xs md:text-sm font-medium text-green-600 hover:text-green-800 flex items-center gap-1" title="Unblock Selected">
                        🔓 <span className="hidden sm:inline">Unblock</span>
                    </button>
                    <button onClick={handleBulkAssignTeacher} className="text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1" title="Assign Teacher">
                        👨‍🏫 <span className="hidden sm:inline">Teacher</span>
                    </button>
                    <button onClick={handleBulkDelete} className="text-xs md:text-sm font-medium text-red-600 hover:text-red-800 flex items-center gap-1" title="Delete Selected">
                        🗑️ <span className="hidden sm:inline">Delete</span>
                    </button>
                    <div className="h-4 w-px bg-gray-300 shrink-0"></div>
                    <button onClick={() => setSelectedStudentIds([])} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Input 
                    placeholder="Search students..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="max-w-xs"
                />
                <div className="flex gap-2">
                    <Button onClick={() => csvInputRef.current?.click()} variant="secondary" className="shadow-md text-xs md:text-sm">Import CSV</Button>
                    <input type="file" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" accept=".csv" />
                    <Button onClick={openAddModal} className="shadow-md text-xs md:text-sm">+ Add</Button>
                </div>
            </div>
            
            <div className="glass-panel rounded-xl shadow border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-3 text-left">
                                    <input 
                                        type="checkbox" 
                                        checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/40 divide-y divide-gray-200">
                            {filteredStudents.map(s => (
                                <tr key={s.id} className={`${s.isBlocked ? 'bg-red-50/50' : 'hover:bg-gray-50/50'} transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-50' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedStudentIds.includes(s.id)}
                                            onChange={() => toggleSelectStudent(s.id)}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap flex items-center">
                                        <Avatar 
                                            src={s.avatar} 
                                            name={s.name} 
                                            frameId={s.equippedFrame} 
                                            size="sm" 
                                            className="mr-3"
                                        />
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
                                            onClick={() => {
                                                setMessageTargetStudent(s);
                                                setIsMessageModalOpen(true);
                                            }} 
                                            className="text-emerald-600 hover:text-emerald-900 mr-4 bg-emerald-50 px-2 py-1 rounded"
                                        >
                                            💬 Message
                                        </button>
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
        </div>
      )}

      {isStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-float">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg">{editingStudentId ? 'Edit Student' : 'Add New Student'}</h3>
                      <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <form className="space-y-4" onSubmit={handleSaveStudent}>
                          <Input label="Name" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Full Name" />
                          <div className="grid grid-cols-2 gap-4">
                             <Input label="Grade" type="number" value={studentGrade} onChange={e => setStudentGrade(e.target.value)} min="1" max="12" />
                             <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                                <select 
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={studentTeacher}
                                    onChange={e => setStudentTeacher(e.target.value)}
                                >
                                    {teacherList.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                             </div>
                          </div>
                          
                          <Input label="Password (Optional)" type="text" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} placeholder="Leave empty for student setup" />

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
                              <Button type="submit" className="flex-1">Save Student</Button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {isMessageModalOpen && messageTargetStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-float">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg">Հաղորդագրություն {messageTargetStudent.name}-ին</h3>
                      <button onClick={() => setIsMessageModalOpen(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                  </div>
                  <div className="p-6 space-y-4">
                      <textarea 
                        className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary h-32 resize-none"
                        value={quickMessage}
                        onChange={e => setQuickMessage(e.target.value)}
                        placeholder="Գրեք ձեր հաղորդագրությունը..."
                      />
                      <div className="flex gap-3">
                          <Button variant="ghost" onClick={() => setIsMessageModalOpen(false)} className="flex-1 border">Չեղարկել</Button>
                          <Button onClick={handleSendQuickMessage} isLoading={notifSending} className="flex-1 bg-emerald-600">Ուղարկել</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
