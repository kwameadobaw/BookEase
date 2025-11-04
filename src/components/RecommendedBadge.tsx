import React from 'react';
import { Award } from 'lucide-react';

interface RecommendedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RecommendedBadge({ size = 'md', className = '' }: RecommendedBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs py-1 px-2',
    md: 'text-sm py-1 px-3',
    lg: 'text-base py-2 px-4'
  };

  return (
    <div className={`flex items-center bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-full shadow-md ${sizeClasses[size]} ${className}`}>
      <Award className="mr-1 h-4 w-4" />
      <span className="font-medium">BookEase Recommended</span>
    </div>
  );
}