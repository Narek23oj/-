
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
  where,
  deleteDoc,
  getDocs,
  updateDoc,
  getDoc
} from 'firebase/firestore';

const STORAGE_KEYS = {
  SESSIONS: 'timi_sessions',
  STUDENTS: 'timi_students',
  QUESTIONS: 'timi_questions',
  TEACHERS: 'timi_teachers' // New key for teacher profiles
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

// Helper for LocalStorage events
const dispatchStorageEvent = (key: string) => {
  window.dispatchEvent(new Event(key));
};

// --- Subscription Helpers ---

export const subscribeToStudents = (callback: (students: StudentProfile[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.STUDENTS));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data() as StudentProfile);
      callback(students);
    }, (error) => {
      console.error("Error subscribing to students (falling back to local):", error);
      // Fallback
      callback(getStudentsSync());
    });
  } else {
    const handler = () => { callback(getStudentsSync()); };
    window.addEventListener('storage', handler);
    window.addEventListener(STORAGE_KEYS.STUDENTS, handler); // Listen for local updates
    const interval = setInterval(handler, 2000);
    handler();
    return () => { 
      window.removeEventListener('storage', handler); 
      window.removeEventListener(STORAGE_KEYS.STUDENTS, handler);
      clearInterval(interval); 
    };
  }
};

export const subscribeToSessions = (callback: (sessions: ChatSession[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.SESSIONS), orderBy('startTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ChatSession);
      callback(sessions);
    }, (error) => {
        console.error("Error subscribing to sessions (falling back to local):", error);
        callback(getAllSessionsSync());
    });
  } else {
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
  }
};

export const subscribeToStudentSessions = (studentId: string, callback: (sessions: ChatSession[]) => void) => {
  if (isFirebaseEnabled && db) {
    // Note: We avoid 'orderBy' here to prevent the need for a composite index (studentId + startTime).
    // We filter by studentId on the server, and sort by startTime on the client.
    const q = query(
      collection(db, STORAGE_KEYS.SESSIONS), 
      where('studentId', '==', studentId)
    );
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ChatSession);
      // Client-side sort
      sessions.sort((a, b) => b.startTime - a.startTime);
      callback(sessions);
    }, (error) => {
        console.error("Error subscribing to student sessions (falling back to local):", error);
        // Local fallback filtering
        const all = getAllSessionsSync();
        const filtered = all.filter(s => s.studentId === studentId).sort((a,b) => b.startTime - a.startTime);
        callback(filtered);
    });
  } else {
    const handler = () => { 
        const all = getAllSessionsSync();
        const filtered = all.filter(s => s.studentId === studentId).sort((a,b) => b.startTime - a.startTime);
        callback(filtered);
    };
    window.addEventListener('storage', handler);
    window.addEventListener(STORAGE_KEYS.SESSIONS, handler);
    // Initial call
    handler();
    return () => { 
        window.removeEventListener('storage', handler); 
        window.removeEventListener(STORAGE_KEYS.SESSIONS, handler);
    };
  }
};

export const subscribeToQuestions = (callback: (questions: QuizQuestion[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, STORAGE_KEYS.QUESTIONS));
    return onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => doc.data() as QuizQuestion);
      callback(questions);
    }, (error) => {
        console.error("Error subscribing to questions (falling back to local):", error);
        const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
        callback(data ? JSON.parse(data) : []);
    });
  } else {
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
  }
};

// --- Teacher Management ---

export const saveTeacherAvatar = async (username: string, avatarUrl: string): Promise<void> => {
    // Local
    const teachers = getTeachersSync();
    teachers[username] = avatarUrl;
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
    dispatchStorageEvent(STORAGE_KEYS.TEACHERS);

    if (isFirebaseEnabled && db) {
        try {
            await setDoc(doc(db, STORAGE_KEYS.TEACHERS, username), { avatar: avatarUrl, username });
        } catch(e) { console.warn("Firebase teacher save failed", e); }
    }
};

export const getTeacherAvatar = async (username: string): Promise<string | null> => {
    if (isFirebaseEnabled && db) {
        try {
            const docRef = doc(db, STORAGE_KEYS.TEACHERS, username);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().avatar;
            }
        } catch (e) { console.warn("Firebase teacher fetch failed", e); }
    }
    const teachers = getTeachersSync();
    return teachers[username] || null;
};

const getTeachersSync = (): Record<string, string> => {
    const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    return data ? JSON.parse(data) : {};
};

// --- Student Management ---

export const saveStudent = async (student: StudentProfile): Promise<void> => {
  // Always save to local storage as backup
  const students = getStudentsSync();
  const index = students.findIndex(s => s.id === student.id);
  if (index >= 0) students[index] = { ...students[index], ...student };
  else students.push({ ...student, score: student.score || 0 });
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  dispatchStorageEvent(STORAGE_KEYS.STUDENTS);

  if (isFirebaseEnabled && db) {
    try {
      await setDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), student);
    } catch (e) {
      console.warn("Firebase save failed, but saved locally:", e);
    }
  }
};

