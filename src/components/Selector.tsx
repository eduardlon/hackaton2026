import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props<T extends string | number> = {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function Selector<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        scaleTo={0.98}
        haptic="selection"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 6,
        }}
      >
        <View>
          {label ? (
            <Text variant="micro" tone="muted">
              {label}
            </Text>
          ) : null}
          <Text variant="bodyStrong">{selected?.label ?? String(value)}</Text>
        </View>
        <ChevronDown size={18} color={theme.colors.textMuted} />
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <PressableScale
          onPress={() => setOpen(false)}
          scaleTo={1}
          haptic="none"
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingTop: 12,
              paddingBottom: 28,
              paddingHorizontal: 18,
              gap: 6,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                marginBottom: 8,
              }}
            />
            {label ? (
              <Text variant="h3" style={{ marginBottom: 6 }}>
                {label}
              </Text>
            ) : null}
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <PressableScale
                  key={String(opt.value)}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  scaleTo={0.98}
                  haptic="selection"
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: theme.radii.lg,
                    backgroundColor: active ? theme.colors.primarySoft : 'transparent',
                  }}
                >
                  <Text
                    variant="bodyStrong"
                    style={{
                      color: active ? theme.colors.primaryDark : theme.colors.text,
                    }}
                  >
                    {opt.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </PressableScale>
      </Modal>
    </>
  );
}
