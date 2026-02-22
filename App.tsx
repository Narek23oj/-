
import React, { useState, useEffect, useRef } from 'react';
import { AppState, StudentProfile, MAIN_ADMIN, Notification } from './types';
import Login from './components/Login';
import ChatWindow from './components/ChatWindow';
import { AdminDashboard } from './components/AdminDashboard';
import QuizSection from './components/QuizSection';
import StudentProfileSetup from './components/StudentProfileSetup';
import StoreSection from './components/StoreSection';

import Button from './components/Button';
import Avatar from './components/Avatar'; // Import Avatar
import { getTeacherAvatar, subscribeToStudents, subscribeToNotifications, markNotificationAsRead, findStudentByNameAndGrade } from './services/storageService';
import { getDoc, doc, getFirestore } from 'firebase/firestore';

// Custom SVG Logo Component for TIMI
const TIMILogo = () => (
    <svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 md:w-[100px] h-auto">
        <text x="5" y="32" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="34" fill="#6020A0" letterSpacing="2">TIMI</text>
        {/* Simple orange accent shapes */}
        <circle cx="92" cy="14" r="5" fill="#FF8000" />
        <rect x="88" y="22" width="8" height="10" fill="#FF8000" />
    </svg>
);

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 Minutes

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    isAdmin: false,
    view: 'LOGIN'
  });

  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [currentTeacherAvatar, setCurrentTeacherAvatar] = useState<string | null>(null);
  const [mainAdminAvatar, setMainAdminAvatar] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Inactivity Timer Refs
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- SESSION MANAGEMENT ---

  // 1. Check for stored session on mount
  useEffect(() => {
    const restoreSession = async () => {
        const storedSession = localStorage.getItem('timi_session');
        if (storedSession) {
            try {
                const { uid, role, timestamp } = JSON.parse(storedSession);
                
                // Optional: Check if session is too old (e.g., > 24 hours), currently rely on explicit logout or inactivity
                
                if (role === 'ADMIN') {
                    // Restore Admin
                    setState({
                        currentUser: null,
                        isAdmin: true,
                        currentAdminUser: uid,
                        view: 'ADMIN_DASHBOARD'
                    });
                } else if (role === 'STUDENT') {
                    // Restore Student - Fetch fresh data from DB
                    // Note: We need a direct way to get student by ID. 
                    // Reusing findStudentByNameAndGrade isn't efficient if we have ID.
                    // Let's implement a quick fetch or just wait for the subscription to kick in.
                    // Better approach: Subscribe works if we have currentUser set. 
                    // We need to fetch the initial student object to set the state.
                    
                    const db = getFirestore();
                    const docRef = doc(db, 'students', uid);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const studentData = docSnap.data() as StudentProfile;
                        if (studentData.isBlocked) {
                            localStorage.removeItem('timi_session');
                            alert("Ձեր մուտքը արգելափակված է։");
                        } else {
                            setState({
                                currentUser: studentData,
                                isAdmin: false,
                                view: 'STUDENT_DASHBOARD'
                            });
                        }
                    } else {
                         // Student deleted?
                         localStorage.removeItem('timi_session');
                    }
                }
            } catch (e) {
                console.error("Session restore failed", e);
                localStorage.removeItem('timi_session');
            }
        }
        setIsRestoringSession(false);
    };

    restoreSession();
  }, []);

  // 2. Inactivity Logic
  const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      
      if (state.currentUser || state.isAdmin) {
          inactivityTimerRef.current = setTimeout(() => {
              alert("Դուք դուրս եք գրվել համակարգից անգործության պատճառով (10 րոպե):");
              handleLogout();
          }, INACTIVITY_LIMIT_MS);
      }
  };

  useEffect(() => {
      // Add event listeners for activity
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      const handler = () => resetInactivityTimer();
      
      events.forEach(ev => window.addEventListener(ev, handler));
      
      // Start initial timer
      resetInactivityTimer();

      return () => {
          events.forEach(ev => window.removeEventListener(ev, handler));
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      };
  }, [state.currentUser, state.isAdmin]); // Reset listeners when login state changes


  // REAL-TIME SYNC & SECURITY CHECK
  useEffect(() => {
    // Only subscribe if a student is logged in
    if (state.currentUser && !state.isAdmin) {
        // 1. Student Data Sync
        const unsubscribeStudents = subscribeToStudents((students) => {
            const updatedMe = students.find(s => s.id === state.currentUser?.id);
            if (updatedMe) {
                // SECURITY CHECK: If blocked while online, logout immediately
                if (updatedMe.isBlocked) {
                    alert("Դուք արգելափակվել եք ուսուցչի կողմից։");
                    handleLogout();
                    return;
                }
                // Update local state (score, name changes, etc.)
                setState(prev => ({ ...prev, currentUser: updatedMe }));
            }
        });

        // 2. Notification Sync
        const unsubscribeNotifs = subscribeToNotifications(state.currentUser, (notifs) => {
            setNotifications(notifs);
            const unread = notifs.filter(n => !n.readBy.includes(state.currentUser!.id));
            setUnreadCount(unread.length);
        });

        return () => {
            unsubscribeStudents();
            unsubscribeNotifs();
        };
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

  const saveSession = (uid: string, role: 'STUDENT' | 'ADMIN') => {
      localStorage.setItem('timi_session', JSON.stringify({
          uid,
          role,
          timestamp: Date.now()
      }));
  };

  const handleLoginStudent = (student: StudentProfile) => {
    saveSession(student.id, 'STUDENT');
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
    saveSession(username, 'ADMIN');
    setState({
      currentUser: null,
      isAdmin: true,
      currentAdminUser: username,
      view: 'ADMIN_DASHBOARD'
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('timi_session');
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    
    setState({
      currentUser: null,
      isAdmin: false,
      currentAdminUser: null,
      view: 'LOGIN'
    });
    setNotifications([]);
    setUnreadCount(0);
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

  const handleMarkAsRead = async (notif: Notification) => {
      if (state.currentUser && !notif.readBy.includes(state.currentUser.id)) {
          await markNotificationAsRead(notif.id, state.currentUser.id);
      }
  };

  // Render content based on view
  const renderContent = () => {
      if (isRestoringSession) {
          return (
              <div className="h-screen flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
          );
      }

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
          <div className="min-h-screen flex flex-col relative z-10">
            <header className="bg-white/90 backdrop-blur shadow-sm relative z-50">
              <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <TIMILogo />
                    <span className="font-bold text-gray-500 text-sm mt-2 ml-2 hidden sm:inline">Admin Panel</span>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:bg-red-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Դուրս գալ</span>
                </Button>
              </div>
            </header>
            <main className="flex-1">
              <AdminDashboard key={lastUpdate} adminUsername={state.currentAdminUser} />
            </main>
          </div>
        );
      }

      // Student Views
      return (
        <div className="h-screen flex flex-col relative z-10">
          {/* Enhanced Header */}
          <header className="bg-white/95 backdrop-blur shadow-sm flex-none relative z-50">
            <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              
              {/* Left Side: Logo & Student Info */}
              <div className="flex justify-between md:justify-start items-center gap-4 md:gap-6">
                 {/* CUSTOM LOGO - Visible on all screens now */}
                 <div className="shrink-0 cursor-pointer" onClick={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}>
                     <TIMILogo />
                 </div>

                 <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        {state.currentUser && (
                            <Avatar 
                                src={state.currentUser.avatar}
                                name={state.currentUser.name}
                                frameId={state.currentUser.equippedFrame}
                                size="md"
                                showScore={state.currentUser.score}
                            />
                        )}
                    </div>
                    <div className="max-w-[120px] md:max-w-none">
                        <h3 className="font-bold text-gray-800 leading-tight text-sm md:text-lg truncate">{state.currentUser?.name}</h3>
                        <p className="text-[10px] md:text-xs text-gray-500">{state.currentUser?.grade}-րդ դասարան</p>
                    </div>
                 </div>
              </div>

              {/* Center/Right Side: Teachers Info & Controls Container */}
              <div className="flex flex-row items-center justify-between gap-2 md:gap-4 mt-1 md:mt-0">
                  
                  {/* Teachers Info - Hidden on very small screens to save space, or just show icon */}
                  <div className="hidden sm:flex flex-row gap-3 bg-gray-50/80 p-1.5 md:p-2 rounded-lg border border-gray-100">
                      {/* Assigned Teacher */}
                      {state.currentUser?.teacherName && (
                          <div className="flex items-center gap-2">
                              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-100 overflow-hidden border border-indigo-200 shrink-0">
                                 {currentTeacherAvatar ? (
                                     <img src={currentTeacherAvatar} className="w-full h-full object-cover" alt="Teacher" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-indigo-500 text-xs font-bold">
                                         {state.currentUser.teacherName.charAt(0)}
                                     </div>
                                 )}
                              </div>
                              <div className="flex flex-col hidden lg:flex">
                                  <span className="text-[10px] uppercase text-gray-400 font-bold">Ուսուցիչ</span>
                                  <span className="text-xs font-bold text-indigo-900">{state.currentUser.teacherName}</span>
                              </div>
                          </div>
                      )}

                      {/* Main Admin / Principal */}
                      <div className="flex items-center gap-2">
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-100 overflow-hidden border border-purple-200 shrink-0">
                                {mainAdminAvatar ? (
                                     <img src={mainAdminAvatar} className="w-full h-full object-cover" alt="Main Admin" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-purple-500 text-xs font-bold">
                                         {MAIN_ADMIN.username.charAt(0)}
                                     </div>
                                 )}
                          </div>
                           {/* Add Email Display Here */}
                          <div className="flex flex-col hidden lg:flex">
                              <span className="text-[10px] uppercase text-gray-400 font-bold">Գլխավոր Ադմինիստրատոր</span>
                              <span className="text-xs font-bold text-purple-900">{MAIN_ADMIN.username}</span>
                              <span className="text-[10px] text-gray-500 -mt-0.5">{MAIN_ADMIN.email}</span>
                          </div>
                      </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center space-x-2 flex-1 md:flex-none justify-end">
                      
                      {/* NOTIFICATION BELL */}
                      <div className="relative">
                          <button 
                            onClick={() => setIsNotifOpen(!isNotifOpen)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              {unreadCount > 0 && (
                                  <span className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
                              )}
                          </button>

                          {/* NOTIFICATION DROPDOWN */}
                          {isNotifOpen && (
                              <div className="fixed inset-x-2 top-[70px] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-float">
                                  <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                                      <h4 className="font-bold text-gray-700">Notifications</h4>
                                      <button onClick={() => setIsNotifOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                  </div>
                                  <div className="max-h-[70vh] sm:max-h-[400px] overflow-y-auto">
                                      {notifications.length === 0 ? (
                                          <p className="p-6 text-center text-gray-400 text-sm">No notifications yet.</p>
                                      ) : (
                                          notifications.map(n => {
                                              const isRead = n.readBy.includes(state.currentUser!.id);
                                              return (
                                                  <div 
                                                    key={n.id} 
                                                    className={`p-3 sm:p-4 border-b hover:bg-gray-50 transition cursor-pointer ${!isRead ? 'bg-indigo-50/50' : ''}`}
                                                    onClick={() => handleMarkAsRead(n)}
                                                  >
                                                      <div className="flex justify-between items-start mb-1">
                                                          <span className={`font-bold text-sm ${!isRead ? 'text-indigo-700' : 'text-gray-800'}`}>
                                                              {n.title} {!isRead && '•'}
                                                          </span>
                                                          <span className="text-[10px] text-gray-400">{new Date(n.timestamp).toLocaleDateString()}</span>
                                                      </div>
                                                      <p className="text-xs text-gray-600 mb-2 whitespace-pre-wrap">{n.message}</p>
                                                      {n.attachmentUrl && (
                                                          <div className="mt-2">
                                                              {n.attachmentType === 'image' ? (
                                                                  <img src={n.attachmentUrl} className="w-full h-auto rounded border" alt="Attachment" />
                                                              ) : (
                                                                  <a href={n.attachmentUrl} download className="text-xs text-blue-600 underline">Download Attachment</a>
                                                              )}
                                                          </div>
                                                      )}
                                                  </div>
                                              )
                                          })
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="h-6 w-px bg-gray-300 mx-1 md:mx-2"></div>

                      {/* NAVIGATION BUTTONS */}
                      <Button 
                          variant={state.view === 'STORE' ? 'primary' : 'ghost'}
                          onClick={() => setState(prev => ({ ...prev, view: 'STORE' }))}
                          className={`text-xs md:text-sm flex-1 md:flex-none justify-center ${state.view !== 'STORE' ? 'text-gray-600 hover:bg-gray-100' : ''}`}
                      >
                          🛍️
                      </Button>

                      <Button 
                          variant={state.view === 'QUIZ' ? 'primary' : 'secondary'}
                          onClick={() => setState(prev => ({ ...prev, view: 'QUIZ' }))}
                          className="shadow-sm text-xs md:text-sm flex-1 md:flex-none justify-center px-3"
                      >
                          📝
                      </Button>


                      <Button 
                        variant={state.view === 'STUDENT_DASHBOARD' ? 'primary' : 'ghost'}
                        onClick={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
                        className={`text-xs md:text-sm flex-1 md:flex-none justify-center ${state.view !== 'STUDENT_DASHBOARD' ? 'text-primary hover:bg-indigo-50' : ''}`}
                      >
                        💬
                      </Button>
                      
                      <div className="h-6 w-px bg-gray-300 mx-1 md:mx-2"></div>

                      <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors px-2 md:px-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </Button>
                  </div>
              </div>
            </div>
          </header>
          
          <main className="flex-1 max-w-7xl mx-auto w-full p-2 md:p-4 h-full overflow-hidden">
            {state.currentUser && (
               <>
                 {state.view === 'STORE' && (
                     <StoreSection 
                        student={state.currentUser}
                        onUpdate={handleScoreUpdate}
                        onBack={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
                     />
                 )}
                 {state.view === 'QUIZ' && (
                    <QuizSection 
                        student={state.currentUser}
                        onScoreUpdate={handleScoreUpdate}
                        onBack={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' }))}
                    />
                 )}
                 {state.view === 'STUDENT_DASHBOARD' && (
                    <ChatWindow 
                        student={state.currentUser} 
                        onSessionUpdate={handleSessionUpdate}
                    />
                 )}
               </>
            )}
          </main>
        </div>
      );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-100">
        {/* Animated Background Elements */}
        <ul className="circles">
            <li></li><li></li><li></li><li></li><li></li>
            <li></li><li></li><li></li><li></li><li></li>
        </ul>
        
        {renderContent()}
    </div>
  );
};

export default App;
