
export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export interface StudentProfile {
  id: string;
  name: string; // Full name (First + Last)
  grade: string; // 1-9
  password?: string; 
  avatar?: string; 
  joinedAt: number; 
  isBlocked?: boolean; 
  score?: number; 
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  studentId: string;
  studentName: string;
  studentGrade: string;
  startTime: number;
  messages: Message[];
  isFlagged?: boolean; // For 18+ content monitoring
}

export interface AppState {
  currentUser: StudentProfile | null;
  isAdmin: boolean;
  view: 'LOGIN' | 'STUDENT_DASHBOARD' | 'ADMIN_DASHBOARD' | 'QUIZ';
}

export const ADMIN_CREDENTIALS = {
  code: 'timi1',
  password: 'TiMi1'
};

export interface QuizQuestion {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  points: number;
}
