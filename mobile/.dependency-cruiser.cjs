/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  forbidden: [
    {
      name: 'app-routes-must-not-depend-on-infrastructure',
      comment:
        'app/ (expo-router) is routing-only — wiring to infrastructure happens via providers/, ' +
        'never a direct import.',
      severity: 'error',
      from: { path: '^src/app' },
      to: { path: '^src/infrastructure' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: {
      path: 'node_modules|\\.test\\.|/test-utils\\.',
    },
  },
}
