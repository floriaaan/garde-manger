# Android Google sign-in regression checklist (#91)

The Android sign-in callback is `gardemanger://oauth-return`, including backend
OAuth errors. Better Auth consumes the callback and persists its cookie before
the connector verifies the session. Expo Router ignores this URL so the sign-in
screen stays mounted and can display errors. Foreground session checks must not
sign out while this exchange is in progress, or after returning an older result.

## Automated regression coverage

Tests were added for Android success with an existing Google/PocketID identity,
cancellation, callback errors (including `account_not_linked`), missing cookies,
missing/unreachable sessions, foreground cookie-clearing races, session cache
refresh, URL listener cleanup, safe callback parsing, and visible UI feedback.
Existing tests retain the iOS native callback and web redirect behavior.

Run the focused tests when validation is authorized:

```sh
cd mobile
pnpm exec jest --runInBand src/application/identity/android-oauth-return.test.ts src/infrastructure/http/http-fridge-connector.test.ts src/presentation/identity/google-availability.test.tsx src/infrastructure/telemetry/telemetry.test.ts
```

## Device checks before release

These checks require an Android build, a configured Google provider and a real
test account. They have not been performed in the coding workspace.

1. Sign out of an existing account already linked to Google. Sign in with Google.
   Expect authenticated tabs (or household onboarding if no household exists).
2. Open an authenticated screen that calls the backend, then restart the app.
   Expect the session to remain usable and restored.
3. Repeat with a Google identity whose email matches an unverified password
   account that has not linked Google. Expect instructions to use the original
   method and link Google from the account screen. Automatic linking remains
   disabled; the fix must not bypass proof of ownership.
4. Cancel the browser flow or refuse Google consent. Expect “Connexion annulée”
   and an enabled retry button, without navigating into the app.
5. Interrupt connectivity after returning from Google. Expect an explicit
   session verification error; reconnect and retry successfully.
6. Repeat success and cancellation several times, including background/foreground
   transitions. Expect no cookie clearing or silent return to login.
7. In OpenObserve logs, filter `app.operation` by the prefix
   `identity.sign_in_social.google.`. INFO events show `.request` started and
   completed, `.callback` completed, `.browser` completed, and `.session` started
   then success. If a flow stops, its last event identifies the stage reached;
   detected failures add an ERROR with `error.code` (cancellation is INFO).
   Events and failures share a trace; the Android auth request sends its
   `traceparent` and subsequent logs include the backend `request_id` when
   available. Progress events are not aggregated across sign-in attempts.
   No callback URL, cookie, token,
   email or OAuth error description should appear in these diagnostics.
8. Verify web Google sign-in still returns to the frontend origin; verify iOS
   provider availability and the existing native authentication flow remain intact.
