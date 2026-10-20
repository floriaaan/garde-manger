# Conventions de clean architecture

Référence commune pour `backend/`, `mobile/` et `landing/`. Ces conventions
précisent l’[ADR-0002](adr/0002-structure-en-couches-arr.md) et s’appliquent aux
nouveaux développements comme aux corrections. L’approche est pragmatique :
préserver le comportement, corriger les frontières et réutiliser les abstractions
existantes, sans multiplier les couches ni réorganiser tout le dépôt.

## Responsabilités et dépendances

Chaque application conserve `src/{domain,application,infrastructure,presentation}`,
avec des sous-dossiers par contexte métier (`fridge`, `identity`, `recipe`, etc.).

| Emplacement | Responsabilité | Dépendances internes autorisées |
| --- | --- | --- |
| `domain/` | Entités, objets-valeurs, invariants, erreurs métier, contrats des ports | Domaine uniquement |
| `application/` | Cas d’usage, orchestration, queries et mutations frontend | Domaine et application |
| `infrastructure/` | HTTP, base de données, authentification technique, stockage, fournisseurs externes | Domaine, application et infrastructure |
| `presentation/` | Contrôleurs, DTO, validation HTTP, écrans et composants | Domaine, application et présentation |
| `providers/` | Choix des implémentations et assemblage des dépendances | Application, domaine et infrastructure |
| Points d’entrée | Routes, démarrage et installation des providers | Présentation, application et providers selon le besoin |

Le domaine n’importe ni framework, ni paquet npm, ni couche externe. Les imports
`type` suivent les mêmes frontières. Un réexport ou un helper partagé ne doit pas
servir à contourner une interdiction. Éviter les dépendances circulaires.

L’application backend ne dépend ni d’Adonis, ni de Node, ni de la configuration,
ni d’un conteneur global. Les entrées/sorties passent par des ports. Les valeurs
utiles au métier (heure courante, identifiants, configuration) sont injectées ou
transmises explicitement. Une fonction pure peut utiliser `Date` pour calculer à
partir d’une date reçue ; elle ne choisit pas elle-même l’heure courante.

## Classes et fonctions

- **Backend** : classes pour les modules, use cases, repositories, adaptateurs et
  providers. Dépendances explicites dans le constructeur, typées par les ports.
- **Frontend** : fonctions pour les composants, hooks, queries, mutations et
  utilitaires. Les modules avec état et les connecteurs HTTP/fake peuvent rester
  des classes injectées (`HttpFridgeConnector`, `FakeLandingConnector`,
  `MutationQueue`, par exemple).
- Les fonctions pures, conversions DTO, validateurs et fabriques d’assemblage
  restent des fonctions : ne pas créer une classe utilitaire sans état pour les
  envelopper. Garder les objets-valeurs et agrégats existants côté backend.

## Injection obligatoire côté backend

Les providers de chaque contexte assemblent les ports **et les use cases**.
Un contrôleur ne construit pas de use case avec `new`, même si ses ports sont
déjà injectés. Il résout l’instance depuis les bindings du provider via le
resolver de la requête, puis appelle `execute`.

```ts
// backend/providers/fridge_provider.ts
this.app.container.bind('fridge.listProducts', async (resolver) => {
  const { ListProducts } = await import('#application/fridge/list-products.use-case')
  return new ListProducts(await resolver.make('fridge.products'))
})

// Contrôleur : validation/authentification avant l’appel, DTO après l’appel.
const listProducts = await resolveBinding(ctx, 'fridge.listProducts')
const products = await listProducts.execute({ householdId: ctx.household.id })
```

La présentation utilise `resolveBinding(ctx, binding)` pour conserver les types de
`ContainerBindings` : le resolver HTTP brut d’Adonis est typé `ContainerResolver<any>`.
Ce helper délègue au resolver de la requête et préserve ses substitutions.

Déclarer chaque binding dans `ContainerBindings`, dans son provider. Utiliser le
`resolver` reçu par la fabrique pour ses dépendances : passer par le conteneur
global ferait perdre les substitutions propres à une requête.

Les use cases HTTP sont des bindings transitoires (`bind`) par défaut. Les
adaptateurs partagés sans état de requête peuvent être des singletons. Ne pas
capturer un utilisateur, un foyer ou un fournisseur IA dynamique dans un singleton.
Pour une dépendance qui varie à l’appel, injecter une fabrique du provider :
`recipe.createSuggestRecipes(householdId)` sélectionne le fournisseur pour ce
foyer à chaque invocation. Les workers assemblés dans les providers conservent
leur cycle de vie explicite.

Les use cases ne connaissent pas `HttpContext` : les identifiants authentifiés et
les données validées arrivent dans leur entrée. Les règles métier et contrôles
d’appartenance restent applicables sans HTTP. Les contrôleurs traduisent les
résultats et erreurs en réponses sans exposer les modèles Lucid.

