import { cn } from '@/utils/cn';

/** Renders the app icon, served from the renderer's public/ dir. */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="icon/128.png"
      alt="ApiTab"
      draggable={false}
      className={cn('shrink-0 select-none rounded-md', className)}
    />
  );
}
