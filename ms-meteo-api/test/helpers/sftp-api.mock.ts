import { ISftpFileClient, SftpFileEntry } from '../../src/app/domain/ports/sftp-file-client.port';
import { ProviderError } from '../../src/app/domain/errors/provider.error';

export interface MockSftpDirNode {
    type: 'dir';
    name: string;
    children: Record<string, MockSftpNode>;
}

export interface MockSftpFileNode {
    type: 'file';
    name: string;
    content?: string; // for text files (info.json, ...)
    binary?: Buffer; // for raster files
    modifiedAt?: string;
}

export type MockSftpNode = MockSftpDirNode | MockSftpFileNode;

/**
 * Test double for `ISftpFileClient` backed by an in-memory tree.
 *
 * Build the tree once with `buildSftpTree({ ... })` and inject this client into
 * the test NestJS module. Tests can also call `client.failNextCall(...)` to
 * simulate sftp-api outages.
 */
export class InMemorySftpFileClient extends ISftpFileClient {
    private root: MockSftpDirNode;
    private failureToInject: { context: string; message: string } | null = null;
    public listCalls = 0;
    public readCalls = 0;
    public downloadCalls = 0;
    public moveCalls = 0;
    public moveLog: Array<{ sourcePath: string; destinationPath: string; overwrite: boolean }> = [];

    constructor(root: MockSftpDirNode) {
        super();
        this.root = root;
    }

    setRoot(root: MockSftpDirNode): void {
        this.root = root;
    }

    failNextCall(context: string, message = 'mock failure'): void {
        this.failureToInject = { context, message };
    }

    async listDirectory(directoryPath: string): Promise<SftpFileEntry[]> {
        this.listCalls++;
        this.checkFailure('list', directoryPath);
        const node = this.lookup(directoryPath);
        if (!node || node.type !== 'dir') {
            return [];
        }
        return Object.values(node.children).map((child) => this.toEntry(child, directoryPath));
    }

    async readText(filePath: string): Promise<string> {
        this.readCalls++;
        this.checkFailure('read', filePath);
        const node = this.lookup(filePath);
        if (!node || node.type !== 'file') {
            throw new ProviderError(`Mock: file not found ${filePath}`);
        }
        if (node.content === undefined) {
            throw new ProviderError(`Mock: file ${filePath} has no text content`);
        }
        return node.content;
    }

    async download(filePath: string): Promise<Buffer> {
        this.downloadCalls++;
        this.checkFailure('download', filePath);
        const node = this.lookup(filePath);
        if (!node || node.type !== 'file') {
            throw new ProviderError(`Mock: file not found ${filePath}`);
        }
        if (node.binary) return node.binary;
        if (node.content !== undefined) return Buffer.from(node.content, 'utf8');
        throw new ProviderError(`Mock: file ${filePath} has no content`);
    }

    async move(sourcePath: string, destinationPath: string, overwrite = false): Promise<void> {
        this.moveCalls++;
        this.moveLog.push({ sourcePath, destinationPath, overwrite });
        this.checkFailure('move', sourcePath);

        const sourceNode = this.lookup(sourcePath);
        if (!sourceNode || sourceNode.type !== 'file') {
            throw new ProviderError(`Mock: source file not found for move: ${sourcePath}`);
        }

        // Resolve destination dir + filename
        const destParts = destinationPath.split('/').filter(Boolean);
        const destFileName = destParts[destParts.length - 1];
        const destDirPath = '/' + destParts.slice(0, -1).join('/');
        let destDir = this.lookup(destDirPath);

        // Auto-create destination directory
        if (!destDir || destDir.type !== 'dir') {
            const allParts = destDirPath.split('/').filter(Boolean);
            let cursor: MockSftpDirNode = this.root;
            for (const seg of allParts) {
                if (!cursor.children[seg]) {
                    cursor.children[seg] = { type: 'dir', name: seg, children: {} };
                }
                const next: MockSftpNode = cursor.children[seg];
                if (next.type !== 'dir') throw new ProviderError(`Mock: path conflict at ${seg}`);
                cursor = next;
            }
            destDir = cursor;
        }

        if (!overwrite && (destDir as MockSftpDirNode).children[destFileName]) {
            throw new ProviderError(`Mock: destination already exists: ${destinationPath}`);
        }

        // Move: copy to dest then remove from source
        (destDir as MockSftpDirNode).children[destFileName] = { ...sourceNode, name: destFileName };

        const sourceParts = sourcePath.split('/').filter(Boolean);
        const sourceParentPath = '/' + sourceParts.slice(0, -1).join('/');
        const sourceParentNode = this.lookup(sourceParentPath);
        if (sourceParentNode && sourceParentNode.type === 'dir') {
            delete sourceParentNode.children[sourceParts[sourceParts.length - 1]];
        }
    }

