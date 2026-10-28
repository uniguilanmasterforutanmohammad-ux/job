import base from '@repo/config/eslint';

export default [...base, { files: ['src/**/*.ts', 'prisma/**/*.ts'] }];
