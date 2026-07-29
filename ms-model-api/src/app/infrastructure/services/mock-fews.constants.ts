/**
 * Wiring shared between the fake PI REST service and the resolver that points
 * the MOCK source at it.
 *
 * The route prefix lives here rather than being typed twice so the controller
 * and the client can never drift apart: if this changes, both move together.
 * The filter and workflow ids are fixed values instead of environment variables
 * on purpose — MOCK has to work with no configuration at all, otherwise it stops
 * being the thing you reach for to check the pipeline quickly.
 */
export const MOCK_FEWS_ROUTE = 'mock-fews/rest/fewspiservice/v1';

export const MOCK_FEWS_SERVICE_PATH = `/${MOCK_FEWS_ROUTE}`;

export const MOCK_FEWS_FILTER_ID = 'mock-filter';

export const MOCK_FEWS_WORKFLOW_ID = 'mock-workflow';