    private checkFailure(op: string, path: string): void {
        if (this.failureToInject && (this.failureToInject.context === op || this.failureToInject.context === path)) {
            const f = this.failureToInject;
            this.failureToInject = null;
            throw new ProviderError(`Mock failure: ${f.message}`);
        }
    }

    private lookup(path: string): MockSftpNode | null {
        const segments = path.split('/').filter(Boolean);
        let current: MockSftpNode = this.root;
        for (const seg of segments) {
            if (current.type !== 'dir') return null;
            const next: MockSftpNode | undefined = current.children[seg];
            if (!next) return null;
            current = next;
        }
        return current;
    }

    private toEntry(node: MockSftpNode, parentPath: string): SftpFileEntry {
        const path = `${parentPath}/${node.name}`;
        if (node.type === 'dir') {
            return { name: node.name, path, size: 0, modifiedAt: '2026-01-01T00:00:00Z', isDirectory: true };
        }
        const size = node.binary?.length ?? Buffer.byteLength(node.content ?? '', 'utf8');
        return {
            name: node.name,
            path,
            size,
            modifiedAt: node.modifiedAt ?? '2026-01-01T00:00:00Z',
            isDirectory: false,
        };
    }
}

/**
 * Convenience builder. Pass an object literal where keys are paths under
 * the root and values are file contents (string for text, Buffer for binary).
 *
 * Example:
 *   buildSftpTree('tajo/METEO', {
 *     'RADAR/info.json': '{"nombre":...}',
 *     'RADAR/radarprec0000.000': Buffer.from(...),
 *     'HARMONIE/Precipitacion/info.json': '...',
 *   });
 */
export function buildSftpTree(rootName: string, files: Record<string, string | Buffer>): MockSftpDirNode {
    const segments = rootName.split('/').filter(Boolean);
    const ensureDir = (parent: MockSftpDirNode, name: string): MockSftpDirNode => {
        if (!parent.children[name]) {
            parent.children[name] = { type: 'dir', name, children: {} };
        }
        const node: MockSftpNode = parent.children[name];
        if (node.type !== 'dir') throw new Error(`Conflict: ${name} is not a directory`);
        return node;
    };

    const topRoot: MockSftpDirNode = { type: 'dir', name: '', children: {} };
    let cursor: MockSftpDirNode = topRoot;
    for (const seg of segments) {
        cursor = ensureDir(cursor, seg);
    }

    for (const [filePath, content] of Object.entries(files)) {
        const parts = filePath.split('/').filter(Boolean);
        let dir = cursor;
        for (let i = 0; i < parts.length - 1; i++) {
            dir = ensureDir(dir, parts[i]);
        }
        const fileName = parts[parts.length - 1];
        const node: MockSftpFileNode = { type: 'file', name: fileName };
        if (typeof content === 'string') {
            node.content = content;
        } else {
            node.binary = content;
        }
        dir.children[fileName] = node;
    }

    return topRoot;
}
