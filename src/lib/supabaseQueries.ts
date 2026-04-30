import { supabase } from './supabase';
import { getLocalISODate } from './dateUtils';

// ============================================
// TIPOS
// ============================================

export type Crew = {
  id: string;
  name: string;
  foreman_name?: string;
  foreman_contact?: string;
  member_count?: number;
  notes?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type Task = {
  id: string;
  rubro: string;
  task_code: string;
  description: string;
  total_qty?: number;
  unit?: 'm3' | 'ml' | 'm2' | 'u';
  unit_price?: number | null;
  created_at: Date;
  updated_at: Date;
};

export type TaskPrice = {
  id: string;
  task_id: string;
  unit_price: number;
  currency: 'ARS' | 'USD' | 'EUR';
  valid_from: string; // YYYY-MM-DD
  valid_to?: string; // YYYY-MM-DD
  created_at: Date;
};

export type DailyEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  task_id: string;
  crew_id: string;
  qty: number;
  unit: 'm3' | 'ml' | 'm2' | 'u';
  photo_url?: string;
  foreman?: string;
  notes?: string;
  created_by?: string;
  created_at: Date;
};

export type PayrollPeriod = {
  id: string;
  crew_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  total_value_completed: number;
  status: 'open' | 'closed' | 'paid';
  receipt_id?: string;
  created_at: Date;
  updated_at: Date;
};

export type PaymentReceipt = {
  id: string;
  payroll_period_id: string;
  number: string;
  issue_date: string; // YYYY-MM-DD
  amount: number;
  currency: 'ARS' | 'USD' | 'EUR';
  payment_method?: string;
  notes?: string;
  pdf_url?: string;
  created_at: Date;
};

// ============================================
// FUNCIONES DE CONVERSIÓN
// ============================================

const fromSupabaseTimestamp = (value: string | Date | null | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const generateClientId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatSupabaseError = (
  context: string,
  error: { message: string; code?: string; details?: string; hint?: string },
  payload?: unknown
) => {
  const parts = [`${context}: ${error.message}`];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  if (payload !== undefined) parts.push(`payload=${JSON.stringify(payload)}`);
  return new Error(parts.join(' | '));
};

export type QueuedWrite = {
  id: string;
  commit: Promise<void>;
};

// ============================================
// CREWS
// ============================================

export const getCrews = async (): Promise<Crew[]> => {
  const { data, error } = await supabase
    .from('crews')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    foreman_name: row.foreman_name ?? undefined,
    foreman_contact: row.foreman_contact ?? undefined,
    member_count: row.member_count ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
    created_at: fromSupabaseTimestamp(row.created_at),
    updated_at: fromSupabaseTimestamp(row.updated_at),
  }));
};

export const createCrew = async (crewData: {
  name: string;
  foreman_name?: string;
  foreman_contact?: string;
  member_count?: number;
  notes?: string;
}): Promise<string> => {
  const nowIso = new Date().toISOString();
  const id = generateClientId();
  const { error } = await supabase.from('crews').insert({
    id,
    name: crewData.name,
    foreman_name: crewData.foreman_name ?? null,
    foreman_contact: crewData.foreman_contact ?? null,
    member_count: crewData.member_count ?? null,
    notes: crewData.notes ?? null,
    active: true,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) {
    throw error;
  }

  return id;
};

export const updateCrew = async (
  id: string,
  updates: {
    name?: string;
    foreman_name?: string;
    foreman_contact?: string;
    member_count?: number;
    notes?: string;
  }
): Promise<void> => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }
  if ('foreman_name' in updates) {
    payload.foreman_name = updates.foreman_name ?? null;
  }
  if ('foreman_contact' in updates) {
    payload.foreman_contact = updates.foreman_contact ?? null;
  }
  if ('member_count' in updates) {
    payload.member_count = updates.member_count ?? null;
  }
  if ('notes' in updates) {
    payload.notes = updates.notes ?? null;
  }

  const { error } = await supabase.from('crews').update(payload).eq('id', id);
  if (error) {
    throw error;
  }
};

