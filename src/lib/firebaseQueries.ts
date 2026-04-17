import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase';

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

const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date();
};

const toTimestamp = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Timestamp.fromDate(d);
};

// ============================================
// CREWS
// ============================================

export const getCrews = async (): Promise<Crew[]> => {
  const q = query(
    collection(db, 'crews'),
    where('active', '==', true),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
    updated_at: toDate(doc.data().updated_at),
  })) as Crew[];
};

export const getCrew = async (id: string): Promise<Crew | null> => {
  const docRef = doc(db, 'crews', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    created_at: toDate(docSnap.data().created_at),
    updated_at: toDate(docSnap.data().updated_at),
  } as Crew;
};

// ============================================
// TASKS
// ============================================

export const getTasks = async (): Promise<Task[]> => {
  const q = query(
    collection(db, 'tasks'),
    orderBy('rubro'),
    orderBy('task_code')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
    updated_at: toDate(doc.data().updated_at),
  })) as Task[];
};

export const getTask = async (id: string): Promise<Task | null> => {
  const docRef = doc(db, 'tasks', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    created_at: toDate(docSnap.data().created_at),
    updated_at: toDate(docSnap.data().updated_at),
  } as Task;
};

export const createTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
  const now = new Date();
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    created_at: toTimestamp(now),
    updated_at: toTimestamp(now),
  });
  return docRef.id;
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
  const docRef = doc(db, 'tasks', id);
  await updateDoc(docRef, {
    ...updates,
    updated_at: toTimestamp(new Date()),
  });
};

// ============================================
// TASK PRICES
// ============================================

export const getTaskPrices = async (taskId: string): Promise<TaskPrice[]> => {
  const q = query(
    collection(db, 'tasks', taskId, 'taskPrices'),
    orderBy('valid_from', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    task_id: taskId,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
  })) as TaskPrice[];
};

export const getCurrentTaskPrice = async (taskId: string, date?: string): Promise<TaskPrice | null> => {
  const checkDate = date || new Date().toISOString().split('T')[0];
  
  // Obtener todos los precios y filtrar en memoria (evita problema de índices)
  const q = query(
    collection(db, 'tasks', taskId, 'taskPrices'),
    orderBy('valid_from', 'desc')
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  // Encontrar el precio vigente para la fecha
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const validFrom = data.valid_from;
    const validTo = data.valid_to;
    
    // Verificar que la fecha esté dentro del rango
    if (validFrom <= checkDate && (!validTo || validTo >= checkDate)) {
      return {
        id: doc.id,
        task_id: taskId,
        ...data,
        created_at: toDate(data.created_at),
      } as TaskPrice;
    }
  }
  
  return null;
};

export const createTaskPrice = async (taskId: string, priceData: Omit<TaskPrice, 'id' | 'task_id' | 'created_at'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'tasks', taskId, 'taskPrices'), {
    ...priceData,
    created_at: toTimestamp(new Date()),
  });
  return docRef.id;
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
  const constraints: QueryConstraint[] = [];
  
  if (filters?.taskId) {
    constraints.push(where('task_id', '==', filters.taskId));
  }
  if (filters?.crewId) {
    constraints.push(where('crew_id', '==', filters.crewId));
  }
  if (filters?.dateFrom) {
    constraints.push(where('date', '>=', filters.dateFrom));
  }
  if (filters?.dateTo) {
    constraints.push(where('date', '<=', filters.dateTo));
  }
  
  constraints.push(orderBy('date', 'desc'));
  
  const q = query(collection(db, 'dailyEntries'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
  })) as DailyEntry[];
};

export const getDailyEntriesByTask = async (taskId: string): Promise<DailyEntry[]> => {
  return getDailyEntries({ taskId });
};

export const createDailyEntry = async (entryData: Omit<DailyEntry, 'id' | 'created_at'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'dailyEntries'), {
    ...entryData,
    created_at: toTimestamp(new Date()),
  });
  return docRef.id;
};

export const deleteDailyEntry = async (id: string): Promise<void> => {
  const docRef = doc(db, 'dailyEntries', id);
  await deleteDoc(docRef);
};

// ============================================
// PAYROLL PERIODS
// ============================================

export const getPayrollPeriods = async (crewId?: string): Promise<PayrollPeriod[]> => {
  const constraints: QueryConstraint[] = [];
  if (crewId) {
    constraints.push(where('crew_id', '==', crewId));
  }
  constraints.push(orderBy('created_at', 'desc'));
  
  const q = query(collection(db, 'payrollPeriods'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
    updated_at: toDate(doc.data().updated_at),
  })) as PayrollPeriod[];
};

export const createPayrollPeriod = async (periodData: Omit<PayrollPeriod, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
  const now = new Date();
  const docRef = await addDoc(collection(db, 'payrollPeriods'), {
    ...periodData,
    created_at: toTimestamp(now),
    updated_at: toTimestamp(now),
  });
  return docRef.id;
};

// ============================================
// PAYMENT RECEIPTS
// ============================================

export const getPaymentReceipts = async (): Promise<PaymentReceipt[]> => {
  const q = query(
    collection(db, 'paymentReceipts'),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    created_at: toDate(doc.data().created_at),
  })) as PaymentReceipt[];
};

export const getPaymentReceipt = async (id: string): Promise<PaymentReceipt | null> => {
  const docRef = doc(db, 'paymentReceipts', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    created_at: toDate(docSnap.data().created_at),
  } as PaymentReceipt;
};

export const createPaymentReceipt = async (receiptData: Omit<PaymentReceipt, 'id' | 'created_at'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'paymentReceipts'), {
    ...receiptData,
    created_at: toTimestamp(new Date()),
  });
  return docRef.id;
};

export const generateReceiptNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const q = query(
    collection(db, 'paymentReceipts'),
    where('number', '>=', `REC-${year}-0000`),
    where('number', '<=', `REC-${year}-9999`),
    orderBy('number', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  
  let nextNum = 1;
  if (!snapshot.empty) {
    const lastNumber = snapshot.docs[0].data().number;
    const parts = lastNumber.split('-');
    if (parts.length === 3 && parts[2]) {
      nextNum = parseInt(parts[2]) + 1;
    }
  }
  
  return `REC-${year}-${String(nextNum).padStart(4, '0')}`;
};

