import { A, Aside, Facts, H3, LEGAL_UPDATED, P, REPOSITORY_URL, Ul } from './legal-blocks.js'
import { LegalPage, type LegalSection } from './legal-layout.js'

const sections: LegalSection[] = [
  {
    id: 'responsable',
    title: 'Responsable du traitement',
    body: (
      <>
        <P>
          Cette politique concerne l’<strong>instance officielle</strong> de Garde-manger. Le responsable du traitement
          est l’éditeur du service, identifié dans les <A href="/legal">mentions légales</A> :{' '}
          Florian Leroux, Rouen, France.
        </P>
        <P>
          Elle ne concerne pas les instances auto-hébergées : voir la section « Instances auto-hébergées » ci-dessous.
        </P>
      </>
    ),
  },
  {
    id: 'donnees',
    title: 'Données collectées',
    body: (
      <>
        <H3>À la création d’un compte</H3>
        <Ul>
          <li>adresse email, nom et éventuelle image de profil ;</li>
          <li>mot de passe (conservé sous forme non lisible) ou identifiant de la connexion sociale utilisée ;</li>
          <li>rattachement à un foyer, rôle et code d’invitation.</li>
        </Ul>
        <H3>Liées à l’utilisation du service</H3>
        <Ul>
          <li>produits du garde-manger (noms, quantités, dates de péremption, prix), listes de courses et recettes ;</li>
          <li>tickets de caisse scannés : magasin, date, montant, nombre d’articles et, le cas échéant, l’image du ticket ;</li>
          <li>photos du frigo ou des tickets envoyées pour analyse par l’IA ;</li>
          <li>consommation de l’IA du foyer (nombre d’utilisations) ;</li>
          <li>
            données techniques de connexion (adresse IP, journaux).
          </li>
        </Ul>
        <H3>Liées à la facturation</H3>
        <Ul>
          <li>statut et référence de l’abonnement du foyer, transmis par le prestataire de paiement.</li>
          <li>L’éditeur ne conserve aucune donnée de carte bancaire.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'finalites',
    title: 'Finalités et bases légales',
    body: (
      <>
        <Ul>
          <li>
            <strong>Fournir le service</strong> (compte, foyer partagé, inventaire, scan, recettes) : exécution du
            contrat.
          </li>
          <li>
            <strong>Gérer l’abonnement et la facturation</strong> : exécution du contrat et obligations légales.
          </li>
          <li>
            <strong>Sécuriser le service</strong> et prévenir les abus : intérêt légitime.
          </li>
        </Ul>
      </>
    ),
  },
  {
    id: 'conservation',
    title: 'Durées de conservation',
    body: (
      <>
        <Facts
          items={[
            ['Compte et données du foyer', 'Jusqu’à la suppression du compte, puis 30 jours au plus'],
            ['Images de tickets', 'Jusqu’à leur suppression ou celle du compte'],
            ['Données de facturation', '10 ans (obligation comptable)'],
            ['Journaux techniques', '12 mois au plus'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'destinataires',
    title: 'Destinataires et sous-traitants',
    body: (
      <>
        <P>
          Les données sont accessibles à l’éditeur et, dans le foyer, aux autres membres pour ce qui concerne le
          garde-manger partagé. Elles peuvent être traitées par les prestataires suivants :
        </P>
        <H3>Hébergement</H3>
        <P>
          L’instance est hébergée en France, à Rouen, sur l’infrastructure de l’éditeur : aucun hébergeur tiers n’intervient.
        </P>
        <H3>Prestataire de paiement</H3>
        <P>
          Les abonnements sont traités par Stripe, qui reçoit l’identifiant du foyer et de l’utilisateur pour rattacher
          l’abonnement, ainsi que l’adresse email et les données de paiement saisies sur sa page sécurisée. L’éditeur ne
          reçoit ni ne stocke aucune donnée de carte bancaire.
        </P>
        <H3>Fournisseur d’IA</H3>
        <P>
          Les fonctions d’IA s’appuient sur un modèle Ollama exécuté sur l’infrastructure de l’éditeur : les photos et
          textes soumis ne sont envoyés à aucun fournisseur d’IA tiers.
        </P>
        <H3>Connexion sociale</H3>
        <P>
          La connexion sociale passe par Google et PocketID, qui reçoivent les informations nécessaires à l’authentification.
        </P>
      </>
    ),
  },
  {
    id: 'transferts',
    title: 'Transferts hors Union européenne',
    body: (
      <P>
        L’éditeur n’effectue pas lui-même de transfert de données hors de l’Union européenne. Les prestataires de connexion et de paiement relèvent de leurs propres politiques de confidentialité.
      </P>
    ),
  },
  {
    id: 'droits',
    title: 'Vos droits',
    body: (
      <>
        <P>Vous disposez des droits suivants sur vos données personnelles :</P>
        <Ul>
          <li>accès, rectification et effacement ;</li>
          <li>limitation et opposition au traitement ;</li>
          <li>portabilité des données que vous avez fournies ;</li>
          <li>retrait du consentement lorsque le traitement repose sur celui-ci ;</li>
          <li>définition de directives sur le sort de vos données après votre décès.</li>
        </Ul>
        <P>
          Vous pouvez aussi introduire une réclamation auprès de la CNIL (<A href="https://www.cnil.fr">cnil.fr</A>).
        </P>
      </>
    ),
  },
  {
    id: 'exercice-droits',
    title: 'Exercer vos droits et nous contacter',
    body: (
      <>
        <P>
          Pour exercer vos droits ou poser une question sur vos données, écrivez à <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>
          {' '}(aucun délégué à la protection des données n’est désigné). Une réponse vous est apportée dans le
          délai d’un mois prévu par le RGPD. Une pièce d’identité peut être demandée en cas de doute sur votre identité.
        </P>
      </>
    ),
  },
  {
    id: 'mineurs',
    title: 'Utilisateurs mineurs',
    body: (
      <P>
        Le service est réservé aux personnes de 15 ans et plus. En dessous, l’accord d’un parent ou tuteur est requis.
      </P>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies et traceurs',
    body: (
      <>
        <P>
          Le code de ce site ne dépose pas de cookie et n’intègre pas d’outil de mesure d’audience ou de publicité.
          Pour afficher les statistiques de la page d’accueil, votre navigateur interroge l’instance officielle et
          l’API publique de GitHub : ces services reçoivent votre adresse IP comme pour toute requête web.
        </P>
        <P>
         Aucun cookie ni traceur n’est utilisé par le service.
        </P>
      </>
    ),
  },
  {
    id: 'auto-heberge',
    title: 'Instances auto-hébergées',
    body: (
      <>
        <Aside title="Une instance auto-hébergée n’est pas l’instance officielle">
          <Ul>
            <li>
              L’éditeur du logiciel n’est pas nécessairement le responsable du traitement des données d’une instance
              auto-hébergée.
            </li>
            <li>
              L’administrateur de l’instance décide des traitements réalisés sur son instance : hébergement, IA
              utilisée, conservation, contact.
            </li>
            <li>
              La présente politique ne doit pas être considérée comme applicable par défaut à une instance auto-hébergée.
            </li>
          </Ul>
        </Aside>
        <P>
          Le code du logiciel est public : <A href={REPOSITORY_URL}>consultez le dépôt</A>. Pour connaître le traitement
          de vos données sur une instance tierce, adressez-vous à son administrateur.
        </P>
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Quelles données personnelles l’instance officielle Garde-manger traite, pourquoi, et comment exercer vos droits."
      updated={LEGAL_UPDATED}
      applies="official"
      sections={sections}
    />
  )
}
