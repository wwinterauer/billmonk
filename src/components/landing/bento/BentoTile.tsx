import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'dark';

interface BentoTileProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  className?: string;
  tone?: Tone;
  glow?: boolean;
  delay?: number;
  children: React.ReactNode;
}

const toneStyles: Record<Tone, string> = {
  default: 'bg-card border-border',
  primary: 'bg-gradient-to-br from-primary/10 via-card to-card border-primary/20',
  success: 'bg-gradient-to-br from-success/10 via-card to-card border-success/20',
  warning: 'bg-gradient-to-br from-warning/10 via-card to-card border-warning/20',
  dark: 'bg-sidebar text-sidebar-foreground border-sidebar-border',
};

export const BentoTile = forwardRef<HTMLDivElement, BentoTileProps>(
  ({ className, tone = 'default', glow = false, delay = 0, children, ...rest }, ref) => {
    const reduce = useReducedMotion();
    return (
      <motion.div
        ref={ref}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
        className={cn(
          'group relative overflow-hidden rounded-3xl border p-6 lg:p-8 shadow-sm',
          'transition-[transform,box-shadow,border-color] duration-500',
          'hover:shadow-xl hover:-translate-y-0.5',
          toneStyles[tone],
          className,
        )}
        {...rest}
      >
        {glow && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                'radial-gradient(600px circle at var(--mx, 50%) var(--my, 0%), hsl(var(--primary) / 0.15), transparent 40%)',
            }}
          />
        )}
        <div className="relative z-10 h-full">{children}</div>
      </motion.div>
    );
  },
);

BentoTile.displayName = 'BentoTile';