export const deactivateCrew = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('crews')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    throw error;
  }
};

export const queueCreateCrew = (crewData: {
  name: string;
  foreman_name?: string;
  foreman_contact?: string;
  member_count?: number;
  notes?: string;
}): QueuedWrite => {
  const id = generateClientId();
  const payload: Record<string, unknown> = {
    id,
    name: crewData.name,
    active: true,
  };

  if (crewData.foreman_name !== undefined) {
    payload.foreman_name = crewData.foreman_name;
  }
  if (crewData.foreman_contact !== undefined) {
    payload.foreman_contact = crewData.foreman_contact;
  }
  if (crewData.notes !== undefined) {
    payload.notes = crewData.notes;
  }
  if (crewData.member_count !== undefined) {
    payload.member_count = Number.isFinite(crewData.member_count)
      ? crewData.member_count
      : null;
  }

  const commit = supabase
    .from('crews')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreateCrew insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });
  return { id, commit };
};

// ============================================
// TASKS
// ============================================

export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('rubro', { ascending: true })
    .order('task_code', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    rubro: row.rubro,
    task_code: row.task_code,
    description: row.description,
    total_qty: row.total_qty ?? undefined,
    unit: row.unit ?? undefined,
    unit_price: row.unit_price ?? undefined,
    created_at: fromSupabaseTimestamp(row.created_at),
    updated_at: fromSupabaseTimestamp(row.updated_at),
  }));
};

export const createTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
  const id = generateClientId();
  const payload = {
    id,
    rubro: taskData.rubro,
    task_code: taskData.task_code,
    description: taskData.description,
    total_qty: taskData.total_qty ?? null,
    unit: taskData.unit ?? null,
    unit_price: taskData.unit_price ?? null,
  };

  const { error } = await supabase.from('tasks').insert(payload);
  if (error) {
    throw formatSupabaseError('createTask insert failed', error, payload);
  }

  return id;
};

export const queueCreateTask = (
  taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>
): QueuedWrite => {
  const id = generateClientId();
  const payload = {
    id,
    rubro: taskData.rubro,
    task_code: taskData.task_code,
    description: taskData.description,
    total_qty: taskData.total_qty ?? null,
    unit: taskData.unit ?? null,
    unit_price: taskData.unit_price ?? null,
  };

  const commit = supabase
    .from('tasks')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreateTask insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ('rubro' in updates) {
    payload.rubro = updates.rubro;
  }
  if ('task_code' in updates) {
    payload.task_code = updates.task_code;
  }
  if ('description' in updates) {
    payload.description = updates.description;
  }
  if ('total_qty' in updates) {
    payload.total_qty = updates.total_qty ?? null;
  }
  if ('unit' in updates) {
    payload.unit = updates.unit ?? null;
  }
  if ('unit_price' in updates) {
    payload.unit_price = updates.unit_price ?? null;
  }

  const runUpdate = async (nextPayload: Record<string, unknown>) =>
    supabase.from('tasks').update(nextPayload).eq('id', id).select('id').maybeSingle();

  let response = await runUpdate(payload);

  const missingUpdatedAtColumn =
    response.error &&
    (response.error.code === '42703' || response.error.code === 'PGRST204') &&
    (response.error.message.includes('updated_at') || response.error.details?.includes('updated_at'));

  if (missingUpdatedAtColumn) {
    const { updated_at: _omit, ...payloadWithoutUpdatedAt } = payload;
    response = await runUpdate(payloadWithoutUpdatedAt);
    if (response.error) {
      throw formatSupabaseError('updateTask update retry failed', response.error, {
        id,
        payload: payloadWithoutUpdatedAt,
      });
    }
    if (!response.data) {
      throw new Error(`updateTask update retry affected 0 rows for id=${id}. Check RLS policy or row id.`);
    }
    return;
  }

  if (response.error) {
    throw formatSupabaseError('updateTask update failed', response.error, { id, payload });
  }
  if (!response.data) {
    throw new Error(`updateTask affected 0 rows for id=${id}. Check RLS policy or row id.`);
  }
};

