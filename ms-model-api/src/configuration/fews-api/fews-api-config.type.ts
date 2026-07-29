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
    /**
     * Where the fake PI REST service used by the MOCK source lives. It runs
     * inside this same process, so the default is loopback: MOCK needs no
     * configuration at all to work.
     */
    mockBaseUrl: string;
    /**
     * How long the fake reports a task as pending/running before completing it.
     * Zero — the default — completes on the first status read, which keeps the
     * mock check as fast as it was before. Setting this above
     * SIMULATION_POLL_INTERVAL_MINUTES is what makes the poller actually walk
     * through the in-flight branch at runtime.
     */
    mockRunningMs: number;
};
