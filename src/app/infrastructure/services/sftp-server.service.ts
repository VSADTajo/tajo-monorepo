import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as ssh2 from 'ssh2';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import * as bcrypt from 'bcryptjs';

import { SftpServerConfigService } from '@config/sftp-server/sftp-server-config.service';
import { StorageConfigService } from '@config/storage/storage-config.service';
import { SftpServerUser } from '@config/sftp-server/sftp-server-config.type';
import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';

const SFTP_STATUS = ssh2.utils.sftp.STATUS_CODE;
const SFTP_OPEN_MODE = ssh2.utils.sftp.OPEN_MODE;

interface HandleInfo {
    path: string;
    fd: number;
    flags: number;
}

interface DirHandle {
    path: string;
    entries: ssh2.FileEntry[] | null;
}

@Injectable()
export class SftpServerService implements OnModuleInit, OnModuleDestroy {
    private server: ssh2.Server | null = null;
    private activeConnections = new Set<ssh2.Connection>();

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly config: SftpServerConfigService,
        private readonly storageConfig: StorageConfigService,
        private readonly sftpUserRepository: ISftpUserRepository,
    ) {}

    async onModuleInit(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.log('SFTP Server is disabled');
            return;
        }

        const hostKey = await this.loadOrGenerateHostKey();

        this.server = new ssh2.Server({ hostKeys: [hostKey] }, (client, info) => {
            this.handleConnection(client, info);
        });

        this.server.listen(this.config.port, '0.0.0.0', () => {
            this.logger.log(`SFTP Server listening on port ${this.config.port}`);
        });
    }

    async onModuleDestroy(): Promise<void> {
        if (!this.server) return;

        for (const conn of this.activeConnections) {
            conn.end();
        }
        this.activeConnections.clear();

        await new Promise<void>((resolve) => {
            this.server!.close(() => resolve());
        });
        this.logger.log('SFTP Server stopped');
    }

    private async loadOrGenerateHostKey(): Promise<string> {
        const keyPath = this.config.hostKeyPath;

        try {
            const key = await fsPromises.readFile(keyPath, 'utf-8');
            this.logger.log(`Loaded SFTP host key from ${keyPath}`);
            return key;
        } catch {
            if (!this.config.autoGenerateHostKey) {
                throw new Error(`SFTP host key not found at ${keyPath} and auto-generation is disabled`);
            }

            this.logger.log(`Generating new ed25519 host key at ${keyPath}`);
            await fsPromises.mkdir(path.dirname(keyPath), { recursive: true });
            execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -q`);
            // Remove the .pub file — we only need the private key
            await fsPromises.unlink(`${keyPath}.pub`).catch(() => {});

            const privateKey = await fsPromises.readFile(keyPath, 'utf-8');
            return privateKey;
        }
    }

    private handleConnection(client: ssh2.Connection, info: ssh2.ClientInfo): void {
        if (this.activeConnections.size >= this.config.maxConnections) {
            this.logger.warn({ msg: 'Max SFTP connections reached', entity: 'SFTPServer', ip: info.ip });
            client.end();
            return;
        }

        this.activeConnections.add(client);
        this.logger.debug(`SFTP connection from ${info.ip}`);

        let authenticatedUser: SftpServerUser | null = null;

        client.on('authentication', (ctx) => {
            if (ctx.method !== 'password') {
                ctx.reject(['password']);
                return;
            }

            this.authenticateUser(ctx.username, ctx.password)
                .then((user) => {
                    if (user) {
                        authenticatedUser = user;
                        ctx.accept();
                    } else {
                        ctx.reject(['password']);
                    }
                })
                .catch((err) => {
                    this.logger.error({ msg: 'SFTP auth error', entity: 'SFTPServer', error: String(err) });
                    ctx.reject(['password']);
                });
        });

        client.on('ready', () => {
            this.logger.log(`SFTP user authenticated: ${authenticatedUser?.username}`);

            // Ensure user root directory exists
            if (authenticatedUser) {
                const userRoot = path.join(this.storageConfig.basePath, authenticatedUser.rootDirectory || '');
                fsPromises.mkdir(userRoot, { recursive: true }).catch((err) => {
                    this.logger.error({
                        msg: 'Failed to create user root directory',
                        entity: 'SFTPServer',
                        path: userRoot,
                        error: String(err),
                    });
                });
            }

            client.on('session', (accept) => {
                const session = accept();
                session.on('sftp', (accept) => {
                    const sftpStream = accept();
                    this.setupSftpHandlers(sftpStream, authenticatedUser!);
                });
            });
        });

        client.on('close', () => {
            this.activeConnections.delete(client);
            this.logger.debug(`SFTP connection closed: ${authenticatedUser?.username ?? info.ip}`);
        });

        client.on('error', (err) => {
            this.logger.error({ msg: 'SFTP client error', entity: 'SFTPServer', error: err.message });
            this.activeConnections.delete(client);
        });
    }

    private async authenticateUser(username: string, password: string): Promise<SftpServerUser | null> {
        // 1. Try DB first (active users only)
        try {
            const dbUser = await this.sftpUserRepository.findByUsername(username);
            if (dbUser && dbUser.isActive) {
                const passwordMatch = await bcrypt.compare(password, dbUser.password);
                if (passwordMatch) {
                    return {
                        username: dbUser.username,
                        password: dbUser.password,
                        rootDirectory: dbUser.rootDirectory,
                    };
                }
                return null;
            }
        } catch (error) {
            this.logger.error({ msg: 'SFTP DB auth lookup failed', entity: 'SFTPServer', error: String(error) });
        }

        // 2. Fallback to env var config
        const configUser = this.config.users.find((u) => u.username === username);
        if (configUser?.password && configUser.password === password) {
            return configUser;
        }

        return null;
    }

    private setupSftpHandlers(sftp: ssh2.SFTPWrapper, user: SftpServerUser): void {
        const fileHandles = new Map<number, HandleInfo>();
        const dirHandles = new Map<number, DirHandle>();
        let nextHandle = 0;

        const makeHandle = (): Buffer => {
            const id = nextHandle++;
            const buf = Buffer.alloc(4);
            buf.writeUInt32BE(id, 0);
            return buf;
        };

        const getHandleId = (handle: Buffer): number => {
            return handle.readUInt32BE(0);
        };

        const resolvePath = (requestedPath: string): string | null => {
            const userRoot = user.rootDirectory || '';
            const basePath = path.join(this.storageConfig.basePath, userRoot);
            const resolved = path.resolve(
                basePath,
                requestedPath.startsWith('/') ? '.' + requestedPath : requestedPath,
            );

            if (!resolved.startsWith(basePath)) {
                return null; // Path traversal attempt
            }
            return resolved;
        };

        // eslint-disable-next-line no-bitwise
        const hasFlag = (flags: number, flag: number): boolean => (flags & flag) !== 0;

        const mapOpenFlags = (flags: number): string => {
            const READ = SFTP_OPEN_MODE.READ;
            const WRITE = SFTP_OPEN_MODE.WRITE;
            const CREAT = SFTP_OPEN_MODE.CREAT;
            const TRUNC = SFTP_OPEN_MODE.TRUNC;
            const APPEND = SFTP_OPEN_MODE.APPEND;

            if (hasFlag(flags, READ) && hasFlag(flags, WRITE)) return 'r+';
            if (hasFlag(flags, WRITE) && hasFlag(flags, CREAT) && hasFlag(flags, TRUNC)) return 'w';
            if (hasFlag(flags, WRITE) && hasFlag(flags, CREAT) && hasFlag(flags, APPEND)) return 'a';
            if (hasFlag(flags, WRITE) && hasFlag(flags, CREAT)) return 'w';
            if (hasFlag(flags, WRITE)) return 'r+';
            return 'r';
        };

        const statsToAttrs = (stats: fs.Stats): ssh2.Attributes => {
            return {
                mode: stats.mode,
                uid: stats.uid,
                gid: stats.gid,
                size: stats.size,
                atime: Math.floor(stats.atimeMs / 1000),
                mtime: Math.floor(stats.mtimeMs / 1000),
            };
        };

        const mapFsError = (err: NodeJS.ErrnoException): number => {
            switch (err.code) {
                case 'ENOENT':
                    return SFTP_STATUS.NO_SUCH_FILE;
                case 'EACCES':
                case 'EPERM':
                    return SFTP_STATUS.PERMISSION_DENIED;
                case 'EEXIST':
                    return SFTP_STATUS.FAILURE;
                case 'ENOTDIR':
                    return SFTP_STATUS.NO_SUCH_FILE;
                case 'EISDIR':
                    return SFTP_STATUS.FAILURE;
                default:
                    return SFTP_STATUS.FAILURE;
            }
        };

        // ── OPEN ──
        sftp.on('OPEN', (reqId, filename, flags) => {
            const resolved = resolvePath(filename);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            const nodeFlags = mapOpenFlags(flags);
            const needsDir = nodeFlags === 'w' || nodeFlags === 'a';

            const doOpen = () => {
                fs.open(resolved, nodeFlags, 0o666, (err, fd) => {
                    if (err) {
                        sftp.status(reqId, mapFsError(err));
                        return;
                    }
                    const handle = makeHandle();
                    fileHandles.set(getHandleId(handle), { path: resolved, fd, flags });
                    sftp.handle(reqId, handle);
                });
            };

            if (needsDir) {
                fs.mkdir(path.dirname(resolved), { recursive: true }, (mkdirErr) => {
                    if (mkdirErr) {
                        sftp.status(reqId, mapFsError(mkdirErr));
                        return;
                    }
                    doOpen();
                });
            } else {
                doOpen();
            }
        });

        // ── READ ──
        sftp.on('READ', (reqId, handle, offset, length) => {
            const info = fileHandles.get(getHandleId(handle));
            if (!info) {
                sftp.status(reqId, SFTP_STATUS.FAILURE);
                return;
            }

            const buf = Buffer.alloc(length);
            fs.read(info.fd, buf, 0, length, offset, (err, bytesRead) => {
                if (err) {
                    sftp.status(reqId, SFTP_STATUS.FAILURE);
                    return;
                }
                if (bytesRead === 0) {
                    sftp.status(reqId, SFTP_STATUS.EOF);
                    return;
                }
                sftp.data(reqId, buf.subarray(0, bytesRead));
            });
        });

        // ── WRITE ──
        sftp.on('WRITE', (reqId, handle, offset, data) => {
            const info = fileHandles.get(getHandleId(handle));
            if (!info) {
                sftp.status(reqId, SFTP_STATUS.FAILURE);
                return;
            }

            fs.write(info.fd, data, 0, data.length, offset, (err) => {
                if (err) {
                    sftp.status(reqId, SFTP_STATUS.FAILURE);
                    return;
                }
                sftp.status(reqId, SFTP_STATUS.OK);
            });
        });

        // ── CLOSE ──
        sftp.on('CLOSE', (reqId, handle) => {
            const handleId = getHandleId(handle);
            const fileInfo = fileHandles.get(handleId);
            const dirInfo = dirHandles.get(handleId);

            if (fileInfo) {
                fs.close(fileInfo.fd, () => {
                    fileHandles.delete(handleId);
                    sftp.status(reqId, SFTP_STATUS.OK);
                });
                return;
            }

            if (dirInfo) {
                dirHandles.delete(handleId);
                sftp.status(reqId, SFTP_STATUS.OK);
                return;
            }

            sftp.status(reqId, SFTP_STATUS.FAILURE);
        });

        // ── FSTAT ──
        sftp.on('FSTAT', (reqId, handle) => {
            const info = fileHandles.get(getHandleId(handle));
            if (!info) {
                sftp.status(reqId, SFTP_STATUS.FAILURE);
                return;
            }

            fs.fstat(info.fd, (err, stats) => {
                if (err) {
                    sftp.status(reqId, SFTP_STATUS.FAILURE);
                    return;
                }
                sftp.attrs(reqId, statsToAttrs(stats));
            });
        });

        // ── STAT ──
        sftp.on('STAT', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.stat(resolved, (err, stats) => {
                if (err) {
                    sftp.status(reqId, mapFsError(err));
                    return;
                }
                sftp.attrs(reqId, statsToAttrs(stats));
            });
        });

        // ── LSTAT ──
        sftp.on('LSTAT', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.lstat(resolved, (err, stats) => {
                if (err) {
                    sftp.status(reqId, mapFsError(err));
                    return;
                }
                sftp.attrs(reqId, statsToAttrs(stats));
            });
        });

        // ── OPENDIR ──
        sftp.on('OPENDIR', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.readdir(resolved, { withFileTypes: true }, (err, entries) => {
                if (err) {
                    sftp.status(reqId, mapFsError(err));
                    return;
                }

                const fileEntries: ssh2.FileEntry[] = [];
                let pending = entries.length;

                if (pending === 0) {
                    const handle = makeHandle();
                    dirHandles.set(getHandleId(handle), { path: resolved, entries: fileEntries });
                    sftp.handle(reqId, handle);
                    return;
                }

                for (const entry of entries) {
                    const fullPath = path.join(resolved, entry.name);
                    fs.stat(fullPath, (statErr, stats) => {
                        if (!statErr) {
                            fileEntries.push({
                                filename: entry.name,
                                longname: this.formatLongname(entry.name, stats),
                                attrs: statsToAttrs(stats),
                            });
                        }
                        pending--;
                        if (pending === 0) {
                            const handle = makeHandle();
                            dirHandles.set(getHandleId(handle), { path: resolved, entries: fileEntries });
                            sftp.handle(reqId, handle);
                        }
                    });
                }
            });
        });

        // ── READDIR ──
        sftp.on('READDIR', (reqId, handle) => {
            const info = dirHandles.get(getHandleId(handle));
            if (!info) {
                sftp.status(reqId, SFTP_STATUS.FAILURE);
                return;
            }

            if (info.entries === null) {
                sftp.status(reqId, SFTP_STATUS.EOF);
                return;
            }

            sftp.name(reqId, info.entries);
            info.entries = null; // Next call returns EOF
        });

        // ── REALPATH ──
        sftp.on('REALPATH', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            // Return the virtual path within the chroot
            const userRoot = user.rootDirectory || '';
            const basePath = path.join(this.storageConfig.basePath, userRoot);
            let virtualPath = '/' + path.relative(basePath, resolved);
            if (virtualPath === '/.') virtualPath = '/';

            fs.stat(resolved, (err, stats) => {
                const attrs = err ? { mode: 0, uid: 0, gid: 0, size: 0, atime: 0, mtime: 0 } : statsToAttrs(stats);
                sftp.name(reqId, [
                    {
                        filename: virtualPath,
                        longname: virtualPath,
                        attrs,
                    },
                ]);
            });
        });

        // ── REMOVE ──
        sftp.on('REMOVE', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.unlink(resolved, (err) => {
                sftp.status(reqId, err ? mapFsError(err) : SFTP_STATUS.OK);
            });
        });

        // ── RENAME ──
        sftp.on('RENAME', (reqId, oldPath, newPath) => {
            const resolvedOld = resolvePath(oldPath);
            const resolvedNew = resolvePath(newPath);
            if (!resolvedOld || !resolvedNew) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.rename(resolvedOld, resolvedNew, (err) => {
                sftp.status(reqId, err ? mapFsError(err) : SFTP_STATUS.OK);
            });
        });

        // ── MKDIR ──
        sftp.on('MKDIR', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.mkdir(resolved, { recursive: true }, (err) => {
                sftp.status(reqId, err ? mapFsError(err) : SFTP_STATUS.OK);
            });
        });

        // ── RMDIR ──
        sftp.on('RMDIR', (reqId, reqPath) => {
            const resolved = resolvePath(reqPath);
            if (!resolved) {
                sftp.status(reqId, SFTP_STATUS.PERMISSION_DENIED);
                return;
            }

            fs.rmdir(resolved, (err) => {
                sftp.status(reqId, err ? mapFsError(err) : SFTP_STATUS.OK);
            });
        });

        // ── SETSTAT / FSETSTAT ── (no-op)
        sftp.on('SETSTAT', (reqId) => {
            sftp.status(reqId, SFTP_STATUS.OK);
        });

        sftp.on('FSETSTAT', (reqId) => {
            sftp.status(reqId, SFTP_STATUS.OK);
        });
    }

    private formatLongname(name: string, stats: fs.Stats): string {
        const type = stats.isDirectory() ? 'd' : '-';
        const size = stats.size.toString().padStart(10);
        const date = stats.mtime.toISOString().substring(0, 10);
        return `${type}rwxr-xr-x 1 owner group ${size} ${date} ${name}`;
    }
}
