import type { ListFilesResponse, ListPathsOverviewResponse } from '../types/file.types';

import { fetchWithAuth } from '../utils/fetchWithAuth';

const API_FILES = '/api/files';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.ErrorDescription || error.message || 'Request failed');
    }
    return response.json();
}

export async function fetchPathsOverview(): Promise<ListPathsOverviewResponse> {
    const response = await fetchWithAuth(`${API_FILES}/paths-overview`);
    return handleResponse(response);
}

export async function fetchFiles(directory: string): Promise<ListFilesResponse> {
    const response = await fetchWithAuth(`${API_FILES}?directory=${encodeURIComponent(directory)}`);
    return handleResponse(response);
}

export function getDownloadUrl(filePath: string): string {
    return `${API_FILES}/download?path=${encodeURIComponent(filePath)}`;
}

export async function downloadFile(filePath: string, fileName: string): Promise<void> {
    const response = await fetchWithAuth(getDownloadUrl(filePath));
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.ErrorDescription || error.message || 'Download failed');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
