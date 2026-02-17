import React, { useState } from 'react';
import Input from './Input';
import Button from './Button';
import { ADMIN_CREDENTIALS, StudentProfile } from '../types';
import { findStudentByNameAndGrade } from '../services/storageService';

interface LoginProps {
  onLoginStudent: (student: StudentProfile) => void;
  onLoginAdmin: () => void;
}

type AuthMode = 'STUDENT' | 'ADMIN';

const Login: React.FC<LoginProps> = ({ onLoginStudent, onLoginAdmin }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('STUDENT');
  
  // Student Form State
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  
  // Admin Form State
  const [adminCode, setAdminCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setGrade('');
    setStudentPassword('');
    setAdminCode('');
    setPassword('');
    setError('');
  };

  const handleModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    resetForm();
  };

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !grade.trim() || !studentPassword.trim()) {
      setError('Խնդրում ենք լրացնել բոլոր դաշտերը');
      return;
    }

    // Check if student exists
    const existingStudent = findStudentByNameAndGrade(name.trim(), grade.trim());

    if (!existingStudent) {
        setError('Աշակերտը գտնված չէ։ Խնդրեք ուսուցչին գրանցել ձեզ համակարգում։');
        return;
    }

    if (existingStudent.isBlocked) {
        setError('Ձեր մուտքը համակարգ արգելափակված է ուսուցչի կողմից։');
        return;
    }

    if (existingStudent.password !== studentPassword.trim()) {
        setError('Սխալ գաղտնաբառ։');
        return;
    }

    // Success
    onLoginStudent(existingStudent);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === ADMIN_CREDENTIALS.code && password === ADMIN_CREDENTIALS.password) {
      onLoginAdmin();
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
                <p className="text-gray-500">Մուտքագրեք ձեր տվյալները սկսելու համար</p>
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
                label="Admin Code"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Մուտքագրեք կոդը"
              />
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

          {authMode === 'STUDENT' && (
            <form onSubmit={handleStudentLogin} className="space-y-6">
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
              <Input
                label="Գաղտնաբառ"
                type="password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                placeholder="Մուտքագրեք գաղտնաբառը"
              />
              <Button type="submit" className="w-full py-3 text-lg shadow-lg shadow-indigo-200">
                Մուտք
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;