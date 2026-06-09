import type {
    MappingSchema,
    CreateMappingSchemaRequest,
    UpdateMappingSchemaRequest,
    ToggleMappingSchemaRequest,
    ListMappingSchemasResponse,
    DeleteMappingSchemaResponse,
} from '../types/mapping-schema.types';

import { fetchWithAuth } from '../utils/fetchWithAuth';

const API_BASE = '/api/mapping-schemas';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.ErrorDescription || error.message || 'Request failed');
    }
    return response.json();
}

export async function fetchSchemas(): Promise<ListMappingSchemasResponse> {
    const response = await fetchWithAuth(API_BASE);
    return handleResponse(response);
}

export async function fetchSchemaById(id: string): Promise<MappingSchema> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`);
    return handleResponse(response);
}

export async function createSchema(data: CreateMappingSchemaRequest): Promise<MappingSchema> {
    const response = await fetchWithAuth(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}

export async function updateSchema(id: string, data: UpdateMappingSchemaRequest): Promise<MappingSchema> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}

export async function deleteSchema(id: string): Promise<DeleteMappingSchemaResponse> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
}

export async function toggleSchema(id: string, data: ToggleMappingSchemaRequest): Promise<MappingSchema> {
    const response = await fetch(`${API_BASE}/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}
