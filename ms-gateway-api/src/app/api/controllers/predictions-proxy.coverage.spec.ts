import { PredictionsProxyController } from './predictions-proxy.controller';

/**
 * Ensures the gateway reflects the prediction-type coverage endpoints:
 * JSON forwarding (matrix + per-station) and binary (.xlsx) passthrough with
 * the right download filename, including upstream-error passthrough.
 */
describe('PredictionsProxyController — coverage forwarding', () => {
    let controller: PredictionsProxyController;
    let forward: jest.Mock;

    const buildRes = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.set = jest.fn().mockReturnValue(res);
        res.setHeader = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        return res;
    };

    beforeEach(() => {
        forward = jest.fn();
        const proxyService: any = { forward };
        const servicesConfig: any = { predictionsApiUrl: 'http://ms-predictions-api:3007' };
        controller = new PredictionsProxyController(proxyService, servicesConfig);
    });

    it('forwards the coverage matrix as JSON', async () => {
        forward.mockResolvedValue({ status: 200, data: { types: [], stations: [] } });
        const req: any = { query: {}, user: { userId: 'u1' }, id: 'trace-1' };
        const res = buildRes();

        await controller.getPredictionTypeCoverage(req, res);

        const arg = forward.mock.calls[0][0];
        expect(arg.method).toBe('GET');
        expect(arg.path).toBe('/prediction-types/coverage');
        expect(res.json).toHaveBeenCalledWith({ types: [], stations: [] });
    });

    it('forwards per-station coverage as JSON', async () => {
        forward.mockResolvedValue({ status: 200, data: { stationCode: 'E_01', total: 2, withData: 1, types: [] } });
        const req: any = { user: {}, id: 'trace-2' };
        const res = buildRes();

        await controller.listPredictionTypesByStation('E_01', req, res);

        expect(forward.mock.calls[0][0].path).toBe('/prediction-types/by-station/E_01');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('streams the per-station xlsx with a sanitized attachment filename', async () => {
        const buf = Buffer.from('PK-fake-xlsx');
        forward.mockResolvedValue({
            status: 200,
            data: buf,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const req: any = { user: {}, id: 'trace-3' };
        const res = buildRes();

        await controller.downloadStationCoverageReport('E/01', req, res);

        const arg = forward.mock.calls[0][0];
        expect(arg.path).toBe('/prediction-types/by-station/E/01/report.xlsx');
        expect(arg.responseType).toBe('arraybuffer');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="cobertura-E_01.xlsx"');
        expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('streams the full-matrix xlsx', async () => {
        forward.mockResolvedValue({
            status: 200,
            data: Buffer.from('PK-fake-xlsx'),
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const req: any = { user: {}, id: 'trace-4' };
        const res = buildRes();

        await controller.downloadPredictionTypeCoverageReport(req, res);

        expect(forward.mock.calls[0][0].path).toBe('/prediction-types/coverage/report.xlsx');
        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Disposition',
            'attachment; filename="cobertura-todas-las-estaciones.xlsx"',
        );
    });

    it('passes an upstream error body through without a download header', async () => {
        forward.mockResolvedValue({
            status: 404,
            data: Buffer.from(JSON.stringify({ message: 'not found' })),
            contentType: 'application/json',
        });
        const req: any = { user: {}, id: 'trace-5' };
        const res = buildRes();

        await controller.downloadStationCoverageReport('NOPE', req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(res.setHeader).not.toHaveBeenCalledWith('Content-Disposition', expect.anything());
        expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    });
});
