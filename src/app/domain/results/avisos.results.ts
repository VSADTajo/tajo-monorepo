import { AemetGeoJsonCollection } from '@domain/ports/aemet-client.port';

export class GetAvisosResult {
    readonly geojson: AemetGeoJsonCollection;

    constructor(params: { geojson: AemetGeoJsonCollection }) {
        this.geojson = params.geojson;
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosTipos
// ─────────────────────────────────────────────────────────────

export interface AvisoTipoItem {
    code: string;
    name: string;
}

export class GetAvisosTiposResult {
    readonly tipos: AvisoTipoItem[];

    constructor(params: { tipos: AvisoTipoItem[] }) {
        this.tipos = params.tipos;
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosResumen
// ─────────────────────────────────────────────────────────────

export interface CategoriaActivaItem {
    code: string;
    name: string;
    count: number;
}

export class GetAvisosResumenResult {
    readonly categoriasActivas: CategoriaActivaItem[];
    readonly totalAvisos: number;

    constructor(params: { categoriasActivas: CategoriaActivaItem[]; totalAvisos: number }) {
        this.categoriasActivas = params.categoriasActivas;
        this.totalAvisos = params.totalAvisos;
    }
}
