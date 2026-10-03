# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are git tags (`X.Y.Z`) and match the Docker image tags on GHCR.

## [Unreleased]

## [1.0.0-rc.4]

### Added
- Configurable household expiry reminders, with windows of 0, 1, 2, 3 or 7 days and a daily digest.
- Web Push notifications on supported browsers, with VAPID configuration and PWA assets for the self-hosted web app.
- Dedicated not-found pages on the landing site and in the app, with recovery links for unknown routes and deep links.
- Landing-page links to the web app, TestFlight and Google Play beta.
- Bundled Plus Jakarta Sans and Spectral fonts for the self-hosted web app.

### Changed
- Redesigned welcome, authentication, server selection and household setup with explicit sign-in/sign-up and join/create paths.
- Authentication and onboarding share an animated garden background, transitions with reduced-motion support, refreshed illustrations and loading screens.
- Refreshed landing-page branding and food illustrations, app splash typography and App Store screenshots.
- Backend and mobile diagnostics now sanitize sensitive data, correlate requests and include build metadata; observability configuration and documentation have been updated.

### Fixed
- A fridge scan consumes one AI quota unit for the whole scan, including multiple photos and resumed jobs.
- Web login and sign-up fields retain focus and keyboard navigation, and remain visible in short windows.
- Dashboard greeting text and AI card illustrations stay correctly aligned.
- Expiry-reminder validation accepts all supported windows, and settings no longer render errors while reminder preferences are loading.
- Missing web font assets return a 404 instead of the app's HTML fallback.

## [1.0.0-rc.3]

### Added
- Sign in with Apple and passkeys on supported clients, including account linking and the domain-association endpoints needed for Apple and Android.
- Password recovery by email, configurable through SMTP.
- A public account-deletion page for requests made without the app.
- A self-hostable Expo web app, published as a Docker image by CI.
- Configuration and setup documentation for Apple sign-in, passkeys and password recovery.

### Changed
- Sign-in and sign-up now share a redesigned screen, with available authentication methods shown from instance configuration.
- Account deletion has a dedicated confirmation screen with household ownership checks.
- Push notifications for scans, recipes and expiring products now use more specific messages.
- Refreshed app icons, illustrations and authentication visuals.

## [1.0.0-rc.2]

### Added
- Receipts: scan a PDF, import one in-app, or share one straight into the app.
- Recipe composer: product cards picked from the whole pantry, a collapsible pantry card, "Affiner" folded away.
- Adding a shopping item and the Scanner open as sheets.
- iPad support with the sidebar layout.
- Links to the privacy policy and terms from Settings.
- iOS: subscribers are pointed to the web app to manage billing; Stripe billing and Google sign-in are hidden (App Store 3.1.1, 4.8).
- Backend: Sign in with Apple (off until configured), `seed:review-account` command and AI quota exemptions.
- Landing: working waitlist form, with a hint when the email is already subscribed.
- App Store listing, review notes and privacy answers in `docs/store/ios`.

### Changed
- Mobile app version is `1.0.0`: the App Store only accepts integer components in `CFBundleShortVersionString`, so release candidates are no longer reflected in `expo.version`.
- Expiry and receipt dates use a real date picker.
- Plain HTTP is allowed to self-hosted servers on the local network (iOS ATS); the README documents the limit for public servers.

### Fixed
- A failed recipe generation no longer creates a recipe, and the model can no longer answer "impossible" as a recipe.
- Recipe composer: exits are guarded, cards render in dark mode, picks are kept.
- Onboarding headlines were clipped.
- The scan button's haptic fired on touch-down.
- The debug screen is kept out of release builds.
- The /privacy page matches what the app actually does.

## [1.0.0-rc.1]

First release candidate.

### Added
- Shared household pantry: inventory, expiry dates, shared shopping list.
- Receipt and fridge scanning, and recipes with what's left, through Gemini, OpenAI or a local Ollama model.
- Self-hosting with Docker Compose (images on GHCR) and an official hosted instance.
- Android APK attached to the release.
- Waitlist form and reworked messaging on the landing site.

### Changed
- Install guide: minimal compose file, secrets in a `.env`, HTTPS with Caddy, versioned updates with a backup step.
- Application id is now `com.floriaaan.gardemanger` on iOS and Android.

[Unreleased]: https://github.com/floriaaan/garde-manger/compare/1.0.0-rc.4...HEAD
[1.0.0-rc.4]: https://github.com/floriaaan/garde-manger/compare/1.0.0-rc.3...1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/floriaaan/garde-manger/compare/1.0.0-rc.2...1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/floriaaan/garde-manger/compare/1.0.0-rc.1...1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/floriaaan/garde-manger/releases/tag/1.0.0-rc.1
