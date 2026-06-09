export interface UserApiRoleItem {
    id: string;
    name: string;
}

export interface UserApiResponse {
    id: string;
    password: string;
    roles: UserApiRoleItem[];
    status: string;
}

/**
 * Fields we use from user-api GET /users/:id (for validate token).
 * User-api returns more (e.g. status, welcomeEmailId); we only type what auth-api needs.
 */
export interface UserProfileResponse {
    id: string;
    name: string;
    email: string;
}
