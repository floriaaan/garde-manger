# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Membres d'un foyer partagé (couple, colocataires, famille) qui gèrent ensemble un frigo/garde-manger réel. Le job : garder trace de ce qu'il y a à la maison, éviter le gaspillage lié aux dates de péremption, et décider quoi cuisiner ou acheter — à plusieurs, sur le même état partagé (pas un carnet perso par personne).

## Product Purpose

Garde-manger est une app de gestion de frigo partagé : suivi des produits (stock, localisation frigo/congélateur/garde-manger, péremption), import de tickets de caisse par photo (extraction IA multi-produits), génération de recettes par IA à partir des produits proches de la péremption, et liste de courses. Succès = le foyer sait ce qu'il a, jette moins, et retrouve plus vite quoi cuisiner.

## Positioning

Self-hosted (Docker Compose, auth via instance PocketID perso de l'utilisateur + email/password) — pas de service SaaS tiers qui aspire les données du frigo. Receipt-scan en un seul appel IA multimodal (vision, pas d'étape OCR séparée) : plus rapide, une dépendance de moins que les concurrents type OCR-first. Tout est scopé au foyer (`householdId`), pas à l'utilisateur seul — différenciateur structurant face aux apps de liste de courses mono-utilisateur (AnyList, Mealime).

## Operating Context

- Usage réel : dans la cuisine, souvent au moment de ranger les courses (scan ticket) ou en ouvrant le frigo (checker péremption, décider du repas).
- Multi-device par foyer : plusieurs membres, chacun sur son téléphone, données partagées en temps quasi-réel.
- Auth : PocketID SSO (OIDC, provider "pocketid") + email/password, méthodes découvertes dynamiquement par le front (pas de liste hardcodée).
- Un seul foyer par utilisateur en v1 (pas de multi-foyer/switch). Un seul owner par foyer ; pour quitter depuis l’écran Foyer, il doit d’abord transférer la propriété à un autre membre. Un owner seul ne peut pas quitter le foyer ; un member peut quitter librement.
- Backend AdonisJS/Postgres complet et livré pour identity/household, fridge/receipt/settings, shopping-list/recipe (phases 1-3). Le mobile a livré identity, onboarding, frigo (liste/ajout/scan code-barres/édition), scan de ticket, liste de courses et recette IA, réglages, Home Assistant, dashboard — surface produit complète end-to-end ; polish et durcissement en cours.

## Capabilities and Constraints

- Stack : Expo (expo-router) + TanStack Query + Tamagui + better-auth (`@better-auth/expo`), monorepo pnpm avec `backend/`.
- Aucun appel direct du mobile vers un service externe (OpenFoodFacts, providers IA) — tout transite par le backend.
- Code-barres + lookup OpenFoodFacts en prefill à la création d'un produit.
- Intégration Home Assistant livrée (todo-entity-picker inclus). Nice-to-have post-MVP toujours non construit : fridge-scan (photo du frigo entier, scan actuel = code-barres unitaire), statistiques (gaspillage/catégories).
- Explicitement hors scope v1 : multi-foyer, permissions fines au-delà owner/member, partage de recettes inter-foyers. Transfert de propriété de foyer livré (Foyer + suppression de compte).

## Brand Commitments

Nom produit : "Garde-manger" (`app.json`). Aucune autre contrainte de marque figée — couleurs actuelles (#208AEF, #E6F4FE) sont un défaut de scaffold Expo, librement remplaçables.

## Evidence on Hand

- Specs de cadrage complètes : `docs/phase-0/*` (arborescence, modèle de domaine, schéma DB, endpoints HTTP) + `docs/adr/0001`-`0010`.
- Plans/specs déjà exécutés : `docs/superpowers/specs/2026-08-26-mobile-phase-1-identity-design.md`, `docs/superpowers/plans/2026-08-25-phase-1-identity-household.md`, `docs/superpowers/plans/2026-08-26-phase-2-fridge-receipt-settings.md`, `docs/superpowers/plans/2026-08-26-phase-3-shopping-list-recipe.md` (backend uniquement pour 2 et 3).
- Aucun logo, aucune démo, aucun témoignage utilisateur. Ne rien inventer de ce côté.

## Product Principles

1. Le foyer est l'unité de vérité, jamais l'utilisateur seul — chaque écran produit reflète un état partagé, pas une liste perso.
2. Minimiser la friction au moment réel d'usage (ranger les courses, ouvrir le frigo) — scan photo plutôt que saisie manuelle quand possible.
3. Rien ne part vers l'extérieur sans passer par le backend — aucune intégration tierce directe depuis le mobile.
4. Ne pas pré-câbler ce qui n'a pas d'usage v1 (pas de colonnes/écrans morts pour fridge-scan/stats/HA) tout en gardant les frontières de module ouvertes à leur ajout futur.

## Accessibility & Inclusion

Aucune exigence spécifique confirmée au-delà des standards mobiles habituels (contraste, tailles de touch target, `userInterfaceStyle: automatic` déjà en place pour le mode sombre système).
