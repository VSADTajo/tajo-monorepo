export abstract class IRetryService {
    abstract retryWithTimeout<T>(task: () => Promise<T>, timeout: number, retries: number): Promise<T>;
    abstract withTimeout<T>(task: () => Promise<T>, timeout: number): Promise<T>;
}
