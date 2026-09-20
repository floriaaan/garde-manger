const TICK_MS = 5 * 60_000

export interface PushSchedulerOptions {
  /** Runs the digest for the given local day (`YYYY-MM-DD`). Must be idempotent per day. */
  digest: (today: string) => Promise<unknown>
  hour: number
  timeZone: string
  now: () => Date
  onError: (error: unknown, message: string) => void
}

/**
 * Wakes every few minutes and, once the local hour has reached `hour`, asks for
 * today's digest. Idempotence lives in `last_digest_on`, so a restart after 9:00
 * still sends it (late, once) and two ticks never send it twice.
 */
export class PushScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(private readonly options: PushSchedulerOptions) {}

  start(): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(): Promise<void> {
    if (this.running) return
    const { hour, timeZone, now, digest, onError } = this.options
    const at = now()
    const localHour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at),
    )
    if (localHour < hour) return
    // en-CA formats as YYYY-MM-DD.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(at)
    this.running = true
    try {
      await digest(today)
    } catch (error) {
      onError(error, 'Expiry digest failed')
    } finally {
      this.running = false
    }
  }
}
