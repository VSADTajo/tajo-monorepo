import { Controller, Inject } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { TraceContext, extractTraceId } from 'tajo-toolkit';

import { Queues } from '@infrastructure/messaging/messaging.registry';

@Controller()
export class ExampleConsumer {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly traceContext: TraceContext,
    ) {}

    @MessagePattern(Queues.EXAMPLE_PROCESSING)
    async handleExampleMessage(@Payload() _data: unknown, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        // Continue the trace from the incoming message (or start a new one)
        const traceId = extractTraceId(originalMsg.properties?.headers);

        await this.traceContext.runInContext(traceId, async () => {
            try {
                this.logger.log({ msg: 'Processing message', queue: Queues.EXAMPLE_PROCESSING });

                // TODO: Replace with actual processing logic
                // e.g., await this.commandBus.execute(new SomeCommand(data));

                channel.ack(originalMsg);
            } catch (error) {
                this.logger.error(`Failed to process message: ${error}`);
                channel.nack(originalMsg, false, true);
            }
        });
    }
}