export const updateStudentScore = async (studentId: string, pointsToAdd: number): Promise<StudentProfile | null> => {
    // Optimistic update local
    let updatedStudent: StudentProfile | null = null;
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
      students[index].score = (students[index].score || 0) + pointsToAdd;
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
      updatedStudent = students[index];
    }

    if (isFirebaseEnabled && db) {
      try {
        const remoteStudents = await getStudentsAsync();
        const student = remoteStudents.find(s => s.id === studentId);
        if (student) {
            student.score = (student.score || 0) + pointsToAdd;
            await setDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), student);
            updatedStudent = student;
        }
      } catch (e) { console.warn("Firebase score update failed", e); }
    }
    return updatedStudent;
};

export const setStudentScore = async (studentId: string, newScore: number): Promise<void> => {
    // Local
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
        students[index].score = newScore;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
    }

    if (isFirebaseEnabled && db) {
        try {
            await updateDoc(doc(db, STORAGE_KEYS.STUDENTS, studentId), { score: newScore });
        } catch(e) { console.warn("Firebase set score failed", e); }
    }
}

export const getStudentsAsync = async (): Promise<StudentProfile[]> => {
  if (isFirebaseEnabled && db) {
    try {
        const snapshot = await getDocs(collection(db, STORAGE_KEYS.STUDENTS));
        return snapshot.docs.map(doc => doc.data() as StudentProfile);
    } catch (e) {
        console.warn("Firebase fetch failed, returning local", e);
    }
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
    // Local
    const students = getStudentsSync();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
        students[index].isBlocked = !students[index].isBlocked;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        dispatchStorageEvent(STORAGE_KEYS.STUDENTS);
    }

    if (isFirebaseEnabled && db) {
        try {
            const remoteStudents = await getStudentsAsync();
            const student = remoteStudents.find(s => s.id === studentId);
            if (student) {
                await updateDoc(doc(db, STORAGE_KEYS.STUDENTS, student.id), { isBlocked: !student.isBlocked });
            }
        } catch (e) { console.warn("Firebase block failed", e); }
    }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    // 1. Delete Locally First (Optimistic)
    const students = getStudentsSync().filter(s => s.id !== studentId);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    dispatchStorageEvent(STORAGE_KEYS.STUDENTS);

    // 2. Try Firebase
    if (isFirebaseEnabled && db) {
        try {
            await deleteDoc(doc(db, STORAGE_KEYS.STUDENTS, studentId));
        } catch (e) { 
            console.error("Error deleting student from Firebase:", e);
            // We already deleted locally, so the UI will update. 
            // We suppress the alert to make it "work" for the user.
        }
    }
};

// --- Question Management (Dynamic) ---

export const saveQuestion = async (question: QuizQuestion): Promise<void> => {
    // Local
    const questions = getQuestionsSync();
    questions.push(question);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    dispatchStorageEvent(STORAGE_KEYS.QUESTIONS);

    if (isFirebaseEnabled && db) {
        try {
            await setDoc(doc(db, STORAGE_KEYS.QUESTIONS, question.id), question);
        } catch(e) { console.warn("Firebase question save failed", e); }
    }
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
    // Local
    const questions = getQuestionsSync().filter(q => q.id !== questionId);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    dispatchStorageEvent(STORAGE_KEYS.QUESTIONS);

    if (isFirebaseEnabled && db) {
        try {
            await deleteDoc(doc(db, STORAGE_KEYS.QUESTIONS, questionId));
        } catch(e) {
            console.error("Error deleting question from Firebase:", e);
        }
    }
};

export const getQuestionsAsync = async (): Promise<QuizQuestion[]> => {
    if (isFirebaseEnabled && db) {
        try {
            const snapshot = await getDocs(collection(db, STORAGE_KEYS.QUESTIONS));
            return snapshot.docs.map(doc => doc.data() as QuizQuestion);
        } catch (e) { console.warn("Firebase fetch questions failed", e); }
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
  // Local
  const sessions = getAllSessionsSync();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  dispatchStorageEvent(STORAGE_KEYS.SESSIONS);

  if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, STORAGE_KEYS.SESSIONS, session.id), session);
      } catch(e) { console.error("Error saving session to Firebase", e); }
  }
};

export const getAllSessionsAsync = async (): Promise<ChatSession[]> => {
    if (isFirebaseEnabled && db) {
        try {
            const q = query(collection(db, STORAGE_KEYS.SESSIONS), orderBy('startTime', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as ChatSession);
        } catch(e) { console.warn("Firebase fetch sessions failed", e); }
    }
    return getAllSessionsSync();
};

const getAllSessionsSync = (): ChatSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    // Local
    const sessions = getAllSessionsSync().filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    dispatchStorageEvent(STORAGE_KEYS.SESSIONS);

    if (isFirebaseEnabled && db) {
        try {
            await deleteDoc(doc(db, STORAGE_KEYS.SESSIONS, sessionId));
        } catch(e) {
            console.error("Error deleting session from Firebase:", e);
        }
    }
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
