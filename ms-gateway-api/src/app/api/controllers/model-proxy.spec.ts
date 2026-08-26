import { ModelProxyController } from './model-proxy.controller';

/**
 * Contract tests for the data-provider proxy.
 *
 * These pin the upstream path, method and status pass-through. The backoffice
 * reads the payload verbatim, so a wrong path here surfaces as an empty screen
 * rather than as an error — which is exactly the failure this file exists to
 * catch.
 */
describe('ModelProxyController', () => {
    let controller: ModelProxyController;
    let forward: jest.Mock;

    const MODEL_URL = 'http://ms-model-api:3008';

    const buildRes = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    const buildReq = (query: Record<string, unknown> = {}) => ({
        query,
        user: { userId: 'u1', roles: ['admin'] },
        id: 'trace-1',
    }) as any;

    beforeEach(() => {
        forward = jest.fn().mockResolvedValue({ status: 200, data: { providerConfigs: [] } });
        controller = new ModelProxyController({ forward } as any, { modelApiUrl: MODEL_URL } as any);
    });

    it('lists providers from /provider-configs', async () => {
        await controller.listProviderConfigs(buildReq(), buildRes());

        const arg = forward.mock.calls[0][0];
        expect(arg).toMatchObject({ method: 'GET', baseUrl: MODEL_URL, path: '/provider-configs' });
        expect(arg.headers).toEqual({ 'x-internal-caller': 'ms-gateway-api' });
    });

    it('creates a provider with the body untouched', async () => {
        const dto = {
            name: 'WISKI Observados (API)',
            type: 'WISKI_API',
            baseUrl: 'https://apisaih.saihchtajo.es',
            pollingIntervalMinutes: 60,
            settings: { endpointPath: '/wiski/tagus_flowcast_observado/' },
        };

        await controller.createProviderConfig(dto as any, buildReq(), buildRes());

        const arg = forward.mock.calls[0][0];
        expect(arg).toMatchObject({ method: 'POST', path: '/provider-configs', body: dto });
    });

    it('toggles with PATCH on the id-scoped route', async () => {
        await controller.toggleProviderConfig('abc', buildReq(), buildRes());

        expect(forward.mock.calls[0][0]).toMatchObject({
            method: 'PATCH',
            path: '/provider-configs/abc/toggle',
        });
    });

    it('gives a manual trigger its own long timeout — the ingestion runs inline', async () => {
        await controller.triggerIngestion('abc', buildReq(), buildRes());

        const arg = forward.mock.calls[0][0];
        expect(arg).toMatchObject({ method: 'POST', path: '/provider-configs/abc/trigger' });
        expect(arg.timeoutMs).toBeGreaterThanOrEqual(120_000);
    });

    it('forwards providerConfigId when listing ingestion runs, and omits it otherwise', async () => {
        await controller.listIngestionRuns(buildReq({ providerConfigId: 'abc' }), buildRes());
        expect(forward.mock.calls[0][0]).toMatchObject({
            path: '/ingestion-runs',
            query: { providerConfigId: 'abc' },
        });

        forward.mockClear();
        await controller.listIngestionRuns(buildReq(), buildRes());
        expect(forward.mock.calls[0][0].query).toBeUndefined();
    });

    it('passes the upstream status through instead of flattening it to 200', async () => {
        forward.mockResolvedValueOnce({ status: 409, data: { ErrorDescription: 'already exists' } });
        const res = buildRes();

        await controller.createProviderConfig({} as any, buildReq(), res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ ErrorDescription: 'already exists' });
    });
});
