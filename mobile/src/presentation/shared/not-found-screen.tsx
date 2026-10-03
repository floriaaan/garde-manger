import { router } from 'expo-router'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { Pressable } from './pressable.js'

export function NotFoundScreen() {
  const palette = useSoftPalette()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.cream }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.content}>
        <Image source={require('../../../assets/mascot.png')} accessible={false} style={styles.mascot} />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>
          Page introuvable
        </Text>
        <Text style={[styles.description, { color: palette.creamText }]}>
          On dirait que ce lien s’est égaré. Retrouvons l’accueil de Garde-manger pour continuer.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={[styles.button, { backgroundColor: palette.accentLime }]}
        >
          <Text style={[styles.buttonLabel, { color: palette.accentLimeText }]}>Revenir à l’accueil</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  content: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 16 },
  mascot: { width: 144, height: 144, resizeMode: 'contain', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 17, lineHeight: 26, textAlign: 'center' },
  button: { minHeight: 48, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999, marginTop: 16, maxWidth: '100%' },
  buttonLabel: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
})
