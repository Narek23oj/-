
import React, { useState } from 'react';
import Input from './Input';
import Button from './Button';
import { ADMIN_USERNAMES, ADMIN_PASSWORD, StudentProfile } from '../types';
import { findStudentByNameAndGrade } from '../services/storageService';

interface LoginProps {
  onLoginStudent: (student: StudentProfile) => void;
  onStudentSetupRequired: (student: StudentProfile) => void;
  onLoginAdmin: (username: string) => void;
}

type AuthMode = 'STUDENT' | 'ADMIN';

const Login: React.FC<LoginProps> = ({ onLoginStudent, onStudentSetupRequired, onLoginAdmin }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('STUDENT');
  
  // Student Form State
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foundStudent, setFoundStudent] = useState<StudentProfile | null>(null);
  
  // Admin Form State
  const [adminUsername, setAdminUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setGrade('');
    setStudentPassword('');
    setAdminUsername('');
    setPassword('');
    setError('');
    setShowPasswordInput(false);
    setFoundStudent(null);
  };

  const handleModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    resetForm();
  };

  const handleStudentCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !grade.trim()) {
      setError('Խնդրում ենք լրացնել Անուն և Դասարան դաշտերը');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
        const student = await findStudentByNameAndGrade(name.trim(), grade.trim());

        if (!student) {
            setError('Աշակերտը գտնված չէ։ Խնդրեք ուսուցչին գրանցել ձեզ համակարգում։');
            setIsLoading(false);
            return;
        }

        if (student.isBlocked) {
            setError('Ձեր մուտքը համակարգ արգելափակված է ուսուցչի կողմից։');
            setIsLoading(false);
            return;
        }

        // SCENARIO: Student found, NO password set -> Go to Setup
        if (!student.password) {
            onStudentSetupRequired(student);
            return;
        }

        // SCENARIO: Student found, password exists -> Show Password Input
        setFoundStudent(student);
        setShowPasswordInput(true);
        setIsLoading(false);

    } catch (err) {
        console.error(err);
        setError('Խնդիր առաջացավ։ Խնդրում ենք փորձել կրկին։');
        setIsLoading(false);
    }
  };

  const handleStudentFinalLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (!foundStudent) return;
      
      if (foundStudent.password !== studentPassword.trim()) {
          setError('Սխալ գաղտնաբառ։');
          return;
      }
      onLoginStudent(foundStudent);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = adminUsername.trim();
    if (ADMIN_USERNAMES.includes(cleanUsername) && password === ADMIN_PASSWORD) {
      onLoginAdmin(cleanUsername);
    } else {
      setError('Սխալ մուտքանուն կամ գաղտնաբառ');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Educational Info */}
      <div className="md:w-1/2 bg-gradient-to-br from-primary to-indigo-800 p-8 md:p-16 text-white flex flex-col justify-center relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-5xl font-bold mb-2 tracking-tight">ԹԻՄԻ</h1>
          <p className="text-xl opacity-90 mb-12">by YEGHIAZARYAN NAREK</p>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
            <h3 className="text-2xl font-semibold mb-6 flex items-center">
              <span className="mr-2">📚</span> Կրթական Սկզբունք
            </h3>
            <ul className="space-y-4 text-lg">
              <li className="flex items-start">
                <span className="mr-3 mt-1 text-secondary">✓</span>
                Կարևոր է հասկանալ թեման, ոչ թե պարզապես ստանալ պատասխանը։
              </li>
              <li className="flex items-start">
                <span className="mr-3 mt-1 text-secondary">✓</span>
                Հարթակը չի տալիս պատրաստի լուծումներ։
              </li>
              <li className="flex items-start">
                <span className="mr-3 mt-1 text-secondary">✓</span>
                Խրախուսվում է ինքնուրույն մտածողությունը։
              </li>
              <li className="flex items-start">
                <span className="mr-3 mt-1 text-secondary">✓</span>
                Սովորում ենք սխալվելով և ուղղելով։
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="md:w-1/2 bg-white flex items-center justify-center p-8 z-0">
        <div className="w-full max-w-md">
          {/* Top Navigation for Mode */}
          <div className="flex justify-between items-center mb-8">
             {authMode === 'ADMIN' ? (
                 <Button 
                    variant="ghost"
                    onClick={() => handleModeChange('STUDENT')}
                    className="text-gray-500 hover:text-primary font-medium"
                  >
                    ← Վերադառնալ
                 </Button>
             ) : (
                <h2 className="text-2xl font-bold text-gray-800">Մուտք</h2>
             )}
             
             {authMode !== 'ADMIN' && (
                <Button 
                    variant="ghost"
                    onClick={() => handleModeChange('ADMIN')}
                    className="text-gray-400 hover:text-primary font-medium text-sm"
                >
                    Admin
                </Button>
             )}
          </div>

          <div className="mb-8 text-center">
            {authMode === 'ADMIN' && (
                <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Admin Մուտք</h2>
                <p className="text-gray-500">Մուտք գործեք կառավարման վահանակ</p>
                </>
            )}
            {authMode === 'STUDENT' && (
                <p className="text-gray-500">
                    {showPasswordInput ? `Բարև, ${foundStudent?.name}` : 'Մուտքագրեք ձեր տվյալները սկսելու համար'}
                </p>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-r">
              <p>{error}</p>
            </div>
          )}

          {authMode === 'ADMIN' && (
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <Input
                label="Admin Username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Օր.՝ Yeghiazaryan.N"
                list="admin-list"
              />
              <datalist id="admin-list">
                  {ADMIN_USERNAMES.map(u => <option key={u} value={u} />)}
              </datalist>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Մուտքագրեք գաղտնաբառը"
              />
              <Button type="submit" className="w-full py-3 text-lg">
                Մուտք
              </Button>
            </form>
          )}

          {authMode === 'STUDENT' && !showPasswordInput && (
            <form onSubmit={handleStudentCheck} className="space-y-6">
              <Input
                label="Անուն Ազգանուն"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Օրինակ՝ Արամ Արամյան"
              />
              <Input
                label="Դասարան"
                type="number"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Օրինակ՝ 9"
                min="1"
                max="12"
              />
              <Button type="submit" isLoading={isLoading} className="w-full py-3 text-lg shadow-lg shadow-indigo-200">
                Շարունակել
              </Button>
            </form>
          )}

          {authMode === 'STUDENT' && showPasswordInput && (
              <form onSubmit={handleStudentFinalLogin} className="space-y-6">
                  <Input
                    label="Գաղտնաբառ"
                    type="password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Մուտքագրեք գաղտնաբառը"
                  />
                  <div className="flex gap-2">
                      <Button variant="ghost" onClick={resetForm} className="flex-1">Ետ</Button>
                      <Button type="submit" className="flex-1 shadow-lg shadow-indigo-200">Մուտք</Button>
                  </div>
              </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
