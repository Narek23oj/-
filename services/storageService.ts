import { ChatSession, StudentProfile } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'timi_sessions',
  STUDENTS: 'timi_students',
};

// --- Student Management ---

export const saveStudent = (student: StudentProfile): void => {
  const students = getStudents();
  // Update if exists or add new
  const index = students.findIndex(s => s.id === student.id);
  if (index >= 0) {
    // Preserve blocked status and score if updating details
    students[index] = { 
        ...students[index], 
        ...student, 
        isBlocked: students[index].isBlocked,
        score: students[index].score || student.score || 0
    };
  } else {
    students.push({ ...student, score: 0 });
  }
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
};

export const updateStudentScore = (studentId: string, pointsToAdd: number): StudentProfile | null => {
  const students = getStudents();
  const index = students.findIndex(s => s.id === studentId);
  
  if (index >= 0) {
    const currentScore = students[index].score || 0;
    const newScore = currentScore + pointsToAdd;
    students[index].score = newScore;
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return students[index];
  }
  return null;
};

export const getStudents = (): StudentProfile[] => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  return data ? JSON.parse(data) : [];
};

export const findStudentByNameAndGrade = (name: string, grade: string): StudentProfile | undefined => {
  const students = getStudents();
  return students.find(
    s => s.name.toLowerCase().trim() === name.toLowerCase().trim() && 
         s.grade.trim() === grade.trim()
  );
};

export const toggleStudentBlockStatus = (studentId: string): StudentProfile | undefined => {
    const students = getStudents();
    const index = students.findIndex(s => s.id === studentId);
    if (index >= 0) {
        students[index].isBlocked = !students[index].isBlocked;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        return students[index];
    }
    return undefined;
};

export const deleteStudent = (studentId: string): void => {
    const students = getStudents().filter(s => s.id !== studentId);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
};

// --- Bulk Import Logic ---

export const bulkImportStudents = (csvContent: string): { added: number, errors: string[] } => {
    const lines = csvContent.split('\n');
    let addedCount = 0;
    const errors: string[] = [];
    
    // Skip header if exists (check if first line contains "name" or "անուն")
    const startIndex = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('անուն')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Expected format: Name,Grade,Password
        const parts = line.split(',');
        if (parts.length < 3) {
            errors.push(`Տող ${i + 1}: Սխալ ֆորմատ (պահանջվում է: Անուն,Դասարան,Գաղտնաբառ)`);
            continue;
        }

        const name = parts[0].trim();
        const grade = parts[1].trim();
        const password = parts[2].trim();

        if (!name || !grade || !password) {
            errors.push(`Տող ${i + 1}: Բացակայող տվյալներ`);
            continue;
        }

        const existing = findStudentByNameAndGrade(name, grade);
        if (existing) {
            errors.push(`Տող ${i + 1}: Աշակերտ "${name}" արդեն գրանցված է`);
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

        saveStudent(newStudent);
        addedCount++;
    }

    return { added: addedCount, errors };
};

// --- Database Backup/Restore ---

export const exportDatabase = (): string => {
    const data = {
        students: getStudents(),
        sessions: getAllSessions(),
        timestamp: Date.now()
    };
    return JSON.stringify(data, null, 2);
};

export const restoreDatabase = (jsonContent: string): boolean => {
    try {
        const data = JSON.parse(jsonContent);
        if (data.students && Array.isArray(data.students)) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
        }
        if (data.sessions && Array.isArray(data.sessions)) {
            localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
        }
        return true;
    } catch (e) {
        console.error("Failed to restore database", e);
        return false;
    }
};

// --- Session/Chat Management ---

export const saveSession = (session: ChatSession): void => {
  const sessions = getAllSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const getAllSessions = (): ChatSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const getSessionsByStudent = (studentId: string): ChatSession[] => {
  return getAllSessions().filter(s => s.studentId === studentId);
};

export const deleteSession = (sessionId: string): void => {
    const sessions = getAllSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

// Helper to generate IDs
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};