# Reprise de session et bases local-first

## Diagnostic du signalement rc.4

Le mécanisme identifié dans le code est une confusion entre échec de vérification
et absence de session. `HttpFridgeConnector.getSession()` appelait `closeSession()`
pour toute erreur de Better Auth, exception ou expiration de son délai de cinq
secondes. Ce helper appelait `authClient.signOut()` puis retournait `null`.
Les layouts interprétaient ce `null` comme une déconnexion et redirigeaient vers
la connexion.

Ce comportement a été introduit par `f3f7727` et est présent en rc.4 ; il ne
s'agit pas d'une preuve qu'il a été introduit spécifiquement en rc.4.
La revalidation des queries au premier plan était installée dans `JobHost`, sous
les onglets. Elle déclenche notamment la lecture de session lors du retour dans
l'application. Une erreur temporaire sur cette lecture suffit donc à reproduire
le mécanisme de déconnexion, sans retrait du multitâche.

La dépendance verrouillée `@better-auth/expo` 1.7.1 persiste déjà cookies et cache
de session via SecureStore (`gardemanger_cookie`, `gardemanger_session_data`).
Son initialisation de `/sign-out` efface ces données **avant** la requête réseau :
une déconnexion lancée sur erreur détruit donc la session locale même si le
serveur est injoignable. Voir le [code versionné du plugin Expo](https://github.com/better-auth/better-auth/blob/v1.7.1/packages/expo/src/client.ts).
Le backend utilise PostgreSQL pour les sessions ; aucun changement de sa durée
de session ou de son stockage n'est nécessaire au correctif.

L'investigation établit ce défaut dans le code, pas la cause de l'erreur réseau
sur le téléphone de Florian. Sans capture de sa reproduction, ni panne serveur,
ni défaut spécifique du Keychain iOS ne peuvent être affirmés.

## Choix du correctif

| Situation | Résultat de lecture | Effet sur le stockage et la navigation |
| --- | --- | --- |
| Restauration en cours | Query pending | Écran d'ouverture, aucune redirection vers la connexion |
| Réponse avec session | Session | Cache en mémoire actualisé, accès normal |
| Réseau absent, timeout, erreur HTTP transitoire, lecture sécurisée impossible ou réponse malformée | Exception | Identifiants conservés ; la query conserve sa dernière donnée |
| Premier démarrage sans réponse fiable | Query error avec donnée inconnue | Écran d'ouverture avec Réessayer / Changer de serveur après six secondes |
| Réponse explicite `null` ou HTTP 401 du endpoint de session | `null` | Session invalidée, nettoyage Better Auth et accès à la connexion |
| API métier : HTTP 401 avec erreur `unauthenticated` | Cache session mis à `null` | Lecture de session en cours annulée ; nettoyage Better Auth |
| Déconnexion volontaire | Cache session mis à `null` | Queries annulées et cache du compte vidé, y compris si la requête réseau échoue |

Les erreurs HTTP 403 et 5xx ne sont pas assimilées à une révocation. Une erreur
métier nommée `unauthenticated` sans HTTP 401 ne suffit pas non plus.
Les layouts auth, onglets, onboarding et le lien d'invitation attendent une
réponse fiable lorsqu'aucune session n'a encore été restaurée.
La revalidation native au premier plan est désormais installée à la racine,
avec nettoyage du listener à son démontage, pour permettre aussi une nouvelle
tentative après un échec au démarrage. Le web garde sa gestion du focus native
au navigateur.

Aucun nouveau stockage de tokens ni changement de format n'est ajouté : les
sessions existantes restent compatibles sur iOS et Android. Le cache TanStack
est seulement en mémoire. Après arrêt du processus, le cookie sécurisé est
réutilisé par Better Auth pour interroger le serveur. Si cette interrogation
échoue, l'application propose une nouvelle tentative sans effacer le cookie.
Ce correctif ne promet pas d'accès aux données métier lors d'un démarrage hors
ligne.

Les spans `identity.get_session` distinguent `session_valid`, `session_absent`,
`session_invalid` et `session_revalidation_failed` dans `event.outcome`.
Les diagnostics d'échec conservent un code HTTP/timeout et le `request_id` via
le filtrage de télémétrie existant. Aucun cookie, token, profil utilisateur ou
contenu métier n'est ajouté aux diagnostics.

## Validation à effectuer

Les tests ont été écrits/adaptés, sans exécution conformément à `AGENTS.md`.
Ils couvrent les lectures répétées sur les branches iOS et Android, les erreurs
HTTP et réseau, le timeout, la réponse malformée, la reprise après échec, le
maintien du cache lors de revalidations et la déconnexion volontaire hors ligne.
Les tests du focus couvrent les transitions répétées et le retrait du listener.
Ces mocks ne prouvent pas la persistance réelle du Keychain/Keystore ni un arrêt
de processus.

Sur une build de développement ou de release, effectuer cette matrice sur
**iOS et Android**, avec le même compte et le même serveur :

- [ ] Connexion puis au moins cinq cycles arrière-plan / premier plan, sans nouvelle authentification.
- [ ] Fermeture puis relance, et retrait du multitâche puis relance : session restaurée avec le réseau disponible.
- [ ] Mode avion après connexion, retour au premier plan : aucune déconnexion ; retour du réseau puis revalidation réussie.
- [ ] Relance en mode avion : état réessayable ; rétablissement du réseau puis reprise sans saisir les identifiants.
- [ ] Timeout / HTTP 503 à la lecture de session : aucun nettoyage ; reprise après résolution de l'erreur.
- [ ] Révocation serveur et expiration réelle : retour à la connexion lors de la prochaine vérification fiable.
- [ ] Déconnexion explicite en ligne puis hors ligne : accès à la connexion, aucune restauration de l'ancien compte après relance.
- [ ] Connexion avec un autre compte : aucune donnée du précédent compte visible.

Les critères de recette sur appareils restent ouverts tant que cette matrice
n'a pas été exécutée. Une session déjà effacée par rc.4 nécessitera une dernière
connexion après mise à jour : le correctif ne peut pas récupérer le cookie perdu.

## Séparation pour un futur moteur local-first

Trois responsabilités restent distinctes :

1. **Session** : preuve d'authentification conservée dans le stockage sécurisé,
   revalidation distante et révocation. L'absence de réseau n'est pas une
   preuve de déconnexion ; une identité locale ne donne pas d'autorisation
   supplémentaire côté serveur.
2. **État métier local** : inventaire et liste de courses, avec un stockage
   persistant indexé par instance, compte et foyer. Ce correctif ne le crée pas.
3. **Synchronisation** : transport, reprises et résultats de mutations ; ses
   erreurs ne doivent ni supprimer les données locales ni révoquer la session.

Étapes ultérieures pour la liste de courses :

- Choisir un cache persistant adapté aux données métier (par exemple SQLite),
  versionner son schéma et définir sa rétention et sa purge/changement de compte.
- Restaurer d'abord les données locales ; afficher leur fraîcheur et les erreurs
  de synchronisation séparément de l'état de session.
- Définir un protocole de reprise : versions/cursor, suppressions explicites,
  synchronisation au premier plan et après rétablissement du réseau.
- Persister les mutations hors ligne dans une outbox, avec identifiants stables,
  idempotence serveur et statuts en attente/confirmée/refusée. Ne pas rejouer
  sous un autre compte ou foyer.
- Définir les conflits de liste partagée (quantité, libellé, coche, suppression)
  et leur résolution avant de permettre des écritures concurrentes hors ligne.
- Tester redémarrages entre écriture et envoi, doublons, révocation pendant
  synchronisation et modifications concurrentes de plusieurs appareils.

La conservation de session prépare cette séparation ; elle ne constitue pas
un moteur local-first complet.
