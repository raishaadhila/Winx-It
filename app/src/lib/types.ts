/** Types mirroring the FastAPI backend Pydantic schemas. */

export type Pillar = 'tecna' | 'flora' | 'musa' | 'bloom' | 'stella';
export type Fairy = 'bloom' | 'stella' | 'flora' | 'musa' | 'tecna' | 'layla';
export type Accent = 'pink' | 'blue' | 'lime' | 'purple' | 'yellow';
export type Energy = 'low' | 'medium' | 'high';
export type PlanStatus = 'active' | 'paused' | 'completed' | 'archived';

export type PillarXp = Record<Pillar, number>;

export type Profile = {
  id: string;
  email: string;
  name: string;
  fairy: Fairy;
  pillar: Pillar;
  accent: Accent;
  avatar_seed: string | null;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  pillar_xp: PillarXp;
  xp_to_next_level: number;
};

export type Task = {
  id: string;
  plan_id: string;
  day: number;
  week: number;
  month: number;
  date: string;
  description: string;
  pillar: Pillar;
  hours: number;
  energy: Energy;
  done: boolean;
  completed_at: string | null;
  position: number;
};

export type Plan = {
  id: string;
  title: string;
  goal_text: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  status: PlanStatus;
  tasks: Task[];
  created_at: string;
  updated_at: string;
};

export type PlanSummary = {
  id: string;
  title: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  status: PlanStatus;
  total_tasks: number;
  done_tasks: number;
  progress: number;
  created_at: string;
};

export type PlanUpdate = {
  title?: string;
  status?: PlanStatus;
};

export type TaskUpdate = {
  description?: string;
  pillar?: Pillar;
  hours?: number;
  energy?: Energy;
  day?: number;
  week?: number;
  month?: number;
  date?: string;
  position?: number;
};

export type TaskCreate = {
  day: number;
  week: number;
  month: number;
  date: string;
  description: string;
  pillar: Pillar;
  hours?: number;
  energy?: Energy;
  position?: number;
};

export type TaskCompleteResponse = {
  task: Task;
  xp_awarded: number;
  pillar_xp_awarded: number;
  new_total_xp: number;
  new_level: number;
  leveled_up: boolean;
  streak: number;
};

export type AttachmentKind = 'image' | 'file' | 'link';

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  /** Display name (filename or URL) */
  name: string;
  /** For links: the full URL. For files/images: a data URL or text content. */
  value: string;
  /** Optional size in bytes (no enforced limit) */
  size?: number;
  /** Optional mime type (for files/images) */
  mime?: string;
};

export type PlanGenerateRequest = {
  goal: string;
  timeframe: '1 month' | '3 months' | '6 months' | 'custom';
  custom_days?: number;
  energy_focus: 'deep' | 'physical' | 'creative' | 'balanced';
  pillars: Pillar[];
  /** Files / images / links the user attached. */
  attachments?: Attachment[];
  /** Additional AI context (optional). */
  custom_prompt?: string;
};

export type GeneratedTask = {
  day: number;
  week: number;
  month: number;
  date: string;
  description: string;
  pillar: Pillar;
  hours: number;
  energy: Energy;
};

export type GeneratedPlan = {
  title: string;
  start_date: string;
  end_date: string;
  tasks: GeneratedTask[];
};

export type PlanCreate = {
  title: string;
  goal_text: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  tasks: GeneratedTask[];
};

export type AvatarUpdate = {
  fairy?: Fairy;
  pillar?: Pillar;
  accent?: Accent;
  name?: string;
  avatar_seed?: string;
};
