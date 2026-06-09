import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as XLSX from 'xlsx';
import { Organismo } from '@domain/types/organismo.enum';
import { ResguardoImportRow } from '@application/commands/resguardo.commands';

/**
 * Maps sheet names from the XLS file to Organismo enum values.
 */
const SHEET_TO_ORGANISMO: Record<string, Organismo> = {
    'PRESAS EXPLOTACION': Organismo.EXPLOTACION,
    'PRESAS PROYECTOS Y OBRAS': Organismo.PROYECTOS_Y_OBRAS,
    'PRESAS CYII': Organismo.CYII,
    'PRESAS UNION FENOSA': Organismo.UNION_FENOSA,
    'PRESAS IBERDROLA': Organismo.IBERDROLA,
    'OTROS USUARIOS': Organismo.OTROS,
};

/**
 * Maps embalse names (as they appear in the XLS) to station codes.
 * This is derived from the "datos SAIH" sheet.
 */
const EMBALSE_TO_CODE: Record<string, string> = {
    ENTREPEÑAS: 'E_01',
    ENTREPENAS: 'E_01',
    BUENDIA: 'E_03',
    BUENDÍA: 'E_03',
    BOLARQUE: 'E_04',
    ZORITA: 'E_05',
    ALMOGUERA: 'E_06',
    VALDAJOS: 'E_07',
    PALMACES: 'E_08',
    PÁLMACES: 'E_08',
    ALCORLO: 'E_09',
    'POZO DE LOS RAMOS': 'E_10',
    BELEÑA: 'E_11',
    'LA TAJERA': 'E_12',
    'EL VADO': 'E_13',
    'EL ATAZAR': 'E_14',
    SANTILLANA: 'E_15',
    'MANZANARES EL REAL': 'E_15',
    VALMAYOR: 'E_16',
    BURGUILLO: 'E_17',
    'EL BURGUILLO': 'E_17',
    'CHARCO DEL CURA': 'E_18',
    'SAN JUAN': 'E_19',
    PICADAS: 'E_20',
    'EL PARDO': 'E_21',
    'DEL REY': 'E_22',
    FINISTERRE: 'E_23',
    'EL CASTRO': 'E_24',
    CAZALEGAS: 'E_25',
    GUAJARAZ: 'E_26',
    CASTREJON: 'E_27',
    CASTREJÓN: 'E_27',
    'EL TORCON': 'E_28',
    'EL TORCÓN': 'E_28',
    AZUTAN: 'E_29',
    AZUTÁN: 'E_29',
    VALDECAÑAS: 'E_30',
    VALDECANAS: 'E_30',
    'TORREJON TAJO-TIETAR': 'E_31',
    NAVALCAN: 'E_32',
    NAVALCÁN: 'E_32',
    ROSARITO: 'E_33',
    PORTAJE: 'E_34',
    NAVAMUÑO: 'E_35',
    NAVAMUNO: 'E_35',
    'GABRIEL Y GALAN': 'E_36',
    'GABRIEL Y GALÁN': 'E_36',
    'GUIJO DE GRANADILLA': 'E_37',
    BAÑOS: 'E_38',
    BANOS: 'E_38',
    VALDEOBISPO: 'E_39',
    'JERTE-PLASENCIA': 'E_40',
    'EL JERTE': 'E_40',
    JERTE: 'E_40',
    BORBOLLON: 'E_41',
    BORBOLLÓN: 'E_41',
    ARRAGO: 'E_42',
    'ÁRRAGO (CONTRAEMBALSE)': 'E_42',
    'RIVERA DE GATA': 'E_43',
    GUADILOBA: 'E_44',
    'GUADILOBA - CÁCERES': 'E_44',
    ALCANTARA: 'E_45',
    ALCÁNTARA: 'E_45',
    SALOR: 'E_46',
    CEDILLO: 'E_47',
    'EL ATANCE': 'E_48',
    'NAVALMORAL DE LA MATA': 'E_50',
    'LOS MORALES': 'E_51',
    PAJARERO: 'E_53',
    'EL PAJARERO': 'E_53',
    'VILLAR DE PLASENCIA': 'E_55',
    'CASAR DE CÁCERES': 'E_59',
    'AZUD DE HERVÁS': 'E_65',
    // CYII-specific names (only those that map to known E_ stations)
    'EL POZO DE LOS RAMOS': 'E_10',
};

/**
 * Months dictionary for parsing dates like "1oct", "15ene"
 */
const MONTH_MAP: Record<string, number> = {
    ene: 1,
    feb: 2,
    mar: 3,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dic: 12,
};

@Injectable()
export class ResguardoImportService {
    constructor(@Inject(Logger) private readonly logger: Logger) {}

    /**
     * Parses an XLS/XLSX buffer and returns flat rows ready for import.
     * Supports both the multi-sheet "RESUMEN RESGUARDOS" format
     * and the simple "ResguardosCotaVolumen" format.
     */
    parseXls(buffer: Buffer, filename: string, baseYear?: number): ResguardoImportRow[] {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;

        this.logger.log({ msg: 'Parsing XLS file', filename, sheets: sheetNames });

        // Detect format: if it has "PRESAS EXPLOTACION" sheet → multi-sheet format
        const isMultiSheet = sheetNames.some((s) => SHEET_TO_ORGANISMO[s] !== undefined);

        // Base year for hydrological year: oct-dec → baseYear, jan-sep → baseYear+1
        // Default: current hydrological year (if we're in oct-dec use this year, otherwise last year)
        const now = new Date();
        const defaultBaseYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
        const hydroBaseYear = baseYear ?? defaultBaseYear;

        this.logger.log({ msg: 'Using hydrological base year', hydroBaseYear });

        if (isMultiSheet) {
            return this.parseMultiSheet(workbook, hydroBaseYear);
        }

        // Simple format: COD_ESTACION, FECHA, VOLUMEN RESGUARDO, COTA RESGUARDO
        return this.parseSimpleFormat(workbook);
    }

