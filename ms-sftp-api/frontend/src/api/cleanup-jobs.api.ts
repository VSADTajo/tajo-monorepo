import type { CleanupJob, CreateCleanupJobRequest, UpdateCleanupJobRequest } from '../types/cleanup-job.types';

import { fetchWithAuth } from '../utils/fetchWithAuth';

const API_CLEANUP_JOBS = '/api/cleanup-jobs';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.ErrorDescription || error.message || 'Request failed');
    }
    return response.json();
}

export async function createCleanupJob(dto: CreateCleanupJobRequest): Promise<CleanupJob> {
    const response = await fetchWithAuth(API_CLEANUP_JOBS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    });
    return handleResponse(response);
}

export async function updateCleanupJob(id: string, dto: UpdateCleanupJobRequest): Promise<CleanupJob> {
    const response = await fetchWithAuth(`${API_CLEANUP_JOBS}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    });
    return handleResponse(response);
}

export async function toggleCleanupJob(id: string, isActive: boolean): Promise<CleanupJob> {
    const response = await fetch(`${API_CLEANUP_JOBS}/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
    });
    return handleResponse(response);
}

export async function deleteCleanupJob(id: string): Promise<{ deletedId: string }> {
    const response = await fetchWithAuth(`${API_CLEANUP_JOBS}/${id}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
}

export async function getCleanupJobByPath(directoryPath: string): Promise<{ job: CleanupJob | null }> {
    const response = await fetchWithAuth(`${API_CLEANUP_JOBS}/by-path?directoryPath=${encodeURIComponent(directoryPath)}`);
    return handleResponse(response);
}
