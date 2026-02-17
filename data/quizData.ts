
import { QuizQuestion } from "../types";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Math
  {
    id: 'm1',
    subject: 'Մաթեմատիկա',
    question: 'Ո՞րն է Պյութագորասի թեորեմը:',
    options: ['a + b = c', 'a² + b² = c²', 'a * b = c', 'a² - b² = c²'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 'm2',
    subject: 'Մաթեմատիկա',
    question: 'Ինչի՞ է հավասար 5-ի խորանարդը:',
    options: ['25', '100', '125', '15'],
    correctAnswer: 2,
    points: 10
  },
  {
    id: 'm3',
    subject: 'Մաթեմատիկա',
    question: 'Քանի՞ աստիճան է ուղիղ անկյունը:',
    options: ['45°', '90°', '180°', '360°'],
    correctAnswer: 1,
    points: 5
  },
  
  // Armenian History
  {
    id: 'h1',
    subject: 'Պատմություն',
    question: 'Ե՞րբ է ընդունվել Քրիստոնեությունը Հայաստանում որպես պետական կրոն:',
    options: ['405 թ.', '301 թ.', '451 թ.', '1918 թ.'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 'h2',
    subject: 'Պատմություն',
    question: 'Ո՞վ է ստեղծել հայոց գրերը:',
    options: ['Մովսես Խորենացի', 'Սահակ Պարթև', 'Մեսրոպ Մաշտոց', 'Գրիգոր Լուսավորիչ'],
    correctAnswer: 2,
    points: 10
  },

  // Physics
  {
    id: 'p1',
    subject: 'Ֆիզիկա',
    question: 'Ի՞նչ միավորով է չափվում ուժը:',
    options: ['Ջոուլ (J)', 'Նյուտոն (N)', 'Վատտ (W)', 'Պասկալ (Pa)'],
    correctAnswer: 1,
    points: 15
  },
  {
    id: 'p2',
    subject: 'Ֆիզիկա',
    question: 'Ո՞րն է արագության բանաձևը:',
    options: ['v = S/t', 'v = m*a', 'v = t/S', 'v = S*t'],
    correctAnswer: 0,
    points: 10
  },

  // Geography
  {
    id: 'g1',
    subject: 'Աշխարհագրություն',
    question: 'Ո՞րն է Հայաստանի ամենաբարձր լեռնագագաթը:',
    options: ['Արա լեռ', 'Արագած', 'Կապուտջուղ', 'Աժդահակ'],
    correctAnswer: 1,
    points: 5
  },

  // Literature
  {
    id: 'l1',
    subject: 'Գրականություն',
    question: 'Ո՞վ է գրել «Անուշ» պոեմը:',
    options: ['Եղիշե Չարենց', 'Ավետիք Իսահակյան', 'Հովհաննես Թումանյան', 'Պարույր Սևակ'],
    correctAnswer: 2,
    points: 10
  },

  // English
  {
    id: 'e1',
    subject: 'Անգլերեն',
    question: 'Ինչպե՞ս է անգլերեն թարգմանվում «Գիրք» բառը:',
    options: ['Pen', 'Book', 'Table', 'School'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 'e2',
    subject: 'Անգլերեն',
    question: 'Ընտրեք ճիշտ տարբերակը՝ "I ___ a student".',
    options: ['is', 'are', 'am', 'be'],
    correctAnswer: 2,
    points: 10
  },
  {
    id: 'e3',
    subject: 'Անգլերեն',
    question: 'Ո՞րն է "Red" գույնը հայերեն:',
    options: ['Կապույտ', 'Կանաչ', 'Դեղին', 'Կարմիր'],
    correctAnswer: 3,
    points: 5
  },

  // Russian
  {
    id: 'r1',
    subject: 'Ռուսաց լեզու',
    question: 'Ինչպե՞ս է ռուսերեն թարգմանվում «Շուն» բառը:',
    options: ['Кошка', 'Собака', 'Мышь', 'Птица'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 'r2',
    subject: 'Ռուսաց լեզու',
    question: 'Ո՞րն է "Спасибо" բառի հայերեն թարգմանությունը:',
    options: ['Բարև', 'Հաջողություն', 'Խնդրեմ', 'Շնորհակալություն'],
    correctAnswer: 3,
    points: 10
  },
  {
    id: 'r3',
    subject: 'Ռուսաց լեզու',
    question: 'Ընտրեք ճիշտ տարբերակը՝ "Я ___ в школу".',
    options: ['иду', 'идёшь', 'идёт', 'идут'],
    correctAnswer: 0,
    points: 15
  }
];

export const SUBJECTS = Array.from(new Set(QUIZ_QUESTIONS.map(q => q.subject)));
