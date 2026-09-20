import { A, Aside, Facts, LEGAL_UPDATED, P, REPOSITORY_URL } from './legal-blocks.js'
import { LegalPage, type LegalSection } from './legal-layout.js'

const sections: LegalSection[] = [
  {
    id: 'editeur',
    title: 'Éditeur de l’instance officielle',
    body: (
      <>
        <P>Le service officiel Garde-manger, accessible depuis ce site et l’application mobile, est édité par :</P>
        <Facts
          items={[
            ['Éditeur', 'Florian Leroux'],
            ['Statut', 'Personne physique (particulier)'],
            ['Adresse', 'Rouen, France'],
            ['Immatriculation', 'Aucune (éditeur non professionnel)'],
            ['TVA', 'Non assujetti'],
            ['Contact', <A key="e" href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>],
            ['Directeur de la publication', 'Florian Leroux'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'hebergeur',
    title: 'Hébergeur',
    body: (
      <>
        <P>L’instance officielle est hébergée en France par l’éditeur lui-même :</P>
        <Facts
          items={[
            ['Hébergeur', 'Florian Leroux (auto-hébergement)'],
            ['Localisation', 'Rouen, France'],
            ['Contact', <A key="c" href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A>],
          ]}
        />
      </>
    ),
  },
  {
    id: 'propriete-intellectuelle',
    title: 'Propriété intellectuelle',
    body: (
      <>
        <P>
          Le code de Garde-manger est publié sous licence MIT. Les conditions applicables au logiciel sont celles de la{' '}
          <A href={`${REPOSITORY_URL}/blob/main/LICENSE`}>licence du dépôt</A>.
        </P>
        <P>Les illustrations proviennent de Fluent Emoji, © Microsoft, sous licence MIT.</P>
      </>
    ),
  },
  {
    id: 'donnees-personnelles',
    title: 'Données personnelles et cookies',
    body: (
      <P>
        Le traitement des données personnelles sur l’instance officielle est décrit dans la{' '}
        <A href="/privacy">politique de confidentialité</A>, qui précise aussi ce qu’il en est des cookies.
      </P>
    ),
  },
  {
    id: 'litiges',
    title: 'Médiation et litiges',
    body: (
      <P>
        Les informations relatives à la médiation de la consommation figurent dans les{' '}
        <A href="/cgv#mediation">conditions générales de vente</A>.
      </P>
    ),
  },
  {
    id: 'auto-heberge',
    title: 'Instances auto-hébergées',
    body: (
      <Aside title="Ces mentions ne s’appliquent pas aux instances auto-hébergées">
        <P>
          Une instance auto-hébergée est installée et opérée par son propre administrateur, sur son infrastructure.
          L’éditeur du logiciel n’en est ni l’hébergeur ni l’éditeur : les mentions légales de ces instances peuvent
          différer et relèvent de leurs administrateurs.
        </P>
      </Aside>
    ),
  },
]

export function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Qui édite et héberge le service officiel Garde-manger, et comment nous joindre."
      updated={LEGAL_UPDATED}
      applies="official"
      sections={sections}
    />
  )
}
