import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Scenario } from '../../../src/app/domain/entities/scenario.entity';
import { ScenarioFile } from '../../../src/app/domain/entities/scenario-file.entity';
import { IScenarioRepository } from '../../../src/app/domain/ports/scenario-repository.port';
import { IScenarioFileRepository } from '../../../src/app/domain/ports/scenario-file-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { ScenarioRepository } from '../../../src/app/infrastructure/persistence/scenario.repository';
import { ScenarioFileRepository } from '../../../src/app/infrastructure/persistence/scenario-file.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateScenarioHandler, DeleteScenarioHandler } from '../../../src/app/application/commands/scenario.commands';
import {
    AddFilesToScenarioHandler,
    ReplaceScenarioFileHandler,
    DeleteScenarioFileHandler,
} from '../../../src/app/application/commands/scenario-file.commands';
import { GetScenarioByIdHandler, ListScenariosHandler } from '../../../src/app/application/queries/scenario.queries';
import { DownloadScenarioFileHandler } from '../../../src/app/application/queries/scenario-file.queries';
import { ScenarioController } from '../../../src/app/api/controllers/scenario.controller';
import { ScenarioFileController } from '../../../src/app/api/controllers/scenario-file.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

describe('Scenario Files (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Scenario, ScenarioFile],
            controllers: [ScenarioController, ScenarioFileController],
            providers: [
                CreateScenarioHandler,
                DeleteScenarioHandler,
                GetScenarioByIdHandler,
                ListScenariosHandler,
                AddFilesToScenarioHandler,
                ReplaceScenarioFileHandler,
                DeleteScenarioFileHandler,
                DownloadScenarioFileHandler,
                CachingQueryBus,
                { provide: IScenarioRepository, useClass: ScenarioRepository },
                { provide: IScenarioFileRepository, useClass: ScenarioFileRepository },
                { provide: ICacheService, useValue: mockCacheService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ──────────────────────────────────────────────
    function createScenario(name: string) {
        return request(app.getHttpServer()).post('/scenarios').send({ name });
    }

    function uploadFiles(scenarioId: string) {
        return request(app.getHttpServer())
            .post(`/scenarios/${scenarioId}/files`)
            .attach('files', Buffer.from('{"a":1}'), 'episodio-1.json')
            .attach('files', Buffer.from('station,value\nAR50,12.3\n'), 'episodio-2.csv');
    }

    it('uploads N files of different types to a scenario', async () => {
        const { body: scenario } = await createScenario('crecida-marzo').expect(HttpStatus.CREATED);

        const { body } = await uploadFiles(scenario.id).expect(HttpStatus.CREATED);

        expect(body.scenarioId).toBe(scenario.id);
        expect(body.files).toHaveLength(2);
        const names = body.files.map((f: { filename: string }) => f.filename).sort();
        expect(names).toEqual(['episodio-1.json', 'episodio-2.csv']);
        const csv = body.files.find((f: { filename: string }) => f.filename === 'episodio-2.csv');
        expect(csv.contentType).toContain('csv');
        expect(csv.sizeBytes).toBeGreaterThan(0);
    });

    it('lists the files when fetching the scenario', async () => {
        const { body: scenario } = await createScenario('with-files').expect(HttpStatus.CREATED);
        await uploadFiles(scenario.id).expect(HttpStatus.CREATED);

        const { body: fetched } = await request(app.getHttpServer())
            .get(`/scenarios/${scenario.id}`)
            .expect(HttpStatus.OK);

        expect(fetched.files).toHaveLength(2);
        expect(fetched.payload).toBeNull();
    });

    it('downloads a file with its original content and type', async () => {
        const { body: scenario } = await createScenario('downloadable').expect(HttpStatus.CREATED);
        const { body: uploaded } = await uploadFiles(scenario.id).expect(HttpStatus.CREATED);
        const csv = uploaded.files.find((f: { filename: string }) => f.filename === 'episodio-2.csv');

        const res = await request(app.getHttpServer())
            .get(`/scenarios/${scenario.id}/files/${csv.id}/download`)
            .expect(HttpStatus.OK);

        expect(res.headers['content-disposition']).toContain('episodio-2.csv');
        expect(res.text).toBe('station,value\nAR50,12.3\n');
    });

    it('replaces a single file (patch) keeping the others', async () => {
        const { body: scenario } = await createScenario('patchable').expect(HttpStatus.CREATED);
        const { body: uploaded } = await uploadFiles(scenario.id).expect(HttpStatus.CREATED);
        const json = uploaded.files.find((f: { filename: string }) => f.filename === 'episodio-1.json');

        const { body: replaced } = await request(app.getHttpServer())
            .patch(`/scenarios/${scenario.id}/files/${json.id}`)
            .attach('file', Buffer.from('{"a":999}'), 'episodio-1.json')
            .expect(HttpStatus.OK);

        expect(replaced.id).toBe(json.id);

        const res = await request(app.getHttpServer())
            .get(`/scenarios/${scenario.id}/files/${json.id}/download`)
            .expect(HttpStatus.OK);
        expect(res.text).toBe('{"a":999}');

        // The other file is untouched.
        const { body: fetched } = await request(app.getHttpServer()).get(`/scenarios/${scenario.id}`).expect(HttpStatus.OK);
        expect(fetched.files).toHaveLength(2);
    });

    it('deletes a single file', async () => {
        const { body: scenario } = await createScenario('deletable').expect(HttpStatus.CREATED);
        const { body: uploaded } = await uploadFiles(scenario.id).expect(HttpStatus.CREATED);
        const json = uploaded.files.find((f: { filename: string }) => f.filename === 'episodio-1.json');

        await request(app.getHttpServer())
            .delete(`/scenarios/${scenario.id}/files/${json.id}`)
            .expect(HttpStatus.OK);

        const { body: fetched } = await request(app.getHttpServer()).get(`/scenarios/${scenario.id}`).expect(HttpStatus.OK);
        expect(fetched.files).toHaveLength(1);
    });

    it('cascade-deletes files when the scenario is deleted', async () => {
        const { body: scenario } = await createScenario('cascade').expect(HttpStatus.CREATED);
        const { body: uploaded } = await uploadFiles(scenario.id).expect(HttpStatus.CREATED);
        const fileId = uploaded.files[0].id;

        await request(app.getHttpServer()).delete(`/scenarios/${scenario.id}`).expect(HttpStatus.OK);

        const remaining = await dataSource.getRepository(ScenarioFile).findOne({ where: { id: fileId } });
        expect(remaining).toBeNull();
    });

    it('returns 404 when uploading to a non-existent scenario', async () => {
        await request(app.getHttpServer())
            .post('/scenarios/00000000-0000-0000-0000-000000000000/files')
            .attach('files', Buffer.from('{"a":1}'), 'x.json')
            .expect(HttpStatus.NOT_FOUND);
    });

    it('returns 400 when uploading with no files', async () => {
        const { body: scenario } = await createScenario('empty-upload').expect(HttpStatus.CREATED);
        await request(app.getHttpServer()).post(`/scenarios/${scenario.id}/files`).expect(HttpStatus.BAD_REQUEST);
    });

    it('returns 404 when patching a file that does not belong to the scenario', async () => {
        const { body: scenario } = await createScenario('wrong-file').expect(HttpStatus.CREATED);
        await request(app.getHttpServer())
            .patch(`/scenarios/${scenario.id}/files/00000000-0000-0000-0000-000000000000`)
            .attach('file', Buffer.from('{"a":1}'), 'x.json')
            .expect(HttpStatus.NOT_FOUND);
    });
});
