// ─────────────────────────────────────────────────────────────
// DownstreamStationItem
// ─────────────────────────────────────────────────────────────

export class DownstreamStationItem {
    readonly codigoDestino: string;
    readonly nombreDestino: string;
    readonly tipoDestino: string;

    constructor(params: { codigoDestino: string; nombreDestino: string; tipoDestino: string }) {
        this.codigoDestino = params.codigoDestino;
        this.nombreDestino = params.nombreDestino;
        this.tipoDestino = params.tipoDestino;
    }
}

// ─────────────────────────────────────────────────────────────
// DownstreamStationsResult
// ─────────────────────────────────────────────────────────────

export class DownstreamStationsResult {
    readonly items: DownstreamStationItem[];
    readonly count: number;

    constructor(params: { items: DownstreamStationItem[] }) {
        this.items = params.items;
        this.count = params.items.length;
    }
}