// ============================================
// TASK PRICES
// ============================================

export const getCurrentTaskPrice = async (taskId: string, date?: string): Promise<TaskPrice | null> => {
  const checkDate = date || getLocalISODate();

  const { data, error } = await supabase
    .from('task_prices')
    .select('*')
    .eq('task_id', taskId)
    .lte('valid_from', checkDate)
    .order('valid_from', { ascending: false });

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    const validFrom =
      typeof row.valid_from === 'string'
        ? row.valid_from
        : getLocalISODate(new Date(row.valid_from));
    const validTo = row.valid_to ?? undefined;

    if (validFrom <= checkDate && (!validTo || validTo >= checkDate)) {
      return {
        id: row.id,
        task_id: row.task_id,
        unit_price: row.unit_price,
        currency: row.currency,
        valid_from: validFrom,
        valid_to: validTo,
        created_at: fromSupabaseTimestamp(row.created_at),
      };
    }
  }

  return null;
};

export const getCurrentTaskPricesByTaskIds = async (
  taskIds: string[],
  date?: string
): Promise<Map<string, number | null>> => {
  const result = new Map<string, number | null>();
  if (taskIds.length === 0) return result;

  const checkDate = date || getLocalISODate();
  const { data, error } = await supabase
    .from('task_prices')
    .select('task_id, unit_price, valid_from, valid_to')
    .in('task_id', taskIds)
    .lte('valid_from', checkDate)
    .order('valid_from', { ascending: false });

  if (error) {
    throw error;
  }

  (data || []).forEach((row) => {
    const taskId = row.task_id;
    if (!taskId || result.has(taskId)) return;

    const validTo = row.valid_to ?? undefined;
    if (validTo && validTo < checkDate) return;
    result.set(taskId, typeof row.unit_price === 'number' ? row.unit_price : null);
  });

  taskIds.forEach((taskId) => {
    if (!result.has(taskId)) result.set(taskId, null);
  });

  return result;
};

export const createTaskPrice = async (taskId: string, priceData: Omit<TaskPrice, 'id' | 'task_id' | 'created_at'>): Promise<string> => {
  const id = generateClientId();
  const payload = {
    id,
    task_id: taskId,
    unit_price: priceData.unit_price,
    currency: priceData.currency,
    valid_from: priceData.valid_from,
    valid_to: priceData.valid_to ?? null,
  };

  const { error } = await supabase.from('task_prices').insert(payload);
  if (error) {
    throw formatSupabaseError('createTaskPrice insert failed', error, payload);
  }

  return id;
};

