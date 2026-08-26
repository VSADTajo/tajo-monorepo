/**
 * Route of the local stand-in for their WISKI observed-data endpoint.
 *
 * apisaih.saihchtajo.es resolves only inside CH Tajo's network — not merely
 * IP-filtered, the hostname does not exist in public DNS. Without a local
 * service answering the same shape, neither the client nor the mapper could be
 * exercised over real HTTP before the network access is granted.
 */
export const MOCK_WISKI_ROUTE = 'mock-wiski/wiski';

export const MOCK_WISKI_PATH = `/${MOCK_WISKI_ROUTE}/tagus_flowcast_observado/`;
