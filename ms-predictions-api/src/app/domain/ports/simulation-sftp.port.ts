export abstract class ISimulationSftpService {
    abstract uploadInputFile(simulationId: string, content: Buffer): Promise<void>;
}