export const queueCreateTaskPrice = (
  taskId: string,
  priceData: Omit<TaskPrice, 'id' | 'task_id' | 'created_at'>
): QueuedWrite => {
  const id = generateClientId();
  const payload = {
    id,
    task_id: taskId,
    unit_price: priceData.unit_price,
    currency: priceData.currency,
    valid_from: priceData.valid_from,
    valid_to: priceData.valid_to ?? null,
  };

  const commit = supabase
    .from('task_prices')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreateTaskPrice insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

export const getTaskPricesByTaskIds = async (
  taskIds: string[],
  dateTo?: string
): Promise<Map<string, TaskPrice[]>> => {
  const pricesByTaskId = new Map<string, TaskPrice[]>();
  if (taskIds.length === 0) return pricesByTaskId;

  let queryBuilder = supabase
    .from('task_prices')
    .select('*')
    .in('task_id', taskIds)
    .order('valid_from', { ascending: false });

  if (dateTo) {
    queryBuilder = queryBuilder.lte('valid_from', dateTo);
  }

  const { data, error } = await queryBuilder;
  if (error) {
    throw error;
  }

  (data || []).forEach((row) => {
    const taskId = row.task_id;
    if (!taskId) return;

    const item = {
      id: row.id,
      task_id: taskId,
      unit_price: row.unit_price,
      currency: row.currency,
      valid_from:
        typeof row.valid_from === 'string'
          ? row.valid_from
          : getLocalISODate(new Date(row.valid_from)),
      valid_to: row.valid_to ?? undefined,
      created_at: fromSupabaseTimestamp(row.created_at),
    } as TaskPrice;

    const current = pricesByTaskId.get(taskId);
    if (current) {
      current.push(item);
    } else {
      pricesByTaskId.set(taskId, [item]);
    }
  });

  return pricesByTaskId;
};
// ============================================
// DAILY ENTRIES
// ============================================

export const getDailyEntries = async (filters?: {
  taskId?: string;
  crewId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DailyEntry[]> => {
  let supabaseQuery = supabase
    .from('daily_entries')
    .select('*')
    .order('date', { ascending: false });

  if (filters?.taskId) {
    supabaseQuery = supabaseQuery.eq('task_id', filters.taskId);
  }
  if (filters?.crewId) {
    supabaseQuery = supabaseQuery.eq('crew_id', filters.crewId);
  }
  if (filters?.dateFrom) {
    supabaseQuery = supabaseQuery.gte('date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    supabaseQuery = supabaseQuery.lte('date', filters.dateTo);
  }

  const { data, error } = await supabaseQuery;
  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    date: typeof row.date === 'string' ? row.date : getLocalISODate(new Date(row.date)),
    task_id: row.task_id,
    crew_id: row.crew_id,
    qty: row.qty,
    unit: row.unit,
    photo_url: row.photo_url ?? undefined,
    foreman: row.foreman ?? undefined,
    notes: row.notes ?? undefined,
    created_by: row.created_by ?? undefined,
    created_at: fromSupabaseTimestamp(row.created_at),
  }));
};

export const createDailyEntry = async (entryData: Omit<DailyEntry, 'id' | 'created_at'>): Promise<string> => {
  const id = generateClientId();
  const payload: Record<string, unknown> = {
    id,
    date: entryData.date,
    task_id: entryData.task_id,
    crew_id: entryData.crew_id,
    qty: entryData.qty,
    unit: entryData.unit,
    foreman: entryData.foreman ?? null,
    notes: entryData.notes ?? null,
    photo_url: entryData.photo_url ?? null,
    created_by: entryData.created_by ?? null,
  };

  const { error } = await supabase.from('daily_entries').insert(payload);
  if (error) {
    throw formatSupabaseError('createDailyEntry insert failed', error, payload);
  }

  return id;
};

export const queueCreateDailyEntry = (
  entryData: Omit<DailyEntry, 'id' | 'created_at'>
): QueuedWrite => {
  const id = generateClientId();
  const payload: Record<string, unknown> = {
    id,
    date: entryData.date,
    task_id: entryData.task_id,
    crew_id: entryData.crew_id,
    qty: entryData.qty,
    unit: entryData.unit,
    foreman: entryData.foreman ?? null,
    notes: entryData.notes ?? null,
    photo_url: entryData.photo_url ?? null,
    created_by: entryData.created_by ?? null,
  };

  const commit = supabase
    .from('daily_entries')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreateDailyEntry insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

export const deleteDailyEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('daily_entries').delete().eq('id', id);
  if (error) {
    throw error;
  }
};

// ============================================
// PAYROLL PERIODS
// ============================================

export const getPayrollPeriodsByIds = async (periodIds: string[]): Promise<PayrollPeriod[]> => {
  if (periodIds.length === 0) return [];

  const uniqueIds = [...new Set(periodIds)];
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return ((data || []).map((row) => ({
    id: row.id,
    crew_id: row.crew_id,
    start_date: typeof row.start_date === 'string' ? row.start_date : getLocalISODate(new Date(row.start_date)),
    end_date: typeof row.end_date === 'string' ? row.end_date : getLocalISODate(new Date(row.end_date)),
    total_value_completed: Number(row.total_value_completed),
    status: row.status,
    receipt_id: row.receipt_id ?? undefined,
    created_at: fromSupabaseTimestamp(row.created_at),
    updated_at: fromSupabaseTimestamp(row.updated_at),
  })) as PayrollPeriod[]);
};

export const createPayrollPeriod = async (periodData: Omit<PayrollPeriod, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
  const id = generateClientId();
  const nowIso = new Date().toISOString();
  const payload = {
    id,
    crew_id: periodData.crew_id,
    start_date: periodData.start_date,
    end_date: periodData.end_date,
    total_value_completed: periodData.total_value_completed,
    status: periodData.status,
    receipt_id: periodData.receipt_id ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { error } = await supabase.from('payroll_periods').insert(payload);
  if (error) {
    throw formatSupabaseError('createPayrollPeriod insert failed', error, payload);
  }

  return id;
};

export const queueCreatePayrollPeriod = (
  periodData: Omit<PayrollPeriod, 'id' | 'created_at' | 'updated_at'>
): QueuedWrite => {
  const id = generateClientId();
  const nowIso = new Date().toISOString();
  const payload = {
    id,
    crew_id: periodData.crew_id,
    start_date: periodData.start_date,
    end_date: periodData.end_date,
    total_value_completed: periodData.total_value_completed,
    status: periodData.status,
    receipt_id: periodData.receipt_id ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const commit = supabase
    .from('payroll_periods')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreatePayrollPeriod insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

// ============================================
// PAYMENT RECEIPTS
// ============================================

export const getPaymentReceipts = async (): Promise<PaymentReceipt[]> => {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    payroll_period_id: row.payroll_period_id,
    number: row.number,
    issue_date: typeof row.issue_date === 'string' ? row.issue_date : getLocalISODate(new Date(row.issue_date)),
    amount: Number(row.amount),
    currency: row.currency,
    payment_method: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
    pdf_url: row.pdf_url ?? undefined,
    created_at: fromSupabaseTimestamp(row.created_at),
  })) as PaymentReceipt[];
};

export const getPaymentReceiptsList = async (): Promise<PaymentReceipt[]> => {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('id, payroll_period_id, number, issue_date, amount, currency, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    payroll_period_id: row.payroll_period_id,
    number: row.number,
    issue_date: typeof row.issue_date === 'string' ? row.issue_date : getLocalISODate(new Date(row.issue_date)),
    amount: Number(row.amount),
    currency: row.currency,
    created_at: fromSupabaseTimestamp(row.created_at),
  })) as PaymentReceipt[];
};

