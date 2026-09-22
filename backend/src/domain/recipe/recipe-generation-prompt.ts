import type { RecipeGenerationContext } from './interfaces/recipe-generation-port.interface.js'

const BASE_INSTRUCTIONS = `Tu es un assistant culinaire. Les produits fournis sont une réserve où piocher, pas une liste à épuiser : retiens ceux qui vont bien ensemble, ignore les autres, et complète librement avec des ingrédients courants (huile, sel, épices, farine, œufs, etc.). Une recette cohérente autour de deux ou trois de ces produits vaut mieux qu'une recette qui les case tous. Retourne UNIQUEMENT un JSON de la forme :
[{"title": string, "description": string | null, "instructions": string, "preparationTime": number | null, "tags": string[], "ingredients": [{"label": string, "quantity": number | null, "unit": string | null}]}]
"instructions" doit contenir une étape par ligne, chaque ligne préfixée par son numéro suivi d'un point (ex. "1. Émincer l'oignon.\\n2. Faire chauffer l'huile."). "tags" : des mots simples en français correctement orthographiés (ex. "dessert", "végétarien", "rapide"), jamais tronqués ni abrégés. Pas de texte hors du JSON. Propose entre 1 et 3 recettes.`

/**
 * Shared by all three `RecipeGenerationPort` adapters (Task 5) — one place
 * builds the prompt from context, the same role `receipt-draft-parser.ts`
 * plays for parsing on the `ReceiptExtractionPort` side.
 */
export function buildRecipeGenerationPrompt(context: RecipeGenerationContext): string {
  const productLines = context.products
    .map(
      (p) =>
        `- ${p.name} (${p.category}${p.expiresAt ? `, périme le ${p.expiresAt.toISOString().slice(0, 10)}` : ''})`,
    )
    .join('\n')

  const parts = [
    BASE_INSTRUCTIONS,
    `Produits actuellement dans le foyer, à utiliser si pertinent :\n${productLines || '(aucun produit)'}`,
  ]

  if (context.prioritizeExpiringSoon) {
    parts.push('À qualité de recette égale, préfère celles qui utilisent les produits proches de la péremption.')
  }
  if (context.prompt) {
    parts.push(`Demande spécifique de l'utilisateur : ${context.prompt}`)
  }

  return parts.join('\n\n')
}
