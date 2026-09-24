# Notes pour l'App Review

À coller dans App Store Connect > *App Review Information*. Les notes sont en anglais :
l'équipe de review les lit plus vite.

## Compte de démonstration

| Champ | Valeur |
|---|---|
| Sign-in required | Oui |
| User name | valeur de `REVIEW_ACCOUNT_EMAIL` sur le serveur officiel |
| Password | valeur de `REVIEW_ACCOUNT_PASSWORD` sur le serveur officiel |

Préparer le compte avant chaque soumission, sur le serveur officiel
(`https://api-gardemanger.floriaaan.fr`) :

```bash
# backend/.env du serveur officiel
REVIEW_ACCOUNT_EMAIL=review@gardemanger.floriaaan.fr
REVIEW_ACCOUNT_PASSWORD=<mot de passe long, généré>

node ace seed:review-account
```

La commande (`backend/commands/seed_review_account.ts`) :

- crée l'utilisateur « Camille Martin » ou remet son mot de passe à la valeur de l'env ;
- crée le foyer « Maison Martin » s'il n'existe pas ;
- remplace son contenu par un jeu de données daté par rapport au jour même : 21 produits
  (dont plusieurs qui périment dans 1 à 3 jours et un déjà périmé), 8 produits
  consommés ou jetés dans l'historique, 5 articles sur la liste de courses ;
- affiche l'id du foyer, à ajouter une fois à `AI_QUOTA_EXEMPT_HOUSEHOLD_IDS`, puis
  redémarrer le backend. Le foyer n'a alors plus de plafond d'appels IA : le reviewer
  peut scanner et générer des recettes sans tomber sur le quota gratuit.

Relancer la commande juste avant chaque soumission pour que les dates restent
pertinentes. Elle est idempotente. Elle refuse de tourner si `DISABLE_PASSWORD_LOGIN`
est actif : le reviewer se connecte par e-mail et mot de passe.

## Texte des notes (anglais)

```
Garde-manger is a shared household pantry: it tracks what is in the fridge, warns
before food expires and suggests recipes that use up what is about to expire.

SIGN-IN
1. On first launch, swipe through the welcome pages (or tap "Passer").
2. On "Choisis ton serveur", keep "Garde-manger officiel" selected and tap
   "Utiliser ce serveur".
3. Sign in with the demo account above (email + password).
The demo household is pre-filled with products, some of them expiring within the next
days, a consumption history and a shopping list.

CAMERA
The camera is used only when the user taps a scan action:
- scan a product barcode (Scan tab);
- scan a grocery receipt to add every item at once (Scan tab > receipt);
- take a photo of the fridge to inventory it;
- scan a household invitation QR code.
Photos can also be picked from the library instead. Receipt and fridge photos are
sent to our server for product extraction; the receipt image is kept with the
receipt until the user deletes it or the account.

NOTIFICATIONS
Optional expiry reminders. Permission is requested from Settings > Notifications,
never at launch.

SELF-HOSTING
The app can also connect to a self-hosted server ("Auto-hébergé"). This is optional;
review can be done entirely on the official server. There are no purchases in the iOS
app.

ACCOUNT DELETION
Settings > Compte > "Supprimer le compte". Deletion is immediate and removes the
user's data; a household left without members is deleted with it.

CONTACT
garde-manger@floriaaan.fr
```

## À vérifier avant de coller

- Le parcours de connexion ci-dessus correspond à la build soumise (libellés
  « Passer », « Utiliser ce serveur », « Compte »).
- La phrase sur la conservation des images reprend la page /privacy (images de tickets
  gardées jusqu'à leur suppression ou celle du compte). La garder alignée si la
  politique change.
- La suppression d'un foyer sans membre correspond bien au hook `beforeDelete` du
  backend.
