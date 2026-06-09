/**
 * Filter parameters for meteo operations.
 * Used by application layer mappers - decoupled from HTTP DTOs.
 */
export interface MeteoFilter {
    provider?: string;
    variable?: string;
}
