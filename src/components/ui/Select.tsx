/**
 * Select field — a glass row that opens a bottom Sheet of options. Used to pick
 * branch / warehouse / customer in the sales flows. Supports a "none" option and
 * a quick search for long lists.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface Option {
  id: string;
  name: string;
}

export function Select({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select…',
  noneLabel,
  icon,
  searchable,
}: {
  label?: string;
  value: string | null;
  options: Option[];
  onSelect: (id: string | null) => void;
  placeholder?: string;
  noneLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  searchable?: boolean;
}) {
  const { palette } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.name.toLowerCase().includes(t));
  }, [options, search]);

  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: palette.surface2, borderColor: palette.border }]}
      >
        {icon ? <Ionicons name={icon} size={18} color={palette.muted} /> : null}
        <Text variant="body" tone={selected ? 'default' : 'muted2'} style={styles.value} numberOfLines={1}>
          {selected ? selected.name : noneLabel && value === null ? noneLabel : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={palette.muted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {searchable ? (
          <Input icon="search" placeholder="Search…" value={search} onChangeText={setSearch} autoCorrect={false} />
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            noneLabel ? (
              <Row
                label={noneLabel}
                selected={value === null}
                onPress={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Row
              label={item.name}
              selected={item.id === value}
              onPress={() => {
                onSelect(item.id);
                setOpen(false);
              }}
            />
          )}
        />
      </Sheet>
    </View>
  );
}

function Row({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor: palette.border }]}>
      <Text variant="body" weight={selected ? 'bold' : 'regular'} tone={selected ? 'primary' : 'default'}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={palette.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  value: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
