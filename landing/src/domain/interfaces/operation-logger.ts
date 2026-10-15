export interface OperationLogger {
  run<T>(operation: string, fn: () => Promise<T>, parameters?: { locale?: 'fr' | 'en' }): Promise<T>
}
