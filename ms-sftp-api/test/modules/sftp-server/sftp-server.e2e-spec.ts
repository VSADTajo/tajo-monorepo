import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import SftpClient from 'ssh2-sftp-client';

import { SftpServerService } from '../../../src/app/infrastructure/services/sftp-server.service';
import { Logger } from 'nestjs-pino';
import { SftpServerConfigService } from '../../../src/configuration/sftp-server/sftp-server-config.service';
import { StorageConfigService } from '../../../src/configuration/storage/storage-config.service';
import { ISftpUserRepository } from '../../../src/app/domain/ports/sftp-user-repository.port';

// ─── Test config mocks ──────────────────────────────────────

const TEST_PORT = 2299;
const TEST_USER = 'testuser';
const TEST_PASSWORD = 'testpass123';

let tmpDir: string;
let hostKeyPath: string;
let storageBasePath: string;
let userRootDir: string;

function createMockLogger() {
    return {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        fatal: jest.fn(),
    };
}

function createMockConfig() {
    return {
        enabled: true,
        port: TEST_PORT,
        hostKeyPath,
        autoGenerateHostKey: true,
        maxConnections: 5,
        users: [
            {
                username: TEST_USER,
                password: TEST_PASSWORD,
                rootDirectory: 'testuser',
            },
        ],
    };
}

function createMockStorageConfig() {
    return { basePath: storageBasePath };
}

function createMockSftpUserRepository() {
    return {
        create: jest.fn(),
        findById: jest.fn().mockResolvedValue(null),
        findByUsername: jest.fn().mockResolvedValue(null),
        findAll: jest.fn().mockResolvedValue([]),
        findAllActive: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
    };
}

// ─── Tests ──────────────────────────────────────────────────

describe('SFTP Server (e2e)', () => {
    let service: SftpServerService;
    let client: SftpClient;

    beforeAll(async () => {
        // Create temp directories
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sftp-test-'));
        hostKeyPath = path.join(tmpDir, 'host_key');
        storageBasePath = path.join(tmpDir, 'storage');
        userRootDir = path.join(storageBasePath, 'testuser');
        await fs.mkdir(userRootDir, { recursive: true });

        // Generate host key in OpenSSH format (required by ssh2)
        execSync(`ssh-keygen -t ed25519 -f "${hostKeyPath}" -N "" -q`);
        await fs.unlink(`${hostKeyPath}.pub`).catch(() => {});

        // Create and start service
        const logger = createMockLogger();
        const config = createMockConfig();
        const storageConfig = createMockStorageConfig();

        const sftpUserRepository = createMockSftpUserRepository();

        service = new SftpServerService(
            logger as unknown as Logger,
            config as unknown as SftpServerConfigService,
            storageConfig as unknown as StorageConfigService,
            sftpUserRepository as unknown as ISftpUserRepository,
        );

        await service.onModuleInit();
    }, 30_000);

    afterAll(async () => {
        await service.onModuleDestroy();
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        client = new SftpClient();
    });

    afterEach(async () => {
        try {
            await client.end();
        } catch {
            // Ignore if not connected
        }
    });

    async function connect() {
        await client.connect({
            host: '127.0.0.1',
            port: TEST_PORT,
            username: TEST_USER,
            password: TEST_PASSWORD,
            algorithms: { kex: ['curve25519-sha256', 'curve25519-sha256@libssh.org'] },
        });
    }

    // ─── Authentication ─────────────────────────────────────

    describe('Authentication', () => {
        it('should accept valid credentials', async () => {
            await connect();
            const list = await client.list('/');
            expect(Array.isArray(list)).toBe(true);
        });

        it('should reject invalid password', async () => {
            await expect(
                client.connect({
                    host: '127.0.0.1',
                    port: TEST_PORT,
                    username: TEST_USER,
                    password: 'wrong-password',
                    retries: 0,
                }),
            ).rejects.toThrow();
        });

        it('should reject unknown username', async () => {
            await expect(
                client.connect({
                    host: '127.0.0.1',
                    port: TEST_PORT,
                    username: 'unknown',
                    password: TEST_PASSWORD,
                    retries: 0,
                }),
            ).rejects.toThrow();
        });
    });

    // ─── File Operations ────────────────────────────────────

    describe('File Operations', () => {
        it('should upload and download a file', async () => {
            await connect();

            const content = Buffer.from('Hello SFTP Server!');
            await client.put(content, '/test-upload.txt');

            // Verify file exists on disk
            const diskPath = path.join(userRootDir, 'test-upload.txt');
            const diskContent = await fs.readFile(diskPath);
            expect(diskContent.toString()).toBe('Hello SFTP Server!');

            // Download and verify
            const downloaded = await client.get('/test-upload.txt');
            expect(downloaded.toString()).toBe('Hello SFTP Server!');

            // Cleanup
            await client.delete('/test-upload.txt');
        });

        it('should list files in a directory', async () => {
            await connect();

            // Create test files
            await client.put(Buffer.from('file1'), '/list-test-1.txt');
            await client.put(Buffer.from('file2'), '/list-test-2.txt');

            const list = await client.list('/');
            const names = list.map((f) => f.name);

            expect(names).toContain('list-test-1.txt');
            expect(names).toContain('list-test-2.txt');

            // Cleanup
            await client.delete('/list-test-1.txt');
            await client.delete('/list-test-2.txt');
        });

        it('should create and list directories', async () => {
            await connect();

            await client.mkdir('/subdir', true);

            const list = await client.list('/');
            const dirEntry = list.find((f) => f.name === 'subdir');
            expect(dirEntry).toBeDefined();
            expect(dirEntry!.type).toBe('d');

            // Cleanup
            await client.rmdir('/subdir');
        });

        it('should rename/move files', async () => {
            await connect();

            await client.put(Buffer.from('move me'), '/original.txt');
            await client.rename('/original.txt', '/renamed.txt');

            const list = await client.list('/');
            const names = list.map((f) => f.name);
            expect(names).not.toContain('original.txt');
            expect(names).toContain('renamed.txt');

            // Cleanup
            await client.delete('/renamed.txt');
        });

        it('should delete files', async () => {
            await connect();

            await client.put(Buffer.from('delete me'), '/to-delete.txt');
            await client.delete('/to-delete.txt');

            const list = await client.list('/');
            const names = list.map((f) => f.name);
            expect(names).not.toContain('to-delete.txt');
        });

        it('should get file stats', async () => {
            await connect();

            const content = Buffer.from('stat this file');
            await client.put(content, '/stat-test.txt');

            const stat = await client.stat('/stat-test.txt');
            expect(stat.size).toBe(content.length);
            expect(stat.isFile).toBe(true);

            // Cleanup
            await client.delete('/stat-test.txt');
        });
    });

    // ─── Chroot / Path Traversal ────────────────────────────

    describe('Chroot Security', () => {
        it('should not allow path traversal outside rootDirectory', async () => {
            await connect();

            // Create a file outside user root to verify it's not accessible
            const outsidePath = path.join(storageBasePath, 'outside-secret.txt');
            await fs.writeFile(outsidePath, 'secret data');

            // Attempting to read /../outside-secret.txt should fail
            await expect(client.get('/../outside-secret.txt')).rejects.toThrow();

            // Cleanup
            await fs.unlink(outsidePath);
        });
    });
});
