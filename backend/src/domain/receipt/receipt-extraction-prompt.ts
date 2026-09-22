/**
 * Shared by all three `ReceiptExtractionPort` adapters (Task 9) — one place
 * owns the prompt's contract, the same role `recipe-generation-prompt.ts`
 * plays on the `RecipeGenerationPort` side. It used to be copy-pasted
 * identically into each adapter, three places to drift out of sync.
 *
 * Three rules were added after real receipts kept polluting le garde-manger:
 * a raw thermal-printer line becomes a fridge product name verbatim
 * otherwise, promo/discount noise and all.
 *
 * `expiresInDays` (2026-09-10): the review screen used to leave every
 * item's expiry blank — the one field that decides whether the app ever
 * flags a product before it's wasted, and the one field a receipt can never
 * print, so nothing on the ticket could have filled it in anyway. The model
 * already reads a food category for every line; asking it for a typical
 * shelf life from the same read costs nothing extra and needs no local
 * lookup table this codebase would have to keep in sync with reality
 * (a "durée de conservation" table per category, maintained by hand, is
 * its own source of drift). The estimate is still just a starting point —
 * the field stays editable, exactly like every other extracted value.
 */
export const RECEIPT_EXTRACTION_PROMPT = `Analyse ce ticket de caisse (photo ou PDF scanné) et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null, "expiresInDays": number | null}]}

Règles pour "items" :
- N'inclus que les produits alimentaires ou destinés au garde-manger, au frigo ou au congélateur. Exclus tout le reste : sacs, consigne, frais de service, carte de fidélité, remises, sous-totaux, totaux, taxes, et toute ligne qui n'est pas un produit réel.
- "name" doit être un nom de produit propre et lisible. Retire toute mention promotionnelle ou de remise ("PROMO", "-20%", "2E GRATUIT", "OFFRE", codes/références internes du magasin) — le nom ne doit décrire que le produit.
- Si le libellé du ticket est une abréviation de caissier peu claire (ex. "PDT BIO", "LT 1/2 ECR", "YAB NAT"), déduis et écris le nom complet et compréhensible le plus probable plutôt que de copier l'abréviation telle quelle.
- "expiresInDays" : ta meilleure estimation du nombre de jours de conservation typique de ce produit à partir de la date d'achat (ex. 7 pour un yaourt, 3 pour de la viande fraîche non transformée, 300 pour des pâtes sèches). Mets null si tu n'as aucune estimation raisonnable à faire — ne devine jamais au hasard.

Pas de texte hors du JSON.`
