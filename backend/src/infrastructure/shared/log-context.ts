import { AsyncLocalStorage } from 'node:async_hooks'

/** Carries worker context across awaits without leaking between concurrent jobs. */
class LogContext {
  private readonly storage = new AsyncLocalStorage<Record<string, unknown>>()

  run<T>(attributes: Record<string, unknown>, fn: () => T): T {
    return this.storage.run(attributes, fn)
  }

  current(): Record<string, unknown> {
    return this.storage.getStore() ?? {}
  }
}

export const logContext = new LogContext()
