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
}
