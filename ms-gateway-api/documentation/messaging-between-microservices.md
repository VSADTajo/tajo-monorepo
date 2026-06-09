# Messaging Between Microservices

## Architecture

All microservices connect to a **single shared RabbitMQ broker**. RabbitMQ is shared infrastructure, not per-service.

```
                        +------------------+
  MS-A (this service) ----->               |
  MS-B (notifications) ---->   RabbitMQ    |  <-- single broker
  MS-C (analytics)     ---->   (broker)    |
                        +------------------+
```

---

## Case 1: Create a New Queue and Listen to It

Use queues for **point-to-point** processing (background jobs, high-throughput ingestion).

### Step 1 — Register the queue in `messaging.registry.ts`

```typescript
export const Queues = {
    EXAMPLE_PROCESSING: 'example-processing',
    PAYMENT_PROCESSING: 'payment-processing',  // new
};
```

### Step 2 — Create the consumer in `src/app/application/consumers/payment.consumer.ts`

```typescript
@Controller()
export class PaymentConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
    ) {}

    @MessagePattern(Queues.PAYMENT_PROCESSING)
    async handlePayment(@Payload() data: ProcessPaymentDto, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        try {
            await this.commandBus.execute(new ProcessPaymentCommand(data));
            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error(`Payment failed: ${error}`);
            channel.nack(originalMsg, false, true); // requeue for retry
        }
    }
}
```

### Step 3 — Register in `application.module.ts`

```typescript
controllers: [UserController, RoleController, ExampleConsumer, PaymentConsumer],
```

### Step 4 — Register the queue in `main.ts`

One `connectMicroservice` per queue:

```typescript
app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
        urls: [rabbitmqConfig.url],
        queue: Queues.PAYMENT_PROCESSING,
        queueOptions: { durable: true },
        prefetchCount: rabbitmqConfig.prefetch,
        noAck: false,
    },
});
```

### Step 5 — Publish from a controller or handler

```typescript
@Post('payments')
async enqueuePayment(@Body() dto: PaymentDto) {
    await this.messageBroker.publish(Queues.PAYMENT_PROCESSING, dto);
    return { status: 'accepted' }; // 201 - does not wait for processing
}
```

---

## Case 2: Publish to a Topic

Use topics for **pub/sub** events (multiple services react to the same event).

### Step 1 — Define the topic in the registry

```typescript
export const Topics = {
    USER_EVENTS: {
        exchange: 'user-events',
        routingKeys: {
            CREATED: 'user.created',
            UPDATED: 'user.updated',
        },
    },
};
```

### Step 2 — Publish from a command handler

```typescript
// In RegisterUserHandler, after persisting
await this.messageBroker.publishToTopic(
    Topics.USER_EVENTS.exchange,
    Topics.USER_EVENTS.routingKeys.CREATED,
    { userId: persistedUser.id, email: persistedUser.email },
);
```

The exchange `user-events` is created automatically (durable, topic type) and the message is routed by routing key `user.created`.

---

## Case 3: Another MS Listens to a Topic You Publish

Your MS publishes `user.created` to the `user-events` exchange. A **notifications MS** wants to react.

In the **other MS** (separate project):

### `main.ts` of the notifications MS

```typescript
app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
        urls: ['amqp://guest:guest@rabbitmq:5672'],
        queue: 'notifications-user-events', // this MS's own queue
        queueOptions: { durable: true },
        prefetchCount: 10,
        noAck: false,
    },
});
```

### Consumer in the other MS

```typescript
@Controller()
export class UserEventsConsumer {
    @EventPattern('user.created') // routing key from the topic
    async onUserCreated(@Payload() data: { userId: string; email: string }, @Ctx() ctx: RmqContext) {
        await this.emailService.sendWelcome(data.email);
        ctx.getChannelRef().ack(ctx.getMessage());
    }
}
```

### Binding the queue to the exchange

The other MS needs to bind its queue to the exchange. This can be done:

**Option A — Programmatically** with `amqplib` in `onModuleInit`:

```typescript
await channel.assertQueue('notifications-user-events', { durable: true });
await channel.bindQueue('notifications-user-events', 'user-events', 'user.created');
await channel.bindQueue('notifications-user-events', 'user-events', 'user.updated'); // multiple routing keys
```

