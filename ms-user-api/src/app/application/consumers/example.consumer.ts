import { Controller, Inject } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { TraceContext, X_TRACE_ID_HEADER } from 'tajo-toolkit';
import { v4 as uuidv4 } from 'uuid';

import { Queues } from '@infrastructure/messaging/messaging.registry';

@Controller()
export class ExampleConsumer {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly traceContext: TraceContext,
    ) {}

    @MessagePattern(Queues.EXAMPLE_PROCESSING)
    async handleExampleMessage(@Payload() data: unknown, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        // Continue the trace from the incoming message (or start a new one)
        const headers = originalMsg.properties?.headers || {};
        const traceId = headers[X_TRACE_ID_HEADER] || uuidv4();

        await this.traceContext.runInContext(traceId, async () => {
            try {
                this.logger.log(`Processing message from queue "${Queues.EXAMPLE_PROCESSING}": ${JSON.stringify(data)}`);

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
