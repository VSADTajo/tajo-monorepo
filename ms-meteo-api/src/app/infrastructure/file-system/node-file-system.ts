import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { Logger } from 'nestjs-pino';

import { IFileSystem } from '@domain/ports/file-system.port';

@Injectable()
export class NodeFileSystem extends IFileSystem {
    constructor(@Inject(Logger) private readonly logger: Logger) {
        super();
    }

    async mkdir(path: string): Promise<void> {
        await fs.mkdir(path, { recursive: true });
    }

    async writeFile(path: string, content: string): Promise<void> {
        await fs.writeFile(path, content, 'utf8');
    }

    async deleteFile(path: string): Promise<void> {
        try {
            await fs.unlink(path);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.warn({ msg: 'Failed to delete file', entity: 'MeteoSync', path, error: String(err) });
            }
        }
    }

    async listFiles(directory: string): Promise<string[]> {
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            return entries.filter((e) => e.isFile()).map((e) => e.name);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }
}
