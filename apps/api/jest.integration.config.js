module.exports = {
  moduleFileExtensions: ['js', 'ts'],
  testRegex: 'test/integration/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^@il-arrive/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
  },
};
