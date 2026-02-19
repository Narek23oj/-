
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
  quizAttempts?: Record<string, number>; // Subject -> Count tracking
  
  // Shop Items
  inventory?: string[]; // List of IDs of owned items (frames)
  equippedFrame?: string; // ID of the currently active frame

  // Background Items
  inventoryBackgrounds?: string[]; // List of IDs of owned backgrounds
  equippedBackground?: string; // ID of currently active chat background
}

export interface TeacherProfile {
    username: string;
    addedBy: string;
    joinedAt: number;
    avatar?: string;
}

export interface TeacherMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: number;
    avatar?: string;
    relatedStudentId?: string; // ID of a student to show an info card for
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  sender: string;
  targetType: 'ALL' | 'GRADE' | 'USER'; // Who sees this?
  targetValue?: string; // e.g. "5" for grade, or "student_id"
  attachmentUrl?: string; // Base64 image or file url
  attachmentType?: 'image' | 'file'; 
  readBy: string[]; // List of student IDs who marked this as read
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string for generated images
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
  view: 'LOGIN' | 'PROFILE_SETUP' | 'STUDENT_DASHBOARD' | 'ADMIN_DASHBOARD' | 'QUIZ' | 'STORE';
}

// These two have full access to manage other teachers
export const SUPER_ADMINS = ['Yeghiazaryan.N', 'Davtyan.R'];

// Initial fallback list, but app will rely on Firestore 'teachers' collection
export const INITIAL_ADMINS = [
  'Yeghiazaryan.N',
  'Davtyan.R',
  'Margaryan.G',
  'Matevosyan.H',
  'Harutyunyan.H',
  'Taschyan.D',
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
export const SUPER_ADMIN_PASSWORD = 'timi.supadm.edu';

export interface QuizQuestion {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  points: number;
}

// --- SHOP DATA ---

export interface FrameItem {
    id: string;
    name: string;
    price: number;
    styleClass: string; // Tailwind classes or custom CSS
    previewColor: string; // For the shop card background
}

export const AVAILABLE_FRAMES: FrameItem[] = [
    { id: 'f_basic_blue', name: 'Կապույտ Շրջանակ', price: 5, styleClass: 'border-4 border-blue-500', previewColor: '#EBF8FF' },
    { id: 'f_basic_green', name: 'Կանաչ Շրջանակ', price: 5, styleClass: 'border-4 border-green-500 border-dashed', previewColor: '#F0FFF4' },
    { id: 'f_double_indigo', name: 'Կրկնակի Ինդիգո', price: 10, styleClass: 'border-4 border-indigo-600 ring-2 ring-indigo-300 ring-offset-2', previewColor: '#E0E7FF' },
    { id: 'f_orange_offset', name: 'Նարնջագույն', price: 15, styleClass: 'border-4 border-orange-500 shadow-[0_0_0_3px_rgba(251,146,60,0.5)]', previewColor: '#FFFAF0' },
    { id: 'f_grad_sunset', name: 'Մայրամուտ', price: 20, styleClass: 'p-[3px] bg-gradient-to-br from-pink-500 to-orange-400', previewColor: '#FFF5F7' },
    { id: 'f_grad_ocean', name: 'Օվկիանոս', price: 25, styleClass: 'p-[3px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600', previewColor: '#E6FFFA' },
    { id: 'f_neon_purple', name: 'Նեոնային Մանուշակ', price: 35, styleClass: 'border-[3px] border-purple-500 shadow-[0_0_10px_#A855F7,inset_0_0_5px_#A855F7]', previewColor: '#FAF5FF' },
    { id: 'f_rainbow', name: 'Ծիածան', price: 40, styleClass: 'p-[4px] bg-gradient-to-r from-red-500 via-green-500 to-blue-500 animate-spin-slow', previewColor: '#FFFFFF' },
    { id: 'f_gold_master', name: 'Ոսկե Չեմպիոն', price: 50, styleClass: 'border-[4px] border-yellow-400 shadow-[0_0_15px_#FACC15] ring-2 ring-yellow-200', previewColor: '#FFFFF0' },
];

export interface ChatBackgroundItem {
    id: string;
    name: string;
    price: number;
    cssValue: string; // CSS background property value
    textColor: 'dark' | 'light'; // Optimized text color for this bg
}

export const AVAILABLE_BACKGROUNDS: ChatBackgroundItem[] = [
    { 
        id: 'bg_paper', 
        name: 'Graph Paper', 
        price: 10, 
        cssValue: 'radial-gradient(#e5e7eb 1px, transparent 1px) 0 0 / 20px 20px', 
        textColor: 'dark' 
    },
    { 
        id: 'bg_warm', 
        name: 'Warm Gradient', 
        price: 15, 
        cssValue: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)', 
        textColor: 'dark' 
    },
    { 
        id: 'bg_mint', 
        name: 'Fresh Mint', 
        price: 20, 
        cssValue: 'linear-gradient(to top, #d299c2 0%, #fef9d7 100%)', 
        textColor: 'dark' 
    },
    { 
        id: 'bg_space_light', 
        name: 'Soft Space', 
        price: 25, 
        cssValue: 'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)', 
        textColor: 'dark' 
    },
    { 
        id: 'bg_dots_color', 
        name: 'Polka Dots', 
        price: 30, 
        cssValue: 'radial-gradient(#818cf8 2px, #f3f4f6 2px) 0 0 / 30px 30px', 
        textColor: 'dark' 
    },
    { 
        id: 'bg_abstract', 
        name: 'Abstract Blue', 
        price: 35, 
        cssValue: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 100%), linear-gradient(45deg, #e0f2fe 25%, #f0f9ff 25%, #f0f9ff 50%, #e0f2fe 50%, #e0f2fe 75%, #f0f9ff 75%, #f0f9ff 100%)',
        textColor: 'dark'
    },
    {
        id: 'bg_sunset_vibe',
        name: 'Sunset Vibe',
        price: 40,
        cssValue: 'linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)',
        textColor: 'dark'
    },
    {
        id: 'bg_night_mode',
        name: 'Night Sky',
        price: 50,
        cssValue: 'linear-gradient(to top, #1e3c72 0%, #2a5298 100%)',
        textColor: 'light'
    }
];
