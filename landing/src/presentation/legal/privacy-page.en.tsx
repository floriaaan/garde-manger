import { A, Aside, Facts, H3, P, REPOSITORY_URL, Ul } from './legal-blocks.js'
import { LegalPage, type LegalSection } from './legal-layout.js'

const sections: LegalSection[] = [
  {
    id: 'responsable',
    title: 'Data controller',
    body: <>
      <P>This policy covers the <strong>official instance</strong> of Garde-manger. The data controller is the service publisher, identified in the <A href="/legal" lang="fr">legal notice (French)</A>: Florian Leroux, Rouen, France.</P>
      <P>It does not cover self-hosted instances: see “Self-hosted instances” below.</P>
    </>,
  },
  {
    id: 'donnees',
    title: 'Data collected',
    body: <>
      <H3>When you create an account</H3>
      <Ul>
        <li>Email address, name and optional profile picture;</li>
        <li>Password (stored in a non-readable form) or the identifier of the social login used;</li>
        <li>Household membership, role and invitation code.</li>
      </Ul>
      <H3>When you use the service</H3>
      <Ul>
        <li>Pantry products (names, quantities, expiry dates, prices), shopping lists and recipes;</li>
        <li>Scanned receipts: store, date, amount, number of items and, where applicable, the receipt image;</li>
        <li>Fridge or receipt photos submitted for AI analysis;</li>
        <li>Barcodes scanned to identify a product;</li>
        <li>Household AI usage (number of uses);</li>
        <li>If you connect a Home Assistant server: its address and the access token you provide;</li>
        <li>Your device notification token, if you enable expiry reminders;</li>
        <li>Technical connection and diagnostic data (IP address, logs, app and operating system versions, mobile app performance and errors, session identifier).</li>
      </Ul>
      <H3>For billing</H3>
      <Ul>
        <li>Household subscription status and reference, provided by the payment provider.</li>
        <li>The publisher does not store any payment card data.</li>
      </Ul>
    </>,
  },
  {
    id: 'finalites',
    title: 'Purposes and legal bases',
    body: <Ul>
      <li><strong>Providing the service</strong> (account, shared household, inventory, scanning, recipes): performance of a contract.</li>
      <li><strong>Managing subscriptions and billing</strong>: performance of a contract and legal obligations.</li>
      <li><strong>Securing the service</strong> and preventing abuse: legitimate interest.</li>
    </Ul>,
  },
  {
    id: 'conservation',
    title: 'Retention periods',
    body: <Facts items={[
      ['Account and household data', 'Until account deletion, then no more than 30 days'],
      ['Receipt images', 'Until they or the account are deleted'],
      ['Billing data', '10 years (accounting obligation)'],
      ['Technical logs', 'No more than 12 months'],
      ['Mobile app diagnostics (performance, errors)', 'No more than 30 days'],
    ]} />,
  },
  {
    id: 'destinataires',
    title: 'Recipients and processors',
    body: <>
      <P>Data is accessible to the publisher and, within your household, to other members for the shared pantry. It may be processed by the following providers:</P>
      <H3>Hosting</H3>
      <P>The instance is hosted in Rouen, France, on the publisher’s infrastructure: no third-party hosting provider is involved.</P>
      <H3>Payment provider</H3>
      <P>Subscriptions are processed by Stripe, which receives household and user identifiers to associate the subscription, as well as the email address and payment details entered on its secure page. The publisher neither receives nor stores any payment card data.</P>
      <H3>AI provider</H3>
      <P>AI features (reading receipt and fridge photos, generating recipes) currently use Google’s Gemini API. Photos and text submitted to AI are sent to it for processing; this provider may be located outside the European Union. This choice may change (a local Ollama model on the publisher’s infrastructure, or another provider): the current provider is the one indicated here.</P>
      <H3>Notifications</H3>
      <P>Expiry reminders pass through Expo’s notification service (exp.host), which forwards them to Apple (APNs) or Google (FCM) depending on your device. The notification token and reminder content (for example, a product name) pass through this service.</P>
      <H3>Open Food Facts</H3>
      <P>When you scan a barcode, it is sent to the collaborative Open Food Facts database to identify the product.</P>
      <H3>Sign-in</H3>
      <P>Social sign-in uses Google and PocketID, which receive the information needed for authentication. You can also sign in with a passkey, which does not transmit any biometric data to the service.</P>
    </>,
  },
  {
    id: 'transferts',
    title: 'Transfers outside the European Union',
    body: <P>The publisher does not itself transfer data outside the European Union. The currently configured AI provider (Gemini, Google) and the notification service (Expo) may do so as part of their own processing. Sign-in and payment providers are also governed by their own privacy policies.</P>,
  },
  {
    id: 'droits',
    title: 'Your rights',
    body: <>
      <P>You have the following rights regarding your personal data:</P>
      <Ul>
        <li>Access, rectification and erasure;</li>
        <li>Restriction of and objection to processing;</li>
        <li>Portability of the data you provided;</li>
        <li>Withdrawal of consent where processing is based on consent;</li>
        <li>Instructions on what happens to your data after your death.</li>
      </Ul>
      <P>You may also lodge a complaint with the CNIL (<A href="https://www.cnil.fr">cnil.fr</A>).</P>
    </>,
  },
  {
    id: 'exercice-droits',
    title: 'Exercising your rights and contacting us',
    body: <>
      <P>To exercise your rights or ask a question about your data, email <A href="mailto:garde-manger@floriaaan.fr">garde-manger@floriaaan.fr</A> (no data protection officer has been appointed). You will receive a response within the one-month period provided for by the GDPR. Proof of identity may be requested if there is doubt about your identity.</P>
      <P>To delete your account, see also the <A href="/delete-account" lang="fr">account deletion page (French)</A>.</P>
    </>,
  },
  {
    id: 'mineurs',
    title: 'Minors',
    body: <P>The service is intended for people aged 15 and over. Below that age, a parent’s or guardian’s consent is required.</P>,
  },
  {
    id: 'cookies',
    title: 'Cookies and trackers',
    body: <>
      <P>This website’s code does not set cookies or include audience measurement or advertising tools. To display homepage statistics, your browser queries the official instance and GitHub’s public API: these services receive your IP address as with any web request.</P>
      <P>The service does not use advertising or audience measurement cookies or trackers. Signing in sets a session cookie (website) or an equivalent token stored in the device keychain (mobile app): it is strictly necessary to stay signed in and is not used for other purposes.</P>
    </>,
  },
  {
    id: 'auto-heberge',
    title: 'Self-hosted instances',
    body: <>
      <Aside title="A self-hosted instance is not the official instance">
        <Ul>
          <li>The software publisher is not necessarily the data controller for a self-hosted instance.</li>
          <li>The instance administrator decides how data is processed on their instance: hosting, AI provider, retention and contact details.</li>
          <li>This policy must not be considered applicable to a self-hosted instance by default.</li>
        </Ul>
      </Aside>
      <P>The software source code is public: <A href={REPOSITORY_URL}>view the repository</A>. To learn how your data is processed on a third-party instance, contact its administrator.</P>
    </>,
  },
]

export function EnglishPrivacyPage() {
  return <LegalPage
    locale="en"
    localeHrefs={{ fr: '/privacy', en: '/en/privacy' }}
    title="Privacy Policy"
    intro="What personal data the official Garde-manger instance processes, why, and how to exercise your rights."
    updated="23 September 2026"
    applies="official"
    sections={sections}
  />
}
