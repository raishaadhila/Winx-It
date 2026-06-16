/**
 * API client. When the user has an active Supabase session, requests go to
 * the FastAPI backend. Otherwise they fall through to a local data layer
 * backed by `localStorage` so the app stays fully usable without auth.
 */
import { local } from './localData';
import { isSupabaseConfigured, supabase } from './supabase';
import type {
  AvatarUpdate,
  GeneratedPlan,
  Plan,
  PlanCreate,
  PlanGenerateRequest,
  PlanSummary,
  PlanUpdate,
  Profile,
  Task,
  TaskCompleteResponse,
  TaskCreate,
  TaskUpdate,
} from './types';

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:8000';

export const isApiConfigured = true;

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

async function isAuthed(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

async function getToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text };
    }
  }

  if (!res.ok) {
    const detail =
      (payload &&
        typeof payload === 'object' &&
        'detail' in payload &&
        typeof (payload as { detail: unknown }).detail === 'string'
          ? (payload as { detail: string }).detail
          : res.statusText) || `HTTP ${res.status}`;
    throw new ApiError(res.status, detail);
  }
  return payload as T;
}

/**
 * Each public method checks auth and dispatches to either the real backend
 * or the local store. The page code never has to branch.
 */
export const api = {
  me: {
    get: async (): Promise<Profile> => {
      if (!(await isAuthed())) return local.me.get();
      return request<Profile>('GET', '/api/me');
    },
    updateAvatar: async (body: AvatarUpdate): Promise<Profile> => {
      if (!(await isAuthed())) return local.me.updateAvatar(body);
      return request<Profile>('PUT', '/api/me/avatar', body);
    },
  },
  plans: {
    list: async (): Promise<PlanSummary[]> => {
      if (!(await isAuthed())) return local.plans.list();
      return request<PlanSummary[]>('GET', '/api/plans');
    },
    get: async (id: string): Promise<Plan> => {
      if (!(await isAuthed())) return local.plans.get(id);
      return request<Plan>('GET', `/api/plans/${id}`);
    },
    generate: async (body: PlanGenerateRequest): Promise<GeneratedPlan> => {
      if (!(await isAuthed())) return local.plans.generate(body);
      return request<GeneratedPlan>('POST', '/api/plans/generate', body);
    },
    create: async (body: PlanCreate): Promise<Plan> => {
      if (!(await isAuthed())) return local.plans.create(body);
      return request<Plan>('POST', '/api/plans', body);
    },
    update: async (id: string, body: PlanUpdate): Promise<Plan> => {
      if (!(await isAuthed())) return local.plans.update(id, body);
      return request<Plan>('PATCH', `/api/plans/${id}`, body);
    },
    remove: async (id: string): Promise<void> => {
      if (!(await isAuthed())) return local.plans.remove(id);
      return request<void>('DELETE', `/api/plans/${id}`);
    },
  },
  tasks: {
    list: async (planId: string): Promise<Task[]> => {
      if (!(await isAuthed())) return local.tasks.list(planId);
      return request<Task[]>('GET', `/api/plans/${planId}/tasks`);
    },
    create: async (planId: string, body: TaskCreate): Promise<Task> => {
      if (!(await isAuthed())) {
        // Strip fields the local store manages
        return local.tasks.create(planId, {
          day: body.day,
          week: body.week,
          month: body.month,
          date: body.date,
          description: body.description,
          pillar: body.pillar,
          hours: body.hours ?? 1,
          energy: body.energy ?? 'medium',
        });
      }
      return request<Task>('POST', `/api/plans/${planId}/tasks`, body);
    },
    update: async (planId: string, taskId: string, body: TaskUpdate): Promise<Task> => {
      if (!(await isAuthed())) return local.tasks.update(planId, taskId, body);
      return request<Task>('PATCH', `/api/plans/${planId}/tasks/${taskId}`, body);
    },
    remove: async (planId: string, taskId: string): Promise<void> => {
      if (!(await isAuthed())) return local.tasks.remove(planId, taskId);
      return request<void>('DELETE', `/api/plans/${planId}/tasks/${taskId}`);
    },
    complete: async (planId: string, taskId: string): Promise<TaskCompleteResponse> => {
      if (!(await isAuthed())) return local.tasks.complete(planId, taskId);
      return request<TaskCompleteResponse>(
        'POST',
        `/api/plans/${planId}/tasks/${taskId}/complete`,
      );
    },
  },
};

export { API_URL };
