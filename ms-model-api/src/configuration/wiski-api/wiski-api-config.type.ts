export type WiskiApiConfig = {
    /**
     * Root of their WISKI REST service, e.g. https://apisaih.saihchtajo.es.
     * A ProviderConfig row may override it; this is the fallback.
     */
    baseUrl: string;
    /** Path of the observed-data resource under baseUrl. */
    path: string;
    /**
     * IANA timezone the `lastchange` timestamps are expressed in. The payload
     * carries no offset, so this is an assumption — the same one the WISKI CSV
     * path already makes (VOBS_CSV_TIMEZONE). Getting it wrong shifts every
     * series by one or two hours without any visible symptom.
     */
    timezone: string;
    requestTimeoutMs: number;
    /**
     * Hard ceiling on the response body. The full window is ~24 MB today; the
     * default leaves headroom without letting a runaway response exhaust the
     * process memory.
     */
    maxResponseBytes: number;
    /**
     * API token, sent as `Authorization: Token <token>`. Empty means the
     * service is called unauthenticated.
     */
    token: string;
    /**
     * Where the fake WISKI endpoint used for local verification lives. It runs
     * inside this same process, so the default is loopback: the mock needs no
     * configuration to work. Their real host does not resolve outside their
     * network, so this is the only way to exercise the client over real HTTP.
     */
    mockBaseUrl: string;
};
