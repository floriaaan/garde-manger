# Fraîcheur du cache et revalidation (#83)

Le moteur local-first restaure le cache persistant avant de monter les écrans.
TanStack sert immédiatement la dernière réponse disponible. Sa fraîcheur
est définie dans `mobile/src/application/shared/query-freshness.ts` et appliquée
par les deux hooks de lecture partagés, y compris aux détails et listes filtrées.

| Domaine | Fraîcheur après la dernière écriture réussie du cache |
| --- | --- |
| Inventaire (listes et détails), liste de courses | 30 secondes |
| Jobs | 2 secondes ; polling existant de 2 secondes uniquement pendant un job actif |
| Brouillons de scan (listes et détails) | 30 secondes |
| Foyer, configuration IA et liaison Home Assistant | 1 minute |
| Recettes, tickets (listes et détails), statistiques, rappels et informations d’instance | 5 minutes |
| Catalogue produit par code-barres | 24 heures ; recherche manuelle existante conservée |
| Session et domaines non spécifiés | Immédiatement périmés ; contrôle de session existant conservé |

Ces délais limitent les lectures automatiques, pas les autorisations du serveur.
Les mutations continuent d’invalider leurs queries : une invalidation ou un
rafraîchissement manuel passe outre le délai. Les options explicites d’un appelant
restent prioritaires.

## Déclencheurs et échecs

- Au montage, au retour au premier plan ou au retour du réseau, TanStack ne
  revalide que les queries observées et périmées. Les queries fraîches ne lancent
  pas de nouvelle requête. Les observateurs d’une même clé partagent la requête
  en cours ; aucune invalidation globale n’est ajoutée au retour dans l’app.
- Sur iOS/Android, `AppState` pilote le focus et `expo-network` pilote
  `onlineManager` via le hook `useConnectivity` déjà installé à la racine pour
  le bandeau réseau, sans listener supplémentaire. La simulation debug reste
  visuelle et ne change pas les requêtes. Un réseau connecté reste utilisable
  même sans Internet public (instance auto-hébergée sur un LAN). Les états inconnus conservent la dernière
  connectivité connue. La lecture initiale ne peut pas écraser un événement plus
  récent ; les listeners sont retirés au démontage. Le web conserve les événements
  natifs du navigateur.
- Hors ligne détecté, les queries restent en pause avec leurs données disponibles.
  Une connexion à un réseau ne garantit pas que le serveur est joignable : les
  erreurs de transport suivent le mécanisme de retry TanStack existant.
- Un échec de revalidation conserve la donnée et son horodatage de succès. Les
  vues d’inventaire, recettes, tickets, tableau de bord et statistiques utilisent
  `isLoadingError` pour réserver leur écran bloquant à une lecture sans donnée.
  Une liste vide déjà connue reste une donnée utilisable. L’erreur de refresh
  reste consultable via `error`/`isRefetchError` ; les alertes existantes qui ne
  masquent pas les données restent disponibles.
- La révocation de session et la déconnexion volontaire gardent leurs règles de
  purge existantes. La fraîcheur du cache ne change pas ces règles.

## Rétention et portée

`staleTime` ne supprime pas une donnée périmée. Le moteur de #82 conserve les
queries persistées (session, foyer, inventaire, statistiques et courses) avec
`gcTime: Infinity` et restaure leurs `dataUpdatedAt` originaux. La restauration
ne rajeunit donc pas les données : seules celles dont le délai de fraîcheur est
dépassé déclenchent une lecture distante au montage. Un refresh en échec ne
modifie pas cet horodatage et les dernières données restent persistables, sans
payload d’erreur.

Les autres domaines utilisent le cache mémoire existant (5 minutes après le
dernier observateur) ; leur délai de fraîcheur ne les ajoute pas à l’allowlist
persistée. Le format de snapshot et ses règles de purge par serveur/compte/foyer
restent ceux de #82. Le rafraîchissement se fait en arrière-plan de l’interface,
sans tâche OS ni polling métier supplémentaire. Voir aussi
[la politique du cache offline](../mobile/docs/offline-cache.md).

## Couverture écrite

- `query-freshness.test.tsx` : règles par domaine, cache servi avant résolution,
  conservation après échec (y compris liste vide), pause hors ligne,
  reprise/reconnexion contrôlées, déduplication, override et invalidation.
- `use-connectivity.test.tsx` : connectivité partagée avec les queries,
  iOS/Android, événements répétés, LAN, état inconnu, résultat tardif, nettoyage,
  simulation uniquement visuelle et comportement web.
- `offline-cache.test.ts` : fraîcheur au cold start d’après les timestamps
  persistés, conservation des données et de leur âge après un refresh en échec
  puis un nouveau redémarrage.
- `fridge-list-screen.test.tsx` : les produits restent visibles pendant et après
  un rafraîchissement en échec.

Tests écrits sans exécution, conformément à `AGENTS.md`. La recette réelle sur
appareils (mode avion, reprise, serveur temporairement indisponible) reste à faire.
