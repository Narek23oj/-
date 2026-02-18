
import React, { useState, useEffect } from 'react';
import { AppState, StudentProfile, MAIN_ADMIN } from './types';
import Login from './components/Login';
import ChatWindow from './components/ChatWindow';
import { AdminDashboard } from './components/AdminDashboard';
import QuizSection from './components/QuizSection';
import StudentProfileSetup from './components/StudentProfileSetup';
import Button from './components/Button';
import { getTeacherAvatar, subscribeToStudents } from './services/storageService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    isAdmin: false,
    view: 'LOGIN'
  });

  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [currentTeacherAvatar, setCurrentTeacherAvatar] = useState<string | null>(null);
  const [mainAdminAvatar, setMainAdminAvatar] = useState<string | null>(null);

  // Subscribe to student data to keep profile fresh
  useEffect(() => {
    if (state.currentUser && !state.isAdmin) {
        const unsubscribe = subscribeToStudents((students) => {
            const updatedMe = students.find(s => s.id === state.currentUser?.id);
            if (updatedMe) {
                setState(prev => ({ ...prev, currentUser: updatedMe }));
            }
        });
        return () => unsubscribe();
    }
  }, [state.currentUser?.id, state.isAdmin]);

  // Fetch avatars (Assigned Teacher AND Main Admin)
  useEffect(() => {
      // 1. Fetch Assigned Teacher Avatar
      if (state.currentUser?.teacherName) {
          getTeacherAvatar(state.currentUser.teacherName).then(avatar => {
              setCurrentTeacherAvatar(avatar);
          });
      } else {
          setCurrentTeacherAvatar(null);
      }

      // 2. Fetch Main Admin Avatar (Always)
      getTeacherAvatar(MAIN_ADMIN.username).then(avatar => {
          setMainAdminAvatar(avatar);
      });

  }, [state.currentUser?.teacherName]);

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

  const handleLoginAdmin = (username: string) => {
    setState({
      currentUser: null,
      isAdmin: true,
      currentAdminUser: username,
      view: 'ADMIN_DASHBOARD'
    });
  };

  const handleLogout = () => {
    setState({
      currentUser: null,
      isAdmin: false,
      currentAdminUser: null,
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
            <span className="font-bold text-gray-800">ԹԻՄԻ Admin Panel</span>
            <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Դուրս գալ
            </Button>
          </div>
        </header>
        <main className="flex-1">
          <AdminDashboard key={lastUpdate} adminUsername={state.currentAdminUser} />
        </main>
      </div>
    );
  }

  // Student View (Dashboard or Quiz)
  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Enhanced Header */}
      <header className="bg-white shadow-sm flex-none relative z-50">
        <div className="max-w-7xl mx-auto px-2 md:px-4 py-2 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          
          {/* Left Side: Student Info */}
          <div className="flex items-center gap-3">
             <div className="relative shrink-0">
                 <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-200 overflow-hidden shadow-sm border border-gray-200">
                   {state.currentUser?.avatar ? (
                     <img src={state.currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold">
                       {state.currentUser?.name.charAt(0)}
                     </div>
                   )}
                 </div>
                 <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                    {state.currentUser?.score || 0} ★
                 </div>
             </div>
             <div>
               <h3 className="font-bold text-gray-800 leading-tight text-lg">{state.currentUser?.name}</h3>
               <p className="text-xs text-gray-500">{state.currentUser?.grade}-րդ դասարան</p>
             </div>
          </div>

          {/* Center/Right Side: Teachers Info */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 bg-gray-50 p-2 rounded-lg border border-gray-100">
              
              {/* Assigned Teacher */}
              {state.currentUser?.teacherName && (
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 overflow-hidden border border-indigo-200 shrink-0">
                         {currentTeacherAvatar ? (
                             <img src={currentTeacherAvatar} className="w-full h-full object-cover" alt="Teacher" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-indigo-500 text-xs font-bold">
                                 {state.currentUser.teacherName.charAt(0)}
                             </div>
                         )}
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-gray-400 font-bold">Ուսուցիչ</span>
                          <span className="text-xs font-bold text-indigo-900">{state.currentUser.teacherName}</span>
                      </div>
                  </div>
              )}

              {/* Vertical Separator (Hidden on mobile) */}
              <div className="hidden sm:block w-px bg-gray-300"></div>

              {/* Main Admin / Principal */}
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 overflow-hidden border border-purple-200 shrink-0">
                        {mainAdminAvatar ? (
                             <img src={mainAdminAvatar} className="w-full h-full object-cover" alt="Main Admin" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-purple-500 text-xs font-bold">
                                 {MAIN_ADMIN.username.charAt(0)}
                             </div>
                         )}
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-gray-400 font-bold">Գլխ․ Ադմինիստրատոր</span>
                      <span className="text-xs font-bold text-purple-900">{MAIN_ADMIN.username}</span>
                      <span className="text-[10px] text-gray-500">{MAIN_ADMIN.email}</span>
                  </div>
              </div>

          </div>

          {/* Controls */}
          <div className="flex items-center justify-end space-x-2 w-full md:w-auto mt-2 md:mt-0">
              {state.view === 'QUIZ' ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
                    className="text-primary hover:bg-indigo-50 text-sm"
                  >
                    💬 Զրուցարան
                  </Button>
              ) : (
                  <Button 
                    variant="secondary" 
                    onClick={() => setState(prev => ({ ...prev, view: 'QUIZ' }))}
                    className="shadow-sm text-sm"
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
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-2 md:p-4 h-full overflow-hidden">
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
