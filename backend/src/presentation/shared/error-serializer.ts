import type { ValidationError } from '#domain/shared/validation-error'

export interface SerializedError {
  status: number
  body: { error: { type: string; message: string; details?: unknown } }
}

const STRING_ERROR_STATUS: Record<string, number> = {
  invalid_credentials: 401,
  already_in_household: 409,
  invalid_invite_code: 404,
  no_household: 403,
  not_owner: 403,
  cannot_remove_owner: 409,
  not_a_member: 404,
  owner_cannot_leave: 409,
  provider_not_configured: 422,
  provider_choice_disabled: 403,
  ai_quota_exceeded: 402,
  already_subscribed: 409,
  no_subscription: 404,
  billing_unavailable: 404,
  product_not_found: 404,
  image_not_found: 404,
  receipt_not_found: 404,
  job_not_found: 404,
  job_not_retryable: 409,
  draft_not_found: 404,
  extraction_failed: 422,
  unsupported_format: 422,
  shopping_item_not_found: 404,
  recipe_not_found: 404,
  generation_failed: 422,
  invalid_url: 422,
  host_not_allowed: 422,
  unreachable: 422,
  unauthorized: 422,
  entity_not_found: 422,
  unexpected_response: 422,
  link_not_found: 404,
  link_unreadable: 409,
  token_required: 422,
  invalid_direction: 422,
  already_owner: 409,
}

const STRING_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe invalide.',
  already_in_household: 'Vous appartenez déjà à un foyer.',
  invalid_invite_code: "Code d'invitation invalide.",
  no_household: "Vous n'appartenez à aucun foyer.",
  not_owner: 'Seul le propriétaire du foyer peut faire cette action.',
  cannot_remove_owner: 'Le propriétaire ne peut pas être retiré.',
  not_a_member: "Cet utilisateur n'est pas membre du foyer.",
  owner_cannot_leave: 'Le propriétaire doit supprimer le foyer plutôt que le quitter.',
  provider_not_configured: 'Ce provider IA ne dispose pas des identifiants nécessaires.',
  provider_choice_disabled: "Le choix du fournisseur IA n'est pas disponible sur cette instance.",
  ai_quota_exceeded: 'Quota IA mensuel atteint.',
  already_subscribed: 'Ce foyer est déjà abonné.',
  no_subscription: 'Aucun abonnement à gérer : seule la personne qui a souscrit peut y accéder.',
  billing_unavailable: "L'abonnement n'est pas disponible sur cette instance.",
  product_not_found: 'Produit introuvable.',
  image_not_found: 'Image introuvable.',
  receipt_not_found: 'Ticket introuvable.',
  job_not_found: 'Tâche introuvable.',
  job_not_retryable: 'Cette tâche ne peut pas être relancée.',
  draft_not_found: 'Brouillon introuvable ou expiré.',
  extraction_failed: "L'extraction du ticket a échoué — réessayez avec une photo plus nette.",
  unsupported_format:
    'Ce fournisseur IA ne lit pas les fichiers PDF — essayez une photo, ou un autre fournisseur.',
  shopping_item_not_found: 'Article introuvable.',
  recipe_not_found: 'Recette introuvable.',
  generation_failed: 'La génération de recette a échoué — réessayez, ou reformulez votre demande.',
  invalid_url: "Cette adresse n'est pas valide.",
  host_not_allowed: "Cet hôte n'est pas autorisé sur ce serveur.",
  unreachable: 'Impossible de joindre cette adresse depuis le serveur.',
  unauthorized: 'Home Assistant a refusé ce jeton.',
  entity_not_found: 'Entité introuvable sur cette instance.',
  unexpected_response: 'Home Assistant a répondu de façon inattendue.',
  link_not_found: 'Aucune connexion Home Assistant configurée.',
  link_unreadable: 'La connexion enregistrée est illisible — reconfigurez-la.',
  token_required: 'Un jeton est requis pour la première connexion.',
  invalid_direction: 'Sens de synchronisation invalide.',
  already_owner: 'Cette personne est déjà propriétaire du foyer.',
}

function isValidationError(error: unknown): error is ValidationError {
  return typeof error === 'object' && error !== null && 'field' in error && 'message' in error
}

/**
 * Converts a domain/application `Result.err(...)` value into an HTTP status
 * + JSON body. Household errors (Task 10) extend `STRING_ERROR_STATUS`/
 * `STRING_ERROR_MESSAGES` in place rather than duplicating this function.
 */
export function serializeError(error: unknown): SerializedError {
  if (isValidationError(error)) {
    return { status: 400, body: { error: { type: 'validation_failed', message: error.message } } }
  }

  if (typeof error === 'string') {
    return {
      status: STRING_ERROR_STATUS[error] ?? 400,
      body: { error: { type: error, message: STRING_ERROR_MESSAGES[error] ?? error } },
    }
  }

  throw new Error(`serializeError: unrecognized domain error shape: ${JSON.stringify(error)}`)
}
