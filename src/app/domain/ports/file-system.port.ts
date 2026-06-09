/**
 * Domain port for filesystem operations used by meteo workflows.
 *
 * Keeping this behind a port lets the application layer stay free of
 * direct `node:fs` imports. The default infrastructure implementation
 * delegates to `node:fs/promises`; tests substitute an in-memory mock.
 */
export abstract class IFileSystem {
    /** Recursively create a directory (no-op if it exists). */
    abstract mkdir(path: string): Promise<void>;

    /** Write a UTF-8 text file (overwrite if it exists). */
    abstract writeFile(path: string, content: string): Promise<void>;

    /** Delete a file. Best-effort: should NOT throw if the file does not exist. */
    abstract deleteFile(path: string): Promise<void>;

    /** List filenames (not full paths) in a directory. Returns empty array if directory does not exist. */
    abstract listFiles(directory: string): Promise<string[]>;
}
