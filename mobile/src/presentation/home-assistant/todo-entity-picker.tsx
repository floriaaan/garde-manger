import { useState } from 'react'
import { Pressable, TextInput } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { CircleCheckIcon } from '../dashboard/dashboard-icons.js'
import type { HaTodoEntity } from '../../domain/home-assistant/ha-link.js'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function TodoEntityRow({
  entity,
  selected,
  onPress,
}: {
  entity: HaTodoEntity
  selected: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  // A card row, not a flat tinted rectangle: same language as `MemberRow`
  // (household-screen) — its own surface + a card-float shadow — so the
  // list reads as rows of cards rather than a bare radio list. Selection
  // uses the Home Assistant mint pairing (matching the "Home Assistant"
  // `IdentityCard` and its config button) instead of `accentLime`, which
  // read as unrelated to the screen it sits on (2026-09-09 design pass).
  return (
    <Pressable
      testID={`todo-entity-${entity.entityId}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={entity.friendlyName}
      android_ripple={ripple(palette.ink)}
      style={[pointerCursor, rippleClip(16)]}
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        paddingVertical="$3"
        paddingHorizontal="$3"
        minHeight={56}
        borderRadius={16}
        backgroundColor={selected ? palette.mintPale : palette.gradientBottom}
        style={{
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 1,
        }}
      >
        <YStack flex={1} minWidth={0}>
          <Text fontSize={14} fontWeight="700" color={selected ? palette.mintPaleText : palette.ink}>
            {entity.friendlyName}
          </Text>
          <Text fontSize={12} color={selected ? palette.mintPaleText : palette.inkSecondary}>
            {entity.entityId}
          </Text>
        </YStack>
        {selected ? <CircleCheckIcon size={18} color={palette.mintPaleText} /> : null}
      </XStack>
    </Pressable>
  )
}

export function TodoEntityPicker({
  entities,
  selectedEntityId,
  onSelect,
}: {
  entities: HaTodoEntity[]
  selectedEntityId: string | null
  onSelect: (entityId: string, friendlyName: string) => void
}) {
  const palette = useSoftPalette()
  const [search, setSearch] = useState('')
  const filtered = entities.filter((entity) => {
    const query = normalize(search)
    if (!query) return true
    return normalize(entity.friendlyName).includes(query) || normalize(entity.entityId).includes(query)
  })

  return (
    <YStack gap="$2">
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une liste"
        placeholderTextColor={palette.inkSecondary}
        accessibilityLabel="Rechercher une liste"
        style={{
          minHeight: 44,
          borderRadius: 14,
          paddingHorizontal: 16,
          fontSize: 14,
          color: palette.ink,
          backgroundColor: palette.cream,
        }}
      />
      <YStack gap="$2">
        {filtered.map((entity) => (
          <TodoEntityRow
            key={entity.entityId}
            entity={entity}
            selected={entity.entityId === selectedEntityId}
            onPress={() => onSelect(entity.entityId, entity.friendlyName)}
          />
        ))}
        {filtered.length === 0 ? (
          <Text fontSize={13} color={palette.inkSecondary} paddingVertical="$2">
            Aucune liste ne correspond.
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
