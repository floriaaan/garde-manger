import { aiLanguageInstruction } from '#domain/shared/ai-language'
import type { AiLanguage } from '#domain/shared/ai-language'

/**
 * Shared by all three `FridgeScanExtractionPort` adapters — same role
 * `receipt-extraction-prompt.ts` plays for the receipt scan. One photo per
 * call (see `fridge-scan-extraction-port.interface.ts`), so this prompt
 * never has to reason about de-duplicating across photos — `ScanFridge`'s
 * caller does that once every photo's draft comes back.
 *
 * Water and ice are excluded by name (2026-09-17): a fridge door full of
 * bottled water is the first thing a photo sees, and none of it expires or
 * needs cooking from — it only buried the real products in the review list.
 */
const FRIDGE_SCAN_EXTRACTION_PROMPT = `Analyse cette photo de l'intérieur d'un frigo, d'un congélateur ou d'un placard et retourne UNIQUEMENT un JSON de la forme :
{"items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "location": "fridge" | "freezer" | "pantry", "expiresInDays": number | null}]}

Règles pour "items" :
- N'inclus que des aliments ou boissons clairement identifiables. Ignore les emballages vides, les contenants non identifiables et tout objet qui n'est pas un produit alimentaire.
- Exclus ce qui n'a pas d'intérêt à être suivi dans un garde-manger : eau plate, eau gazeuse ou pétillante (bouteilles, carafes, gourdes), glaçons et bacs à glaçons.
- "quantity" est le nombre d'unités visibles de ce produit (ex. 3 yaourts identiques = quantity: 3). Si tu ne peux pas compter d'unités distinctes (ex. un reste dans un plat), mets 1.
- "unit" est "pièce" en français ou "piece" en anglais par défaut, selon la langue de sortie. N'invente jamais un poids ou un volume que la photo ne montre pas explicitement (étiquette lisible).
- "location" : déduis-la de la photo. Givre, glaçons ou emballages typés surgelés → "freezer". Étagère ou placard sec, sans réfrigération visible → "pantry". Sinon → "fridge".
- "expiresInDays" : ta meilleure estimation du nombre de jours de conservation restants à partir d'aujourd'hui, en supposant que le produit est déjà entamé ou stocké depuis un moment (sois plus prudent que pour un ticket de caisse qui vient d'être acheté). Mets null si tu n'as aucune estimation raisonnable à faire — ne devine jamais au hasard.

Pas de texte hors du JSON.`

export function buildFridgeScanExtractionPrompt(language: AiLanguage = 'fr'): string {
  return `${FRIDGE_SCAN_EXTRACTION_PROMPT}\n\n${aiLanguageInstruction('item names, categories and spelled-out units', language)}`
}
