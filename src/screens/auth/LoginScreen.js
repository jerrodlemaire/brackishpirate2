import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import HelmCrest from '../../components/HelmCrest'
import { useAuth } from '../../hooks/useAuth'

export default function LoginScreen() {
  const { Colors } = useTheme()
  const { signIn, signUp } = useAuth()
  const [mode,     setMode]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading,  setLoading]  = useState(false)

  const s = useMemo(() => StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: Colors.screenBg,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: 60,
      paddingBottom: 32,
      backgroundColor: Colors.screenBg,
    },
    hero: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    tagline: {
      fontFamily: Typography.fontSerif,
      fontSize: Typography.base,
      color: Colors.textSecondary,
      marginTop: Spacing.md,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: Colors.cardBg,
      borderRadius: Radius.lg,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: Spacing.lg,
      shadowColor: '#0D2137',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: Colors.inputBg,
      borderRadius: Radius.md,
      padding: 3,
      marginBottom: Spacing.lg,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      borderRadius: Radius.sm,
    },
    tabActive:     { backgroundColor: Colors.brackishWater },
    tabText:       { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: Colors.textOnDark },
    fields:        { gap: Spacing.md, marginBottom: Spacing.lg },
    fieldGroup:    { gap: Spacing.xs },
    label: {
      fontSize: Typography.sm,
      color: Colors.textSecondary,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    input: {
      backgroundColor: Colors.inputBg,
      borderWidth: 0.5,
      borderColor: Colors.borderMid,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: Typography.base,
      color: Colors.textPrimary,
    },
    btn:         { backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      fontFamily: Typography.fontSerif,
      fontSize: Typography.md,
      fontWeight: '700',
      color: Colors.textOnDark,
      letterSpacing: 0.5,
    },
    forgotWrap: { alignItems: 'center', marginTop: Spacing.md },
    forgot:     { fontSize: Typography.sm, color: Colors.brackishWater },
    footer: {
      marginTop: Spacing.xxl,
      fontSize: Typography.xs,
      color: Colors.textMuted,
      letterSpacing: 1,
      fontFamily: Typography.fontSerif,
    },
  }), [Colors])

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.')
      return
    }
    if (mode === 'signup' && !fullName) {
      Alert.alert('Missing info', 'Please enter your name.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) Alert.alert('Sign in failed', error.message)
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          Alert.alert('Sign up failed', error.message)
        } else {
          Alert.alert(
            'Check your email',
            'We sent you a confirmation link. Click it to activate your account.',
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={s.hero}>
          <HelmCrest size={110} variant="dark"/>
          <Text style={s.tagline}>Your fishing & boating command center</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Tab toggle */}
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, mode === 'signin' && s.tabActive]}
              onPress={() => setMode('signin')}
            >
              <Text style={[s.tabText, mode === 'signin' && s.tabTextActive]}>
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === 'signup' && s.tabActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[s.tabText, mode === 'signup' && s.tabTextActive]}>
                Create account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={s.fields}>
            {mode === 'signup' && (
              <View style={s.fieldGroup}>
                <Text style={s.label}>Full name</Text>
                <TextInput
                  style={s.input}
                  placeholder="Jake Boudreaux"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={s.fieldGroup}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="captain@brackishpirate.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Password</Text>
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.textOnDark}/>
              : <Text style={s.btnText}>
                  {mode === 'signin' ? 'Set sail  →' : 'Join the crew  →'}
                </Text>
            }
          </TouchableOpacity>

          {/* Footer link */}
          {mode === 'signin' && (
            <TouchableOpacity style={s.forgotWrap}>
              <Text style={s.forgot}>Forgot password?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom tagline */}
        <Text style={s.footer}>
          Brackish Pirate · Fishing & Boating
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
