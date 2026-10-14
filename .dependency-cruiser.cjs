/**
 * Shared layer boundaries; see docs/clean-architecture.md.
 * Paths are relative to each package root. Package configurations supply
 * TypeScript resolution and exclude test-only sources where appropriate.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-has-zero-dependencies',
      comment:
        'domain must not depend on any other layer, and must not depend on any npm package ' +
        '(cf. docs/phase-0/02-modele-de-domaine.md).',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { pathNot: '^src/domain' },
    },
    {
      name: 'application-must-not-depend-on-outer-layers',
      comment: 'application must not depend on infrastructure, presentation or route entry points.',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/(infrastructure|presentation|app|routes)(/|$)' },
    },
    {
      name: 'infrastructure-must-not-depend-on-presentation',
      comment: 'infrastructure may depend on domain and application, never on presentation.',
      severity: 'error',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/presentation' },
    },
    {
      name: 'presentation-must-not-depend-on-infrastructure',
      comment:
        'presentation may depend on domain and application; wiring to infrastructure ' +
        'implementations happens in providers/, outside src/, never via a direct import.',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'layers-must-not-import-composition-root',
      comment:
        'Only entry points assemble dependencies through providers; inner layers must not ' +
        'use providers to bypass dependency inversion.',
      severity: 'error',
      from: { path: '^src/(domain|application|infrastructure|presentation)(/|$)' },
      to: { path: '^providers(/|$)' },
    },
    {
      name: 'no-circular',
      comment: 'Circular imports make the layering hard to reason about.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
}
