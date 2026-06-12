/**
 * On-screen numeric keypad for the POS payment / quantity flows — large touch
 * targets, controlled value, decimal support and backspace.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { FontSize, FontWeight, Radius, Spacing } from '@/lib/theme/tokens';
import { Text } from './Text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function Numpad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { palette } = useTheme();

  const press = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange((value || '0') + '.');
      return;
    }
    // Prevent leading zeros like "00".
    const next = value === '0' ? key : value + key;
    // Limit to 2 decimals.
    if (next.includes('.') && next.split('.')[1]?.length > 2) return;
    onChange(next);
  };

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => press(key)}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: pressed ? palette.surface2 : palette.surface, borderColor: palette.border },
          ]}
        >
          {key === '⌫' ? (
            <Ionicons name="backspace-outline" size={24} color={palette.foreground} />
          ) : (
            <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.semibold }}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  key: {
    width: '31.5%',
    flexGrow: 1,
    height: 58,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
