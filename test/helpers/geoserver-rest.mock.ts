/**
 * In-memory test double for the IGeoserverImageMosaicClient port.
 *
 * Defined here even though the port itself is added in US1 — keeping
 * the helper in foundational tests means US1 just imports it.
 */
import { ProviderError } from '../../src/app/domain/errors/provider.error';

export interface MockGranule {
    id: string;
    location: string;
    time: Date;
}

export interface MockStore {
    workspace: string;
    name: string;
    directory: string;
    granules: MockGranule[];
    timeDimensionEnabled: boolean;
}

export class InMemoryGeoserverImageMosaicClient {
    public stores = new Map<string, MockStore>(); // key = `${workspace}:${name}`
    public failOnAddGranule: Set<string> = new Set(); // set of locations that should fail
    public createStoreCalls = 0;
    public addGranuleCalls = 0;
    public deleteCalls = 0;

    private key(workspace: string, store: string): string {
        return `${workspace}:${store}`;
    }

    async storeExists(workspace: string, store: string): Promise<boolean> {
        return this.stores.has(this.key(workspace, store));
    }

    async createImageMosaicStore(opts: { workspace: string; store: string; directory: string }): Promise<void> {
        this.createStoreCalls++;
        this.stores.set(this.key(opts.workspace, opts.store), {
            workspace: opts.workspace,
            name: opts.store,
            directory: opts.directory,
            granules: [],
            timeDimensionEnabled: true,
        });
    }

    async listGranules(workspace: string, layer: string): Promise<MockGranule[]> {
        const store = this.stores.get(this.key(workspace, layer));
        return store ? [...store.granules] : [];
    }

    async addGranule(workspace: string, store: string, geotiffPath: string, time: Date): Promise<void> {
        this.addGranuleCalls++;
        if (this.failOnAddGranule.has(geotiffPath)) {
            throw new ProviderError(`Mock geoserver: forced failure on ${geotiffPath}`);
        }
        const s = this.stores.get(this.key(workspace, store));
        if (!s) throw new ProviderError(`Mock geoserver: store ${store} does not exist`);
        const location = geotiffPath.split('/').pop() ?? geotiffPath;
        const id = `${store}.${s.granules.length + 1}`;
        // Replace if same time exists
        const existingIdx = s.granules.findIndex((g) => g.time.getTime() === time.getTime());
        if (existingIdx >= 0) {
            s.granules[existingIdx] = { id: s.granules[existingIdx].id, location, time };
        } else {
            s.granules.push({ id, location, time });
        }
    }

    async deleteGranulesOlderThan(workspace: string, layer: string, threshold: Date): Promise<number> {
        this.deleteCalls++;
        const s = this.stores.get(this.key(workspace, layer));
        if (!s) return 0;
        const before = s.granules.length;
        s.granules = s.granules.filter((g) => g.time.getTime() >= threshold.getTime());
        return before - s.granules.length;
    }

    async purgeMosaicIndex(tableName: string): Promise<void> {
        void tableName; // no-op in tests
    }

    // ── WMS proxy ──────────────────────────────────────────────
    public proxyWmsCalls = 0;
    public failProxyWms = false;
    private _proxyWmsResponse: { data: Buffer; contentType: string } = {
        data: Buffer.from('PNG-stub'),
        contentType: 'image/png',
    };

    setProxyWmsResponse(data: Buffer, contentType: string): void {
        this._proxyWmsResponse = { data, contentType };
    }

    async proxyWms(workspace: string, params: Record<string, string>): Promise<{ data: Buffer; contentType: string }> {
        void workspace;
        void params;
        this.proxyWmsCalls++;
        if (this.failProxyWms) {
            throw new ProviderError('Mock geoserver: proxyWms forced failure');
        }
        return { ...this._proxyWmsResponse };
    }

    reset(): void {
        this.stores.clear();
        this.failOnAddGranule.clear();
        this.createStoreCalls = 0;
        this.addGranuleCalls = 0;
        this.deleteCalls = 0;
        this.proxyWmsCalls = 0;
        this.failProxyWms = false;
        this._proxyWmsResponse = { data: Buffer.from('PNG-stub'), contentType: 'image/png' };
    }
}