**Option B — Manually** in RabbitMQ Management UI (`http://localhost:15672`).

Each subscribing MS creates **its own queue** bound to the exchange. If both the notifications MS and analytics MS subscribe to `user.created`, **both receive a copy** of the message (fan-out by topic).

---

## Case 4: This MS Listens to a Queue from Another MS

The **payments MS** publishes results to a queue `payment-results`. Your MS wants to consume them.

### Step 1 — Register the queue in your registry

```typescript
export const Queues = {
    EXAMPLE_PROCESSING: 'example-processing',
    PAYMENT_RESULTS: 'payment-results', // queue from the other MS
};
```

### Step 2 — Add `connectMicroservice` in your `main.ts`

```typescript
app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
        urls: [rabbitmqConfig.url],
        queue: Queues.PAYMENT_RESULTS,
        queueOptions: { durable: true },
        prefetchCount: rabbitmqConfig.prefetch,
        noAck: false,
    },
});
```

### Step 3 — Consumer

```typescript
@MessagePattern(Queues.PAYMENT_RESULTS)
async handlePaymentResult(@Payload() data: PaymentResultDto, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const originalMsg = ctx.getMessage();
    try {
        // update order status
        channel.ack(originalMsg);
    } catch (error) {
        channel.nack(originalMsg, false, true);
    }
}
```

Both MSs point to the **same queue** (`payment-results`). RabbitMQ distributes messages round-robin if there are multiple consumers (competing consumers pattern). If only your MS consumes, it receives all messages.

---

## Summary

```
QUEUES (point-to-point):
  MS-A --> publish('payment-processing', msg) --> [Queue] --> MS-A consumer (or MS-B, only one receives)

TOPICS (pub/sub):
  MS-A --> publishToTopic('user-events', 'user.created', msg) --> [Exchange topic]
                                                                     |-> [queue MS-B] --> MS-B consumer
                                                                     |-> [queue MS-C] --> MS-C consumer

LISTEN TO QUEUE FROM ANOTHER MS:
  MS-B --> publish('shared-queue', msg) --> [Queue] --> Your MS with connectMicroservice + @MessagePattern
```

**Key difference**: Queues are point-to-point (one consumer processes each message). Topics are pub/sub (each subscriber with its own queue receives a copy).

---

## Feature Flag: `RABBITMQ_ENABLED`

RabbitMQ is **opt-in** per microservice via the `RABBITMQ_ENABLED` environment variable.

| Value | Behavior |
|-------|----------|
| `true` | Connects to RabbitMQ, registers consumers, publishes messages normally |
| `false` (default) | No connection attempt, consumers are not registered, `publish`/`publishToTopic` log a warning and discard the message |

This allows the same boilerplate to be used for MS that need messaging and MS that are HTTP-only, without changing code.

---

## Queue Idempotency

Multiple microservices can declare the **same queue** without conflict. `assertQueue` in RabbitMQ is idempotent — if the queue already exists with the same options (`durable: true`), it simply reuses it.

The only thing that breaks is if one MS declares `durable: true` and another `durable: false` for the same queue — RabbitMQ will reject with an error. This is why the centralized registry (`messaging.registry.ts`) is important: all MS should agree on queue options.

---

## Docker Infrastructure

RabbitMQ runs as **shared infrastructure** in a separate `docker-compose.infra.yml`, not inside each MS's compose file.

### Start infrastructure (once, shared)

```bash
docker compose -f docker-compose.infra.yml up -d
```

This creates the `infra-network` that all MS join.

### Each MS connects to the shared broker

```yaml
# docker-compose.yml of any MS
services:
    app:
        environment:
            - RABBITMQ_ENABLED=true
            - RABBITMQ_HOST=nestjs-boilerplate-rabbitmq  # container name from infra
            - RABBITMQ_PORT=5672
            - RABBITMQ_USER=guest
            - RABBITMQ_PASSWORD=guest
        networks:
            - app-network
            - infra-network  # join the shared infra network

networks:
    app-network:
    infra-network:
        external: true
        name: infra-network
```

### Production

In production, RabbitMQ runs as a managed service (AWS MQ, CloudAMQP, etc.) and each MS only needs the connection URL as environment variables. No docker network configuration needed.
