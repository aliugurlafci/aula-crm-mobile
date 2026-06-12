/**
 * On-screen barcode / QR preview. Generates an SVG with bwip-js and renders it
 * via react-native-svg's SvgXml. Used in product detail + the label designer.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { barcodeSvg } from '@/lib/barcode/generate';
import { guessType, type BarcodeType } from '@/lib/barcode/check-digit';
import { Text } from '@/components/ui/Text';

export function BarcodeView({
  value,
  type,
  width = 220,
  height = 90,
  showText = true,
}: {
  value: string;
  type?: BarcodeType;
  width?: number;
  height?: number;
  showText?: boolean;
}) {
  const resolved = type ?? guessType(value);
  const xml = useMemo(() => barcodeSvg(value, resolved, { scale: 3, height: resolved === 'qr' ? undefined : 14 }), [value, resolved]);

  if (!value) return null;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {xml ? (
        <SvgXml xml={xml} width={resolved === 'qr' ? height : width} height={height} />
      ) : (
        <Text variant="mono">{value}</Text>
      )}
      {showText ? (
        <Text variant="mono" tone="muted">
          {value}
        </Text>
      ) : null}
    </View>
  );
}
