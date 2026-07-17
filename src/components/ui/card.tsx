import { Text, TextClassContext } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';
import { StyleSheet, View } from 'react-native';

function Card({ className, style, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          // Comma DS: Surface/02 card, true hairline border, radius-lg (this project's custom
          // tailwind.config.js scale: lg=16px "cards, banners" — NOT Tailwind's stock scale,
          // where 2xl=16px; here 2xl=28px is reserved for "modals, phone surface"), p-4 (16px)
          // edge padding, no shadow (elevation = surface + border). Matches the cardPad/rCard
          // convention every screen's hand-rolled card already used before this was adopted.
          'bg-card border-line-subtle flex flex-col gap-6 rounded-lg p-4',
          className
        )}
        style={[{ borderWidth: StyleSheet.hairlineWidth }, style]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  // No horizontal padding here — Card itself now supplies the card's one edge padding (p-4).
  return <View className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {

  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return <Text className={cn('text-content-muted text-paragraph-s', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn(className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex flex-row items-center', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
