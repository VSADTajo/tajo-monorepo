import { webcrypto } from 'crypto';
import { Blob } from 'buffer';

// Polyfill for Node 18 (crypto is not global)
if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// Polyfill for Node 18 (File is not global, required by undici/testcontainers)
if (typeof globalThis.File === 'undefined') {
    class File extends Blob {
        name: string;
        lastModified: number;
        constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
            super(chunks, options);
            this.name = name;
            this.lastModified = options?.lastModified ?? Date.now();
        }
    }
    Object.defineProperty(globalThis, 'File', { value: File });
}
