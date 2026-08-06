/**
 * Login screen: email + password, plus a TOTP code when the account has 2FA.
 *
 * The form is centred in the viewport (the screen has no header, so there is
 * nothing to anchor it to the top) while the backend-host switch stays at the
 * foot — it exists so a phone can reach a dev server by LAN IP and shouldn't
 * compete with the sign-in card.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { getBaseUrl, setBaseUrl } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { Spacing } from '@/lib/theme/tokens';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BrandMark } from '@/components/ui/BrandMark';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { online } = useSync();
  const { loginWithCredentials } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFA, setTwoFA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getBaseUrl());

  const onCredentials = async () => {
    setError(null);
    setLoading(true);
    const res = await loginWithCredentials(email.trim(), password, twoFA ? code.trim() : undefined);
    setLoading(false);
    if (res.twoFactorRequired) {
      setTwoFA(true);
      return;
    }
    if (!res.ok) {
      setError(res.error ?? t('login.failedGeneric'));
      return;
    }
    router.replace('/(tabs)/pos');
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
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.center}>
            <View style={styles.brand}>
              <View style={[styles.logo, { backgroundColor: palette.field, borderColor: palette.fieldBorder }]}>
                <BrandMark size={46} />
              </View>
              <Text variant="display" weight="heavy">
                Aula POS
              </Text>
              <Text variant="body" tone="muted" center>
                {t('login.tagline')}
              </Text>
            </View>

            {!online ? <Banner tone="warning" message={t('login.offlineBanner')} /> : null}
            {error ? <Banner tone="danger" title={t('login.failedTitle')} message={error} /> : null}

            <Card style={{ gap: Spacing.md }}>
              <Input
                label={t('login.email')}
                icon="mail-outline"
                placeholder="you@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <Input
                label={t('login.password')}
                icon="lock-closed-outline"
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={onCredentials}
              />
              {twoFA ? (
                <Input
                  label={t('login.code')}
                  icon="keypad-outline"
                  placeholder="123456"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                />
              ) : null}
              <Button
                title={twoFA ? t('login.verifySignIn') : t('login.signIn')}
                icon="log-in-outline"
                size="lg"
                loading={loading}
                onPress={onCredentials}
              />
            </Card>
          </View>

          {showServer ? (
            <Card style={{ gap: Spacing.sm }}>
              <Input
                label={t('login.serverUrl')}
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
                  <Button title={t('common.save')} icon="checkmark" onPress={saveServer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t('common.cancel')} variant="ghost" onPress={() => setShowServer(false)} />
                </View>
              </View>
            </Card>
          ) : (
            <Button title={t('login.server', { url: getBaseUrl() })} variant="ghost" icon="settings-outline" onPress={() => setShowServer(true)} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  /** Takes the space the server switch leaves and centres the form in it. */
  center: { flexGrow: 1, justifyContent: 'center', gap: Spacing.lg },
  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  serverRow: { flexDirection: 'row', gap: Spacing.sm },
});
