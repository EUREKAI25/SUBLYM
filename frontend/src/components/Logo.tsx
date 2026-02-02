import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const heights = {
    sm: 'h-6',
    md: 'h-10',
    lg: 'h-14',
  };

  return (
    <div className={cn('flex items-center', className)}>
      <img
        src="/logo.svg"
        alt="SUBLYM"
        className={cn(heights[size], 'w-auto')}
      />
    </div>
  );
}
