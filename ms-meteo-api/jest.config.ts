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
        '^@app/(.*)$': '<rootDir>/src/app/$1',
        '^@api/(.*)$': '<rootDir>/src/app/api/$1',
        '^@domain/(.*)$': '<rootDir>/src/app/domain/$1',
        '^@application/(.*)$': '<rootDir>/src/app/application/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/app/infrastructure/$1',
        '^@config/(.*)$': '<rootDir>/src/configuration/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@health/(.*)$': '<rootDir>/src/health/$1',
        '^@swagger/(.*)$': '<rootDir>/src/swagger/$1',
    },
};
