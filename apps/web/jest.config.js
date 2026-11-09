module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/../../libs/ui/setup-jest.ts', '<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '^@il-arrive/ui$': '<rootDir>/../../libs/ui/src/public-api.ts',
    '^@il-arrive/ui/(.*)$': '<rootDir>/../../libs/ui/src/$1',
    '^@il-arrive/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@il-arrive/contracts/(.*)$': '<rootDir>/../../libs/contracts/src/$1',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};
