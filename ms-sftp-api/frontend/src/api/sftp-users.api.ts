import type {
    SftpUser,
    CreateSftpUserRequest,
    UpdateSftpUserRequest,
    ToggleSftpUserRequest,
    ListSftpUsersResponse,
    DeleteSftpUserResponse,
} from '../types/sftp-user.types';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const API_BASE = '/api/sftp-users';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.ErrorDescription || error.message || 'Request failed');
    }
    return response.json();
}

export async function fetchSftpUsers(): Promise<ListSftpUsersResponse> {
    const response = await fetchWithAuth(API_BASE);
    return handleResponse(response);
}

export async function fetchSftpUserById(id: string): Promise<SftpUser> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`);
    return handleResponse(response);
}

export async function createSftpUser(data: CreateSftpUserRequest): Promise<SftpUser> {
    const response = await fetchWithAuth(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}

export async function updateSftpUser(id: string, data: UpdateSftpUserRequest): Promise<SftpUser> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}

export async function deleteSftpUser(id: string): Promise<DeleteSftpUserResponse> {
    const response = await fetchWithAuth(`${API_BASE}/${id}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
}

export async function toggleSftpUser(id: string, data: ToggleSftpUserRequest): Promise<SftpUser> {
    const response = await fetch(`${API_BASE}/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
}
