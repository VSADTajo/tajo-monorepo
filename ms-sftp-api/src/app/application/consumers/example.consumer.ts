import { Controller, Inject } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { Queues } from '@infrastructure/messaging/messaging.registry';

@Controller()
export class ExampleConsumer {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
    ) {}

    @MessagePattern(Queues.EXAMPLE_PROCESSING)
    async handleExampleMessage(@Payload() data: unknown, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            this.logger.log(`Processing message from queue "${Queues.EXAMPLE_PROCESSING}": ${JSON.stringify(data)}`);

            // TODO: Replace with actual processing logic
            // e.g., await this.commandBus.execute(new SomeCommand(data));

            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error({ msg: 'Failed to process message', entity: 'MessageConsumer', error: String(error) });
            channel.nack(originalMsg, false, true);
        }
    }
}
