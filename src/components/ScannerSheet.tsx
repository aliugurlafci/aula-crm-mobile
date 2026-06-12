/**
 * Full-screen barcode/QR scanner modal (expo-camera). Reused by POS, Cart,
 * Returns and Labels. Handles the camera permission flow, debounces repeat
 * scans, offers a manual-entry fallback and a torch toggle. Calls `onScan` with
 * the raw code; the caller resolves it (local cache first, then /pos/lookup).
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';

const BARCODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'datamatrix',
  'pdf417',
] as const;

export function ScannerSheet({
  visible,
  onClose,
  onScan,
  title = 'Scan barcode',
  hint = 'Align the barcode within the frame',
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  hint?: string;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const lockedRef = useRef(false);

  // Unlock the scanner each time the modal opens.
  useEffect(() => {
    if (visible) lockedRef.current = false;
  }, [visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    if (lockedRef.current || !result.data) return;
    lockedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScan(result.data.trim());
    // Re-arm after a short delay so a held camera can scan the next item.
    setTimeout(() => {
      lockedRef.current = false;
    }, 1200);
  };

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    setManual('');
    onScan(code);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            active={visible}
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handleScan}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permission]}>
            <Ionicons name="camera-outline" size={56} color="#fff" />
            <Text variant="subtitle" style={{ color: '#fff' }} center>
              Camera access is needed to scan products
            </Text>
            <Button title="Grant camera access" icon="camera" onPress={requestPermission} />
          </View>
        )}

        {/* viewfinder + chrome */}
        <View style={[styles.chrome, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.topBar}>
            <IconButton icon="close" tint="transparent" color="#fff" onPress={onClose} />
            <Text variant="subtitle" weight="bold" style={{ color: '#fff' }}>
              {title}
            </Text>
            <IconButton icon={torch ? 'flashlight' : 'flashlight-outline'} tint="transparent" color="#fff" onPress={() => setTorch((t) => !t)} />
          </View>

          {permission?.granted ? (
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={[styles.frame, { borderColor: palette.primary }]} />
              <Text variant="caption" style={{ color: '#fff', marginTop: Spacing.md }} center>
                {hint}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.manual}>
            <Input
              icon="keypad-outline"
              placeholder="Enter code manually"
              value={manual}
              onChangeText={setManual}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={submitManual}
              right={
                <Pressable onPress={submitManual} hitSlop={8}>
                  <Ionicons name="arrow-forward-circle" size={28} color={palette.primary} />
                </Pressable>
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  permission: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
  chrome: { flex: 1, justifyContent: 'space-between', paddingHorizontal: Spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 200,
    borderWidth: 3,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  manual: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: Radius.md,
    padding: Spacing.xs,
  },
});
