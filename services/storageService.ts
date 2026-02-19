
import { ChatSession, StudentProfile, QuizQuestion } from '../types';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  orderBy,
  where,
  getDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
// Ensure you have a .env file with these values or configure them in your deployment platform
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

let db: any;

// Fallback for development if keys are missing (prevents crash, but sync won't work)
try {
    if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("🔥 Firebase initialized successfully.");
    } else {
        console.warn("⚠️ Firebase keys missing. App running in non-sync mode (UI only).");
    }
} catch (e) {
    console.error("Firebase init error:", e);
}

// Collections
const COLLECTIONS = {
    STUDENTS: 'students',
    SESSIONS: 'sessions',
    QUESTIONS: 'questions',
    TEACHERS: 'teachers'
};

// --- MIGRATION UTILITY (Run once to push LocalStorage to Firebase) ---
export const migrateLocalToCloud = async (): Promise<string> => {
    if (!db) return "Firebase not configured.";
    
    let count = 0;
    try {
        // Migrate Students
        const localStudents = localStorage.getItem('timi_students');
        if (localStudents) {
            const students: StudentProfile[] = JSON.parse(localStudents);
            for (const s of students) {
                await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), s, { merge: true });
                count++;
            }
        }

        // Migrate Questions
        const localQuestions = localStorage.getItem('timi_questions');
        if (localQuestions) {
            const questions: QuizQuestion[] = JSON.parse(localQuestions);
            for (const q of questions) {
                await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), q, { merge: true });
                count++;
            }
        }

        // Migrate Sessions
        const localSessions = localStorage.getItem('timi_sessions');
        if (localSessions) {
            const sessions: ChatSession[] = JSON.parse(localSessions);
            for (const s of sessions) {
                await setDoc(doc(db, COLLECTIONS.SESSIONS, s.id), s, { merge: true });
                count++;
            }
        }
        
        return `Successfully migrated ${count} items to Cloud!`;
    } catch (e: any) {
        console.error(e);
        return `Migration failed: ${e.message}`;
    }
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToStudents = (callback: (students: StudentProfile[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLLECTIONS.STUDENTS));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const students: StudentProfile[] = [];
    snapshot.forEach((doc) => {
      students.push(doc.data() as StudentProfile);
    });
    callback(students);
  });
  return unsubscribe;
};

export const subscribeToSessions = (callback: (sessions: ChatSession[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLLECTIONS.SESSIONS), orderBy('startTime', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = [];
      snapshot.forEach((doc) => sessions.push(doc.data() as ChatSession));
      callback(sessions);
  });
  return unsubscribe;
};

export const subscribeToStudentSessions = (studentId: string, callback: (sessions: ChatSession[]) => void) => {
  if (!db) return () => {};
  // Firestore composite index might be needed for where + orderBy. 
  // If failed, check console for link to create index.
  const q = query(
      collection(db, COLLECTIONS.SESSIONS), 
      where('studentId', '==', studentId)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
      let sessions: ChatSession[] = [];
      snapshot.forEach((doc) => sessions.push(doc.data() as ChatSession));
      // Sort client-side to avoid complex index requirements for simple app
      sessions.sort((a, b) => b.startTime - a.startTime);
      callback(sessions);
  });
  return unsubscribe;
};

export const subscribeToQuestions = (callback: (questions: QuizQuestion[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLLECTIONS.QUESTIONS));
  const unsubscribe = onSnapshot(q, (snapshot) => {
      const questions: QuizQuestion[] = [];
      snapshot.forEach((doc) => questions.push(doc.data() as QuizQuestion));
      callback(questions);
  });
  return unsubscribe;
};

// --- TEACHER MANAGEMENT ---

export const saveTeacherAvatar = async (username: string, avatarUrl: string): Promise<void> => {
    if (!db) return;
    // We store teachers in a 'teachers' collection where doc ID is username
    await setDoc(doc(db, COLLECTIONS.TEACHERS, username), { avatar: avatarUrl }, { merge: true });
};

export const getTeacherAvatar = async (username: string): Promise<string | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, COLLECTIONS.TEACHERS, username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().avatar || null;
        }
    } catch (e) {
        console.warn("Error fetching avatar", e);
    }
    return null;
};

// --- STUDENT OPERATIONS ---

