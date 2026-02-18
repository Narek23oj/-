
import { ChatSession, StudentProfile, QuizQuestion } from '../types';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc,
  getDocs,
  updateDoc
} from 'firebase/firestore';

const STORAGE_KEYS = {
  SESSIONS: 'timi_sessions',
  STUDENTS: 'timi_students',
  QUESTIONS: 'timi_questions'
};

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpSc72hKk3oYgxFSKaSMRF87Vi8-ysodI",
  authDomain: "timi-school.firebaseapp.com",
  projectId: "timi-school",
  storageBucket: "timi-school.firebasestorage.app",
  messagingSenderId: "521618908416",
  appId: "1:521618908416:web:846a17b2498f785e167fe5",
  measurementId: "G-YSGRNV9JN5"
};

let db: any = null;
const isFirebaseEnabled = !!FIREBASE_CONFIG.apiKey;

if (isFirebaseEnabled) {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

// --- Subscription Helpers ---

export const subscribeToStudents = (callback: (students: StudentProfile[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.STUDENTS));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data() as StudentProfile);
      callback(students);
    });
  } else {
    const handler = () => { callback(getStudentsSync()); };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 2000);
    handler();
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }
};

export const subscribeToSessions = (callback: (sessions: ChatSession[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.SESSIONS), orderBy('startTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ChatSession);
      callback(sessions);
    });
  } else {
    const handler = () => { callback(getAllSessionsSync()); };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 2000);
    handler();
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }
};

export const subscribeToQuestions = (callback: (questions: QuizQuestion[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.QUESTIONS));
    return onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => doc.data() as QuizQuestion);
      callback(questions);
    });
  } else {
    const handler = () => { 
        const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
        callback(data ? JSON.parse(data) : []);
    };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 2000);
    handler();
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }
};

// --- Student Management ---

export const saveStudent = async (student: StudentProfile): Promise<void> => {
  if (isFirebaseEnabled && db) {
    await setDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), student);
  } else {
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === student.id);
    if (index >= 0) {
      students[index] = { ...students[index], ...student };
    } else {
      students.push({ ...student, score: student.score || 0 });
    }
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
};

export const updateStudentScore = async (studentId: string, pointsToAdd: number): Promise<StudentProfile | null> => {
  // If pointsToAdd is 0, we might be manually setting score, handled by admin specific update usually, 
  // but this function adds. 
  if (isFirebaseEnabled && db) {
      const students = await getStudentsAsync();
      const student = students.find(s => s.id === studentId);
      if (student) {
          student.score = (student.score || 0) + pointsToAdd;
          await setDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), student);
          return student;
      }
      return null;
  } else {
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
      students[index].score = (students[index].score || 0) + pointsToAdd;
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      return students[index];
    }
    return null;
  }
};

// Admin explicit score set
export const setStudentScore = async (studentId: string, newScore: number): Promise<void> => {
    if (isFirebaseEnabled && db) {
        await updateDoc(doc(db, STORAGE_KEYS.STUDENTS, studentId), { score: newScore });
    } else {
        const students = getStudentsSync();
        const index = students.findIndex(s => s.id === studentId);
        if (index >= 0) {
            students[index].score = newScore;
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        }
    }
}

export const getStudentsAsync = async (): Promise<StudentProfile[]> => {
  if (isFirebaseEnabled && db) {
    const snapshot = await getDocs(collection(db, STORAGE_KEYS.STUDENTS));
    return snapshot.docs.map(doc => doc.data() as StudentProfile);
  }
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
    if (isFirebaseEnabled && db) {
        const students = await getStudentsAsync();
        const student = students.find(s => s.id === studentId);
        if (student) {
            await updateDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), { isBlocked: !student.isBlocked });
        }
    } else {
        const students = getStudentsSync();
        const index = students.findIndex(s => s.id === studentId);
        if (index >= 0) {
            students[index].isBlocked = !students[index].isBlocked;
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        }
    }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, STORAGE_KEYS.STUDENTS, studentId));
    } else {
        const students = getStudentsSync().filter(s => s.id !== studentId);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    }
};

// --- Question Management (Dynamic) ---

export const saveQuestion = async (question: QuizQuestion): Promise<void> => {
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, STORAGE_KEYS.QUESTIONS, question.id), question);
    } else {
        const questions = getQuestionsSync();
        questions.push(question);
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, STORAGE_KEYS.QUESTIONS, questionId));
    } else {
        const questions = getQuestionsSync().filter(q => q.id !== questionId);
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }
};

export const getQuestionsAsync = async (): Promise<QuizQuestion[]> => {
    if (isFirebaseEnabled && db) {
        const snapshot = await getDocs(collection(db, STORAGE_KEYS.QUESTIONS));
        return snapshot.docs.map(doc => doc.data() as QuizQuestion);
    }
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

    // Check header
    const startIndex = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('անուն')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        // Expected CSV: Name, Grade
        // Password will be auto-generated if not provided, or logic says "Teacher generated password"
        // Let's assume CSV is: Name, Grade, [Password-Optional]
        if (parts.length < 2) {
            errors.push(`Row ${i + 1}: Invalid format`);
            continue;
        }

        const name = parts[0].trim();
        const grade = parts[1].trim();
        const password = parts[2]?.trim() || Math.random().toString(36).slice(-6); // Auto-gen if missing

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
  if (isFirebaseEnabled && db) {
      await setDoc(doc(db, STORAGE_KEYS.SESSIONS, session.id), session);
  } else {
    const sessions = getAllSessionsSync();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }
};

export const getAllSessionsAsync = async (): Promise<ChatSession[]> => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, STORAGE_KEYS.SESSIONS), orderBy('startTime', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as ChatSession);
    }
    return getAllSessionsSync();
};

const getAllSessionsSync = (): ChatSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, STORAGE_KEYS.SESSIONS, sessionId));
    } else {
        const sessions = getAllSessionsSync().filter(s => s.id !== sessionId);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    }
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
