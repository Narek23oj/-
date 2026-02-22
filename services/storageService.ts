
import { ChatSession, StudentProfile, QuizQuestion, Notification, TeacherProfile, TeacherMessage, INITIAL_ADMINS, AVAILABLE_FRAMES, AVAILABLE_BACKGROUNDS } from '../types';
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
  getDoc,
  limit,
  arrayUnion,
  addDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
// Hardcoded for immediate connection reliability
const firebaseConfig = {
  apiKey: "AIzaSyBkLx7A2QGeQFfklSFyYg7PPDLTCbAMhzw",
  authDomain: "timi-platform.firebaseapp.com",
  projectId: "timi-platform",
  storageBucket: "timi-platform.firebasestorage.app",
  messagingSenderId: "295502379181",
  appId: "1:295502379181:web:11995f2cd1d0215f04ee24"
};

// Initialize Firebase immediately
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 Firebase initialized and ready.");

// Collections
const COLLECTIONS = {
    STUDENTS: 'students',
    SESSIONS: 'sessions',
    QUESTIONS: 'questions',
    TEACHERS: 'teachers',
    NOTIFICATIONS: 'notifications',
    TEACHER_MESSAGES: 'teacher_messages'
};

// --- MIGRATION UTILITY ---
export const migrateLocalToCloud = async (): Promise<string> => {
    let count = 0;
    try {
        // Migrate Teachers (Initial Seed)
        // This ensures the database gets populated with the hardcoded list initially
        for (const tName of INITIAL_ADMINS) {
             const tRef = doc(db, COLLECTIONS.TEACHERS, tName);
             const tSnap = await getDoc(tRef);
             if (!tSnap.exists()) {
                 await setDoc(doc(db, COLLECTIONS.TEACHERS, tName), {
                     username: tName,
                     addedBy: 'SYSTEM',
                     joinedAt: Date.now()
                 });
                 count++;
             }
        }

        // Migrate Students
        const localStudents = localStorage.getItem('timi_students');
        if (localStudents) {
            const students: StudentProfile[] = JSON.parse(localStudents);
            for (const s of students) {
                await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), s, { merge: true });
                count++;
            }
        }
        
        return `Successfully synced/seeded ${count} items to Cloud!`;
    } catch (e: any) {
        console.error(e);
        return `Migration failed: ${e.message}`;
    }
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToStudents = (callback: (students: StudentProfile[]) => void) => {
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
  const q = query(collection(db, COLLECTIONS.SESSIONS), orderBy('startTime', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = [];
      snapshot.forEach((doc) => sessions.push(doc.data() as ChatSession));
      callback(sessions);
  });
  return unsubscribe;
};

export const subscribeToStudentSessions = (studentId: string, callback: (sessions: ChatSession[]) => void) => {
  const q = query(
      collection(db, COLLECTIONS.SESSIONS), 
      where('studentId', '==', studentId)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
      let sessions: ChatSession[] = [];
      snapshot.forEach((doc) => sessions.push(doc.data() as ChatSession));
      sessions.sort((a, b) => b.startTime - a.startTime);
      callback(sessions);
  });
  return unsubscribe;
};

export const subscribeToQuestions = (callback: (questions: QuizQuestion[]) => void) => {
  const q = query(collection(db, COLLECTIONS.QUESTIONS));
  const unsubscribe = onSnapshot(q, (snapshot) => {
      const questions: QuizQuestion[] = [];
      snapshot.forEach((doc) => questions.push(doc.data() as QuizQuestion));
      callback(questions);
  });
  return unsubscribe;
};

export const subscribeToTeachers = (callback: (teachers: TeacherProfile[]) => void) => {
    const q = query(collection(db, COLLECTIONS.TEACHERS));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const teachers: TeacherProfile[] = [];
        snapshot.forEach((doc) => teachers.push(doc.data() as TeacherProfile));
        
        teachers.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
        callback(teachers);
    });
    return unsubscribe;
};

// --- TEACHER CHAT SUBSCRIPTION ---

export const subscribeToTeacherMessages = (callback: (messages: TeacherMessage[]) => void) => {
    const q = query(collection(db, COLLECTIONS.TEACHER_MESSAGES), orderBy('timestamp', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: TeacherMessage[] = [];
        snapshot.forEach((doc) => messages.push(doc.data() as TeacherMessage));
        callback(messages);
    });
    return unsubscribe;
};

export const sendTeacherMessage = async (msg: TeacherMessage): Promise<void> => {
    await setDoc(doc(db, COLLECTIONS.TEACHER_MESSAGES, msg.id), msg);
};

// --- NOTIFICATION SUBSCRIPTION ---

