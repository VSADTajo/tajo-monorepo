# tajo-toolkit

Shared TypeScript toolkit for the VSAD Tajo services: `nestjs-cls` tracing
helpers, a traced axios HTTP client, and uuid utilities.

Consumed by the NestJS services as `github:VSADTajo/tajo-toolkit`.

## Deployment

This package lives as a subtree in the monorepo (`tajo-toolkit/`) and is synced
to its standalone repo `VSADTajo/tajo-toolkit` by the Jenkins `monorepo-sync`
job on every push to `main`.
