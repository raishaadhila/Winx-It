/**
 * Guest → authed plan transfer.
 *
 * When a user signs up after exploring the app as a guest, any plans they
 * generated (via /api/anon/plans/generate) and saved locally need to be
 * copied to Supabase so they can see them on mobile + across devices.
 *
 * We also flip a 'winx-it:transferred' flag so we don't try to transfer
 * the same plans twice (which would create duplicates).
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { listLocalPlans, deleteLocalPlan, getLocalProfile } from './localData';
import { api } from './api';
import type { Plan, PlanCreate, Task } from './types';

const TRANSFERRED_FLAG = 'winx-it:transferred-v1';

export type TransferResult = {
  transferred: number;
  failed: number;
  errors: string[];
};

/**
 * Migrate any local plans the user built while in guest mode to their
 * Supabase account. Idempotent — safe to call multiple times.
 */
export async function transferLocalPlansToCloud(): Promise<TransferResult> {
  const result: TransferResult = { transferred: 0, failed: 0, errors: [] };

  if (!isSupabaseConfigured) return result;
  if (localStorage.getItem(TRANSFERRED_FLAG) === '1') return result;

  const local = listLocalPlans();
  if (local.length === 0) {
    localStorage.setItem(TRANSFERRED_FLAG, '1');
    return result;
  }

  for (const plan of local) {
    try {
      const payload: PlanCreate = {
        title: plan.title,
        goal_text: plan.goal_text,
        timeframe: plan.timeframe,
        start_date: plan.start_date,
        end_date: plan.end_date,
        tasks: plan.tasks.map((t: Task) => ({
          day: t.day,
          week: t.week,
          month: t.month,
          date: t.date,
          description: t.description,
          pillar: t.pillar,
          hours: t.hours,
          energy: t.energy,
        })),
      };
      const created: Plan = await api.plans.create(payload);
      deleteLocalPlan(plan.id);
      result.transferred += 1;
      // Touch the created plan so we have something to reference in the
      // success toast
      void created;
    } catch (e) {
      result.failed += 1;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Mark transferred even if some failed — we don't want to retry forever
  // and the successful ones are already deleted from localStorage.
  localStorage.setItem(TRANSFERRED_FLAG, '1');

  // Also carry the local profile over so the user doesn't lose their
  // settings from guest mode. (XP/streak live in the local stats store
  // and the backend re-derives them on first task completion.)
  const profile = getLocalProfile();
  if (profile) {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return result;
      await supabase.from('profiles').upsert({
        id: userId,
        name: profile.name,
        fairy: profile.fairy,
        pillar: profile.pillar,
        accent: profile.accent,
        avatar_data_url: profile.avatar_data_url,
        goal_text: profile.goal_text,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      // Best-effort; if this fails the local profile just stays around
      // until next sign-in.
      result.errors.push(`profile: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

/** Clear the transferred flag (used on sign-out so a new account gets a fresh window). */
export function clearTransferFlag(): void {
  localStorage.removeItem(TRANSFERRED_FLAG);
}
