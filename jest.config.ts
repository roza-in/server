import type { Config } from 'jest';

const config: Config = {
    // Use ts-jest for TypeScript
    preset: 'ts-jest/presets/default-esm',

    // Test environment
    testEnvironment: 'node',

    // Root directory
    rootDir: '.',

    // Source and test file patterns
    roots: ['<rootDir>/src', '<rootDir>/tests'],

    // Test file patterns
    testMatch: [
        '**/*.test.ts',
        '**/*.spec.ts',
    ],

    // Module resolution
    moduleNameMapper: {
        // Handle path aliases from tsconfig
        '^@/(.*)$': '<rootDir>/src/$1',
        // Handle .js imports in ESM
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },

    // Transform TypeScript files
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.json',
            },
        ],
    },

    // Extensions to consider
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

    // ESM support
    extensionsToTreatAsEsm: ['.ts'],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

    // Coverage configuration
    collectCoverage: false,
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/types/**/*',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50,
        },
    },

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
    ],

    // Quiet mode for cleaner output
    verbose: true,

    // Timeout for async tests
    testTimeout: 10000,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks after each test
    restoreMocks: true,
};

export default config;
