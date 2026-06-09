import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, closeTestApp } from './helpers/test-app.helper';
import { cleanDatabase } from './helpers/db.helper';
import { buildCreateAlertRuleDto, resetFactory } from './factories/alert.factory';

const API_KEY = 'test-api-key-123';

let app: Express;

beforeAll(async () => {
    process.env.X_API_KEY = API_KEY;
    const ctx = await createTestApp();
    app = ctx.app;
}, 60_000);

afterEach(async () => {
    await cleanDatabase();
    resetFactory();
});

afterAll(async () => {
    await closeTestApp();
});

function createRule(dto: Record<string, unknown> = {}) {
    return request(app)
        .post('/api/alerts')
        .set('x-api-key', API_KEY)
        .send(buildCreateAlertRuleDto(dto));
}

function listRules() {
    return request(app)
        .get('/api/alerts')
        .set('x-api-key', API_KEY);
}

function getRule(id: string) {
    return request(app)
        .get(`/api/alerts/${id}`)
        .set('x-api-key', API_KEY);
}

function updateRule(id: string, dto: Record<string, unknown>) {
    return request(app)
        .put(`/api/alerts/${id}`)
        .set('x-api-key', API_KEY)
        .send(dto);
}

function deleteRule(id: string) {
    return request(app)
        .delete(`/api/alerts/${id}`)
        .set('x-api-key', API_KEY);
}

function toggleRule(id: string, enabled: boolean) {
    return request(app)
        .patch(`/api/alerts/${id}/toggle`)
        .set('x-api-key', API_KEY)
        .send({ enabled });
}

function testQuery(dataSource: string, query: string) {
    return request(app)
        .post('/api/alerts/test-query')
        .set('x-api-key', API_KEY)
        .send({ dataSource, query });
}

function getHistory(id: string) {
    return request(app)
        .get(`/api/alerts/${id}/history`)
        .set('x-api-key', API_KEY);
}

function getTemplates() {
    return request(app)
        .get('/api/alerts/templates')
        .set('x-api-key', API_KEY);
}

function getDataSources() {
    return request(app)
        .get('/api/alerts/datasources')
        .set('x-api-key', API_KEY);
}

// ─────────────────────────────────────────────────────────
// POST /api/alerts — Create
// ─────────────────────────────────────────────────────────