    private parseSimpleFormat(workbook: XLSX.WorkBook): ResguardoImportRow[] {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const rows: ResguardoImportRow[] = [];

        // Skip header row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0] || !row[1]) continue;

            const stationCode = String(row[0]).trim().replace('_', '_');
            const fecha = this.excelDateToString(row[1]);
            if (!fecha) continue;

            const volumen = this.parseNumber(row[2]);
            const cota = this.parseNumber(row[3]);

            rows.push({
                stationCode,
                date: fecha,
                organismo: Organismo.EXPLOTACION,
                originalReserveVolume: volumen,
                originalReserveLevel: cota,
                originalMinimumVolume: null,
            });
        }

        this.logger.log({ msg: 'Parsed simple format', totalRows: rows.length });
        return rows;
    }

    private parseMultiSheet(workbook: XLSX.WorkBook, hydroBaseYear: number): ResguardoImportRow[] {
        const allRows: ResguardoImportRow[] = [];

        for (const [sheetName, organismo] of Object.entries(SHEET_TO_ORGANISMO)) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const rows = this.parsePresasSheet(data, organismo, hydroBaseYear);
            allRows.push(...rows);

            this.logger.log({ msg: `Parsed sheet: ${sheetName}`, organismo, rows: rows.length });
        }

        this.logger.log({ msg: 'Parsed multi-sheet format', totalRows: allRows.length });
        return allRows;
    }

    /**
     * Parses a "PRESAS" sheet with columnar layout.
     * Structure: groups of 5 columns per embalse (Fecha, Vol.Resguardo, Cota, Vol.Minimo, separator)
     * Row 1: EMBALSE headers (embalse names)
     * Row 3: Column headers (Vol. Resguardo, Cota, Vol. Minimo)
     * Row 4: Units (Hm3, m, Hm3)
     * Row 5+: Data rows
     */
    private parsePresasSheet(data: any[][], organismo: Organismo, hydroBaseYear: number): ResguardoImportRow[] {
        if (data.length < 6) return [];

        const rows: ResguardoImportRow[] = [];

        // Row index 1 has the embalse names
        const headerRow = data[1];
        if (!headerRow) return [];

        // Find embalse columns: look for "EMBALSE" label followed by name
        const embalseColumns: { colIndex: number; stationCode: string }[] = [];

        for (let col = 0; col < headerRow.length; col++) {
            const cellValue = String(headerRow[col] ?? '')
                .trim()
                .toUpperCase();
            if (cellValue === 'EMBALSE') {
                const embalseNameRaw = String(headerRow[col + 1] ?? '')
                    .trim()
                    .toUpperCase();
                const stationCode = EMBALSE_TO_CODE[embalseNameRaw];
                if (stationCode) {
                    embalseColumns.push({ colIndex: col, stationCode });
                } else {
                    this.logger.warn({ msg: `Unknown embalse name: ${embalseNameRaw}`, organismo });
                }
            }
        }

        // Parse data rows (starting at row index 5)

        for (let rowIdx = 5; rowIdx < data.length; rowIdx++) {
            const row = data[rowIdx];
            if (!row) continue;

            for (const { colIndex, stationCode } of embalseColumns) {
                const dateRaw = String(row[colIndex] ?? '').trim();
                if (!dateRaw) continue;

                const date = this.parseHydroDate(dateRaw, hydroBaseYear);
                if (!date) continue;

                const volumen = this.parseNumber(row[colIndex + 1]);
                const cota = this.parseNumber(row[colIndex + 2]);
                const volMinimo = this.parseNumber(row[colIndex + 3]);

                if (volumen === null && cota === null && volMinimo === null) continue;

                rows.push({
                    stationCode,
                    date,
                    organismo,
                    originalReserveVolume: volumen,
                    originalReserveLevel: cota,
                    originalMinimumVolume: volMinimo,
                });
            }
        }

        return rows;
    }

    /**
     * Parses hydrological date format like "1oct", "15ene" → "YYYY-MM-DD"
     * Hydrological year: oct-dec → currentYear, jan-sep → currentYear+1
     */
    private parseHydroDate(dateStr: string, baseYear: number): string | null {
        const match = dateStr.match(/^(\d{1,2})([a-z]{3})$/i);
        if (!match) return null;

        const day = parseInt(match[1], 10);
        const monthStr = match[2].toLowerCase();
        const month = MONTH_MAP[monthStr];
        if (!month) return null;

        // Hydrological year starts in October
        const year = month >= 10 ? baseYear : baseYear + 1;

        // Validate the date actually exists (e.g., skip Feb 29 in non-leap years)
        const testDate = new Date(year, month - 1, day);
        if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
            return null;
        }

        const paddedMonth = String(month).padStart(2, '0');
        const paddedDay = String(day).padStart(2, '0');

        return `${year}-${paddedMonth}-${paddedDay}`;
    }

    /**
     * Converts Excel serial date number or date string to YYYY-MM-DD
     */
    private excelDateToString(value: any): string | null {
        if (value === null || value === undefined) return null;

        if (typeof value === 'number') {
            const date = XLSX.SSF.parse_date_code(value);
            if (date) {
                const y = date.y;
                const m = String(date.m).padStart(2, '0');
                const d = String(date.d).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return null;
        }

        const str = String(value).trim();
        // Try ISO format
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

        return null;
    }

    private parseNumber(value: any): number | null {
        if (value === null || value === undefined || value === '' || value === 'NaN') return null;

        // Handle Spanish decimal format: "0,06" → 0.06
        const str = String(value).replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }
}
