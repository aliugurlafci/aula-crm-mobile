/**
 * Empty / placeholder state with an icon, title and optional hint.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Text } from './Text';

export function EmptyState({
  icon = 'cube-outline',
  title,
  hint,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.root}>
      <Ionicons name={icon} size={48} color={palette.muted2} />
      <Text variant="subtitle" tone="muted" center weight="semibold">
        {title}
      </Text>
      {hint ? (
        <Text variant="body" tone="muted2" center>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
});
