/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lambdas'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // ts-jest 配置
    }],
  },
  // Commented out to isolate issue
  // setupFiles: ['<rootDir>/test/setup.ts'],
};
