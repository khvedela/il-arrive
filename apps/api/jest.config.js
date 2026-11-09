module.exports = {
  moduleFileExtensions: ['js', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/'],
  moduleNameMapper: {
    '^@libs/(.*)$': '<rootDir>/../../libs/$1',
  },
};
