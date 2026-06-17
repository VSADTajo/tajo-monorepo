import * as XLSX from 'xlsx';

/**
 * Represents a single resguardo row to include in the XLS.
 * - embalseName: must be a key in EMBALSE_TO_CODE (e.g. 'ENTREPEÑAS' → 'E_01')
 * - dateStr: hydrological date string, e.g. '1oct', '15ene'
 * - vol: originalReserveVolume
 * - cota: originalReserveLevel
 * - volMin: originalMinimumVolume
 */
export interface ResguardoXlsRow {
    embalseName: string;
    dateStr: string;
    vol: number | null;
    cota: number | null;
    volMin: number | null;
}

/**
 * Builds an in-memory XLSX buffer using the multi-sheet "PRESAS EXPLOTACION" format
 * that ResguardoImportService.parseXls() auto-detects and processes.
 *
 * Layout per embalse: 5-column group [Fecha, Vol.Resguardo, Cota, Vol.Minimo, (separator)]
 * - Row index 0: placeholder
 * - Row index 1: embalse headers — "EMBALSE" at colIndex, name at colIndex+1
 * - Row index 2: placeholder
 * - Row index 3: column sub-headers
 * - Row index 4: units
 * - Row index 5+: data rows
 */
export function buildResguardoXlsBuffer(rows: ResguardoXlsRow[]): Buffer {
    const wb = XLSX.utils.book_new();

    // Group rows by embalseName to build columnar layout
    const embalseMap = new Map<string, ResguardoXlsRow[]>();
    for (const row of rows) {
        const existing = embalseMap.get(row.embalseName) ?? [];
        existing.push(row);
        embalseMap.set(row.embalseName, existing);
    }

    const embalseNames = Array.from(embalseMap.keys());
    // Each embalse occupies 5 columns: Fecha, Vol, Cota, VolMin, separator
    const COLS_PER_EMBALSE = 5;

    // Calculate max data rows needed
    let maxDataRows = 0;
    for (const embalseRows of embalseMap.values()) {
        if (embalseRows.length > maxDataRows) maxDataRows = embalseRows.length;
    }

    // Build the 2D array (AOA = array of arrays)
    // Total rows: 5 header rows + maxDataRows data rows
    // Total cols: embalseNames.length * COLS_PER_EMBALSE
    const totalRows = 5 + maxDataRows;
    const totalCols = embalseNames.length * COLS_PER_EMBALSE;

    const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () =>
        Array.from({ length: totalCols }, () => null),
    );

    // Fill header rows per embalse
    embalseNames.forEach((embalseName, embalseIdx) => {
        const colIndex = embalseIdx * COLS_PER_EMBALSE;

        // Row 1 (index 1): "EMBALSE" at colIndex, name at colIndex+1
        aoa[1][colIndex] = 'EMBALSE';
        aoa[1][colIndex + 1] = embalseName.toUpperCase();

        // Row 3 (index 3): sub-headers
        aoa[3][colIndex] = 'Fecha';
        aoa[3][colIndex + 1] = 'Vol. Resguardo';
        aoa[3][colIndex + 2] = 'Cota';
        aoa[3][colIndex + 3] = 'Vol. Mínimo';

        // Row 4 (index 4): units
        aoa[4][colIndex + 1] = 'Hm3';
        aoa[4][colIndex + 2] = 'm';
        aoa[4][colIndex + 3] = 'Hm3';

        // Data rows starting at index 5
        const embalseRows = embalseMap.get(embalseName) ?? [];
        embalseRows.forEach((row, rowOffset) => {
            const rowIdx = 5 + rowOffset;
            aoa[rowIdx][colIndex] = row.dateStr;
            aoa[rowIdx][colIndex + 1] = row.vol;
            aoa[rowIdx][colIndex + 2] = row.cota;
            aoa[rowIdx][colIndex + 3] = row.volMin;
        });
    });

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, sheet, 'PRESAS EXPLOTACION');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
