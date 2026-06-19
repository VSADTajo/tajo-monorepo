export abstract class IDownstreamStationsRepository {
    abstract findDownstream(
        codes: string[],
    ): Promise<{ codigoDestino: string; nombreDestino: string; tipoDestino: string }[]>;
}