Référence technique : [conteneur et injection AdonisJS](https://docs.adonisjs.com/guides/concepts/dependency-injection).

## Injection recommandée côté frontend

Conserver le circuit existant : `providers/create-connector.ts` choisit le
connecteur, `ConnectorProvider` le fournit, `useConnector` le récupère dans
l’application. Les composants consomment les hooks applicatifs. Les loaders SSR
reçoivent le connecteur explicitement via les options de query.

Réutiliser `defineQuery`, `defineMutation`, `useDomainQuery`,
`useHouseholdDomainQuery` et les helpers propres à chaque application. Un écran
ou une query ne doit pas importer ni construire le connecteur HTTP/fake.
L’interface du connecteur vit dans le domaine, son implémentation dans
l’infrastructure. Les fakes respectent le même contrat.

React, React Query et les hooks de cycle de vie sont autorisés dans l’application
frontend. Les composants gèrent l’affichage et les interactions ; les invariants
réutilisables et calculs métier purs vont dans le domaine. Ne pas reproduire une
validation métier différente dans chaque écran.

## Adaptateurs, contrats et nommage

- Garder les suffixes existants : `*.entity.ts`, `*.vo.ts`, `*.aggregate.ts`,
  `*.interface.ts`, `*.use-case.ts`, `*.repository.ts`, `*.mapper.ts`,
  `*.controller.ts`, `*.dto.ts`, `*.validator.ts`, `*.routes.ts`.
- Les modèles Lucid vivent dans `backend/src/infrastructure/database/` ; les
  repositories et mappers assurent leur conversion. Aucun modèle ORM dans une
  signature de use case, un DTO public ou le domaine.
- Garder le kebab-case des fichiers métier et les noms de providers Adonis
  existants en snake_case. Ne pas renommer les fichiers sans nécessité.
- Les contrats HTTP frontend restent distincts des entités backend. Ne pas
  importer un contrôleur backend depuis le mobile pour partager un type.
- Les adaptateurs prennent en charge les détails techniques : signatures
  cryptographiques, SQL, protocole HTTP, SDK fournisseur, sérialisation externe.
  Par exemple, `StripeSignatureVerifier` vit en infrastructure et reçoit `Clock`.
- Réutiliser `Result` et les erreurs métier existantes ; la présentation décide
  du statut HTTP. Préserver les chemins d’erreur, l’ordre des effets et les DTO
  lors d’une correction d’architecture.

## Logs obligatoires et contexte complet

Chaque action métier, appel HTTP et exécution de job doit produire un bilan
structuré, sur succès comme sur refus ou erreur. Ne pas dépendre de l’activation
d’un export OTLP pour disposer de logs locaux. Ne pas multiplier les logs à
chaque fonction pure : les points d’entrée et frontières techniques portent le
contexte, le domaine reste indépendant du logger concret.

Le champ `client.platform` identifie le client : `ios`, `android`, `web` (app Expo
dans le navigateur) ou `landing` (y compris son rendu serveur). Il est distinct
de `service.name`, qui désigne le service émettant le log. Les appels au backend
le transmettent via `x-client-platform` ; une valeur absente ou non reconnue
donne `unknown`. Ce champ est déclaratif, jamais une preuve d’identité ni un
critère d’autorisation. Les jobs historiques ne conservent pas cette origine ;
ne pas la déduire de leur utilisateur ou de leur trace.

Le contexte comprend, quand ils existent : service/environnement/version,
`app.operation`, use case backend, `request_id`, `trace_id`/`span_id`, `userId`,
`householdId`, entité (`entityId` backend, `entity.id` mobile), durée, statut HTTP,
`event.outcome`, code d’erreur et diagnostic structuré. Un identifiant inconnu
reste absent ou `null` : ne jamais inventer un utilisateur ou une trace. Les
identifiants déclarés par le mobile sont des diagnostics client ; seule
l’attribution pseudonymisée par le relais est attestée côté serveur.

Inclure aussi les **paramètres métier non sensibles**. Ils sont sélectionnés et
validés par liste blanche, jamais par une copie de `request.all()`, du corps ou
des arguments d’une fonction :

- `business.days`, `expiringWithinDays`, `page`, `limit`, `amount` : nombres bornés ;
- `business.isArchived`, `isFavorite`, `enabled` : booléens ;
- `business.location`, `provider`, `kind`, `platform`, `language` : enums connus ;
- `business.itemsCount`, `productIdsCount` : tailles des collections, sans contenu ;
- landing : `business.locale` (`fr` ou `en`).

Les clés ci-dessus portent toutes le préfixe `business.`. Pour ajouter un champ,
étendre la liste blanche et ses tests ; garder la politique backend/mobile
identique. Les champs manquants ne justifient pas une requête en base uniquement
pour enrichir un log.

Ne jamais journaliser mots de passe, cookies, tokens, clés API, emails, codes
d’invitation, photos, prompts, corps bruts, listes d’aliments ni résultats complets.
Le résultat est décrit par son issue et les identifiants utiles. Les erreurs
passent par le sérialiseur de diagnostics, pas par un dump de leur message brut.

### Points d’intégration

- **HTTP backend** : `traceAction` fournit le bilan métier ; le middleware de
  corrélation couvre les chemins non instrumentés, dont les refus précoces. Il
  évite de réémettre une erreur déjà enregistrée. Les sondes `/health` et le
  transport de télémétrie réussi restent exclus du bilan pour éviter le bruit.
- **Logger backend** : le mixin Pino enrichit aussi les logs des adaptateurs via
  le contexte asynchrone de la requête. Cet accès à `HttpContext` est réservé à
  l’infrastructure de logging et à la configuration, jamais aux use cases.
- **Jobs** : contexte isolé par exécution, avec foyer, auteur, identifiant, type,
  tentative et issue. Une exécution concurrente ne doit pas hériter de l’autre.
- **Mobile** : `getTelemetry()` reste la porte d’entrée applicative ; le provider
  fournit les identités depuis le cache. Chaque requête capture son contexte pour
  le conserver même si la session change avant sa réponse. Les appels HTTP
  émettent un bilan de transport ; une erreur de parsing ou un refus métier a son
  diagnostic associé. Les premiers logs attendent le branchement du provider
  dans une file bornée à 64 entrées.
- **Landing** : `withConnectorLogging` reçoit un `OperationLogger` du provider,
  pour les connecteurs réels comme fake. Les opérations publiques n’ont pas
  d’identité authentifiée ; les identifiants indisponibles restent `null`.

`info` pour un succès ou un refus attendu, `warn` pour un refus inhabituel,
`error` pour une panne technique. Une panne du logger frontend ne doit pas
transformer une opération réussie en erreur. L’export distant et son
échantillonnage restent configurables ; cela ne dispense pas d’instrumenter les
opérations. Voir aussi [le guide d’observabilité](observabilite.md).

## Exceptions pragmatiques existantes

Ces exceptions sont bornées ; elles ne rendent pas les imports entre couches libres.

- Les ports binaires backend utilisent déjà le type Node `Buffer`. Il est conservé
  pour compatibilité ; cela ne permet aucun accès disque, réseau ou crypto dans
  le domaine. Une migration vers `Uint8Array` serait un changement distinct.
- L’application mobile contient des intégrations de plateforme : notifications,
  SecureStore via `app-storage`, connectivité, liens externes et capacités natives.
  Elles restent isolées dans les modules concernés, sans dépendance du domaine
  aux SDK. Pour une nouvelle intégration substituable, privilégier un port injecté.
- La présentation peut utiliser les API du framework pour le transport : lecture
  des fichiers temporaires d’upload, requête brute, configuration d’exposition
  d’un endpoint et sérialisation. Le stockage persistant reste derrière un port.
- Certains contrôleurs font encore des lectures de ports pour enrichir les DTO,
  accéder aux images, ou du CRUD simple sur les préférences/push Web. Ils doivent
  utiliser les ports injectés ; une règle métier ou orchestration supplémentaire
  doit rejoindre un use case, jamais un accès direct à l’ORM.
- Les racines Expo/TanStack installent les providers ; les couches métier ne les
  importent pas. Les fichiers de thème et métadonnées d’app peuvent être utilisés
  par la présentation pour l’affichage.
- Les tests peuvent assembler des instances et utiliser des fakes d’infrastructure.
  Cette liberté ne s’étend pas au code de production.

## Garde-fous et revue

Les fichiers `.dependency-cruiser.cjs` contrôlent les imports entre couches,
les dépendances externes du domaine, les imports de providers et les routes
frontend. La configuration backend interdit aussi les dépendances externes de
l’application. Les cycles sont actuellement signalés en avertissement.
Ces règles ne détectent pas toute règle métier mal placée ni tout accès indirect.

Avant de livrer une modification :

1. Vérifier le sens des imports et l’emplacement de la responsabilité.
2. Vérifier que les contrôleurs obtiennent leurs use cases depuis les providers
   et que les dépendances variables restent propres à la requête ou au foyer.
3. Vérifier les consommateurs, types, DTO et chemins d’erreur touchés.
4. Écrire ou adapter les tests ciblés utiles, puis relire le diff.
5. Mettre à jour ce guide si une convention change ; ajouter un ADR pour une
   décision structurante.

Les commandes existantes `task backend:boundaries`, `task mobile:boundaries` et
`task landing:boundaries` restent disponibles, mais **ne pas les lancer
systématiquement**. La politique d’[AGENTS.md](../AGENTS.md) s’applique aussi aux
tests, lint, typechecks et builds : exécution uniquement sur demande explicite
ou nécessité réelle de diagnostic.