export const getPaymentReceipt = async (id: string): Promise<PaymentReceipt | null> => {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    payroll_period_id: data.payroll_period_id,
    number: data.number,
    issue_date: typeof data.issue_date === 'string' ? data.issue_date : getLocalISODate(new Date(data.issue_date)),
    amount: Number(data.amount),
    currency: data.currency,
    payment_method: data.payment_method ?? undefined,
    notes: data.notes ?? undefined,
    pdf_url: data.pdf_url ?? undefined,
    created_at: fromSupabaseTimestamp(data.created_at),
  } as PaymentReceipt;
};

export const createPaymentReceipt = async (receiptData: Omit<PaymentReceipt, 'id' | 'created_at'>): Promise<string> => {
  const id = generateClientId();
  const payload = {
    id,
    payroll_period_id: receiptData.payroll_period_id,
    number: receiptData.number,
    issue_date: receiptData.issue_date,
    amount: receiptData.amount,
    currency: receiptData.currency,
    payment_method: receiptData.payment_method ?? null,
    notes: receiptData.notes ?? null,
    pdf_url: receiptData.pdf_url ?? null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('payment_receipts').insert(payload);
  if (error) {
    throw formatSupabaseError('createPaymentReceipt insert failed', error, payload);
  }

  return id;
};

export const queueCreatePaymentReceipt = (
  receiptData: Omit<PaymentReceipt, 'id' | 'created_at'>
): QueuedWrite => {
  const id = generateClientId();
  const payload = {
    id,
    payroll_period_id: receiptData.payroll_period_id,
    number: receiptData.number,
    issue_date: receiptData.issue_date,
    amount: receiptData.amount,
    currency: receiptData.currency,
    payment_method: receiptData.payment_method ?? null,
    notes: receiptData.notes ?? null,
    pdf_url: receiptData.pdf_url ?? null,
    created_at: new Date().toISOString(),
  };

  const commit = supabase
    .from('payment_receipts')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreatePaymentReceipt insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

export const getLiquidatedQtyByCrewTaskIds = async (
  crewId: string,
  taskIds: string[],
  asOfDate: string
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  if (taskIds.length === 0) return result;

  const uniqueTaskIds = [...new Set(taskIds)];
  const { data, error } = await supabase
    .from('payroll_liquidation_items')
    .select('task_id, liquidated_qty')
    .eq('crew_id', crewId)
    .in('task_id', uniqueTaskIds)
    .lte('as_of_date', asOfDate);

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    const current = result.get(row.task_id) || 0;
    result.set(row.task_id, current + Number(row.liquidated_qty || 0));
  }

  return result;
};

export const queueCreatePayrollLiquidationItem = (itemData: {
  payroll_period_id: string;
  receipt_id: string;
  crew_id: string;
  task_id: string;
  liquidated_qty: number;
  unit: 'm3' | 'ml' | 'm2' | 'u';
  unit_price: number;
  currency: 'ARS' | 'USD' | 'EUR';
  line_amount: number;
  executed_qty_snapshot: number;
  pending_qty_snapshot: number;
  as_of_date: string;
}): QueuedWrite => {
  const id = generateClientId();
  const payload = {
    id,
    payroll_period_id: itemData.payroll_period_id,
    receipt_id: itemData.receipt_id,
    crew_id: itemData.crew_id,
    task_id: itemData.task_id,
    liquidated_qty: itemData.liquidated_qty,
    unit: itemData.unit,
    unit_price: itemData.unit_price,
    currency: itemData.currency,
    line_amount: itemData.line_amount,
    executed_qty_snapshot: itemData.executed_qty_snapshot,
    pending_qty_snapshot: itemData.pending_qty_snapshot,
    as_of_date: itemData.as_of_date,
    created_at: new Date().toISOString(),
  };

  const commit = supabase
    .from('payroll_liquidation_items')
    .insert(payload)
    .then(({ error, status, statusText }) => {
      if (error) {
        throw formatSupabaseError(
          `queueCreatePayrollLiquidationItem insert failed (status=${status} ${statusText || ''})`,
          error,
          payload
        );
      }
    });

  return { id, commit };
};

export const getCrewsByIds = async (crewIds: string[]): Promise<Crew[]> => {
  if (crewIds.length === 0) return [];

  const uniqueIds = [...new Set(crewIds)];
  const { data, error } = await supabase
    .from('crews')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return ((data || []).map((row) => ({
    id: row.id,
    name: row.name,
    foreman_name: row.foreman_name ?? undefined,
    foreman_contact: row.foreman_contact ?? undefined,
    member_count: row.member_count ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
    created_at: fromSupabaseTimestamp(row.created_at),
    updated_at: fromSupabaseTimestamp(row.updated_at),
  })) as Crew[]);
};

export const generateReceiptNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('number')
    .gte('number', `REC-${year}-0000`)
    .lte('number', `REC-${year}-9999`)
    .order('number', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }
  
  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].number;
    const parts = lastNumber.split('-');
    if (parts.length === 3 && parts[2]) {
      nextNum = parseInt(parts[2]) + 1;
    }
  }
  
  return `REC-${year}-${String(nextNum).padStart(4, '0')}`;
};
