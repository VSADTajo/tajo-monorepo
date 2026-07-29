/**
 * Everything needed to address one PI REST service instance.
 *
 * This is passed into the client on every call instead of being read from
 * configuration inside it. That is deliberate: running against the real FEWS
 * and running against the local fake then differ *only* in these values, so the
 * request code exercised by the mock is the very same code that will talk to
 * Idrica. A mock that took its own branch through the client would prove
 * nothing about the branch that matters.
 */
export interface FewsTarget {
    baseUrl: string;
    servicePath: string;
    filterId: string;
    workflowId: string;
    username: string;
    password: string;
}
