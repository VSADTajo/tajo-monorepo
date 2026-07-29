/** The two SFTP sub-folders a simulation owns. Read-only surface — no other folder is reachable. */
export type SimulationFolder = 'input' | 'output';

export const SIMULATION_FOLDERS: readonly SimulationFolder[] = ['input', 'output'];

/**
 * What happened to a model output file.
 *
 * ms-model-api moves each result out of `output/` as soon as it polls it:
 * to `historial/` when it parses, to `corrupted/` when it does not. Listing
 * only `output/` therefore shows the file just while nothing has been done
 * with it, and hides it precisely once it has been processed — or failed.
 */
export type SimulationFileStatus = 'pending' | 'processed' | 'failed';

/** Sub-folders ms-model-api moves processed output files into. */
export const OUTPUT_SUBFOLDERS: Readonly<Record<string, SimulationFileStatus>> = {
    historial: 'processed',
    corrupted: 'failed',
};

/** A single file entry inside a simulation's SFTP folder. */
export interface SftpFileMeta {
    name: string;
    size: number;
    modifiedAt: string | null;
    /** Always 'pending' for input files; reflects the sub-folder for output ones. */
    status: SimulationFileStatus;
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
