import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ name: 'mv_cht_unificada' })
export class MvChtUnificada {
    @ViewColumn()
    origen: string;

    @ViewColumn()
    codigo: string;

    @ViewColumn()
    nombre: string;

    @ViewColumn({ name: 'tipo_cod' })
    tipoCod: string;

    @ViewColumn()
    x: number;

    @ViewColumn()
    y: number;

    @ViewColumn({ name: 'search_text' })
    searchText: string;
}
