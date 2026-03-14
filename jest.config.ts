import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/services', '<rootDir>/tests'],
  moduleNameMapper: {
    '^@cn-bank/types$': '<rootDir>/shared/types/src/index',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.base.json',
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'services/**/src/**/*.ts',
    '!services/**/src/**/*.test.ts',
    '!services/**/src/__tests__/**',
  ],
};

export default config;
