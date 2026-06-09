import { Loader2 } from 'lucide-react';

interface InlineLoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function InlineLoadingSpinner({
  message = 'Loading...',
  size = 'md'
}: InlineLoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  return (
    <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
      <Loader2 className={`${sizeClasses[size]} text-blue-600 animate-spin`} />
      <span className="ml-3 text-gray-600 font-medium">{message}</span>
    </div>
  );
}
