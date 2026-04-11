import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/services', '<rootDir>/tests'],
  moduleNameMapper: {
    '^@cn-banking/shared-types$': '<rootDir>/shared/types/src/index',
    '^@cn-banking/shared-kafka$': '<rootDir>/shared/kafka/src/index',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.base.json',
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'shared/**/src/**/*.ts',
    '!shared/**/src/**/*.test.ts',
    '!shared/**/src/__tests__/**',
    'services/**/src/**/*.ts',
    '!services/**/src/**/*.test.ts',
    '!services/**/src/__tests__/**',
  ],
};

export default config;
