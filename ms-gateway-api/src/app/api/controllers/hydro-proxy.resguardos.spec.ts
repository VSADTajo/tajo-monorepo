import { HydroProxyController } from './hydro-proxy.controller';

/**
 * Regression test for the resguardos date-range filter bug:
 * the gateway proxy must forward query params (from/to/year) to ms-hydro-api.
 */
describe('HydroProxyController — resguardos query forwarding', () => {
    let controller: HydroProxyController;
    let forward: jest.Mock;

    const buildRes = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    beforeEach(() => {
        forward = jest.fn().mockResolvedValue({ status: 200, data: { entries: {}, total: 0 } });
        const proxyService: any = { forward };
        const servicesConfig: any = { hydroApiUrl: 'http://ms-hydro-api:3006' };
        controller = new HydroProxyController(proxyService, servicesConfig);
    });

    it('forwards from/to/year query params to hydro-api', async () => {
        const req: any = {
            query: { from: '2025-01-01', to: '2025-03-31', year: '2025' },
            user: { sub: 'u1' },
            id: 'trace-1',
        };

        await controller.getResguardosByStation('E_01', req, buildRes());

        expect(forward).toHaveBeenCalledTimes(1);
        const arg = forward.mock.calls[0][0];
        expect(arg.path).toBe('/resguardos/E_01');
        expect(arg.query).toEqual({ from: '2025-01-01', to: '2025-03-31', year: '2025' });
    });

    it('forwards an empty query object when no filters are sent', async () => {
        const req: any = { query: {}, user: {}, id: 'trace-2' };

        await controller.getResguardosByStation('E_01', req, buildRes());

        const arg = forward.mock.calls[0][0];
        expect(arg.query).toEqual({});
    });
});