describe('POST /api/alerts', () => {
    test('creates an alert rule and returns 201', async () => {
        const res = await createRule();

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toContain('Test Alert Rule');
        expect(res.body.data.enabled).toBe(true);
        expect(res.body.data.dataSource).toBe('mongodb_local');
        expect(res.body.data._id).toBeDefined();
    });

    test('returns 409 for duplicate name', async () => {
        await createRule({ name: 'Unique Rule' });
        const res = await createRule({ name: 'Unique Rule' });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    test('returns 400 for invalid dataSource', async () => {
        const res = await createRule({ dataSource: 'invalid_source' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid dataSource');
    });

    test('returns 400 for invalid interval', async () => {
        const res = await createRule({ intervalMinutes: 7 });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid interval');
    });

    test('returns 400 for missing required fields', async () => {
        const res = await request(app)
            .post('/api/alerts')
            .set('x-api-key', API_KEY)
            .send({ name: 'Incomplete' });

        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/alerts — List
// ─────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
    test('returns empty array when no rules exist', async () => {
        const res = await listRules();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
    });

    test('returns all rules sorted by createdAt desc', async () => {
        await createRule({ name: 'First' });
        await createRule({ name: 'Second' });

        const res = await listRules();

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].name).toBe('Second');
        expect(res.body.data[1].name).toBe('First');
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/alerts/:id — Get by ID
// ─────────────────────────────────────────────────────────

describe('GET /api/alerts/:id', () => {
    test('returns a single rule', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await getRule(id);

        expect(res.status).toBe(200);
        expect(res.body.data._id).toBe(id);
    });

    test('returns 404 for non-existent rule', async () => {
        const res = await getRule('000000000000000000000000');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────
// PUT /api/alerts/:id — Update
// ─────────────────────────────────────────────────────────

describe('PUT /api/alerts/:id', () => {
    test('updates a rule and returns the updated document', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await updateRule(id, { name: 'Updated Name', intervalMinutes: 15 });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Updated Name');
        expect(res.body.data.intervalMinutes).toBe(15);
    });

    test('returns 404 for non-existent rule', async () => {
        const res = await updateRule('000000000000000000000000', { name: 'X' });

        expect(res.status).toBe(404);
    });

    test('returns 400 for invalid interval on update', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await updateRule(id, { intervalMinutes: 13 });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid interval');
    });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/alerts/:id — Delete
// ─────────────────────────────────────────────────────────

describe('DELETE /api/alerts/:id', () => {
    test('deletes a rule', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await deleteRule(id);
        expect(res.status).toBe(200);
        expect(res.body.data.deleted).toBe(true);

        const check = await getRule(id);
        expect(check.status).toBe(404);
    });

    test('returns 404 for non-existent rule', async () => {
        const res = await deleteRule('000000000000000000000000');
        expect(res.status).toBe(404);
    });
});

// ─────────────────────────────────────────────────────────
// PATCH /api/alerts/:id/toggle — Enable/Disable
// ─────────────────────────────────────────────────────────

describe('PATCH /api/alerts/:id/toggle', () => {
    test('disables a rule', async () => {
        const created = await createRule({ enabled: true });
        const id = created.body.data._id;

        const res = await toggleRule(id, false);

        expect(res.status).toBe(200);
        expect(res.body.data.enabled).toBe(false);
    });

    test('enables a disabled rule', async () => {
        const created = await createRule({ enabled: false });
        const id = created.body.data._id;

        const res = await toggleRule(id, true);

        expect(res.status).toBe(200);
        expect(res.body.data.enabled).toBe(true);
    });

    test('returns 400 when enabled is not boolean', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await request(app)
            .patch(`/api/alerts/${id}/toggle`)
            .set('x-api-key', API_KEY)
            .send({ enabled: 'yes' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('boolean');
    });
});

// ─────────────────────────────────────────────────────────
// POST /api/alerts/test-query — Test arbitrary query
// ─────────────────────────────────────────────────────────

describe('POST /api/alerts/test-query', () => {
    test('executes a MongoDB query and returns count', async () => {
        const res = await testQuery('mongodb_local', '{"collection":"logs","filter":{}}');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.result).toBe(0);
        expect(res.body.data.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('returns 400 when dataSource is missing', async () => {
        const res = await request(app)
            .post('/api/alerts/test-query')
            .set('x-api-key', API_KEY)
            .send({ query: '{}' });

        expect(res.status).toBe(400);
    });

    test('returns 400 for invalid dataSource', async () => {
        const res = await testQuery('pg_nonexistent', 'SELECT 1');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid dataSource');
    });

    test('returns 400 for invalid MongoDB query JSON', async () => {
        const res = await testQuery('mongodb_local', 'not valid json');

        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/alerts/:id/history — Execution history
// ─────────────────────────────────────────────────────────

describe('GET /api/alerts/:id/history', () => {
    test('returns empty history for a new rule', async () => {
        const created = await createRule();
        const id = created.body.data._id;

        const res = await getHistory(id);

        expect(res.status).toBe(200);
        expect(res.body.data.executions).toEqual([]);
        expect(res.body.data.total).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/alerts/templates — Predefined templates
// ─────────────────────────────────────────────────────────

describe('GET /api/alerts/templates', () => {
    test('returns predefined templates', async () => {
        const res = await getTemplates();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('id');
        expect(res.body.data[0]).toHaveProperty('name');
        expect(res.body.data[0]).toHaveProperty('variables');
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/alerts/datasources — Available data sources
// ─────────────────────────────────────────────────────────

describe('GET /api/alerts/datasources', () => {
    test('returns data sources with status', async () => {
        const res = await getDataSources();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);

        const mongodb = res.body.data.find((ds: { id: string }) => ds.id === 'mongodb_local');
        expect(mongodb).toBeDefined();
        expect(mongodb.status).toBe('connected');
    });
});

// ─────────────────────────────────────────────────────────
// Auth — Unauthorized access
// ─────────────────────────────────────────────────────────

describe('Auth', () => {
    test('returns 401 without api key', async () => {
        const res = await request(app).get('/api/alerts');

        expect(res.status).toBe(401);
    });
});
