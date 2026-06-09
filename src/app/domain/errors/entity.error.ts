export class EntityError<T = any> extends Error {
    #message: string;
    #field?: T;

    get message(): string {
        return this.#message;
    }

    get field(): T | undefined {
        return this.#field || undefined;
    }

    constructor(message: string, field?: T) {
        super(message);
        this.#message = message;
        this.#field = field;
    }
}
