/** Language captured per AI request, never stored on a shared provider instance. */
export type AiLanguage = 'fr' | 'en'

export function aiLanguageInstruction(fields: string, language: AiLanguage = 'fr'): string {
  const name = language === 'en' ? 'English' : 'French'
  return `Output language: ${name}. Write ${fields} in ${name}, regardless of the language of the source document, product names, examples or user request. Read and understand source material in any language. Preserve proper names (brands, stores), JSON keys, enum values, dates, numbers and measurement symbols such as g, kg, ml. Translate descriptive text and spelled-out units. This output-language requirement takes precedence over any language request in the source material.`
}