export const subscribeToNotifications = (student: StudentProfile, callback: (notifications: Notification[]) => void) => {
    const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS), 
        orderBy('timestamp', 'desc'), 
        limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const relevant: Notification[] = [];
        snapshot.forEach((doc) => {
            const notif = doc.data() as Notification;
            
            let isForMe = false;
            if (notif.targetType === 'ALL') isForMe = true;
            else if (notif.targetType === 'GRADE' && notif.targetValue === student.grade) isForMe = true;
            else if (notif.targetType === 'USER' && notif.targetValue === student.id) isForMe = true;

            if (isForMe) {
                relevant.push(notif);
            }
        });
        callback(relevant);
    });
    return unsubscribe;
};

export const markNotificationAsRead = async (notificationId: string, studentId: string) => {
    const ref = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(ref, {
        readBy: arrayUnion(studentId)
    });
};

export const sendNotification = async (notif: Notification) => {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notif.id), notif);
};

// --- TEACHER MANAGEMENT ---

export const getTeacherList = async (): Promise<string[]> => {
    const q = query(collection(db, COLLECTIONS.TEACHERS));
    const snapshot = await getDocs(q);
    const dbNames: string[] = [];
    snapshot.forEach(d => dbNames.push(d.data().username));
    
    // For login validation, we still want to ensure INITIAL_ADMINS can login 
    // even if they haven't been synced to DB yet, so we merge here for the Login dropdown/check.
    const allNames = Array.from(new Set([...INITIAL_ADMINS, ...dbNames]));
    return allNames.sort();
};

export const addTeacher = async (username: string, addedBy: string): Promise<void> => {
    const cleanName = username.trim();
    if (!cleanName) throw new Error("Invalid username");
    
    await setDoc(doc(db, COLLECTIONS.TEACHERS, cleanName), {
        username: cleanName,
        addedBy,
        joinedAt: Date.now(),
        avatar: ''
    });
};

export const removeTeacher = async (username: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.TEACHERS, username));
};

export const saveTeacherAvatar = async (username: string, avatarUrl: string): Promise<void> => {
    try {
        const cleanId = username.trim();
        await setDoc(doc(db, COLLECTIONS.TEACHERS, cleanId), { 
            avatar: avatarUrl,
            updatedAt: Date.now() 
        }, { merge: true });
    } catch (e) {
        console.error("Failed to save avatar", e);
        throw e;
    }
};

export const getTeacherAvatar = async (username: string): Promise<string | null> => {
    try {
        const docRef = doc(db, COLLECTIONS.TEACHERS, username.trim());
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
  await setDoc(doc(db, COLLECTIONS.STUDENTS, student.id), student, { merge: true });
};

export const updateStudentFields = async (studentId: string, fields: Partial<StudentProfile>): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    await updateDoc(docRef, fields);
};

export const updateStudentScore = async (studentId: string, pointsToAdd: number): Promise<StudentProfile | null> => {
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

// --- SHOP OPERATIONS ---

export const purchaseFrame = async (studentId: string, frameId: string): Promise<StudentProfile | null> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const student = docSnap.data() as StudentProfile;
            const frame = AVAILABLE_FRAMES.find(f => f.id === frameId);
            
            if (!frame) throw new Error("Frame not found");
            if ((student.score || 0) < frame.price) throw new Error("Insufficient points");
            if (student.inventory?.includes(frameId)) throw new Error("Already owned");

            const newScore = (student.score || 0) - frame.price;
            const newInventory = [...(student.inventory || []), frameId];

            const updates = {
                score: newScore,
                inventory: newInventory
            };

            await updateDoc(docRef, updates);
            return { ...student, ...updates };
        }
    } catch (e) {
        console.error("Purchase failed", e);
        throw e;
    }
    return null;
};

export const equipFrame = async (studentId: string, frameId: string | undefined): Promise<StudentProfile | null> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    try {
        await updateDoc(docRef, { equippedFrame: frameId || null });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data() as StudentProfile;
    } catch (e) {
        console.error("Equip failed", e);
        throw e;
    }
    return null;
};

// --- SHOP OPERATIONS: BACKGROUNDS ---

export const purchaseBackground = async (studentId: string, bgId: string): Promise<StudentProfile | null> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const student = docSnap.data() as StudentProfile;
            const bg = AVAILABLE_BACKGROUNDS.find(b => b.id === bgId);
            
            if (!bg) throw new Error("Background not found");
            if ((student.score || 0) < bg.price) throw new Error("Insufficient points");
            if (student.inventoryBackgrounds?.includes(bgId)) throw new Error("Already owned");

            const newScore = (student.score || 0) - bg.price;
            const newInventory = [...(student.inventoryBackgrounds || []), bgId];

            const updates = {
                score: newScore,
                inventoryBackgrounds: newInventory
            };

            await updateDoc(docRef, updates);
            return { ...student, ...updates };
        }
    } catch (e) {
        console.error("Purchase bg failed", e);
        throw e;
    }
    return null;
};

export const equipBackground = async (studentId: string, bgId: string | undefined): Promise<StudentProfile | null> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    try {
        await updateDoc(docRef, { equippedBackground: bgId || null });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data() as StudentProfile;
    } catch (e) {
        console.error("Equip bg failed", e);
        throw e;
    }
    return null;
};

