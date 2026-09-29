import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions, useLandingContentQuery } from '../application/content/landing-content.query.js'
import { legalHead } from '../lib/seo.js'
import { SiteHeader } from '../presentation/landing/site-header.js'
import { SiteFooter } from '../presentation/landing/site-footer.js'
import { Button } from '../presentation/ui/button.js'

export const Route = createFileRoute('/delete-account')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () =>
    legalHead(
      '/delete-account',
      'Supprimer son compte',
      'Demander la suppression de son compte Garde-manger et des données associées.',
    ),
  component: DeleteAccountPage,
})

function DeleteAccountPage() {
  const { data: content } = useLandingContentQuery('fr')

  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <SiteHeader content={content} />
      <main id="contenu" className="px-5 pt-32 pb-20 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-ink sm:text-6xl">Supprimer son compte Garde-manger</h1>
          <p className="mt-6 text-lg leading-relaxed text-ink/80">
            Tu peux demander la suppression de ton compte et des données personnelles associées, même si tu n’as plus l’application.
          </p>

          <section className="corners-hero mt-10 bg-ground-mint p-6 sm:p-10" aria-labelledby="demande-title">
            <h2 id="demande-title" className="text-2xl font-extrabold text-ink">Faire une demande sans l’application</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink/80">
              Écris depuis l’adresse e-mail de ton compte à garde-manger@floriaaan.fr, avec pour objet « Suppression de compte Garde-manger ». Nous pourrons te demander de confirmer ton identité avant la suppression.
            </p>
            <Button asChild size="lg" className="mt-6 max-w-full whitespace-normal text-center">
              <a href="mailto:garde-manger@floriaaan.fr?subject=Suppression%20de%20compte%20Garde-manger">Demander la suppression par e-mail</a>
            </Button>
          </section>

          <section className="mt-12 space-y-3" aria-labelledby="application-title">
            <h2 id="application-title" className="text-2xl font-extrabold text-ink">Depuis l’application</h2>
            <p className="leading-relaxed text-ink/80">Ouvre Réglages → Mon compte → Supprimer le compte, puis confirme la suppression. Si tu possèdes un foyer avec d’autres membres, transfère d’abord sa propriété dans l’écran Foyer.</p>
          </section>

          <section className="mt-12 space-y-3" aria-labelledby="donnees-title">
            <h2 id="donnees-title" className="text-2xl font-extrabold text-ink">Données supprimées et conservées</h2>
            <p className="leading-relaxed text-ink/80">La suppression retire ton compte et tes données personnelles. Si tu es seul propriétaire de ton foyer, son contenu est aussi supprimé. Les données de compte et de foyer peuvent être conservées jusqu’à 30 jours après la suppression ; les données de facturation sont conservées 10 ans pour respecter les obligations comptables.</p>
            <p className="leading-relaxed text-ink/80">Pour les autres durées, consulte la <a className="font-semibold underline decoration-blob-strong decoration-4 underline-offset-4" href="/privacy#conservation">politique de confidentialité</a>.</p>
          </section>

          <p className="mt-12 rounded-2xl bg-cream p-5 leading-relaxed text-ink/80">
            Si ton compte appartient à une instance auto-hébergée par un tiers, adresse ta demande à l’administrateur de cette instance : nous n’avons pas accès à ses comptes.
          </p>
        </div>
      </main>
      <SiteFooter content={content} />
    </>
  )
}
