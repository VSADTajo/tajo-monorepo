export class RepositoryError<T = any> extends Error {
    #message: string;
    #errorMessage?: any;
    #data?: T;

    get message(): string {
        return this.#message;
    }

    get data(): T | undefined {
        return this.#data || undefined;
    }

    get errorMessage(): string | undefined {
        return this.#errorMessage || undefined;
    }

    constructor(message: string, errorMessage: any, data?: T) {
        super(message);
        this.#data = data;
        this.#message = message;
        this.#errorMessage = errorMessage;
    }
}
