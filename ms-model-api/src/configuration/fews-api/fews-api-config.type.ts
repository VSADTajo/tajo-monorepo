export type FewsApiConfig = {
    /** Root of the FEWS web services, e.g. https://fews.example.org/FewsWebServices */
    baseUrl: string;
    /**
     * Path of the PI REST service under baseUrl. Configurable because the public
     * documentation is a SPA we could not read: the default matches what the
     * py-wrapper and our existing provider use, and can be corrected without a
     * code change if their instance differs.
     */
    servicePath: string;
    /** Workflow to launch via runtask — an id defined inside THEIR FEWS. */
    workflowId: string;
    /** Filter the input series are posted under, and results read back from. */
    filterId: string;
    /** Optional HTTP basic auth. Empty means no authentication. */
    username: string;
    password: string;
    /** How long to keep polling a task run before giving up. */
    taskTimeoutMs: number;
    /** Delay between task status polls. */
    taskPollIntervalMs: number;
    requestTimeoutMs: number;
};
