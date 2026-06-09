export default {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: './',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@common-module/(.*)$': '<rootDir>/src/modules/common/$1',
        '^@auth/(.*)$': '<rootDir>/src/modules/authentication/$1',
        '^@auth-step/(.*)$': '<rootDir>/src/modules/authentication-step-details/$1',
        '^@customer/(.*)$': '<rootDir>/src/modules/customer/$1',
        '^@providers/(.*)$': '<rootDir>/src/modules/providers/$1',
        '^@config/(.*)$': '<rootDir>/src/modules/configuration/$1',
    },
};
