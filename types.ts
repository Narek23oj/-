
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
  teacherName?: string; // Added teacher name
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
  currentAdminUser?: string | null; // Track which admin is logged in
  view: 'LOGIN' | 'PROFILE_SETUP' | 'STUDENT_DASHBOARD' | 'ADMIN_DASHBOARD' | 'QUIZ';
}

export const ADMIN_USERNAMES = [
  'Yeghiazaryan.N',
  'Margaryan.G',
  'Matevosyan.H',
  'Harutyunyan.H',
  'Taschyan.D',
  'Davtyan.R',
  'Tamrazyan.C',
  'Gasparyan.O',
  'Nersisyan.L',
  'Sayadyan.A',
  'Khachyan.S',
  'Tamamyan.G'
];

export const MAIN_ADMIN = {
    username: 'Yeghiazaryan.N',
    email: 'narekexiazaryan95@gmail.com'
};

export const ADMIN_PASSWORD = 'timi.adm.edu';

export interface QuizQuestion {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  points: number;
}
