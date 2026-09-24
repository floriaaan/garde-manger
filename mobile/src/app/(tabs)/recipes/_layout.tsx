import { Stack } from 'expo-router'

export default function RecipesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Declared before `[id]` so `/recipes/generate` resolves to the
          composer rather than to a recipe with the id "generate". Modal
          presentation, same as the receipt scanner: it is a self-contained
          sub-task with one way out. */}
      {/* Swipe-down stays on: the composer guards an unsaved wish with
          `usePreventRemove`, which catches the swipe, the Android back button
          and "Fermer" alike — an empty sheet just closes, as iOS expects. */}
      <Stack.Screen name="generate" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
