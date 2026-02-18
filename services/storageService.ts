
import { ChatSession, StudentProfile, QuizQuestion } from '../types';

// NOTE: Firebase imports removed due to environment configuration issues.
// The application will run using LocalStorage for persistence.

const STORAGE_KEYS = {
  SESSIONS: 'timi_sessions',
  STUDENTS: 'timi_students',
  QUESTIONS: 'timi_questions',
  TEACHERS: 'timi_teachers'
};

const isFirebaseEnabled = false; 

// Helper for LocalStorage events
const dispatchStorageEvent = (key: string) => {
  window.dispatchEvent(new Event(key));
};

// --- Subscription Helpers ---

export const subscribeToStudents = (callback: (students: StudentProfile[]) => void) => {
  const handler = () => { callback(getStudentsSync()); };
  window.addEventListener('storage', handler);
  window.addEventListener(STORAGE_KEYS.STUDENTS, handler);
  const interval = setInterval(handler, 2000);
  handler();
  return () => { 
    window.removeEventListener('storage', handler); 
    window.removeEventListener(STORAGE_KEYS.STUDENTS, handler);
    clearInterval(interval); 
  };
};

export const subscribeToSessions = (callback: (sessions: ChatSession[]) => void) => {
  const handler = () => { callback(getAllSessionsSync()); };
  window.addEventListener('storage', handler);
  window.addEventListener(STORAGE_KEYS.SESSIONS, handler);
  const interval = setInterval(handler, 2000);
  handler();
  return () => { 
      window.removeEventListener('storage', handler); 
      window.removeEventListener(STORAGE_KEYS.SESSIONS, handler);
      clearInterval(interval); 
  };
};

export const subscribeToStudentSessions = (studentId: string, callback: (sessions: ChatSession[]) => void) => {
  const handler = () => { 
      const all = getAllSessionsSync();
      const filtered = all.filter(s => s.studentId === studentId).sort((a,b) => b.startTime - a.startTime);
      callback(filtered);
  };
  window.addEventListener('storage', handler);
  window.addEventListener(STORAGE_KEYS.SESSIONS, handler);
  handler();
  return () => { 
      window.removeEventListener('storage', handler); 
      window.removeEventListener(STORAGE_KEYS.SESSIONS, handler);
  };
};

export const subscribeToQuestions = (callback: (questions: QuizQuestion[]) => void) => {
  const handler = () => { 
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      callback(data ? JSON.parse(data) : []);
  };
  window.addEventListener('storage', handler);
  window.addEventListener(STORAGE_KEYS.QUESTIONS, handler);
  const interval = setInterval(handler, 2000);
  handler();
  return () => { 
      window.removeEventListener('storage', handler); 
      window.removeEventListener(STORAGE_KEYS.QUESTIONS, handler);
      clearInterval(interval); 
  };
};

// --- Teacher Management ---

export const saveTeacherAvatar = async (username: string, avatarUrl: string): Promise<void> => {
    const teachers = getTeachersSync();
    teachers[username] = avatarUrl;
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
    dispatchStorageEvent(STORAGE_KEYS.TEACHERS);
};

export const getTeacherAvatar = async (username: string): Promise<string | null> => {
    const teachers = getTeachersSync();
    return teachers[username] || null;
};

const getTeachersSync = (): Record<string, string> => {
    const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    return data ? JSON.parse(data) : {};
};

// --- Student Management ---

export const saveStudent = async (student: StudentProfile): Promise<void> => {
  const students = getStudentsSync();
  const index = students.findIndex(s => s.id === student.id);
  if (index >= 0) students[index] = { ...students[index], ...student };
  else students.push({ ...student, score: student.score || 0 });
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
};

export const updateStudentScore = async (studentId: string, pointsToAdd: number): Promise<StudentProfile | null> => {
    let updatedStudent: StudentProfile | null = null;
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
      students[index].score = (students[index].score || 0) + pointsToAdd;
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
      updatedStudent = students[index];
    }
    return updatedStudent;
};

