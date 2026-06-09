/**
 * One entry returned by sftp-api `GET /files?directory=...`.
 */
export interface SftpFileEntry {
    name: string;
    path: string;
    size: number;
    modifiedAt: string; // ISO 8601
    isDirectory: boolean;
}

/**
 * Domain port for the HTTP client that talks to ms-sftp-api.
 *
 * Implementations must:
 * - send the `x-internal-caller` header (whitelist auth)
 * - throw a `ProviderError` on non-2xx responses
 * - reject any path that escapes the configured base path (defense in depth)
 */
export abstract class ISftpFileClient {
    /** Lists immediate children of a directory under the SFTP storage base path. */
    abstract listDirectory(path: string): Promise<SftpFileEntry[]>;

    /** Reads a small text file (e.g. info.json). Throws on files larger than the server-side limit. */
    abstract readText(path: string): Promise<string>;

    /** Downloads a binary file (e.g. raster) into memory as a Buffer. */
    abstract download(path: string): Promise<Buffer>;
}
