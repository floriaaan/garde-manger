import { A, Aside, H3, LEGAL_UPDATED, P, REPOSITORY_URL, Todo, Ul } from './legal-blocks.js'
import { LegalPage, type LegalSection } from './legal-layout.js'

const sections: LegalSection[] = [
  {
    id: 'objet',
    title: 'Objet et périmètre',
    body: (
      <>
        <P>
          Les présentes conditions générales d’utilisation (CGU) encadrent l’utilisation du service Garde-manger
          exploité par l’éditeur : l’<strong>instance officielle</strong>, accessible depuis l’application mobile.
          Garde-manger permet à un foyer de tenir l’inventaire partagé de son frigo, de suivre les dates de péremption,
          de gérer une liste de courses et d’obtenir des suggestions de recettes.
        </P>
        <Aside title="Logiciel open source et instances auto-hébergées">
          <P>
            Ces CGU ne s’imposent pas aux personnes qui téléchargent et installent le logiciel sur leur propre
            infrastructure. Le logiciel est régi par sa <A href={`${REPOSITORY_URL}/blob/main/LICENSE`}>licence MIT</A>.
            Les instances auto-hébergées sont opérées par leurs administrateurs, qui fixent leurs propres conditions.
          </P>
        </Aside>
        <P>
          L’identité de l’éditeur figure dans les <A href="/legal">mentions légales</A>. Les conditions financières de
          l’abonnement sont dans les <A href="/cgv">conditions générales de vente</A>.
        </P>
      </>
    ),
  },
  {
    id: 'acces',
    title: 'Accès au service',
    body: (
      <>
        <P>
          Le service est accessible via l’application mobile (iOS et Android). L’utilisateur supporte ses propres frais
          d’accès (appareil, connexion internet).
        </P>
        <P>
          L’offre gratuite donne accès à l’inventaire, aux dates de péremption et à la liste de courses partagée, avec
          un nombre limité d’utilisations de l’IA par mois. Les fonctions d’IA supplémentaires relèvent de
          l’abonnement décrit dans les CGV.
        </P>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Création et gestion du compte',
    body: (
      <>
        <P>
          L’utilisation du service suppose un compte, créé par email et mot de passe ou via une connexion sociale.
          L’utilisateur fournit des informations exactes et les tient à jour. Les utilisateurs rejoignent un foyer
          partagé avec un code d’invitation.
        </P>
        <P>
          Un compte est personnel. Les membres d’un même foyer voient et modifient le garde-manger commun : chacun est
          responsable des contenus qu’il y ajoute.
        </P>
        <P>
          Le service est réservé aux personnes de 15 ans et plus. En dessous, l’accord d’un parent ou tuteur est requis.
        </P>
      </>
    ),
  },
  {
    id: 'securite',
    title: 'Sécurité du compte',
    body: (
      <P>
        L’utilisateur garde ses identifiants confidentiels et prévient l’éditeur (
        <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>) s’il soupçonne un usage non autorisé de son compte. Les actions réalisées avec
        ses identifiants lui sont attribuées jusqu’à ce signalement.
      </P>
    ),
  },
  {
    id: 'responsabilites-utilisateur',
    title: 'Responsabilités et utilisation acceptable',
    body: (
      <>
        <P>L’utilisateur s’engage à utiliser le service conformément à la loi et aux présentes CGU. Il est interdit de :</P>
        <Ul>
          <li>tenter d’accéder à des comptes, foyers ou données qui ne sont pas les siens ;</li>
          <li>perturber le fonctionnement du service, contourner ses limites d’usage ou en automatiser l’accès de façon abusive ;</li>
          <li>importer des contenus illicites ou portant atteinte aux droits de tiers ;</li>
          <li>revendre l’accès au service ou l’utiliser à des fins contraires à son objet.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'contenu',
    title: 'Contenu importé et généré',
    body: (
      <>
        <P>
          L’utilisateur reste titulaire des contenus qu’il importe (produits, tickets de caisse, photos, listes). Il
          accorde à l’éditeur le droit de les héberger et de les traiter pour fournir le service.
        </P>
        <P>
          Les fonctions d’IA analysent les photos de tickets ou du frigo et proposent des recettes. Ces résultats sont
          indicatifs et peuvent contenir des erreurs : l’utilisateur les vérifie, notamment les dates de péremption et
          les informations d’allergènes, avant de s’y fier.
        </P>
      </>
    ),
  },
  {
    id: 'disponibilite',
    title: 'Disponibilité et maintenance',
    body: (
      <P>
        L’éditeur s’efforce de maintenir le service accessible mais n’est pas tenu à une disponibilité continue. Le
        service peut être interrompu pour maintenance, mise à jour ou incident, et l’éditeur cherche à limiter ces
        interruptions. Aucun engagement de disponibilité n’est pris à ce jour.
      </P>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension ou suppression d’un compte',
    body: (
      <P>
        L’éditeur peut suspendre ou supprimer un compte en cas de manquement aux présentes CGU. L’utilisateur est prévenu par email et dispose de 7 jours pour régulariser, sauf manquement grave nécessitant une suspension immédiate. Il peut contester la mesure en écrivant à <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>.
      </P>
    ),
  },
  {
    id: 'propriete-intellectuelle',
    title: 'Propriété intellectuelle',
    body: (
      <P>
        Le service, sa marque et ses contenus éditoriaux restent la propriété de l’éditeur ou de ses concédants. Le
        code du logiciel est publié sous <A href={`${REPOSITORY_URL}/blob/main/LICENSE`}>licence MIT</A> : cette
        licence, et non les présentes CGU, définit les droits sur le code.
      </P>
    ),
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    body: (
      <>
        <P>
          L’éditeur répond des dommages dans les limites prévues par la loi. Il ne garantit pas l’exactitude des
          suggestions produites par l’IA ni des informations saisies par les utilisateurs, et n’est pas responsable de
          l’usage qui en est fait, notamment en matière de conservation ou de sécurité des aliments.
        </P>
      </>
    ),
  },
  {
    id: 'services-tiers',
    title: 'Liens et services tiers',
    body: (
      <P>
        Le service peut renvoyer vers des services tiers (boutiques d’applications, GitHub, connexion sociale,
        Home Assistant…) dont l’éditeur ne contrôle ni le contenu ni les conditions. Leur usage relève de leurs propres
        conditions.
      </P>
    ),
  },
  {
    id: 'evolution',
    title: 'Évolution du service et des CGU',
    body: (
      <P>
        Le service et les présentes CGU peuvent évoluer. Les modifications sont notifiées au moins 30 jours avant leur entrée en vigueur ; l’utilisateur qui les refuse peut supprimer son compte.
      </P>
    ),
  },
  {
    id: 'resiliation',
    title: 'Résiliation',
    body: (
      <>
        <P>
          L’utilisateur peut cesser d’utiliser le service et demander la suppression de son compte à tout moment.
          La résiliation d’un abonnement est décrite dans les <A href="/cgv#resiliation">CGV</A>.
        </P>
        <P>
          Pour supprimer son compte, l’utilisateur écrit à <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>.
        </P>
      </>
    ),
  },
  {
    id: 'droit-applicable',
    title: 'Droit applicable et litiges',
    body: (
      <>
        <P>
          Les présentes CGU sont soumises au droit français. En cas de litige, l’utilisateur peut
          contacter l’éditeur pour rechercher une solution amiable.
        </P>
        <P>
          Le consommateur peut recourir à un médiateur de la consommation, dont les coordonnées figurent dans les{' '}
          <A href="/cgv#mediation">CGV</A>. À défaut d’accord amiable, les tribunaux français sont compétents. Le
          consommateur conserve le bénéfice des dispositions impératives applicables dans son pays de résidence.
        </P>
        <H3>Une question sur ces conditions ?</H3>
        <P>
          Écrivez à <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>.
        </P>
      </>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalPage
      title="Conditions générales d’utilisation"
      intro="Les règles d’utilisation du service Garde-manger officiel. Elles ne concernent pas le logiciel installé sur un serveur tiers."
      updated={LEGAL_UPDATED}
      applies="official"
      sections={sections}
    />
  )
}
