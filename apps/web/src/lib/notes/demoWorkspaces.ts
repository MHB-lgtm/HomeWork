/**
 * Demo workspaces — in-memory seed until the `notes` slice of `@hg/postgres-store`
 * is implemented. Matches the Workspace Zod schema from `@hg/shared-schemas`.
 */

export interface DemoWorkspace {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string;
  term: 'sem_a' | 'sem_b' | 'summer' | 'other';
  filesCount: number;
  lastActivityIso: string;
}

const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    id: 'ws-calc2',
    userId: 'demo-user',
    name: 'חשבון אינפיניטסימלי 2',
    color: '#2E75B6',
    term: 'sem_b',
    icon: '📐',
    filesCount: 12,
    lastActivityIso: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
  },
  {
    id: 'ws-ds',
    userId: 'demo-user',
    name: 'מבני נתונים',
    color: '#7C3AED',
    term: 'sem_b',
    icon: '🧠',
    filesCount: 8,
    lastActivityIso: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'ws-stats',
    userId: 'demo-user',
    name: 'סטטיסטיקה להנדסה',
    color: '#16A34A',
    term: 'sem_b',
    icon: '📊',
    filesCount: 15,
    lastActivityIso: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

export async function getDemoWorkspaces(): Promise<DemoWorkspace[]> {
  // Simulate DB latency for realism in dev
  await new Promise((r) => setTimeout(r, 30));
  return DEMO_WORKSPACES;
}

export async function getDemoWorkspace(id: string): Promise<DemoWorkspace | null> {
  return DEMO_WORKSPACES.find((w) => w.id === id) ?? null;
}
