import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

const corsOrigin = env.get('CORS_ORIGIN')

const corsConfig = defineConfig({
  enabled: true,

  /**
   * In development without an explicit CORS_ORIGIN, allow every origin to
   * simplify local front/backend setup. Otherwise use the configured
   * comma-separated allowlist.
   */
  origin: corsOrigin ? corsOrigin.split(',') : app.inDev,

  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: ['x-request-id'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
