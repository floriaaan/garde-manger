import { diagnosticAttributes, errorCode } from '#domain/shared/log-diagnostic'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: 'garde-manger-backend',
      level: env.get('LOG_LEVEL'),
      base: {
        'service.name': process.env.OTEL_SERVICE_NAME || 'garde-manger-backend',
        'deployment.environment.name': process.env.DEPLOY_ENV || process.env.NODE_ENV || 'development',
        'service.version': process.env.APP_VERSION || '0.0.0',
        'service.build': process.env.APP_BUILD || process.env.APP_VERSION || '0.0.0',
        'os.name': 'node',
      },
      destination: !app.inProduction ? await syncDestination() : undefined,
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
      serializers: {
        err: (error: unknown) => ({ code: errorCode(error), ...diagnosticAttributes(error) }),
        error: (error: unknown) => ({ code: errorCode(error), ...diagnosticAttributes(error) }),
      },
      /**
       * Nothing in this list is ever useful in a log line, and every entry
       * is a credential, token or unnecessary personal field. `remove: true` deletes the key outright
       * rather than replacing it with "[Redacted]" — the shape of a secret
       * is itself information. These paths also cover the OTLP log records
       * mirrored by `instrumentation-pino`, since redaction happens inside
       * pino, upstream of the bridge.
       */
      redact: {
        remove: true,
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'headers.authorization',
          'headers.cookie',
          'headers.Authorization',
          'headers.Cookie',
          'headers["x-api-key"]',
          'req.headers["x-api-key"]',
          'passwordHash',
          '*.passwordHash',
          'passwd',
          '*.passwd',
          'email',
          '*.email',
          'password',
          '*.password',
          'token',
          '*.token',
          'accessToken',
          '*.accessToken',
          'refreshToken',
          '*.refreshToken',
          'idToken',
          '*.idToken',
          'apiKey',
          '*.apiKey',
          'secret',
          '*.secret',
          'inviteCode',
          '*.inviteCode',
        ],
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
