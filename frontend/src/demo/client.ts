const moduleIds = ['patients', 'appointments', 'departments', 'pharmacy', 'lab', 'billing'] as const;
const states = ['outpatient', 'inpatient', 'scheduled', 'completed', 'available', 'occupied', 'simulation', 'pending', 'simulated'];
export type ModuleId = typeof moduleIds[number];
export interface DemoRecord { id: string; label: string; state: string }
export interface DemoCatalog { fictional: true; readOnly: true; timeZone: 'UTC'; snapshotDate: string; modules: { id: ModuleId; records: DemoRecord[] }[] }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDemoCatalog(value: unknown): DemoCatalog {
  if (!object(value) || value.fictional !== true || value.readOnly !== true || value.timeZone !== 'UTC' || value.snapshotDate !== '2026-11-25' || !Array.isArray(value.modules) || value.modules.length !== moduleIds.length) throw new Error('Invalid demo catalog');
  const seen = new Set<string>();
  const ids = new Set<string>();
  const modules = value.modules.map((module: unknown) => {
    if (!object(module) || typeof module.id !== 'string' || !moduleIds.includes(module.id as ModuleId) || seen.has(module.id) || !Array.isArray(module.records) || module.records.length > 20) throw new Error('Invalid demo module');
    seen.add(module.id);
    const records = module.records.map((row: unknown): DemoRecord => {
      if (!object(row) || typeof row.id !== 'string' || !/^DEMO-[A-Z][0-9]{3}$/.test(row.id) || ids.has(row.id) || typeof row.label !== 'string' || row.label.length > 200 || typeof row.state !== 'string' || !states.includes(row.state)) throw new Error('Invalid demo record');
      ids.add(row.id);
      return { id: row.id, label: row.label, state: row.state };
    });
    return { id: module.id as ModuleId, records };
  });
  return { fictional: true, readOnly: true, timeZone: 'UTC', snapshotDate: '2026-11-25', modules };
}

async function readJson(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { ...init, signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Demo request failed');
  return response.json();
}

/** Memory-only capability. Never uses operational tokens, storage or auth endpoints. */
export async function loadDemo(signal: AbortSignal): Promise<DemoCatalog> {
  const session = await readJson('/api/demo/session', { method: 'POST' }, signal);
  if (!object(session) || session.role !== 'fictional_demo_viewer' || session.readOnly !== true || typeof session.viewerToken !== 'string' || !/^[a-f0-9]{64}$/.test(session.viewerToken)) throw new Error('Invalid demo session');
  return parseDemoCatalog(await readJson('/api/demo/catalog', { headers: { Authorization: `Bearer ${session.viewerToken}` } }, signal));
}
