/**
 * Login screen. Two paths to a session:
 *   - email + password (+ TOTP code when the account has 2FA), and
 *   - one-tap demo personas (admin / manager / rep / accountant) that mint a real
 *     bearer token — handy on a device against the seeded backend.
 * The backend host is editable here so a phone can reach a dev server by LAN IP.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { getBaseUrl, setBaseUrl } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

const PERSONAS: { actor: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { actor: 'admin', label: 'Admin', icon: 'shield-checkmark' },
  { actor: 'manager', label: 'Manager', icon: 'briefcase' },
  { actor: 'rep', label: 'Sales Rep', icon: 'person' },
  { actor: 'accountant', label: 'Accountant', icon: 'calculator' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { online } = useSync();
  const { loginWithCredentials, loginPersona } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFA, setTwoFA] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getBaseUrl());

  const goHome = () => router.replace('/(tabs)/pos');

  const onCredentials = async () => {
    setError(null);
    setLoading('credentials');
    const res = await loginWithCredentials(email.trim(), password, twoFA ? code.trim() : undefined);
    setLoading(null);
    if (res.twoFactorRequired) {
      setTwoFA(true);
      return;
    }
    if (!res.ok) {
      setError(res.error ?? 'Login failed');
      return;
    }
    goHome();
  };

  const onPersona = async (actor: string) => {
    setError(null);
    setLoading(actor);
    const res = await loginPersona(actor);
    setLoading(null);
    if (!res.ok) {
      setError(res.error ?? 'Login failed');
      return;
    }
    goHome();
  };

  const saveServer = async () => {
    await setBaseUrl(server);
    setServer(getBaseUrl());
    setShowServer(false);
    setError(null);
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: palette.primary }]}>
              <Ionicons name="cart" size={34} color="#fff" />
            </View>
            <Text variant="display" weight="heavy">
              Aula POS
            </Text>
            <Text variant="body" tone="muted" center>
              Sell, scan and manage stock — online or off.
            </Text>
          </View>

          {!online ? <Banner tone="warning" message="You're offline. Sign in once online to start a session." /> : null}
          {error ? <Banner tone="danger" title="Sign-in failed" message={error} /> : null}

          <Card style={{ gap: Spacing.md }}>
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="you@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onCredentials}
            />
            {twoFA ? (
              <Input
                label="Authenticator code"
                icon="keypad-outline"
                placeholder="123456"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
            ) : null}
            <Button
              title={twoFA ? 'Verify & sign in' : 'Sign in'}
              icon="log-in-outline"
              size="lg"
              loading={loading === 'credentials'}
              onPress={onCredentials}
            />
          </Card>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: palette.border }]} />
            <Text variant="caption" tone="muted2">
              or try a demo persona
            </Text>
            <View style={[styles.line, { backgroundColor: palette.border }]} />
          </View>

          <View style={styles.personas}>
            {PERSONAS.map((p) => (
              <View key={p.actor} style={styles.personaCell}>
                <Button
                  title={p.label}
                  icon={p.icon}
                  variant="outline"
                  loading={loading === p.actor}
                  onPress={() => onPersona(p.actor)}
                  fullWidth
                />
              </View>
            ))}
          </View>

          {showServer ? (
            <Card style={{ gap: Spacing.sm }}>
              <Input
                label="Backend server URL"
                icon="server-outline"
                placeholder="http://192.168.1.20:4000"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={server}
                onChangeText={setServer}
              />
              <View style={styles.serverRow}>
                <View style={{ flex: 1 }}>
                  <Button title="Save" icon="checkmark" onPress={saveServer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Cancel" variant="ghost" onPress={() => setShowServer(false)} />
                </View>
              </View>
            </Card>
          ) : (
            <Button title={`Server: ${getBaseUrl()}`} variant="ghost" icon="settings-outline" onPress={() => setShowServer(true)} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingTop: Spacing.xxl * 1.6, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logo: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  personas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  personaCell: { width: '48%', flexGrow: 1 },
  serverRow: { flexDirection: 'row', gap: Spacing.sm },
});