export const saveStudent = async (student: StudentProfile): Promise<void> => {
  if (!db) return;
  // Use merge: true to avoid overwriting existing fields if we just want to update partials.
  // This ensures we don't accidentally delete fields like 'score' if they aren't passed in the update.
  await setDoc(doc(db, COLLECTIONS.STUDENTS, student.id), student, { merge: true });
};

export const updateStudentScore = async (studentId: string, pointsToAdd: number): Promise<StudentProfile | null> => {
    if (!db) return null;
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const currentData = docSnap.data() as StudentProfile;
            const newScore = (currentData.score || 0) + pointsToAdd;
            await updateDoc(docRef, { score: newScore });
            return { ...currentData, score: newScore };
        }
    } catch(e) { console.error(e); }
    return null;
};

export const setStudentScore = async (studentId: string, newScore: number): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    await updateDoc(docRef, { score: newScore });
}

export const findStudentByNameAndGrade = async (name: string, grade: string): Promise<StudentProfile | undefined> => {
    if (!db) return undefined;
    
    // Optimized: We perform the fetch. Since we are using Firestore, 
    // getting the docs directly ensures we have the latest data from the server.
    // Note: Firestore queries are case-sensitive by default. To support case-insensitive
    // search without 3rd party tools (Algolia/Typesense), we fetch the collection (if small)
    // or rely on exact match. Here we stick to client-side filtering for flexibility on small datasets.
    
    const q = query(collection(db, COLLECTIONS.STUDENTS));
    const snapshot = await getDocs(q);
    const students: StudentProfile[] = [];
    snapshot.forEach(d => students.push(d.data() as StudentProfile));

    // Client-side robust matching
    const searchName = name.toLowerCase().replace(/\s+/g, ' ').trim();
    const searchGrade = grade.trim();

    return students.find(
        s => s.name.toLowerCase().replace(/\s+/g, ' ').trim() === searchName && 
             s.grade.trim() === searchGrade
    );
};

export const toggleStudentBlockStatus = async (studentId: string): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const isBlocked = docSnap.data().isBlocked;
        await updateDoc(docRef, { isBlocked: !isBlocked });
    }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
};

// --- QUESTION OPERATIONS ---

export const saveQuestion = async (question: QuizQuestion): Promise<void> => {
    if (!db) return;
    await setDoc(doc(db, COLLECTIONS.QUESTIONS, question.id), question, { merge: true });
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, questionId));
};

export const getQuestionsAsync = async (): Promise<QuizQuestion[]> => {
    if (!db) return [];
    const q = query(collection(db, COLLECTIONS.QUESTIONS));
    const snapshot = await getDocs(q);
    const questions: QuizQuestion[] = [];
    snapshot.forEach(d => questions.push(d.data() as QuizQuestion));
    return questions;
};

// --- SESSION OPERATIONS ---

export const saveSession = async (session: ChatSession): Promise<void> => {
    if (!db) return;
    await setDoc(doc(db, COLLECTIONS.SESSIONS, session.id), session, { merge: true });
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTIONS.SESSIONS, sessionId));
};

// --- UTILS ---

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- BULK IMPORT ---

export const bulkImportStudents = async (csvContent: string): Promise<{ added: number, errors: string[] }> => {
    if (!db) return { added: 0, errors: ["Database not connected"] };

    const lines = csvContent.split('\n');
    let addedCount = 0;
    const errors: string[] = [];
    
    // Fetch current to avoid dupes (naive check)
    const q = query(collection(db, COLLECTIONS.STUDENTS));
    const snapshot = await getDocs(q);
    const currentStudents: StudentProfile[] = [];
    snapshot.forEach(d => currentStudents.push(d.data() as StudentProfile));

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

export const exportDatabase = async (): Promise<string> => {
    if (!db) return "{}";
    
    // Fetch all collections manually
    const studentsSnap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
    const sessionsSnap = await getDocs(collection(db, COLLECTIONS.SESSIONS));
    const questionsSnap = await getDocs(collection(db, COLLECTIONS.QUESTIONS));

    const students = studentsSnap.docs.map(d => d.data());
    const sessions = sessionsSnap.docs.map(d => d.data());
    const questions = questionsSnap.docs.map(d => d.data());

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
