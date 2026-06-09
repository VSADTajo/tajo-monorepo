export abstract class IMessageBroker {
    abstract publish<T>(queue: string, message: T): Promise<void>;
    abstract publishToTopic<T>(exchange: string, routingKey: string, message: T): Promise<void>;
}