export const incrementStudentQuizAttempt = async (studentId: string, subject: string): Promise<StudentProfile | null> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as StudentProfile;
            const attempts = data.quizAttempts || {};
            const current = attempts[subject] || 0;
            
            attempts[subject] = current + 1;
            
            await updateDoc(docRef, { quizAttempts: attempts });
            return { ...data, quizAttempts: attempts };
        }
    } catch (e) { console.error("Error incrementing quiz attempt", e); }
    return null;
};

export const setStudentScore = async (studentId: string, newScore: number): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    await updateDoc(docRef, { score: newScore });
}

export const findStudentByNameAndGrade = async (name: string, grade: string): Promise<StudentProfile | undefined> => {
    const q = query(collection(db, COLLECTIONS.STUDENTS));
    const snapshot = await getDocs(q);
    const students: StudentProfile[] = [];
    snapshot.forEach(d => students.push(d.data() as StudentProfile));

    const searchName = name.toLowerCase().replace(/\s+/g, ' ').trim();
    const searchGrade = grade.trim();

    return students.find(
        s => (s.name || "").toLowerCase().replace(/\s+/g, ' ').trim() === searchName && 
             (s.grade || "").trim() === searchGrade
    );
};

export const toggleStudentBlockStatus = async (studentId: string): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const isBlocked = docSnap.data().isBlocked;
        await updateDoc(docRef, { isBlocked: !isBlocked });
    }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
};

// --- QUESTION OPERATIONS ---

export const saveQuestion = async (question: QuizQuestion): Promise<void> => {
    await setDoc(doc(db, COLLECTIONS.QUESTIONS, question.id), question, { merge: true });
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, questionId));
};

export const getQuestionsAsync = async (): Promise<QuizQuestion[]> => {
    const q = query(collection(db, COLLECTIONS.QUESTIONS));
    const snapshot = await getDocs(q);
    const questions: QuizQuestion[] = [];
    snapshot.forEach(d => questions.push(d.data() as QuizQuestion));
    return questions;
};

// --- SESSION OPERATIONS ---

export const saveSession = async (session: ChatSession): Promise<void> => {
    await setDoc(doc(db, COLLECTIONS.SESSIONS, session.id), session, { merge: true });
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.SESSIONS, sessionId));
};

// --- UTILS ---

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- BULK IMPORT ---

export const bulkImportStudents = async (csvContent: string): Promise<{ added: number, errors: string[] }> => {
    const lines = csvContent.split('\n');
    let addedCount = 0;
    const errors: string[] = [];
    
    if (lines.length === 0) return { added: 0, errors: [] };

    const q = query(collection(db, COLLECTIONS.STUDENTS));
    const snapshot = await getDocs(q);
    const currentStudents: StudentProfile[] = [];
    snapshot.forEach(d => currentStudents.push(d.data() as StudentProfile));

    const firstLine = lines[0] || "";
    const headers = firstLine.toLowerCase().split(',').map(h => h.trim());
    
    // Detect column indices based on headers
    let nameIdx = headers.indexOf('student');
    if (nameIdx === -1) nameIdx = headers.indexOf('name');
    if (nameIdx === -1) nameIdx = headers.indexOf('անուն');
    
    let gradeIdx = headers.indexOf('grade');
    if (gradeIdx === -1) gradeIdx = headers.indexOf('դասարան');
    
    let teacherIdx = headers.indexOf('teacher');
    if (teacherIdx === -1) teacherIdx = headers.indexOf('ուսուցիչ');
    
    let passIdx = headers.indexOf('password');
    if (passIdx === -1) passIdx = headers.indexOf('գաղտնաբառ');

    // If we found at least name or grade in the first line, it's a header row
    const hasHeaders = nameIdx !== -1 || gradeIdx !== -1;
    const startIndex = hasHeaders ? 1 : 0;

    // Fallback defaults if no headers found (legacy format: name, grade, password)
    if (!hasHeaders) {
        nameIdx = 0;
        gradeIdx = 1;
        teacherIdx = -1; // No teacher in legacy
        passIdx = 2;
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        
        const name = parts[nameIdx]?.trim();
        const grade = parts[gradeIdx]?.trim();
        const teacher = (teacherIdx !== -1 && parts[teacherIdx]) ? parts[teacherIdx].trim() : undefined;
        const password = (passIdx !== -1 && parts[passIdx]?.trim()) || "";

        if (!name || !grade) {
            if (line.length > 2) errors.push(`Row ${i + 1}: Missing name or grade`);
            continue;
        }

        const existing = currentStudents.find(
            s => (s.name || "").toLowerCase() === name.toLowerCase() && s.grade === grade
        );
        
        if (existing) {
            errors.push(`Row ${i + 1}: Student "${name}" already exists in grade ${grade}`);
            continue;
        }

        const newStudent: StudentProfile = {
            id: generateId(),
            name,
            grade,
            password,
            teacherName: teacher,
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
