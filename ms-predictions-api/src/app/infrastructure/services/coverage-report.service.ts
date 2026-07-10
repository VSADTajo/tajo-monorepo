import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet, Fill } from 'exceljs';

import { StationTypeCoverageResult, CoverageMatrixResult } from '@domain/results/prediction-type.result';

const HEADER_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
const GREEN_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
const GRAY_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
const GREEN_FONT = { color: { argb: 'FF166534' }, bold: true };
const GRAY_FONT = { color: { argb: 'FF94A3B8' }, italic: true };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true };

/** Render an ISO timestamp as "YYYY-MM-DD HH:mm" (UTC), or "—" when null. */
function formatTimestamp(iso: string | null): string {
    if (!iso) return '—';
    return iso.replace('T', ' ').slice(0, 16);
}

function hoursSince(iso: string | null, now: Date): string {
    if (!iso) return '—';
    const diffMs = now.getTime() - new Date(iso).getTime();
    return (Math.round((diffMs / 3_600_000) * 10) / 10).toString();
}

function styleHeaderRow(ws: Worksheet, rowNumber: number): void {
    const row = ws.getRow(rowNumber);
    row.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
}

@Injectable()
export class CoverageReportService {
    /** One-station report: every catalog type as a row with its status and last ingestion. */
    async buildStationWorkbook(result: StationTypeCoverageResult): Promise<Buffer> {
        const now = new Date();
        const wb = new Workbook();
        wb.creator = 'ms-predictions-api';
        const ws = wb.addWorksheet(`Estación ${result.stationCode}`.slice(0, 31));

        ws.addRow([`Cobertura de Prediction Types — Estación ${result.stationCode}`]);
        ws.getRow(1).font = { bold: true, size: 14 };
        ws.addRow([
            `${result.withData} de ${result.total} types con datos · Sólo simulaciones FINALIZED · Generado ${formatTimestamp(now.toISOString())}`,
        ]);
        ws.getRow(2).font = { color: { argb: 'FF64748B' }, size: 10 };
        ws.addRow([]);

        const headerRowNumber = 4;
        ws.addRow(['Type', 'Unidad', 'Estado', 'Última entrada', 'Horas desde última']);
        styleHeaderRow(ws, headerRowNumber);

        for (const t of result.types) {
            const hasData = t.lastEntered !== null;
            const row = ws.addRow([
                t.name,
                t.unit,
                hasData ? 'Con datos' : 'Nunca',
                formatTimestamp(t.lastEntered),
                hoursSince(t.lastEntered, now),
            ]);
            const statusCell = row.getCell(3);
            statusCell.fill = hasData ? GREEN_FILL : GRAY_FILL;
            statusCell.font = hasData ? GREEN_FONT : GRAY_FONT;
            statusCell.alignment = { horizontal: 'center' };
            if (!hasData) {
                row.eachCell((cell) => {
                    if (cell !== statusCell) cell.font = GRAY_FONT;
                });
            }
        }

        ws.columns = [{ width: 42 }, { width: 10 }, { width: 12 }, { width: 20 }, { width: 20 }];
        ws.views = [{ state: 'frozen', ySplit: headerRowNumber }];

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /** All-stations matrix: rows = stations, columns = types, cells = last ingestion / "nunca". */
    async buildMatrixWorkbook(result: CoverageMatrixResult): Promise<Buffer> {
        const wb = new Workbook();
        wb.creator = 'ms-predictions-api';
        const ws = wb.addWorksheet('Cobertura (todas)');

        ws.addRow(['Matriz de cobertura — todas las estaciones × prediction types (última entrada)']);
        ws.getRow(1).font = { bold: true, size: 14 };
        ws.addRow([
            `${result.stations.length} estaciones × ${result.types.length} types · Sólo FINALIZED · Generado ${formatTimestamp(result.generatedAt)}`,
        ]);
        ws.getRow(2).font = { color: { argb: 'FF64748B' }, size: 10 };
        ws.addRow([]);

        const headerRowNumber = 4;
        ws.addRow(['Estación', 'Nombre', ...result.types.map((t) => t.name)]);
        styleHeaderRow(ws, headerRowNumber);

        for (const station of result.stations) {
            const row = ws.addRow([
                station.stationCode,
                station.stationName ?? '',
                ...station.cells.map((c) => (formatTimestamp(c) === '—' && c === null ? 'nunca' : formatTimestamp(c))),
            ]);
            station.cells.forEach((cell, index) => {
                const hasData = cell !== null;
                const target = row.getCell(3 + index);
                target.fill = hasData ? GREEN_FILL : GRAY_FILL;
                target.font = hasData ? GREEN_FONT : GRAY_FONT;
                target.alignment = { horizontal: 'center' };
            });
        }

        ws.columns = [{ width: 12 }, { width: 26 }, ...result.types.map(() => ({ width: 20 }))];
        ws.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRowNumber }];

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
