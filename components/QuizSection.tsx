
import React, { useState, useEffect } from 'react';
import { QuizQuestion, StudentProfile } from '../types';
import { QUIZ_QUESTIONS, SUBJECTS } from '../data/quizData';
import { updateStudentScore } from '../services/storageService';
import Button from './Button';

interface QuizSectionProps {
  student: StudentProfile;
  onScoreUpdate: (newStudentData: StudentProfile) => void;
  onBack: () => void;
}

const QuizSection: React.FC<QuizSectionProps> = ({ student, onScoreUpdate, onBack }) => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filteredQuestions, setFilteredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [scoreEarned, setScoreEarned] = useState(0);

  // Load questions when subject changes
  useEffect(() => {
    if (selectedSubject) {
      const questions = QUIZ_QUESTIONS.filter(q => q.subject === selectedSubject)
                                      .sort(() => 0.5 - Math.random()); // Shuffle
      setFilteredQuestions(questions);
      setCurrentQuestionIndex(0);
      resetQuestionState();
    } else {
      setFilteredQuestions([]);
    }
  }, [selectedSubject]);

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setFeedback(null);
    setScoreEarned(0);
  };

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
  };

  const handleAnswerSelect = (index: number) => {
    if (isAnswered) return;
    
    // Safety check
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSelectedAnswer(index);
    setIsAnswered(true);

    const isCorrect = index === currentQuestion.correctAnswer;

    if (isCorrect) {
      setFeedback('correct');
      setScoreEarned(currentQuestion.points);
      // Update score in storage and parent state (preserves other data)
      const updatedStudent = updateStudentScore(student.id, currentQuestion.points);
      if (updatedStudent) {
        onScoreUpdate(updatedStudent);
      }
    } else {
      setFeedback('wrong');
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    } else {
      // End of quiz for this subject
      setSelectedSubject(null);
    }
  };

  // 1. Subject Selection View
  if (!selectedSubject) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-2xl font-bold text-gray-800">Ընտրեք առարկան</h2>
           <Button variant="ghost" onClick={onBack}>← Վերադառնալ</Button>
        </div>
        
        <p className="text-gray-600 mb-8">Ընտրեք թեման և սկսեք պատասխանել հարցերին՝ միավորներ վաստակելու համար:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUBJECTS.map(subject => (
            <button
              key={subject}
              onClick={() => handleSubjectSelect(subject)}
              className="p-6 rounded-xl border-2 border-indigo-100 hover:border-primary hover:bg-indigo-50 transition-all text-left group"
            >
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-primary mb-2">{subject}</h3>
              <p className="text-sm text-gray-500">
                 {QUIZ_QUESTIONS.filter(q => q.subject === subject).length} հարց
              </p>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-8 border-t border-gray-100 text-center text-gray-400 text-sm">
           Պատասխանիր ճիշտ և հավաքիր միավորներ 🏆
        </div>
      </div>
    );
  }

  // 2. Loading State (Fixes undefined error)
  const currentQuestion = filteredQuestions[currentQuestionIndex];
  
  if (!currentQuestion) {
      return (
        <div className="flex justify-center items-center h-full bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-500">Բեռնվում են հարցերը...</p>
            </div>
        </div>
      );
  }

  // 3. Question View
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 h-full flex flex-col relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-indigo-700 px-6 py-4 flex justify-between items-center text-white">
        <div>
           <h2 className="text-xl font-bold">{selectedSubject}</h2>
           <p className="text-xs opacity-80">Հարց {currentQuestionIndex + 1} / {filteredQuestions.length}</p>
        </div>
        <button 
            onClick={() => setSelectedSubject(null)}
            className="text-white/80 hover:text-white text-sm bg-white/10 px-3 py-1 rounded"
        >
            Դադարեցնել
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-10 flex flex-col justify-center max-w-3xl mx-auto w-full">
         <div className="mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
                {currentQuestion.question}
            </h3>
            <span className="inline-block mt-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                {currentQuestion.points} միավոր
            </span>
         </div>

         <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
                let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all font-medium ";
                
                if (isAnswered) {
                    if (idx === currentQuestion.correctAnswer) {
                        btnClass += "bg-green-100 border-green-500 text-green-800";
                    } else if (selectedAnswer === idx) {
                        btnClass += "bg-red-50 border-red-500 text-red-800";
                    } else {
                        btnClass += "border-gray-100 text-gray-400 opacity-50";
                    }
                } else {
                    btnClass += "bg-white border-gray-200 hover:border-primary hover:bg-indigo-50 text-gray-700";
                }

                return (
                    <button
                        key={idx}
                        onClick={() => handleAnswerSelect(idx)}
                        disabled={isAnswered}
                        className={btnClass}
                    >
                        <span className="mr-2 opacity-50">{String.fromCharCode(65 + idx)}.</span> {option}
                    </button>
                );
            })}
         </div>

         {/* Feedback Area */}
         {isAnswered && (
             <div className={`mt-8 p-4 rounded-lg flex justify-between items-center animate-fade-in ${feedback === 'correct' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                 <div className="flex items-center">
                     <span className="text-2xl mr-3">{feedback === 'correct' ? '🎉' : '❌'}</span>
                     <div>
                         <p className="font-bold">{feedback === 'correct' ? 'Ճիշտ է։' : 'Սխալ է։'}</p>
                         {feedback === 'correct' && <p className="text-sm">+ {scoreEarned} միավոր</p>}
                     </div>
                 </div>
                 <Button onClick={handleNextQuestion}>
                     {currentQuestionIndex < filteredQuestions.length - 1 ? 'Հաջորդ հարցը →' : 'Ավարտել'}
                 </Button>
             </div>
         )}
      </div>
    </div>
  );
};

export default QuizSection;
