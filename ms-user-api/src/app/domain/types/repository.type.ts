export interface IRepository<T> {
    create(data: T): Promise<T>;
    createMany?(data: T[]): Promise<void>;
    update?(data: T): Promise<T>;
    delete?(id: string): Promise<void>;
    findById?(id: string): Promise<T>;
    findAll?(): Promise<T[]>;
}
