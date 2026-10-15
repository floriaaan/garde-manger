/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  forbidden: [
    {
      name: 'backend-application-only-depends-on-inner-layers',
      comment:
        'Backend use cases depend on domain ports and application code, never on Node, ' +
        'frameworks, configuration or the IoC container. Inject technical services.',
      severity: 'error',
      from: { path: '^src/application(/|$)' },
      to: { pathNot: '^src/(domain|application)(/|$)' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: {
      path: 'node_modules',
    },
  },
}
