export interface Role {
    id: string;
    name: string;
    description?: string | null;
}

export interface Permission {
    id: string;
    name: string | null;
    method: string;
    path: string;
}

export interface Group {
    id: string;
    name: string;
    description?: string | null;
    roles: Role[];
}

export interface UserGroup {
    id: string;
    name: string;
    description?: string | null;
}

export interface RoutePermission {
    method: string;
    path: string;
    summary?: string;
    tag?: string;
}

export interface UserRole {
    id: string;
    name: string;
    description?: string | null;
}

export interface UserBasic {
    id: string;
    name: string;
    email: string;
    status?: string;
}
