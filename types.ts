
export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  password?: string; // Teacher generated password
  avatar?: string; // URL to profile picture
  joinedAt: number; // timestamp
  isBlocked?: boolean; // New field for banning users
  score?: number; // Gamification score
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
