export type MessageHandler<T = unknown> = (
    payload: T,
    ack: () => void,
    nack: (requeue: boolean) => void,
) => Promise<void>;

export abstract class IMessageBroker {
    abstract publish<T>(queue: string, message: T): Promise<void>;
    abstract publishToTopic<T>(exchange: string, routingKey: string, message: T): Promise<void>;
    abstract subscribeToTopic<T>(
        exchange: string,
        routingKey: string,
        queue: string,
        handler: MessageHandler<T>,
    ): Promise<void>;
}
