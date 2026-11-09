module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|scss)$',
    },
  },
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@il-arrive/ui$': '<rootDir>/../../libs/ui/src/public-api.ts',
    '^@il-arrive/ui/(.*)$': '<rootDir>/../../libs/ui/src/$1',
    '^@il-arrive/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
  },
  rootDir: '.',
  roots: ['<rootDir>/src/'],
  testEnvironment: 'jsdom',
};
