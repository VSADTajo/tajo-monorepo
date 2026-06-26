/** The two SFTP sub-folders a simulation owns. Read-only surface — no other folder is reachable. */
export type SimulationFolder = 'input' | 'output';

export const SIMULATION_FOLDERS: readonly SimulationFolder[] = ['input', 'output'];

/** A single file entry inside a simulation's SFTP folder. */
export interface SftpFileMeta {
    name: string;
    size: number;
    modifiedAt: string | null;
}

/** Listing of the input and output files of a simulation. */
export class SimulationFilesResult {
    readonly input: SftpFileMeta[];
    readonly output: SftpFileMeta[];

    constructor(params: { input: SftpFileMeta[]; output: SftpFileMeta[] }) {
        this.input = params.input;
        this.output = params.output;
    }
}

/** A single simulation file downloaded as a buffer, ready to stream back to the client. */
export class SimulationFileDownloadResult {
    readonly content: Buffer;
    readonly fileName: string;
    readonly contentType: string;

    constructor(params: { content: Buffer; fileName: string; contentType: string }) {
        this.content = params.content;
        this.fileName = params.fileName;
        this.contentType = params.contentType;
    }
}
