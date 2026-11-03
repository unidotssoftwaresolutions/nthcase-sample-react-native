import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { actions, credentialsMatch, TEST_EMAIL, TEST_PASSWORD } from '../data/store';
import { TestIds } from '../testIds';
import { Button, Icon, IconButton, TextField } from '../ui/components';
import { ItemNumberStyle, Radius, Space, Type, useTheme } from '../ui/theme';

export const SIGN_IN_WRONG = 'Wrong email or password';
export const SIGN_IN_MISSING = 'Enter your email and password';

/** Signing in flips the root layout's guard, which then opens the Shop (and a waiting deep link). */
export function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const refusal = email.trim() === '' || password === '' ? SIGN_IN_MISSING : !credentialsMatch(email, password) ? SIGN_IN_WRONG : null;
    setError(refusal);
    if (refusal === null) actions.signIn(email);
  }

  return (
    // padding on Android too: edge-to-edge, the window no longer shrinks for the keyboard (see FormScreen)
    <KeyboardAvoidingView testID={TestIds.SIGNIN_SCREEN} behavior="padding" style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.column, { paddingTop: insets.top + Space.xxl, paddingBottom: insets.bottom + Space.xxl }]}
      >
        <Icon name="shop" size={48} color={colors.primary} />
        <View>
          <Text accessibilityRole="header" style={[Type.display, { color: colors.onSurface }]}>
            Mossgrove
          </Text>
          <Text style={[Type.bodyLarge, { color: colors.onSurfaceVariant }]}>Home and desk goods</Text>
        </View>
        <View style={{ height: Space.sm }} />
        <TextField
          label="Email"
          testID={TestIds.SIGNIN_EMAIL}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          error={error !== null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          testID={TestIds.SIGNIN_PASSWORD}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          error={error !== null}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={submit}
          trailing={
            <IconButton
              testID={TestIds.SIGNIN_PASSWORD_TOGGLE}
              icon={showPassword ? 'eye_off' : 'eye'}
              label={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((s) => !s)}
            />
          }
        />
        {error ? (
          <View style={styles.errorRow}>
            <Icon name="warning" size={18} color={colors.error} />
            <Text testID={TestIds.SIGNIN_ERROR} accessibilityLiveRegion="polite" style={[Type.body, { color: colors.error, marginLeft: Space.sm }]}>
              {error}
            </Text>
          </View>
        ) : null}
        <Button label="Sign in" onPress={submit} testID={TestIds.SIGNIN_SUBMIT} />
        <View style={{ height: Space.sm }} />
        {/* the printed slip: a plain view, so Use test account keeps its own id */}
        <View testID={TestIds.SIGNIN_TEST_ACCOUNT} style={[styles.card, { borderColor: colors.outlineVariant }]}>
          <Text style={[Type.titleSmall, { color: colors.onSurface }]}>Test account</Text>
          <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>This is a sample app. Sign in with:</Text>
          <Text style={[ItemNumberStyle, { color: colors.onSurface }]}>{TEST_EMAIL}</Text>
          <Text style={[ItemNumberStyle, { color: colors.onSurface }]}>{TEST_PASSWORD}</Text>
          <Button
            label="Use test account"
            variant="text"
            testID={TestIds.SIGNIN_USE_TEST_ACCOUNT}
            style={{ alignSelf: 'flex-start', marginLeft: -Space.md }}
            onPress={() => {
              setEmail(TEST_EMAIL);
              setPassword(TEST_PASSWORD);
              setError(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: Space.xl, gap: Space.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Space.lg, gap: Space.xs },
});
