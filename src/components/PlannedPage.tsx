import { useState, useEffect } from 'react';
import { getTasks, updateTask, getCurrentTaskPrice, createTaskPrice, getDailyEntriesByTask } from '../lib/firebaseQueries';
import type { Task } from '../lib/firebaseQueries';

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

  useEffect(() => {
    loadTasks();
  }, []);

   const loadTasks = async () => {
    try {
      // Cargar tareas desde Firebase
      const tasksData = await getTasks();

      // Para cada tarea, calcular el progreso real
      const tasksWithProgress = await Promise.all(
        tasksData.map(async (task) => {
          // Obtener cantidad completada desde daily_entries
          const entries = await getDailyEntriesByTask(task.id);
          const completed_qty = entries.reduce((sum, entry) => sum + entry.qty, 0);

          // Obtener precio unitario vigente
          const priceData = await getCurrentTaskPrice(task.id);
          const unit_price = priceData?.unit_price || null;
          const completed_value = completed_qty * (unit_price || 0);
          const progress_pct = task.total_qty && task.total_qty > 0 
            ? Math.min(100, Math.round((completed_qty / task.total_qty) * 100))
            : 0;

          return {
            ...task,
            completed_qty,
            completed_value,
            progress_pct,
            unit_price,
          };
        })
      );

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
      const updates: Partial<Task> = {};
      
      if (editForm.total_qty) {
        updates.total_qty = parseFloat(editForm.total_qty);
      }
      
      if (editForm.unit) {
        updates.unit = editForm.unit as 'm3' | 'ml' | 'm2' | 'u';
      }

      // Actualizar tarea
      await updateTask(editingTask, updates);

      // Actualizar precio si cambió
      if (editForm.unit_price && parseFloat(editForm.unit_price) > 0) {
        await createTaskPrice(editingTask, {
          unit_price: parseFloat(editForm.unit_price),
          currency: 'ARS',
          valid_from: new Date().toISOString().split('T')[0],
        });
      }

      setEditingTask(null);
      setEditForm({ total_qty: '', unit: '', unit_price: '' });
      await loadTasks();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleCancel = () => {
    setEditingTask(null);
    setEditForm({ total_qty: '', unit: '', unit_price: '' });
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
            <button className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Nueva Tarea
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-6">
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
                          type="number"
                          value={editForm.unit_price}
                          onChange={(e) => setEditForm({...editForm, unit_price: e.target.value})}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-gray-300">{task.unit_price ? `$${task.unit_price.toLocaleString()}` : '—'}</span>
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

