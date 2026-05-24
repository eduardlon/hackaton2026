import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyStrong'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'micro';

type Tone = 'default' | 'muted' | 'soft' | 'primary' | 'danger' | 'warn' | 'success' | 'income' | 'expense';

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: Props) {
  const { theme } = useTheme();
  const v = theme.typography[variant];

  const toneColor: Record<Tone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    soft: theme.colors.textSoft,
    primary: theme.colors.primaryDark,
    danger: theme.colors.danger,
    warn: theme.colors.warn,
    success: theme.colors.success,
    income: theme.colors.income,
    expense: theme.colors.expense,
  };

  return (
    <RNText
      allowFontScaling
      style={[
        {
          fontFamily: v.fontFamily,
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          color: toneColor[tone],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
