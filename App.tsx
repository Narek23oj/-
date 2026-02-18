
import React, { useState } from 'react';
import { AppState, StudentProfile } from './types';
import Login from './components/Login';
import ChatWindow from './components/ChatWindow';
import { AdminDashboard } from './components/AdminDashboard';
import QuizSection from './components/QuizSection';
import StudentProfileSetup from './components/StudentProfileSetup';
import Button from './components/Button';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    isAdmin: false,
    view: 'LOGIN'
  });

  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const handleLoginStudent = (student: StudentProfile) => {
    setState({
      currentUser: student,
      isAdmin: false,
      view: 'STUDENT_DASHBOARD'
    });
  };

  const handleStudentSetupRequired = (student: StudentProfile) => {
      setState({
          currentUser: student,
          isAdmin: false,
          view: 'PROFILE_SETUP'
      });
  };

  const handleProfileSetupComplete = (updatedStudent: StudentProfile) => {
      handleLoginStudent(updatedStudent);
  };

  const handleLoginAdmin = () => {
    setState({
      currentUser: null,
      isAdmin: true,
      view: 'ADMIN_DASHBOARD'
    });
  };

  const handleLogout = () => {
    setState({
      currentUser: null,
      isAdmin: false,
      view: 'LOGIN'
    });
  };

  const handleSessionUpdate = () => {
    setLastUpdate(Date.now());
  };

  // Callback to update local state when student gets points
  const handleScoreUpdate = (updatedStudent: StudentProfile) => {
      setState(prev => ({
          ...prev,
          currentUser: updatedStudent
      }));
  };

  if (state.view === 'LOGIN') {
    return (
      <Login 
        onLoginStudent={handleLoginStudent} 
        onStudentSetupRequired={handleStudentSetupRequired}
        onLoginAdmin={handleLoginAdmin} 
      />
    );
  }

  if (state.view === 'PROFILE_SETUP' && state.currentUser) {
      return (
          <StudentProfileSetup 
            student={state.currentUser} 
            onComplete={handleProfileSetupComplete} 
          />
      );
  }

  if (state.view === 'ADMIN_DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white shadow-sm relative z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <span className="font-bold text-gray-800">ԹԻՄԻ Admin</span>
            <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Դուրս գալ
            </Button>
          </div>
        </header>
        <main className="flex-1">
          <AdminDashboard key={lastUpdate} />
        </main>
      </div>
    );
  }

  // Student View (Dashboard or Quiz)
  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm flex-none relative z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
             <div className="relative">
                 <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 overflow-hidden shadow-sm border border-gray-200">
                   {state.currentUser?.avatar ? (
                     <img src={state.currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold">
                       {state.currentUser?.name.charAt(0)}
                     </div>
                   )}
                 </div>
                 {/* Score Badge */}
                 <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                    {state.currentUser?.score || 0} ★
                 </div>
             </div>
             <div>
               <h3 className="font-bold text-gray-800 leading-tight">{state.currentUser?.name}</h3>
               <p className="text-xs text-gray-500">
                   {state.currentUser?.grade}-րդ դասարան 
                   {state.currentUser?.teacherName && <span className="text-indigo-600"> • {state.currentUser.teacherName}</span>}
               </p>
             </div>
          </div>

          <div className="flex items-center space-x-2">
              {state.view === 'QUIZ' ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
                    className="text-primary hover:bg-indigo-50"
                  >
                    💬 Զրուցարան
                  </Button>
              ) : (
                  <Button 
                    variant="secondary" 
                    onClick={() => setState(prev => ({ ...prev, view: 'QUIZ' }))}
                    className="shadow-sm"
                  >
                    📝 Հարցաշար
                  </Button>
              )}
              
              <div className="h-6 w-px bg-gray-300 mx-2"></div>

              <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 h-full overflow-hidden">
        {state.currentUser && (
          state.view === 'QUIZ' ? (
            <QuizSection 
                student={state.currentUser}
                onScoreUpdate={handleScoreUpdate}
                onBack={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
            />
          ) : (
            <ChatWindow 
                student={state.currentUser} 
                onSessionUpdate={handleSessionUpdate}
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;
