/**
 * Where the model output of a manual simulation comes from.
 *
 *   SFTP     — the real file flow: FEWS reads the input folder on its own
 *              schedule and drops the result in the output folder.
 *   FEWS_API — the input is posted to the FEWS PI REST service and the workflow
 *              is launched there; the run is followed by task id instead of by
 *              watching a folder.
 *   MOCK     — the same code path as FEWS_API, pointed at a local fake PI REST
 *              service. It exists to exercise the direct flow for real without
 *              depending on their FEWS being up.
 */
export type ModelSource = 'SFTP' | 'MOCK' | 'FEWS_API';

export const DEFAULT_MODEL_SOURCE: ModelSource = 'SFTP';

/** The two sources that reach the model through the PI REST service. */
export function isDirectSource(source: ModelSource): boolean {
    return source === 'FEWS_API' || source === 'MOCK';
}
