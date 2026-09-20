import { A, Aside, Facts, H3, LEGAL_UPDATED, P, Todo, Ul } from './legal-blocks.js'
import { LegalPage, type LegalSection } from './legal-layout.js'

const sections: LegalSection[] = [
  {
    id: 'champ',
    title: 'Champ d’application',
    body: (
      <>
        <P>
          Les présentes conditions générales de vente (CGV) concernent uniquement les offres commerciales de
          l’<strong>instance officielle</strong> de Garde-manger, proposées par l’éditeur identifié dans les{' '}
          <A href="/legal">mentions légales</A>.
        </P>
        <Aside title="Pas de vente pour le logiciel auto-hébergé">
          <P>
            Le logiciel open source est fourni sous licence MIT et n’est pas vendu par l’éditeur. Les éventuelles
            conditions commerciales d’une instance auto-hébergée sont fixées par son administrateur.
          </P>
        </Aside>
        <P>
          L’offre payante n’est pas encore ouverte : ces CGV s’appliqueront à compter de son ouverture.
        </P>
      </>
    ),
  },
  {
    id: 'offres',
    title: 'Description des offres',
    body: (
      <Ul>
        <li>
          <strong>Gratuit</strong> : inventaire, dates de péremption, liste de courses partagée et 5 utilisations de
          l’IA par mois.
        </li>
        <li>
          <strong>Abonnement Garde-manger</strong> : scan de tickets et du frigo, recettes avec ce qui reste. Un seul
          abonnement pour tout le foyer, avec 150 utilisations de l’IA par mois.
        </li>
      </Ul>
    ),
  },
  {
    id: 'prix',
    title: 'Prix et TVA',
    body: (
      <>
        <Facts
          items={[
            ['Abonnement Garde-manger', '0,99 € TTC par mois'],
            ['TVA', 'Non assujetti à la TVA'],
          ]}
        />
        <P>
          Le prix affiché dans l’application au moment de la souscription fait foi. Toute modification du prix est notifiée au moins 30 jours à l’avance ; l’abonné peut résilier avant son entrée en vigueur.
        </P>
      </>
    ),
  },
  {
    id: 'paiement',
    title: 'Paiement, abonnement et renouvellement',
    body: (
      <>
        <P>
          L’abonnement est souscrit depuis l’application, sur une page de paiement sécurisée hébergée par Stripe, qui
          traite le paiement. L’éditeur ne stocke aucune donnée de carte bancaire. Aucun achat n’est effectué via l’App
          Store ou Google Play.
        </P>
        <P>
          L’abonnement est mensuel et se renouvelle tacitement chaque mois jusqu’à sa résiliation.
        </P>
        <P>
          Aucune période d’essai n’est proposée en dehors de l’offre gratuite.
        </P>
      </>
    ),
  },
  {
    id: 'modification',
    title: 'Modification d’une offre',
    body: (
      <P>
        Les offres, prix et quotas peuvent évoluer. Toute modification est notifiée au moins 30 jours à l’avance ; l’abonné peut résilier avant son entrée en vigueur.
      </P>
    ),
  },
  {
    id: 'resiliation',
    title: 'Résiliation',
    body: (
      <>
        <P>
          L’abonnement peut être résilié à tout moment, avec effet à la fin de la période mensuelle en cours. La résiliation se fait depuis l’application (Réglages, Abonnement, Gérer l’abonnement), par la personne qui a souscrit, sur le portail Stripe.
        </P>
        <P>
          Le sort des données du foyer après la résiliation est décrit dans la <A href="/privacy#conservation">politique de confidentialité</A>.
        </P>
      </>
    ),
  },
  {
    id: 'remboursement',
    title: 'Remboursement',
    body: (
      <P>
        Une période mensuelle entamée n’est pas remboursée au prorata en cas de résiliation. En cas de défaut avéré du service, un remboursement peut être demandé par email à <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>.
      </P>
    ),
  },
  {
    id: 'retractation',
    title: 'Droit de rétractation',
    body: (
      <>
        <P>
          Le consommateur dispose en principe d’un délai de 14 jours pour se rétracter d’un contrat conclu à distance.
          Ce droit connaît des exceptions, notamment lorsque l’exécution d’un service ou la fourniture d’un contenu
          numérique commence avec l’accord exprès du consommateur.
        </P>
        <P>
          L’abonnement donne accès immédiatement au service. En souscrivant, le consommateur demande l’exécution immédiate du service et reconnaît perdre son droit de rétractation une fois le service pleinement exécuté.
        </P>
      </>
    ),
  },
  {
    id: 'garanties',
    title: 'Garanties légales',
    body: (
      <P>
        Le consommateur bénéficie de la garantie légale de conformité applicable aux contenus et services numériques,
        ainsi que de la garantie des vices cachés, indépendamment de toute garantie commerciale.{' '}
        Aucune garantie commerciale n’est proposée.
      </P>
    ),
  },
  {
    id: 'mediation',
    title: 'Médiation de la consommation et litiges',
    body: (
      <>
        <P>
          En cas de litige, le consommateur s’adresse d’abord à l’éditeur : <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>.
        </P>
        <P>
          À défaut de solution amiable, le consommateur peut recourir gratuitement à un médiateur de la consommation :
        </P>
        <Facts
          items={[
            ['Médiateur', <Todo key="m">NOM DU MÉDIATEUR</Todo>],
            ['Adresse', <Todo key="a">ADRESSE POSTALE</Todo>],
            ['Site web', <Todo key="s">SITE DU MÉDIATEUR</Todo>],
          ]}
        />
        <H3>Droit applicable</H3>
        <P>
          Les présentes CGV sont soumises au droit français ; les tribunaux français sont compétents, sous réserve des dispositions impératives applicables au consommateur.
        </P>
      </>
    ),
  },
]

export function SalesTermsPage() {
  return (
    <LegalPage
      title="Conditions générales de vente"
      intro="Les offres, les prix et l’abonnement de l’instance officielle Garde-manger."
      updated={LEGAL_UPDATED}
      applies="official"
      sections={sections}
    />
  )
}
