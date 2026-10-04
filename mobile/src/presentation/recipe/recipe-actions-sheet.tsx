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
        onFeedback('Modification impossible. Réessaie depuis le menu de la recette.', 'error')
        return
      }
      queryClient.setQueryData(['recipe', current.id], result.value)
      queryClient.setQueryData<Recipe[]>(['recipes'], (recipes) =>
        recipes?.map((item) => item.id === current.id ? result.value : item))
      onFeedback(state.isArchived !== undefined
        ? state.isArchived ? 'Recette archivée' : 'Recette désarchivée'
        : state.isFavorite ? 'Recette ajoutée aux favoris' : 'Recette retirée des favoris', 'success')
    } catch {
      onFeedback('Modification impossible. Vérifie ta connexion et réessaie.', 'error')
    }
  }

  return <ActionSheet
    visible={visible && !!recipe}
    onClose={onClose}
    title={recipe ? confirmingDelete ? `Supprimer « ${recipe.title} » ?` : `« ${recipe.title} »` : ''}
    description={confirmingDelete
      ? 'Elle disparaît aussi pour les autres membres du foyer, et c’est définitif.'
      : 'Actions partagées avec le foyer. Les favoris sont épinglés en tête de liste ; les archives restent accessibles dans Archives.'}
    options={confirmingDelete ? [{
      testID: deleteTestID, label: 'Supprimer définitivement',
      icon: (color) => <BanIcon size={18} color={color} />,
      tint: palette.expiredText, destructive: true, onPress: onDelete,
    }] : [{
      testID: 'recipe-favorite-toggle',
      label: recipe?.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris · épingler',
      icon: (color) => <StarIcon size={18} color={color} />,
      tint: palette.freshText, onPress: () => changeState({ isFavorite: !recipe?.isFavorite }),
    }, {
      testID: 'recipe-archive-toggle', label: recipe?.isArchived ? 'Désarchiver la recette' : 'Archiver la recette',
      icon: (color) => <ArchiveIcon size={18} color={color} />,
      tint: palette.inkSecondary, onPress: () => changeState({ isArchived: !recipe?.isArchived }),
    }, {
      testID: 'recipe-delete-action', label: 'Supprimer définitivement…',
      icon: (color) => <BanIcon size={18} color={color} />,
      tint: palette.expiredText, destructive: true, keepOpen: true,
      onPress: () => setConfirmingDelete(true),
    }]}
  />
}
