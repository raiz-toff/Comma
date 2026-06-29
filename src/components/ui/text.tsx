import { cn } from '@/src/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(
  cn(
    'text-content-primary text-paragraph-m',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',

        // ── Comma DS — Base-style ramp ──
        // Display / Heading — structure
        display: 'text-display font-extrabold tracking-tight',
        headingXl: 'text-heading-xl font-extrabold tracking-tight',
        headingL: 'text-heading-l font-bold tracking-tight',
        headingM: 'text-heading-m font-bold',
        headingS: 'text-heading-s font-semibold',
        // Label — controls
        labelL: 'text-label-l font-semibold',
        labelM: 'text-label-m font-semibold',
        labelXs: 'text-label-xs font-bold uppercase tracking-wide',
        // Paragraph — prose
        paragraphL: 'text-paragraph-l font-normal text-content-secondary',
        paragraphM: 'text-paragraph-m font-normal text-content-secondary',
        paragraphS: 'text-paragraph-s font-medium text-content-muted',

        // ── Legacy aliases (shadcn-style; pending migration) ──
        h1: cn(
          'text-center text-heading-xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-border border-b pb-2 text-heading-l font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-heading-m font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-heading-s font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-label-m font-semibold'
        ),
        lead: 'text-content-secondary text-heading-m',
        large: 'text-heading-s font-semibold',
        small: 'text-label-m font-medium leading-none',
        muted: 'text-content-muted text-label-m',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  tabular = false,
  style,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
    /** Tabular figures — required for any money/distance/rate value so columns align. */
    tabular?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      style={tabular ? [{ fontVariant: ['tabular-nums'] as const }, style] : style}
      {...props}
    />
  );
}

export { Text, TextClassContext };
