module.exports = {
  moduleFileExtensions: ['js', 'ts'],
  testRegex: 'test/integration/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/integration/setup-env.ts'],
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^@il-arrive/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
  },
};
