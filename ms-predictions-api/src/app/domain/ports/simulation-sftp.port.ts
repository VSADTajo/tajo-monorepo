import { SftpFileMeta, SimulationFileDownloadResult, SimulationFolder } from '@domain/results/simulation-files.result';

export abstract class ISimulationSftpService {
    /**
     * Uploads a manual-simulation input file to the SFTP storage under
     * `tajo/SIMULATIONS/<simulationId>/input/<fileName>`.
     *
     * @param simulationId  The manual simulation ID (used as folder name)
     * @param fileName      The destination file name (e.g. `tagus_harmonie_Q_202606191200.json`)
     * @param content       The file content as a binary buffer
     */
    abstract uploadInputFile(simulationId: string, fileName: string, content: Buffer): Promise<void>;

    /**
     * Ensures the output folder exists in the SFTP storage at
     * `tajo/SIMULATIONS/<simulationId>/output/`, so the model can drop its
     * response file there. Idempotent (recursive mkdir).
     *
     * @param simulationId  The manual simulation ID (used as folder name)
     */
    abstract ensureOutputFolder(simulationId: string): Promise<void>;

    /**
     * Lists the files in a simulation's `input` and `output` folders. Read-only.
     * A folder that does not exist yet (e.g. `output` before the model runs)
     * resolves to an empty array rather than an error.
     *
     * @param simulationId  The simulation ID (used as folder name)
     */
    abstract listFiles(simulationId: string): Promise<{ input: SftpFileMeta[]; output: SftpFileMeta[] }>;

    /**
     * Downloads a single file from a simulation's `input` or `output` folder.
     * The full SFTP path is built server-side from the (already validated)
     * simulationId + folder + fileName — the caller never supplies a path.
     *
     * @param simulationId  The simulation ID (used as folder name)
     * @param folder        Either `input` or `output`
     * @param fileName      A safe, separator-free file name
     */
    abstract downloadFile(
        simulationId: string,
        folder: SimulationFolder,
        fileName: string,
    ): Promise<SimulationFileDownloadResult>;
}
