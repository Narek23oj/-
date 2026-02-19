
import React from 'react';
import { AVAILABLE_FRAMES } from '../types';

interface AvatarProps {
  src?: string;
  name: string;
  frameId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showScore?: number; // Optional: show score badge
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 md:w-12 md:h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-xl',
  '2xl': 'w-32 h-32 text-2xl'
};

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  frameId, 
  size = 'md', 
  className = '',
  showScore 
}) => {
  const frame = AVAILABLE_FRAMES.find(f => f.id === frameId);
  const isGradientBg = frame?.styleClass.includes('bg-gradient');
  
  // Base classes for the container
  const containerSize = SIZE_CLASSES[size];
  
  // Logic: 
  // If gradient: Outer div has gradient class, Inner div has border-2 border-white
  // If standard border: Outer div is plain, Inner div has the frame border class
  // If no frame: Inner div has border-gray-200
  
  const outerClass = isGradientBg ? (frame?.styleClass || '') : '';
  const innerClass = !frame 
      ? 'border border-gray-200' 
      : (isGradientBg ? 'border-2 border-white' : frame.styleClass);

  const imgSrc = src || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;

  return (
    <div className={`relative shrink-0 rounded-full flex items-center justify-center shadow-sm ${containerSize} ${outerClass} ${className}`}>
        <div className={`w-full h-full rounded-full bg-gray-200 overflow-hidden ${innerClass}`}>
            {src ? (
                 <img src={imgSrc} alt={name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold">
                    {name.charAt(0)}
                </div>
            )}
        </div>
        
        {/* Score Badge (Optional) */}
        {showScore !== undefined && (
             <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm z-10 whitespace-nowrap">
                {showScore} ★
            </div>
        )}
    </div>
  );
};

export default Avatar;
