/**
 * AEMET CAP alert event type codes.
 * Extracted from the eventCode field: <valueName>AEMET-Meteoalerta fenomeno</valueName>
 * Format in XML: "CODE;Name" (e.g., "AT;Temperaturas máximas")
 */
export const AEMET_EVENT_TYPES = [
    { code: 'AT', name: 'Temperaturas máximas' },
    { code: 'BT', name: 'Temperaturas mínimas' },
    { code: 'PR', name: 'Lluvias' },
    { code: 'NE', name: 'Nevadas' },
    { code: 'NI', name: 'Nieblas' },
    { code: 'VI', name: 'Vientos' },
    { code: 'TO', name: 'Tormentas' },
    { code: 'CO', name: 'Costeros' },
    { code: 'GA', name: 'Galernas' },
    { code: 'AL', name: 'Aludes' },
    { code: 'DH', name: 'Deshielos' },
    { code: 'VS', name: 'Polvo en suspensión' },
    { code: 'RI', name: 'Rissagas' },
] as const;

export type AemetEventTypeCode = (typeof AEMET_EVENT_TYPES)[number]['code'];

/** Valid AEMET event type codes for validation */
export const AEMET_EVENT_TYPE_CODES: readonly string[] = AEMET_EVENT_TYPES.map((t) => t.code);

/**
 * INE province codes for the Tajo basin (Cuenca del Tajo).
 * Used to filter AEMET alerts to only those relevant to the project scope.
 * The province code is extracted from the geocode field positions 2-3.
 */
export const TAJO_PROVINCE_CODES = ['05', '06', '10', '13', '16', '19', '28', '40', '45'] as const;

export type TajoProvinceCode = (typeof TAJO_PROVINCE_CODES)[number];

export const TAJO_PROVINCES = [
    { code: '05', name: 'Ávila' },
    { code: '06', name: 'Badajoz' },
    { code: '10', name: 'Cáceres' },
    { code: '13', name: 'Ciudad Real' },
    { code: '16', name: 'Cuenca' },
    { code: '19', name: 'Guadalajara' },
    { code: '28', name: 'Madrid' },
    { code: '40', name: 'Segovia' },
    { code: '45', name: 'Toledo' },
] as const;
