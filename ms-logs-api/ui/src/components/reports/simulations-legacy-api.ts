// LEGACY — kept only for the (currently disabled) ReportsPanel.
// This still points at the external Python simulations API via ms-logs-api `/api`.
// The new predictions section uses the gateway instead (see components/predictions-data/api.ts).
// TODO: remove together with the reports panel once it is decommissioned.
import apiClient from '../../api/api';

export interface LegacyHistoricalSimulation {
    status: string;
    simulation_date: string;
    formatted_date?: string;
    [key: string]: unknown;
}

export interface LegacyHistoricalSimulationsResponse {
    simulations: LegacyHistoricalSimulation[];
}

export interface LegacyHistoricalSimulationsParams {
    simulation_environment?: string;
    page?: number;
    page_size?: number;
    only_unarchived_maneuvers?: boolean;
    basin?: string;
    created_by?: string;
    maneuver_created_by?: string;
}

export async function getHistoricalSimulations(
    params: LegacyHistoricalSimulationsParams,
): Promise<LegacyHistoricalSimulationsResponse> {
    const search = new URLSearchParams();
    if (params.page != null) search.set('page', String(params.page));
    if (params.page_size != null) search.set('page_size', String(params.page_size));
    if (params.simulation_environment) search.set('simulation_environment', params.simulation_environment);
    if (params.basin) search.set('basin', params.basin);
    if (params.created_by) search.set('created_by', params.created_by);
    if (params.maneuver_created_by) search.set('maneuver_created_by', params.maneuver_created_by);
    if (params.only_unarchived_maneuvers != null)
        search.set('only_unarchived_maneuvers', String(params.only_unarchived_maneuvers));

    const response = await apiClient.get<LegacyHistoricalSimulationsResponse>(
        `/predictions-data/simulations/historical?${search.toString()}`,
    );
    return response.data;
}
