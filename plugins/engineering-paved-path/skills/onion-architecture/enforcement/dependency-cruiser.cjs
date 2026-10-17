/**
 * Onion-architecture rules — a dependency-cruiser template for the machine-checkable subset of
 * the onion-architecture skill (SKILL.md in this skill).
 *
 * Adopt:  copy this file to the package root as .dependency-cruiser.cjs, edit the ring path
 *         constants and SDKS below to the project's ring map, and set the package's `arch`
 *         check in .sdd/config.json, e.g. "npx depcruise src --config .dependency-cruiser.cjs".
 *
 * The paths below follow the skill's reference layout:
 *   src/domain/**                 ring 0      src/modules/<m>/service.ts    ring 1
 *   src/adapters/**, src/db/**,   ring 2      src/modules/<m>/routes.ts,    ring 3
 *   src/modules/<m>/repository*               src/{app,server,container}.ts, src/plugins/**
 *
 * Severity policy: `error` = clean today, keep it clean. `warn` = known outstanding
 * violations, named in an OUTSTANDING note in the rule comment. Promote a rule to `error` in
 * the same commit that clears its last violation; never add a new violation to a `warn` rule.
 */

// --- ring paths (keep in sync with the project's ring map) -------------------
const EDGE = '^src/(server|app|container|config)\\.ts$|^src/modules/index\\.ts$|^src/modules/[^/]+/(routes|index)\\.ts$|^src/plugins/';
const PERSISTENCE = '^src/db/|^src/adapters/|^src/modules/[^/]+/repository(\\.ts$|/)|^src/jobs/';
const CORE = '^src/domain/';
const SHARED_MODULE = '^src/modules/_shared/';

// Every SDK the package wraps behind a port: one adapter folder each.
const SDKS = [
  // 'octokit', '@octokit/', 'openai', '@anthropic-ai/sdk', 'simple-git',
];

const escape = (s) => s.replace(/[/@.]/g, '\\$&');

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-fastify-below-edge',
      comment:
        'Fastify is ring 3. Only route files, the module index, app/server, plugins and the ' +
        'composition root may import it; a service that needs the request takes plain ' +
        'arguments and the Logger port instead.',
      severity: 'error',
      from: { path: '^src/', pathNot: EDGE },
      to: { dependencyTypes: ['npm'], path: 'node_modules/(fastify|@fastify/[^/]+|fastify-[^/]+)/' },
    },
    {
      name: 'no-orm-outside-persistence',
      comment:
        'The ORM, the driver and db/schema are ring 2. Allowed only in db/**, adapters/**, ' +
        'modules/*/repository* and the job runner. The db client is also allowed at the ' +
        'composition root, which owns the pool.',
      severity: 'error',
      from: { path: '^src/', pathNot: `${PERSISTENCE}|${EDGE}` },
      to: { path: '^src/db/schema|drizzle-orm|/postgres/' },
    },
    {
      name: 'no-sdk-outside-adapters',
      comment: 'One SDK, one adapter. A second import site means a port is missing from ring 0.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/adapters/|^src/container\\.ts$' },
      to: {
        dependencyTypes: ['npm'],
        path: SDKS.length ? `^(${SDKS.map(escape).join('|')})` : '^$a',
      },
    },
    {
      name: 'adapters-dont-know-modules',
      comment: "Ring 2 never depends on ring 1/3. If an adapter needs a module's data, the data is passed in.",
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/|^src/container\\.ts$' },
    },
    {
      name: 'core-stays-pure',
      comment: 'Ring 0 imports the validation library and its own files only.',
      severity: 'error',
      from: { path: CORE },
      to: { pathNot: `${CORE}|node_modules/zod/` },
    },
    {
      name: 'routes-dont-touch-persistence',
      comment:
        'A handler parses, calls one service method and returns a DTO. Reaching the DB from ' +
        'ring 3 skips the use case entirely.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: '^src/db/(schema|client)|^src/modules/[^/]+/repository(\\.ts$|/)' },
    },
    {
      name: 'services-dont-import-routes',
      comment: 'Ring 1 never names ring 3.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: EDGE },
      to: { path: '^src/modules/[^/]+/routes\\.ts$|^src/(server|app)\\.ts$' },
    },
    {
      name: 'no-cross-module-internals',
      comment:
        "A module may not reach into another module's service/repository. Share through the " +
        'shared module, named row types, or a repository hung off the container.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', pathNot: `${EDGE}|${SHARED_MODULE}` },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', SHARED_MODULE],
      },
    },
    // A pure core package shared by several consumers (see "A pure core package" in SKILL.md).
    // Enable and point `from` at it when the project has one; paths stay unanchored on the `to`
    // side because pnpm resolves to <pkg>/node_modules/<dep> and node_modules/.pnpm/<dep>@<ver>/.
    // {
    //   name: 'core-package-stays-pure',
    //   severity: 'error',
    //   from: { path: '^\\.\\./core/src/' },
    //   to: { path: 'node_modules/(fastify|drizzle-orm|postgres)/|^src/|^node:(fs|child_process|net|http)' },
    // },
    {
      name: 'no-circular',
      comment: 'A cycle means the two files are one module that has not admitted it yet.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-dev-dep',
      comment: 'Runtime code must not import a devDependency.',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.test\\.ts$|^src/db/(seed|migrate)' },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
