# Roadmap post-MVP

**Rédigé le :** 2026-09-13

## État de départ

Le scope MVP v1 de `docs/phase-0/00-overview-et-points-a-valider.md` est livré : produits
+ péremption, code-barres/OpenFoodFacts, receipt-scan IA, recettes IA, liste de courses,
foyer partagé, auth PocketID + email. Depuis, en plus du scope initial : synchronisation
Home Assistant de la liste de courses, observabilité OTel (backend + mobile), onboarding
pré-auth.

Des trois nice-to-have listés en phase 0 (fridge-scan, statistiques, Home Assistant),
seule l'intégration HA est faite, et encore partiellement (todo list, pas de capteurs).

Ce document liste les chantiers suivants, dans l'ordre recommandé. Chaque chantier
suit le cycle habituel spec → plan → implémentation (`docs/superpowers/`).

---

## 1. Tracer la sortie des produits (consommé / jeté) — **implémenté (2026-09-13)**

Branche : `feature/waste-stats`.

**Pourquoi d'abord :** les statistiques de gaspillage sont impossibles sans cette
donnée, et chaque jour sans elle est perdu définitivement. Aujourd'hui un produit
quitte le garde-manger uniquement par `DELETE` (`delete-product.use-case.ts`, retrait
multiple dans `fridge-list-screen.tsx`, `cook-recipe.use-case.ts`) : on ne sait pas s'il
a été mangé ou jeté. ADR-0010 avait volontairement reporté ces colonnes à ce moment-là.

**Idée :** chaque sortie de produit est qualifiée (consommé / jeté / erreur de saisie)
et journalisée avec un instantané du produit (nom, catégorie, quantité, prix,
péremption). `cook-recipe` qualifie automatiquement en « consommé ».

Le journal (`product_outcome`, ADR-0012) écrit et se lit déjà de bout en bout :
`POST /api/products/:id/outcomes`, `CookRecipe` qui qualifie automatiquement en
« consommé », et côté mobile la sheet Consommé/Jeté/Erreur de saisie sur le détail
produit et la sélection multiple.

**Écran de statistiques — implémenté (2026-09-14) :** € et nombre de produits jetés
sur une période (7j/30j/tout), évolution jeté vs consommé par semaine, part des repas
cuisinés à partir d'une recette. Le classement par catégorie reste explicitement hors
scope de cette v1 (voir la spec dédiée).

Spec détaillée : `docs/superpowers/specs/2026-09-13-product-outcome-design.md`
(journal) et `docs/superpowers/specs/2026-09-14-waste-stats-design.md` (écran de
statistiques).
Plan d'implémentation : `docs/superpowers/plans/2026-09-13-product-outcome.md`.

---

## 2. Notifications de péremption

**Pourquoi :** c'est la fonctionnalité qui fait revenir dans l'app au quotidien. Le
dashboard montre ce qui expire, mais seulement si on l'ouvre. Aucune notification
n'existe aujourd'hui (`expo-notifications` n'est pas installé).

**Déjà en place :** `get-expiring-soon-products.use-case.ts` et
`GET /api/products/expiring-soon`.

**Deux approches :**

- **V0 — notifications locales.** Le mobile programme des notifications locales à partir
  des dates de péremption à chaque synchro de la liste produits. Aucun backend à
  toucher. Limites : seul l'appareil qui a ouvert l'app récemment est prévenu, et un
  produit retiré par un autre membre du foyer peut encore déclencher une notification
  périmée tant que l'app n'a pas resynchronisé.
- **V1 — push serveur.** Table `push_token` (par utilisateur et appareil), job planifié
  côté backend (un digest quotidien par foyer : « 3 produits expirent demain »), envoi
  via Expo Push API. Nécessite un scheduler dans AdonisJS et la gestion des tokens
  invalides.

**Décisions ouvertes :** heure du digest (fixe ou par membre), seuil (J-1, J-3),
opt-out par membre, un digest par foyer ou par membre.

**Synergie :** la notification peut ouvrir directement une recette qui sauve le produit
(voir point 6).

---

## 3. Mise en production

**Pourquoi :** sans vrais utilisateurs, les statistiques du point 1 n'ont rien à
montrer et les notifications du point 2 ne servent à personne.

**Déjà en place :** `compose.yml` (backend + Postgres + collector OTel), `eas.json`
(profils development / preview / production), CI GitHub Actions (lint, typecheck,
tests, boundaries, build backend).

**Manque :**

- Build et soumission EAS depuis la CI (au moins `preview` sur merge dans `main`).
- Mises à jour OTA (`expo-updates`) pour livrer les correctifs JS sans passer par les
  stores.
- Cible de déploiement du backend et procédure documentée (image Docker, migrations au
  démarrage, secrets).
- Sauvegardes Postgres automatisées, avec une restauration testée au moins une fois.
- Politique de rétention des images de tickets et de produits (stockage qui grossit
  sans limite).

---

## 4. Fridge-scan photo

**Pourquoi :** remplir le garde-manger reste la friction principale. Le receipt-scan
couvre les courses, pas ce qui est déjà dans le frigo au premier lancement.

**Approche prévue (ADR-0010) :** même pattern de port que le receipt-scan
(`FridgeScanExtractionPort`), extraction IA multimodale en un seul appel (ADR-0006),
écran de relecture identique à l'import de ticket avant création des produits. Aucun
changement de schéma requis sur `product`.

**Livré (2026-09-20) :** le scan tourne en tâche asynchrone — une seule tâche pour les
N photos, résultat conservé dans un brouillon à relire (ADR-0016, ADR-0017). Les
notifications push à la fin d'une tâche restent en V2 : la V1 se limite à l'in-app
(toasts, pastille, écran Tâches).

**Points d'attention :** sans ticket, pas de prix ni de date d'achat — la date de
péremption doit être estimée par catégorie comme pour l'import de ticket
(`056df01`), et marquée comme estimée. Les quantités sur photo sont peu fiables : la
relecture doit rendre la correction rapide.

---

## 5. Capteurs Home Assistant

**Pourquoi :** la phase 0 prévoyait « capteurs + todo ». Seule la liste de courses est
synchronisée aujourd'hui.

**Idée :** exposer au moins un capteur « produits qui expirent bientôt » (nombre +
attributs avec la liste), et éventuellement « produits dépassés ». Permet des
automatisations côté HA (annonce vocale, lampe, notification HA) sans dépendre des
notifications de l'app.

**Approche :** réutiliser la connexion `home-assistant_link` existante et pousser l'état
via l'API REST de HA (`POST /api/states/sensor.fridge_ai_expiring`) à chaque changement
de produit ou à intervalle régulier — ou, inversement, exposer un endpoint lu par une
intégration HACS. À trancher dans la spec (le push réutilise le client HTTP déjà
chiffré et testé).

---

## 6. Recettes anti-gaspi poussées

**Pourquoi :** le lien produit → recette existe déjà côté mobile
(`pantry-match.ts`, section « Ce soir »), mais il faut ouvrir l'onglet Recettes pour le
voir.

**Idée :** depuis la notification de péremption (point 2) ou depuis le détail d'un
produit qui expire, proposer directement « Cuisiner avec » : recettes existantes qui le
sauvent, sinon génération IA ciblée sur ce produit. Avec le point 1, `cook-recipe`
permet ensuite de mesurer la part du gaspillage évitée grâce aux recettes.
