import { StationType } from './station-type.enum';

// ─────────────────────────────────────────────────────────────
// Zona → Basin Code/Name mapping
// ─────────────────────────────────────────────────────────────

const ZONA_TO_CODE: Record<string, string> = {
    CABECERA: 'CABECERA',
    MADRID: 'MADRID',
    HENARES: 'HENARES',
    TIÉTAR: 'TIETAR',
    ALBERCHE: 'ALBERCHE',
    'TAJO IZQUIERDA': 'TAJO-IZQUIERDA',
    ÁRRAGO: 'ARRAGO',
    'BAJO TAJO': 'BAJO-TAJO',
    ALAGÓN: 'ALAGON',
    JARAMA: 'JARAMA',
    TAJUÑA: 'TAJUNA',
};

const ZONA_TO_NAME: Record<string, string> = {
    CABECERA: 'Cabecera',
    MADRID: 'Madrid',
    HENARES: 'Henares',
    TIÉTAR: 'Tiétar',
    ALBERCHE: 'Alberche',
    'TAJO IZQUIERDA': 'Tajo Izquierda',
    ÁRRAGO: 'Árrago',
    'BAJO TAJO': 'Bajo Tajo',
    ALAGÓN: 'Alagón',
    JARAMA: 'Jarama',
    TAJUÑA: 'Tajuña',
};

export function zonaToBasinCode(zona: string): string {
    const code = ZONA_TO_CODE[zona];
    if (code) return code;
    // Fallback: remove diacritics, replace spaces with hyphens, uppercase
    return zona
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .toUpperCase();
}

export function zonaToBasinName(zona: string): string {
    return ZONA_TO_NAME[zona] ?? zona;
}

// ─────────────────────────────────────────────────────────────
// tipo_cod → StationType mapping
// ─────────────────────────────────────────────────────────────

const TIPO_COD_TO_STATION_TYPE: Record<string, StationType> = {
    AR: StationType.AFORO_EN_RIO,
    AC: StationType.AFOROS_EN_CANAL,
    E: StationType.EMBALSE_SAIH,
    P: StationType.PLUVIOMETRO,
    N: StationType.TELENIVOMETRO,
    IM: StationType.IMPULSION,
    MC: StationType.MARCO_DE_CONTROL,
};

export function tipoCodToStationType(tipoCod: string): StationType {
    const stationType = TIPO_COD_TO_STATION_TYPE[tipoCod];
    if (stationType) return stationType;
    // Fallback: default to MARCO_DE_CONTROL for unknown codes
    return StationType.MARCO_DE_CONTROL;
}