export const setStudentScore = async (studentId: string, newScore: number): Promise<void> => {
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
        students[index].score = newScore;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
    }
}

export const getStudentsAsync = async (): Promise<StudentProfile[]> => {
  return getStudentsSync();
};

const getStudentsSync = (): StudentProfile[] => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  return data ? JSON.parse(data) : [];
};

export const findStudentByNameAndGrade = async (name: string, grade: string): Promise<StudentProfile | undefined> => {
  const students = await getStudentsAsync();
  return students.find(
    s => s.name.toLowerCase().trim() === name.toLowerCase().trim() && 
         s.grade.trim() === grade.trim()
  );
};

export const toggleStudentBlockStatus = async (studentId: string): Promise<void> => {
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
        students[index].isBlocked = !students[index].isBlocked;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
    }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    const students = getStudentsSync().filter(s => s.id !== studentId);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
};

// --- Question Management ---

export const saveQuestion = async (question: QuizQuestion): Promise<void> => {
    const questions = getQuestionsSync();
    questions.push(question);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    dispatchStorageEvent(STORAGE_KEYS.QUESTIONS);
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
    const questions = getQuestionsSync().filter(q => q.id !== questionId);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    dispatchStorageEvent(STORAGE_KEYS.QUESTIONS);
};

export const getQuestionsAsync = async (): Promise<QuizQuestion[]> => {
    return getQuestionsSync();
};

const getQuestionsSync = (): QuizQuestion[] => {
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return data ? JSON.parse(data) : [];
};

// --- Bulk Import ---

export const bulkImportStudents = async (csvContent: string): Promise<{ added: number, errors: string[] }> => {
    const lines = csvContent.split('\n');
    let addedCount = 0;
    const errors: string[] = [];
    const currentStudents = await getStudentsAsync();

    const startIndex = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('անուն')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 2) {
            errors.push(`Row ${i + 1}: Invalid format`);
            continue;
        }
        const name = parts[0].trim();
        const grade = parts[1].trim();
        const password = parts[2]?.trim() || Math.random().toString(36).slice(-6);

        if (!name || !grade) continue;

        const existing = currentStudents.find(
            s => s.name.toLowerCase() === name.toLowerCase() && s.grade === grade
        );
        
        if (existing) {
            errors.push(`Row ${i + 1}: Student "${name}" already exists`);
            continue;
        }

        const newStudent: StudentProfile = {
            id: generateId(),
            name,
            grade,
            password,
            joinedAt: Date.now(),
            isBlocked: false,
            score: 0,
            avatar: ''
        };

        await saveStudent(newStudent);
        addedCount++;
    }
    return { added: addedCount, errors };
};

// --- Database Backup/Restore ---

export const exportDatabase = async (): Promise<string> => {
    const students = await getStudentsAsync();
    const sessions = await getAllSessionsAsync();
    const questions = await getQuestionsAsync();
    const data = { students, sessions, questions, timestamp: Date.now() };
    return JSON.stringify(data, null, 2);
};

export const restoreDatabase = async (jsonContent: string): Promise<boolean> => {
    try {
        const data = JSON.parse(jsonContent);
        if (data.students) for (const s of data.students) await saveStudent(s);
        if (data.sessions) for (const s of data.sessions) await saveSession(s);
        if (data.questions) for (const q of data.questions) await saveQuestion(q);
        return true;
    } catch (e) {
        console.error("Failed to restore", e);
        return false;
    }
};

// --- Session Management ---

export const saveSession = async (session: ChatSession): Promise<void> => {
  const sessions = getAllSessionsSync();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  dispatchStorageEvent(STORAGE_KEYS.SESSIONS);
};

export const getAllSessionsAsync = async (): Promise<ChatSession[]> => {
    return getAllSessionsSync();
};

const getAllSessionsSync = (): ChatSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    const sessions = getAllSessionsSync().filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    dispatchStorageEvent(STORAGE_KEYS.SESSIONS);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
