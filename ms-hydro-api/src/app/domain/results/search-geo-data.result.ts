export class SearchGeoDataResult {
    readonly origen: string;
    readonly codigo: string;
    readonly nombre: string;
    readonly tipoCod: string;
    readonly x: number;
    readonly y: number;
    readonly searchText: string;

    constructor(params: {
        origen: string;
        codigo: string;
        nombre: string;
        tipoCod: string;
        x: number;
        y: number;
        searchText: string;
    }) {
        this.origen = params.origen;
        this.codigo = params.codigo;
        this.nombre = params.nombre;
        this.tipoCod = params.tipoCod;
        this.x = params.x;
        this.y = params.y;
        this.searchText = params.searchText;
    }
}
