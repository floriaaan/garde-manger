import router from '@adonisjs/core/services/router'
import env from '#start/env'

router.get('/.well-known/apple-app-site-association', ({ response }) => {
  const teamId = env.get('APPLE_TEAM_ID', '')
  const bundleId = env.get('APPLE_APP_BUNDLE_IDENTIFIER', '')
  if (!teamId || !bundleId) return response.notFound()
  response.header('Content-Type', 'application/json')
  return response.json({ webcredentials: { apps: [`${teamId}.${bundleId}`] } })
})

router.get('/.well-known/assetlinks.json', ({ response }) => {
  const fingerprint = env.get('ANDROID_APP_SIGNING_SHA256', '')
  if (!/^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$/.test(fingerprint)) return response.notFound()
  response.header('Content-Type', 'application/json')
  return response.json([
    {
      relation: [
        'delegate_permission/common.get_login_creds',
        'delegate_permission/common.handle_all_urls',
      ],
      target: {
        namespace: 'android_app',
        package_name: 'com.floriaaan.gardemanger',
        sha256_cert_fingerprints: [fingerprint.toUpperCase()],
      },
    },
  ])
})
