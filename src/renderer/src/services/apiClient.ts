import { API_BASE_URL, API_KEY } from '@/config/server';
import { useAccountStore } from '@/stores/accountStore';
import type {
  AuthSession,
  AuthUser,
  Collection,
  CollectionAssigneeStatus,
  PendingAssignment,
  SyncResponse,
  Team,
  TeamMember,
  TeamVariable,
} from '@/types';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown for a 409 conflict (collection or team variable last-write-wins
 * rejection), carrying the server's current copy. `current`'s shape depends
 * on which endpoint threw it — callers cast to the type they expect.
 */
export class ConflictError extends ApiError {
  current: unknown;

  constructor(body: { message?: string; current: unknown }) {
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
    if (response.status === 409) throw new ConflictError(data as { message?: string; current: unknown });

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

  verifyEmail: (code: string) =>
    request<{ message: string; user: AuthUser }>('POST', '/email/verify', { code }),

  resendVerificationEmail: () => request<{ message: string }>('POST', '/email/resend'),

  me: () => request<{ user: AuthSession['user']; teams: Pick<Team, 'id' | 'name' | 'role'>[] }>('GET', '/me'),

  fetchTeams: () => request<{ teams: Team[] }>('GET', '/teams'),

  createTeam: (name: string) => request<Team>('POST', '/teams', { name }),

  fetchTeamDetail: (teamId: string) =>
    request<{
      id: string;
      name: string;
      ownerId: string;
      createdAt?: number;
      collectionsCount: number;
      members: TeamMember[];
    }>('GET', `/teams/${teamId}`),

  updateTeam: (teamId: string, name: string) =>
    request<{ id: string; name: string; ownerId: string }>('PUT', `/teams/${teamId}`, { name }),

  fetchTeamCollections: (teamId: string) =>
    request<{ collections: Collection[] }>('GET', `/teams/${teamId}/collections`),

  createRemoteCollection: (teamId: string, collection: Collection, userIds: string[] = []) =>
    request<Collection>('POST', `/teams/${teamId}/collections`, {
      id: collection.id,
      name: collection.name,
      folders: collection.folders,
      requests: collection.requests,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      ...(userIds.length ? { userIds } : {}),
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

  fetchTeamVariables: (teamId: string) =>
    request<{ variables: TeamVariable[] }>('GET', `/teams/${teamId}/variables`),

  createTeamVariable: (teamId: string, variable: TeamVariable) =>
    request<TeamVariable>('POST', `/teams/${teamId}/variables`, {
      id: variable.id,
      key: variable.key,
      value: variable.value,
    }),

  updateTeamVariable: (teamId: string, variable: TeamVariable) =>
    request<TeamVariable>('PUT', `/teams/${teamId}/variables/${variable.id}`, {
      key: variable.key,
      value: variable.value,
      updatedAt: variable.updatedAt,
    }),

  deleteTeamVariable: (teamId: string, variableId: string) =>
    request<{ message: string }>('DELETE', `/teams/${teamId}/variables/${variableId}`),

  removeTeamMember: (teamId: string, userId: string) =>
    request<{ message: string }>('DELETE', `/teams/${teamId}/members/${userId}`),

  fetchPendingAssignments: () =>
    request<{ assignments: PendingAssignment[] }>('GET', '/assignments/pending'),

  acceptAssignment: (assignmentId: string) =>
    request<{ message: string }>('POST', `/assignments/${assignmentId}/accept`),

  declineAssignment: (assignmentId: string) =>
    request<{ message: string }>('POST', `/assignments/${assignmentId}/decline`),

  fetchCollectionAssignments: (teamId: string, collectionId: string) =>
    request<{ assignments: CollectionAssigneeStatus[] }>(
      'GET',
      `/teams/${teamId}/collections/${collectionId}/assignments`,
    ),

  assignCollection: (teamId: string, collectionId: string, userIds: string[]) =>
    request<{ message: string }>('POST', `/teams/${teamId}/collections/${collectionId}/assignments`, {
      userIds,
    }),

  leaveTeamCollection: (teamId: string, collectionId: string) =>
    request<{ message: string; collectionId: string }>(
      'POST',
      `/teams/${teamId}/collections/${collectionId}/leave`,
    ),

  unshareCollection: (teamId: string, collectionId: string) =>
    request<{ message: string }>('POST', `/teams/${teamId}/collections/${collectionId}/unshare`),

  // Usage analytics — deliberately best-effort; callers swallow errors so a
  // flaky network never affects the app itself. `auth: true` (the request()
  // default) attaches the session token when signed in and is silently
  // omitted when not, so the same call works anonymous or identified.
  startAnalyticsSession: (sessionId: string, platform: string, appVersion: string) =>
    request<{ ok: true }>('POST', '/analytics/session/start', { sessionId, platform, appVersion }),

  heartbeatAnalyticsSession: (sessionId: string) =>
    request<{ ok: true }>('POST', '/analytics/session/heartbeat', { sessionId }),

  endAnalyticsSession: (sessionId: string) =>
    request<{ ok: true }>('POST', '/analytics/session/end', { sessionId }),
};
