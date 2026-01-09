import React from 'react';

const MedXprtsLogo = ({ size = 'default' }) => {
  const sizeClasses = {
    sm: 'h-8',
    default: 'h-10',
    lg: 'h-12',
  };

  return (
    <div className={`flex items-center ${sizeClasses[size] || sizeClasses.default}`}>
      <span className="text-2xl font-bold text-blue-600">MedXprts</span>
    </div>
  );
};

export default MedXprtsLogo;
