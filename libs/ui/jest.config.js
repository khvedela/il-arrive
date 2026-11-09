module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  moduleNameMapper: {
    '^@il-arrive/ui$': '<rootDir>/src/public-api.ts',
    '^@il-arrive/ui/(.*)$': '<rootDir>/src/$1',
    '^@il-arrive/contracts$': '<rootDir>../../libs/contracts/src/index.ts',
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
