/**
 * Full-screen backdrop: a soft vertical gradient (the web `--background` →
 * `--background-2`) with three decorative aurora blobs (`--aurora-*`) behind the
 * content. Glass surfaces placed on top blur these blobs for the frosted look.
 */
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/lib/theme/ThemeProvider';

export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[palette.background, palette.background2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, styles.blob1, { backgroundColor: palette.aurora1 }]} />
        <View style={[styles.blob, styles.blob2, { backgroundColor: palette.aurora2 }]} />
        <View style={[styles.blob, styles.blob3, { backgroundColor: palette.aurora3 }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 360, height: 360, top: -120, right: -100 },
  blob2: { width: 320, height: 320, top: 220, left: -120 },
  blob3: { width: 300, height: 300, bottom: -100, right: -60 },
});
