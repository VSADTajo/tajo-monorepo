export class RetryError extends Error {
    #message: string;

    get message(): string {
        return this.#message;
    }

    constructor(message: string) {
        super(message);
        this.#message = message;
    }
}
