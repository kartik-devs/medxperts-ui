// src/components/MedXprtsLogo.tsx
import React from 'react';

interface MedXprtsLogoProps {
  size?: 'small' | 'default' | 'large';
  className?: string;
}

export const MedXprtsLogo: React.FC<MedXprtsLogoProps> = ({ size = 'default', className = '' }) => {
  const configs = {
    small: { iconSize: 'w-9 h-9', textSize: 'text-xl', padding: 'p-1.5' },
    default: { iconSize: 'w-12 h-12', textSize: 'text-3xl', padding: 'p-2' },
    large: { iconSize: 'w-16 h-16', textSize: 'text-4xl', padding: 'p-2.5' }
  };
  
  const config = configs[size];
  
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${config.iconSize} ${config.padding} bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl flex items-center justify-center shadow-md`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white" fill="currentColor" stroke="currentColor">
          {/* Central staff */}
          <line x1="50" y1="15" x2="50" y2="85" strokeWidth="5" strokeLinecap="round"/>
          
          {/* Top circle ornament */}
          <circle cx="50" cy="15" r="6"/>
          
          {/* Scales horizontal bar */}
          <line x1="25" y1="35" x2="75" y2="35" strokeWidth="4" strokeLinecap="round"/>
          
          {/* Left scale pan - triangle */}
          <path d="M 25 35 L 20 43 L 30 43 Z"/>
          
          {/* Right scale pan - triangle */}
          <path d="M 75 35 L 70 43 L 80 43 Z"/>
          
          {/* Caduceus snakes - simplified curves */}
          <circle cx="45" cy="55" r="3.5" fill="none" strokeWidth="2.5"/>
          <circle cx="55" cy="55" r="3.5" fill="none" strokeWidth="2.5"/>
          <circle cx="43" cy="65" r="3" fill="none" strokeWidth="2.5"/>
          <circle cx="57" cy="65" r="3" fill="none" strokeWidth="2.5"/>
          
          {/* Bottom arrow ornament */}
          <path d="M 46 82 L 50 86 L 54 82" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
      <div 
        className={`${config.textSize} font-bold tracking-tight`} 
        style={{
          color: '#1e3a8a', 
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 
          letterSpacing: '-0.02em'
        }}
      >
        Med<span style={{fontSize: '1.1em', fontWeight: '900'}}>X</span>prts
      </div>
    </div>
  );
};

export default MedXprtsLogo;