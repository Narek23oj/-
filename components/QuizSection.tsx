
import React, { useState, useEffect } from 'react';
import { QuizQuestion, StudentProfile } from '../types';
import { updateStudentScore, getQuestionsAsync } from '../services/storageService';
import Button from './Button';

interface QuizSectionProps {
  student: StudentProfile;
  onScoreUpdate: (newStudentData: StudentProfile) => void;
  onBack: () => void;
}

const QuizSection: React.FC<QuizSectionProps> = ({ student, onScoreUpdate, onBack }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filteredQuestions, setFilteredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load questions dynamically
  useEffect(() => {
    const loadData = async () => {
        const allQuestions = await getQuestionsAsync();
        setQuestions(allQuestions);
        const uniqueSubjects = Array.from(new Set(allQuestions.map(q => q.subject)));
        setSubjects(uniqueSubjects);
        setIsLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      const qs = questions.filter(q => q.subject === selectedSubject)
                          .sort(() => 0.5 - Math.random()); // Shuffle
      setFilteredQuestions(qs);
      setCurrentQuestionIndex(0);
      resetQuestionState();
    } else {
      setFilteredQuestions([]);
    }
  }, [selectedSubject, questions]);

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setFeedback(null);
    setScoreEarned(0);
    setIsUpdatingScore(false);
  };

  const handleAnswerSelect = async (index: number) => {
    if (isAnswered || isUpdatingScore) return;
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSelectedAnswer(index);
    setIsAnswered(true);

    const isCorrect = index === currentQuestion.correctAnswer;
    if (isCorrect) {
      setFeedback('correct');
      setScoreEarned(currentQuestion.points);
      setIsUpdatingScore(true);
      const updatedStudent = await updateStudentScore(student.id, currentQuestion.points);
      setIsUpdatingScore(false);
      if (updatedStudent) onScoreUpdate(updatedStudent);
    } else {
      setFeedback('wrong');
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    } else {
      setSelectedSubject(null);
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading Questions...</div>;

  if (!selectedSubject) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-2xl font-bold text-gray-800">Choose a Subject</h2>
           <Button variant="ghost" onClick={onBack}>← Back</Button>
        </div>
        {subjects.length === 0 ? (
            <p className="text-center text-gray-500 my-10">No questions available yet. Ask your teacher to add some!</p>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => (
                <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className="p-6 rounded-xl border-2 border-indigo-100 hover:border-primary hover:bg-indigo-50 transition-all text-left group"
                >
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-primary mb-2">{subject}</h3>
                <p className="text-sm text-gray-500">
                    {questions.filter(q => q.subject === subject).length} questions
                </p>
                </button>
            ))}
            </div>
        )}
      </div>
    );
  }

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  if (!currentQuestion) return <div>No questions in this subject.</div>;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 h-full flex flex-col relative">
      <div className="bg-gradient-to-r from-primary to-indigo-700 px-6 py-4 flex justify-between items-center text-white">
        <div>
           <h2 className="text-xl font-bold">{selectedSubject}</h2>
           <p className="text-xs opacity-80">Question {currentQuestionIndex + 1} / {filteredQuestions.length}</p>
        </div>
        <button onClick={() => setSelectedSubject(null)} className="text-white/80 hover:text-white text-sm bg-white/10 px-3 py-1 rounded">Exit Quiz</button>
      </div>

      <div className="flex-1 p-6 md:p-10 flex flex-col justify-center max-w-3xl mx-auto w-full">
         <div className="mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">{currentQuestion.question}</h3>
            <span className="inline-block mt-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">{currentQuestion.points} Points</span>
         </div>

         <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
                let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all font-medium ";
                if (isAnswered) {
                    if (idx === currentQuestion.correctAnswer) btnClass += "bg-green-100 border-green-500 text-green-800";
                    else if (selectedAnswer === idx) btnClass += "bg-red-50 border-red-500 text-red-800";
                    else btnClass += "border-gray-100 text-gray-400 opacity-50";
                } else {
                    btnClass += "bg-white border-gray-200 hover:border-primary hover:bg-indigo-50 text-gray-700";
                }
                return (
                    <button key={idx} onClick={() => handleAnswerSelect(idx)} disabled={isAnswered} className={btnClass}>
                        <span className="mr-2 opacity-50">{String.fromCharCode(65 + idx)}.</span> {option}
                    </button>
                );
            })}
         </div>

         {isAnswered && (
             <div className={`mt-8 p-4 rounded-lg flex justify-between items-center animate-fade-in ${feedback === 'correct' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                 <div className="flex items-center">
                     <span className="text-2xl mr-3">{feedback === 'correct' ? '🎉' : '❌'}</span>
                     <div>
                         <p className="font-bold">{feedback === 'correct' ? 'Correct!' : 'Incorrect.'}</p>
                         {feedback === 'correct' && <p className="text-sm">+ {scoreEarned} points</p>}
                     </div>
                 </div>
                 <Button onClick={handleNextQuestion} disabled={isUpdatingScore}>
                     {currentQuestionIndex < filteredQuestions.length - 1 ? 'Next →' : 'Finish'}
                 </Button>
             </div>
         )}
      </div>
    </div>
  );
};

export default QuizSection;
