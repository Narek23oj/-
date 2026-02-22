
import React from 'react';
import { StudentProfile } from '../types';

interface LeaderboardProps {
  students: StudentProfile[];
  title?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ students, title = "🏆 Աշակերտների Ռեյտինգ (Live)" }) => {
  const sortedStudents = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="glass-panel rounded-xl shadow border p-4 md:p-6 h-full flex flex-col overflow-hidden bg-white/80 backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          {title}
        </h2>
        <div className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
          Real-time
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {sortedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <div className="text-4xl">📊</div>
            <p>Աշակերտներ դեռ չկան</p>
          </div>
        ) : (
          sortedStudents.map((student, index) => (
            <div 
              key={student.id} 
              className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white rounded-xl border transition-all duration-300 hover:shadow-md ${
                index === 0 ? 'border-yellow-200 bg-yellow-50/30' : 
                index === 1 ? 'border-gray-200 bg-gray-50/30' : 
                index === 2 ? 'border-orange-200 bg-orange-50/30' : 
                'border-gray-100'
              }`}
            >
              {/* Rank Badge */}
              <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full font-black text-sm md:text-lg shrink-0 ${
                index === 0 ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' :
                index === 1 ? 'bg-gray-400 text-white shadow-lg shadow-gray-200' :
                index === 2 ? 'bg-orange-400 text-white shadow-lg shadow-orange-200' :
                'bg-indigo-50 text-indigo-600'
              }`}>
                {index + 1}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                <img 
                  src={student.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} 
                  alt={student.name}
                  className="w-full h-full object-cover" 
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate text-sm md:text-base">{student.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] md:text-xs text-gray-500 font-medium">{student.grade}-րդ դասարան</span>
                  {index < 3 && (
                    <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 rounded">TOP</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <div className={`text-lg md:text-2xl font-black ${
                  index === 0 ? 'text-yellow-600' : 
                  index === 1 ? 'text-gray-600' : 
                  index === 2 ? 'text-orange-600' : 
                  'text-indigo-600'
                }`}>
                  {student.score || 0}
                </div>
                <div className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-wider">Միավոր</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
