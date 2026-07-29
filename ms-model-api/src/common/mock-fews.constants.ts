/**
 * Wiring shared between the fake PI REST service, the resolver that points the
 * MOCK source at it, and the client whitelist that has to let it through.
 *
 * The route prefix lives here rather than being typed three times so those three
 * can never drift apart: if this changes, they all move together. It sits in
 * `common/` because it is genuinely cross-cutting — the api layer serves it, the
 * infrastructure layer calls it, and a middleware exempts it.
 * The filter and workflow ids are fixed values instead of environment variables
 * on purpose — MOCK has to work with no configuration at all, otherwise it stops
 * being the thing you reach for to check the pipeline quickly.
 */
export const MOCK_FEWS_ROUTE = 'mock-fews/rest/fewspiservice/v1';

export const MOCK_FEWS_SERVICE_PATH = `/${MOCK_FEWS_ROUTE}`;

export const MOCK_FEWS_FILTER_ID = 'mock-filter';

export const MOCK_FEWS_WORKFLOW_ID = 'mock-workflow';
