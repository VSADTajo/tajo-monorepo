export interface StationThresholdData {
    id: string;
    stationId: string;
    parametro: string | null;
    senal: string | null;
    umbralNivel1: number | null;
    umbralCaudal1: number | null;
    umbralNivel2: number | null;
    umbralCaudal2: number | null;
    umbralNivel3: number | null;
    umbralCaudal3: number | null;
    maxNivelMuro: number | null;
    maxNivelCaseta: number | null;
    umbralVolumen1: number | null;
    umbralVolumen2: number | null;
    umbralVolumen3: number | null;
    caudalEntrada: number | null;
    caudalSalida: number | null;
    capacidad: number | null;
}
