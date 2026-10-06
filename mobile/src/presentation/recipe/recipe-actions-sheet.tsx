import { useTranslation } from '../../i18n/index.js'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Recipe } from '../../domain/recipe/recipe.js'
import { useUpdateRecipeStateMutation } from '../../application/recipe/update-recipe-state.mutation.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { BanIcon, StarIcon, ArchiveIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function RecipeActionsSheet({ visible, recipe, onClose, onDelete, deleteTestID, onFeedback }: {
  visible: boolean
  recipe: Recipe | null | undefined
  onClose: () => void
  onDelete: () => void
  deleteTestID: string
  onFeedback: (message: string, tone: 'success' | 'error') => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const update = useUpdateRecipeStateMutation()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setConfirmingDelete(false)
  }

  async function changeState(state: { isArchived?: boolean; isFavorite?: boolean }) {
    if (!recipe || update.isPending) return
    const current = recipe
    onClose()
    try {
      const result = await update.mutateAsync({ recipeId: current.id, state })
      if (!result.ok) {
        onFeedback(t('recipe.couldn_t_update_try_again_from_the_recipe_menu'), 'error')
        return
      }
      queryClient.setQueryData(['recipe', current.id], result.value)
      queryClient.setQueryData<Recipe[]>(['recipes'], (recipes) =>
        recipes?.map((item) => item.id === current.id ? result.value : item))
      onFeedback(state.isArchived !== undefined
        ? state.isArchived ? t('recipe.recipe_archived') : t('recipe.recipe_unarchived')
        : state.isFavorite ? t('recipe.recipe_added_to_favourites') : t('recipe.recipe_removed_from_favourites'), 'success')
    } catch {
      onFeedback(t('recipe.couldn_t_update_check_your_connection_and_try_again'), 'error')
    }
  }

  return <ActionSheet
    visible={visible && !!recipe}
    onClose={onClose}
    title={recipe ? confirmingDelete ? t('recipe.delete', { value1: recipe.title }) : `« ${recipe.title} »` : ''}
    description={confirmingDelete
      ? t('recipe.it_will_also_disappear_for_the_other_household_members_this')
      : t('recipe.actions_are_shared_with_the_household_favourites_are_pinned_to')}
    options={confirmingDelete ? [{
      testID: deleteTestID, label: t('identity.delete_permanently'),
      icon: (color) => <BanIcon size={18} color={color} />,
      tint: palette.expiredText, destructive: true, onPress: onDelete,
    }] : [{
      testID: 'recipe-favorite-toggle',
      label: recipe?.isFavorite ? t('recipe.remove_from_favourites') : t('recipe.add_to_favourites_pin'),
      icon: (color) => <StarIcon size={18} color={color} />,
      tint: palette.freshText, onPress: () => changeState({ isFavorite: !recipe?.isFavorite }),
    }, {
      testID: 'recipe-archive-toggle', label: recipe?.isArchived ? t('recipe.unarchive_recipe') : t('recipe.archive_recipe'),
      icon: (color) => <ArchiveIcon size={18} color={color} />,
      tint: palette.inkSecondary, onPress: () => changeState({ isArchived: !recipe?.isArchived }),
    }, {
      testID: 'recipe-delete-action', label: t('recipe.delete_permanently'),
      icon: (color) => <BanIcon size={18} color={color} />,
      tint: palette.expiredText, destructive: true, keepOpen: true,
      onPress: () => setConfirmingDelete(true),
    }]}
  />
}
