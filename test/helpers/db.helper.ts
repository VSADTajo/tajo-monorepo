import { DataSource } from 'typeorm';

/**
 * Trunca todas las tablas de la base de datos.
 * Usar en afterEach() para que cada test arranque limpio.
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
    const entities = dataSource.entityMetadatas;

    for (const entity of entities) {
        const repository = dataSource.getRepository(entity.name);
        await repository.query(`TRUNCATE "${entity.tableName}" RESTART IDENTITY CASCADE`);
    }
}
