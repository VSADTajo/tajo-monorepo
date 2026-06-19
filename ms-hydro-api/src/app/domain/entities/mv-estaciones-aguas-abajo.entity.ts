import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ name: 'mv_estaciones_aguas_abajo' })
export class MvEstacionesAguasAbajo {
    @ViewColumn({ name: 'codigo_origen' })
    codigoOrigen: string;

    @ViewColumn({ name: 'codigo_destino' })
    codigoDestino: string;

    @ViewColumn({ name: 'nombre_destino' })
    nombreDestino: string;

    @ViewColumn({ name: 'tipo_destino' })
    tipoDestino: string;
}
