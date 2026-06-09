import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Creates a temporary storage directory for file tests.
 * Returns the path to the created directory.
 */
export function createTempStorageDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'file-test-'));
}

/**
 * Cleans up a temp storage directory.
 */
export function cleanupTempStorageDir(dirPath: string): void {
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

/**
 * Creates a test file in the given base directory.
 */
export function createTestFile(basePath: string, relativePath: string, content: string = 'test file content'): string {
    const fullPath = path.join(basePath, relativePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
}

/**
 * Creates a test directory in the given base directory.
 */
export function createTestDirectory(basePath: string, relativePath: string): string {
    const fullPath = path.join(basePath, relativePath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
}

/**
 * Builds a MoveFileRequestDto.
 */
export function buildMoveFileDto(
    overrides?: Partial<{ sourcePath: string; destinationPath: string; overwrite: boolean }>,
) {
    return {
        sourcePath: 'inbox/report.csv',
        destinationPath: 'processed/report.csv',
        ...overrides,
    };
}
