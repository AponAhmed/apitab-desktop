import { API_BASE_URL, API_KEY } from '@/config/server';
import { useAccountStore } from '@/stores/accountStore';
import type { AuthSession, Collection, SyncResponse, Team, TeamMember } from '@/types';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Thrown specifically for a 409 collection conflict, carrying the server's current copy. */
export class ConflictError extends ApiError {
  current: Collection;

  constructor(body: { message?: string; current: Collection }) {
    super(409, body.message ?? 'Conflict', body);
    this.current = body.current;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  };
  if (auth) {
    const token = useAccountStore.getState().session?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server.', null);
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 409) throw new ConflictError(data as { message?: string; current: Collection });

    let message = `Request failed (${response.status})`;
    if (data && typeof data === 'object') {
      const obj = data as { message?: string; errors?: Record<string, string[]> };
      const firstFieldError = obj.errors ? Object.values(obj.errors)[0]?.[0] : undefined;
      message = obj.message ?? firstFieldError ?? message;
    }
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

export const apiClient = {
  register: (name: string, email: string, password: string) =>
    request<AuthSession>('POST', '/register', { name, email, password }, false),

  login: (email: string, password: string) =>
    request<AuthSession>('POST', '/login', { email, password }, false),

  logout: () => request<{ message: string }>('POST', '/logout'),

  forgotPassword: (email: string) =>
    request<{ message: string }>('POST', '/forgot-password', { email }, false),

  resetPassword: (email: string, token: string, password: string, passwordConfirmation: string) =>
    request<{ message: string }>(
      'POST',
      '/reset-password',
      { email, token, password, password_confirmation: passwordConfirmation },
      false,
    ),

  changePassword: (currentPassword: string, password: string, passwordConfirmation: string) =>
    request<{ message: string }>('POST', '/change-password', {
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    }),

  me: () => request<{ user: AuthSession['user']; teams: Pick<Team, 'id' | 'name' | 'role'>[] }>('GET', '/me'),

  fetchTeams: () => request<{ teams: Team[] }>('GET', '/teams'),

  createTeam: (name: string) => request<Team>('POST', '/teams', { name }),

  fetchTeamDetail: (teamId: string) =>
    request<{ id: string; name: string; ownerId: string; members: TeamMember[] }>(
      'GET',
      `/teams/${teamId}`,
    ),

  fetchTeamCollections: (teamId: string) =>
    request<{ collections: Collection[] }>('GET', `/teams/${teamId}/collections`),

  createRemoteCollection: (teamId: string, collection: Collection) =>
    request<Collection>('POST', `/teams/${teamId}/collections`, {
      id: collection.id,
      name: collection.name,
      folders: collection.folders,
      requests: collection.requests,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    }),

  updateRemoteCollection: (teamId: string, collection: Collection) =>
    request<Collection>('PUT', `/teams/${teamId}/collections/${collection.id}`, {
      name: collection.name,
      folders: collection.folders,
      requests: collection.requests,
      updatedAt: collection.updatedAt,
    }),

  deleteRemoteCollection: (teamId: string, collectionId: string) =>
    request<{ message: string }>('DELETE', `/teams/${teamId}/collections/${collectionId}`),

  fetchSync: (teamId: string, since: number) =>
    request<SyncResponse>('GET', `/teams/${teamId}/sync?since=${since}`),

  addTeamMember: (teamId: string, email: string, role: string) =>
    request<TeamMember>('POST', `/teams/${teamId}/members`, { email, role }),
};
