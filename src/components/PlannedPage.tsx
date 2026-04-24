import { useState, useEffect, useRef } from 'react';
import {
  getTasks,
  updateTask,
  getCurrentTaskPrice,
  getCurrentTaskPricesByTaskIds,
  createTaskPrice,
  queueCreateTask,
  getDailyEntries,
} from '../lib/firebaseQueries';
import type { Task } from '../lib/firebaseQueries';
import { getLocalISODate } from '../lib/dateUtils';

type TaskWithProgress = Task & {
  completed_qty: number;
  completed_value: number;
  progress_pct: number;
  unit_price: number | null;
};

export default function PlannedPage() {
  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRubro, setFilterRubro] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ total_qty: '', unit: '', unit_price: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createForm, setCreateForm] = useState({
    rubro: '',
    task_code: '',
    description: '',
    total_qty: '',
    unit: 'u',
    unit_price: '',
  });
  const hasLoadedRef = useRef(false);

  const sortTasksByCatalogOrder = (items: TaskWithProgress[]) =>
    [...items].sort(
      (a, b) =>
        a.rubro.localeCompare(b.rubro) ||
        a.task_code.localeCompare(b.task_code)
    );

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadTasks();
  }, []);

  const parseUnitPrice = (value: string) => {
    if (!value.trim()) return null;
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

   const loadTasks = async () => {
    try {
      const [tasksData, entriesData] = await Promise.all([
        getTasks(),
        getDailyEntries(),
      ]);

      const completedByTask = entriesData.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.task_id] = (acc[entry.task_id] || 0) + entry.qty;
        return acc;
      }, {});

      let currentPrices = new Map<string, number | null>();
      try {
        currentPrices = await getCurrentTaskPricesByTaskIds(tasksData.map((task) => task.id));
      } catch (bulkError) {
        console.warn('Bulk price query failed, using fallback query per task', bulkError);
        const fallbackPrices = await Promise.all(
          tasksData.map(async (task) => {
            const priceData = await getCurrentTaskPrice(task.id);
            return [task.id, priceData?.unit_price ?? null] as const;
          })
        );
        currentPrices = new Map(fallbackPrices);
      }

      const tasksWithProgress = tasksData.map((task) => {
        const completed_qty = completedByTask[task.id] || 0;
        const unit_price = currentPrices.get(task.id) ?? task.unit_price ?? null;
        const completed_value = completed_qty * (unit_price ?? 0);
        const progress_pct =
          task.total_qty && task.total_qty > 0
            ? Math.min(100, Math.round((completed_qty / task.total_qty) * 100))
            : 0;

        return {
          ...task,
          completed_qty,
          completed_value,
          progress_pct,
          unit_price,
        };
      });

      setTasks(tasksWithProgress);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesRubro = !filterRubro || task.rubro === filterRubro;
    const matchesSearch = !searchTerm || 
      task.task_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRubro && matchesSearch;
  });

  const rubros = [...new Set(tasks.map(t => t.rubro))];

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleEdit = (task: TaskWithProgress) => {
    setEditingTask(task.id);
    setEditForm({
      total_qty: task.total_qty?.toString() || '',
      unit: task.unit || 'u',
      unit_price: task.unit_price?.toString() || '',
    });
  };

  const handleSave = async () => {
    if (!editingTask) return;

    try {
      const parsedUnitPrice = parseUnitPrice(editForm.unit_price);
      if (editForm.unit_price.trim() && parsedUnitPrice === null) {
        alert('Unit Price invalido. Usa un numero valido.');
        return;
      }

      const updates: Partial<Task> = {};

      if (editForm.total_qty) {
        updates.total_qty = parseFloat(editForm.total_qty);
      }

      if (editForm.unit) {
        updates.unit = editForm.unit as 'm3' | 'ml' | 'm2' | 'u';
      }
      if (parsedUnitPrice !== null) {
        updates.unit_price = parsedUnitPrice;
      }

      await updateTask(editingTask, updates);

      if (parsedUnitPrice !== null) {
        try {
          await createTaskPrice(editingTask, {
            unit_price: parsedUnitPrice,
            currency: 'ARS',
            valid_from: getLocalISODate(),
          });
        } catch (priceError) {
          console.warn('Task price history was not saved, keeping task unit_price', priceError);
        }
      }

      setEditingTask(null);
      setEditForm({ total_qty: '', unit: '', unit_price: '' });
      await loadTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('No se pudo guardar los cambios de la tarea.');
    }
  };

  const handleCancel = () => {
    setEditingTask(null);
    setEditForm({ total_qty: '', unit: '', unit_price: '' });
  };

  const handleCreateTask = async () => {
    if (creatingTask) return;
    if (!createForm.rubro.trim() || !createForm.task_code.trim() || !createForm.description.trim()) {
      alert('Completa Rubro, TaskID y Descripcion para guardar la tarea.');
      return;
    }

    try {
      const parsedUnitPrice = parseUnitPrice(createForm.unit_price);
      if (createForm.unit_price.trim() && parsedUnitPrice === null) {
        alert('Unit Price invalido. Usa un numero valido.');
        return;
      }

      if (createForm.total_qty.trim()) {
        const parsedTotalQty = Number(createForm.total_qty);
        if (!Number.isFinite(parsedTotalQty) || parsedTotalQty <= 0) {
          alert('TotalQty invalido. Ingresa un numero mayor a 0 o dejalo vacio.');
          return;
        }
      }
      setCreatingTask(true);

      const queuedTask = queueCreateTask({
        rubro: createForm.rubro.trim(),
        task_code: createForm.task_code.trim(),
        description: createForm.description.trim(),
        total_qty: createForm.total_qty ? parseFloat(createForm.total_qty) : undefined,
        unit: createForm.unit as 'm3' | 'ml' | 'm2' | 'u',
        unit_price: parsedUnitPrice,
      });
      const newTaskId = queuedTask.id;

      const optimisticTask: TaskWithProgress = {
        id: newTaskId,
        rubro: createForm.rubro.trim(),
        task_code: createForm.task_code.trim(),
        description: createForm.description.trim(),
        total_qty: createForm.total_qty ? parseFloat(createForm.total_qty) : undefined,
        unit: createForm.unit as 'm3' | 'ml' | 'm2' | 'u',
        created_at: new Date(),
        updated_at: new Date(),
        completed_qty: 0,
        completed_value: 0,
        progress_pct: 0,
        unit_price: parsedUnitPrice,
      };

      setTasks((prev) => sortTasksByCatalogOrder([...prev, optimisticTask]));
      setCreateForm({
        rubro: '',
        task_code: '',
        description: '',
        total_qty: '',
        unit: 'u',
        unit_price: '',
      });
      setCreatingTask(false);

      queuedTask.commit
        .then(async () => {
          if (parsedUnitPrice === null) return;
          try {
            await createTaskPrice(newTaskId, {
              unit_price: parsedUnitPrice,
              currency: 'ARS',
              valid_from: getLocalISODate(),
            });
          } catch (priceError) {
            console.error('Error creating task price:', priceError);
            console.warn('Task price history was not saved, task unit_price remains on task', priceError);
          }
        })
        .catch((error) => {
          console.error('Error creating task:', error);
          setTasks((prev) => prev.filter((task) => task.id !== newTaskId));
          alert('No se pudo guardar la tarea en Firebase. Se revirtio la tarea local.');
        });
    } catch (error) {
      console.error('Error creating task:', error);
      alert('No se pudo guardar la tarea. Revisa conexion/permisos e intenta de nuevo.');
      setCreatingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Planned Tasks</h1>
              <p className="text-gray-400">Gestión de tareas y progreso</p>
            </div>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Nueva Tarea
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {showCreateForm && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Crear Nueva Tarea</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                value={createForm.rubro}
                onChange={(e) => setCreateForm({ ...createForm, rubro: e.target.value })}
                placeholder="Rubro"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              />
              <input
                value={createForm.task_code}
                onChange={(e) => setCreateForm({ ...createForm, task_code: e.target.value })}
                placeholder="TaskID"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              />
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Descripción"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="number"
                value={createForm.total_qty}
                onChange={(e) => setCreateForm({ ...createForm, total_qty: e.target.value })}
                placeholder="TotalQty (opcional)"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              />
              <select
                value={createForm.unit}
                onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              >
                <option value="u">u</option>
                <option value="m2">m2</option>
                <option value="m3">m3</option>
                <option value="ml">ml</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={createForm.unit_price}
                onChange={(e) => setCreateForm({ ...createForm, unit_price: e.target.value })}
                placeholder="UnitPrice (opcional)"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCreateTask}
                disabled={creatingTask}
                className={`px-4 py-2 rounded-lg text-white ${
                  creatingTask ? 'bg-green-800 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {creatingTask ? 'Guardando...' : 'Guardar Tarea'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rubro</label>
              <select
                value={filterRubro}
                onChange={(e) => setFilterRubro(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              >
                <option value="">Todos los rubros</option>
                {rubros.map(rubro => (
                  <option key={rubro} value={rubro}>{rubro}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="TaskID o descripción..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterRubro(''); setSearchTerm(''); }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Rubro</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">TaskID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Descripción</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">TotalQty</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Unit</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">UnitPrice</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Completed</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Value</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Progress</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">{task.rubro}</td>
                    <td className="px-6 py-4 text-sm font-mono text-white">{task.task_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{task.description}</td>
                    
                    {/* TotalQty */}
                    <td className="px-6 py-4 text-right">
                      {editingTask === task.id ? (
                        <input
                          type="number"
                          value={editForm.total_qty}
                          onChange={(e) => setEditForm({...editForm, total_qty: e.target.value})}
                          className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-gray-300">{task.total_qty || '—'}</span>
                      )}
                    </td>
                    
                    {/* Unit */}
                    <td className="px-6 py-4 text-center">
                      {editingTask === task.id ? (
                        <select
                          value={editForm.unit}
                          onChange={(e) => setEditForm({...editForm, unit: e.target.value})}
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        >
                          <option value="u">u</option>
                          <option value="m2">m2</option>
                          <option value="m3">m3</option>
                          <option value="ml">ml</option>
                        </select>
                      ) : (
                        <span className="text-gray-300">{task.unit || '—'}</span>
                      )}
                    </td>
                    
                    {/* UnitPrice */}
                    <td className="px-6 py-4 text-right">
                      {editingTask === task.id ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editForm.unit_price}
                          onChange={(e) => setEditForm({...editForm, unit_price: e.target.value})}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-gray-300">{task.unit_price !== null && task.unit_price !== undefined ? '$' + task.unit_price.toLocaleString() : 'N/A'}</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-right text-sm text-gray-300">{task.completed_qty}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-300">${task.completed_value.toLocaleString()}</td>
                    
                    {/* Progress */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${getProgressColor(task.progress_pct)}`}></div>
                        <span className="ml-2 text-sm text-gray-300">{task.progress_pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      {editingTask === task.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancel}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(task)}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">{filteredTasks.length}</div>
            <div className="text-sm text-gray-400">Total Tareas</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.progress_pct >= 100).length}
            </div>
            <div className="text-sm text-gray-400">Completadas</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.total_qty === null).length}
            </div>
            <div className="text-sm text-gray-400">Incompletas</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              ${filteredTasks.reduce((sum, t) => sum + t.completed_value, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Valor Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}





