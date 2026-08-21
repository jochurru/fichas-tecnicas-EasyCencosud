import React from 'react';

export default function CompletenessBar({ percentage }) {
  const rounded = Math.round(percentage);
  
  let barColor = 'bg-red-500';
  let textColor = 'text-red-700';
  let bgColor = 'bg-red-50';
  let border = 'border-red-100';

  if (rounded >= 80) {
    barColor = 'bg-green-500';
    textColor = 'text-green-700';
    bgColor = 'bg-green-50';
    border = 'border-green-100';
  } else if (rounded >= 50) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
    bgColor = 'bg-yellow-50';
    border = 'border-yellow-100';
  }

  return (
    <div className={`p-3 rounded-xl border ${border} ${bgColor} flex flex-col gap-1.5 w-full`}>
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-500">
        <span>Completitud de Ficha</span>
        <span className={`${textColor} font-mono text-xs`}>{rounded}%</span>
      </div>
      <div className="w-full bg-gray-250 rounded-full h-2 overflow-hidden">
        <div 
          className={`${barColor} h-2 rounded-full transition-all duration-500`} 
          style={{ width: `${rounded}%` }}
        ></div>
      </div>
    </div>
  );
}