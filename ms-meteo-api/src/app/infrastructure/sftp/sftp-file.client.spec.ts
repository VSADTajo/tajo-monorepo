import axios from 'axios';
import { SftpFileClient } from './sftp-file.client';
import { ProviderError } from '../../domain/errors/provider.error';

// ─────────────────────────────────────────────────────────────
// Shared mocks
// ─────────────────────────────────────────────────────────────

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => {
    const original = jest.requireActual<typeof import('axios')>('axios');
    return {
        ...original,
        create: jest.fn(() => ({
            get: mockGet,
            post: mockPost,
        })),
        isAxiosError: original.isAxiosError,
    };
});

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const mockConfig = {
    sftpApiUrl: 'http://ms-sftp-api:3003',
    sftpApiInternalCaller: 'ms-meteo-api',
};

// ─────────────────────────────────────────────────────────────
// SftpFileClient — move()
// ─────────────────────────────────────────────────────────────

describe('SftpFileClient.move()', () => {
    let client: SftpFileClient;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new SftpFileClient(mockLogger as any, mockConfig as any);
    });

    it('should call POST /files/move with correct payload and resolve on 2xx', async () => {
        mockPost.mockResolvedValueOnce({ status: 200, data: {} });

        await expect(
            client.move('/tagus/pareal/file.json', '/tagus/pareal/historial/file.json', true),
        ).resolves.toBeUndefined();

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith('/files/move', {
            sourcePath: '/tagus/pareal/file.json',
            destinationPath: '/tagus/pareal/historial/file.json',
            overwrite: true,
        });
    });

    it('should default overwrite to false when not provided', async () => {
        mockPost.mockResolvedValueOnce({ status: 200, data: {} });

        await client.move('/src/path.json', '/dst/path.json');

        expect(mockPost).toHaveBeenCalledWith('/files/move', {
            sourcePath: '/src/path.json',
            destinationPath: '/dst/path.json',
            overwrite: false,
        });
    });

    it('should throw ProviderError when the axios call rejects with an AxiosError (non-2xx)', async () => {
        const axiosError = Object.assign(new Error('Request failed with status code 500'), {
            isAxiosError: true,
            response: { status: 500 },
        });
        mockPost.mockRejectedValueOnce(axiosError);
        // Make axios.isAxiosError recognise our fake error
        jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true);

        await expect(client.move('/src/path.json', '/dst/path.json')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should throw ProviderError on a generic (non-axios) error', async () => {
        mockPost.mockRejectedValueOnce(new Error('Network unreachable'));

        await expect(client.move('/src/path.json', '/dst/path.json')).rejects.toBeInstanceOf(ProviderError);
    });
});
