import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  getTasks, 
  getCrews, 
  queueCreateCrew,
  getDailyEntries, 
  queueCreateDailyEntry,
  deleteDailyEntry,
  type Task,
  type Crew,
  type DailyEntry
} from '../lib/firebaseQueries';
import { getLocalISODate } from '../lib/dateUtils';

export default function DailyEntriesPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRubro, setFilterRubro] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [formData, setFormData] = useState({
    date: getLocalISODate(),
    rubro: '',
    task_id: '',
    crew_id: '',
    qty: '',
    unit: 'u',
    foreman: '',
    notes: '',
  });
  const [validation, setValidation] = useState({
    maxQty: 0,
    currentQty: 0,
    canSubmit: false,
    error: '',
  });
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [savingCrew, setSavingCrew] = useState(false);
  const [crewForm, setCrewForm] = useState({
    name: '',
    foreman_name: '',
    foreman_contact: '',
    member_count: '',
    notes: '',
  });
  const hasLoadedRef = useRef(false);

  const sortCrewsByName = (items: Crew[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name));
  const completedQtyByTask = useMemo(() => {
    return entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.task_id] = (acc[entry.task_id] || 0) + entry.qty;
      return acc;
    }, {});
  }, [entries]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, []);

  useEffect(() => {
    validateQty();
  }, [formData.task_id, formData.qty, tasks, entries]);

  const loadData = async () => {
    try {
      // Cargar tareas, crews y entries desde Firebase
      const [tasksData, crewsData, entriesData] = await Promise.all([
        getTasks(),
        getCrews(),
        getDailyEntries(),
      ]);

      setTasks(tasksData);
      setCrews(crewsData);
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateQty = () => {
    if (!formData.task_id || !formData.qty) {
      setValidation({ maxQty: 0, currentQty: 0, canSubmit: false, error: '' });
      return;
    }

    const task = tasks.find((t) => t.id === formData.task_id);
    if (!task) return;

    const currentQty = completedQtyByTask[formData.task_id] || 0;
    const maxQty = task.total_qty || 0;
    const newQty = parseFloat(formData.qty) || 0;
    const totalAfter = currentQty + newQty;

    const canSubmit = newQty > 0 && (maxQty <= 0 || totalAfter <= maxQty);
    const error = maxQty > 0 && totalAfter > maxQty
      ? `Excede el maximo permitido. Maximo: ${maxQty}, Actual: ${currentQty}, Nuevo: ${newQty}`
      : '';

    setValidation({
      maxQty,
      currentQty,
      canSubmit,
      error,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingEntry) return;

    if (!formData.task_id || !formData.crew_id || !formData.qty) {
      alert('Completa Fecha, Tarea, Crew y Cantidad para guardar la entrada.');
      return;
    }

    if (!validation.canSubmit) {
      alert(validation.error || 'La entrada no se puede guardar con los valores actuales.');
      return;
    }

    try {
      setSavingEntry(true);
      const queuedEntry = queueCreateDailyEntry({
        date: formData.date,
        task_id: formData.task_id,
        crew_id: formData.crew_id,
        qty: parseFloat(formData.qty),
        unit: formData.unit as 'm3' | 'ml' | 'm2' | 'u',
        foreman: formData.foreman || undefined,
        notes: formData.notes || undefined,
      });
      const createdEntryId = queuedEntry.id;

      setEntries((prev) => [
        {
          id: createdEntryId,
          date: formData.date,
          task_id: formData.task_id,
          crew_id: formData.crew_id,
          qty: parseFloat(formData.qty),
          unit: formData.unit as 'm3' | 'ml' | 'm2' | 'u',
          foreman: formData.foreman || undefined,
          notes: formData.notes || undefined,
          created_at: new Date(),
        },
        ...prev,
      ]);

      setFormData({
        date: getLocalISODate(),
        rubro: '',
        task_id: '',
        crew_id: '',
        qty: '',
        unit: 'u',
        foreman: '',
        notes: '',
      });
      setSavingEntry(false);

      queuedEntry.commit.catch((error) => {
        console.error('Error saving entry:', error);
        setEntries((prev) => prev.filter((entry) => entry.id !== createdEntryId));
        alert('No se pudo guardar la entrada en Firebase. Se revirtio la entrada local.');
      });
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('No se pudo guardar la entrada. Revisa conexion/permisos e intenta de nuevo.');
      setSavingEntry(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Estas seguro de que queres borrar esta entrada?')) return;

    try {
      await deleteDailyEntry(entryId);
      await loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Error al borrar la entrada');
    }
  };

  const handleCreateCrew = async () => {
    if (savingCrew) return;
    if (!crewForm.name.trim()) {
      alert('Ingresa un nombre para la crew.');
      return;
    }

    try {
      setSavingCrew(true);
      const crewName = crewForm.name.trim();
      const crewForemanName = crewForm.foreman_name.trim() || undefined;
      const crewForemanContact = crewForm.foreman_contact.trim() || undefined;
      const crewMemberCount = crewForm.member_count ? parseInt(crewForm.member_count, 10) : undefined;
      const crewNotes = crewForm.notes.trim() || undefined;

      const queuedCrew = queueCreateCrew({
        name: crewName,
        foreman_name: crewForemanName,
        foreman_contact: crewForemanContact,
        member_count: crewMemberCount,
        notes: crewNotes,
      });
      const crewId = queuedCrew.id;

      setCrews((prev) =>
        sortCrewsByName([
          ...prev,
          {
            id: crewId,
            name: crewName,
            foreman_name: crewForemanName,
            foreman_contact: crewForemanContact,
            member_count: crewMemberCount,
            notes: crewNotes,
            active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
      );

      setCrewForm({
        name: '',
        foreman_name: '',
        foreman_contact: '',
        member_count: '',
        notes: '',
      });
      setFormData((prev) => ({ ...prev, crew_id: crewId }));
      setSavingCrew(false);

      queuedCrew.commit.catch((error) => {
        console.error('Error creating crew:', error);
        setCrews((prev) => prev.filter((crew) => crew.id !== crewId));
        setFormData((prev) => (prev.crew_id === crewId ? { ...prev, crew_id: '' } : prev));
        alert('No se pudo guardar la crew en Firebase. Se revirtio la crew local.');
      });
    } catch (error) {
      console.error('Error creating crew:', error);
      alert('No se pudo crear la crew. Revisa permisos/reglas de Firestore.');
      setSavingCrew(false);
    }
  };

  const filteredTasks = tasks.filter(task => 
    !filterRubro || task.rubro === filterRubro
  );

  const filteredEntries = entries.filter(entry => {
    const matchesDateFrom = !filterDateFrom || entry.date >= filterDateFrom;
    const matchesDateTo = !filterDateTo || entry.date <= filterDateTo;
    return matchesDateFrom && matchesDateTo;
  });

  const rubros = [...new Set(tasks.map(t => t.rubro))];
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const crewById = useMemo(() => new Map(crews.map((crew) => [crew.id, crew])), [crews]);

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
              <h1 className="text-3xl font-bold text-white mb-2">Daily Entries</h1>
              <p className="text-gray-400">Partes diarios de trabajo</p>
            </div>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              {showForm ? 'Cancelar' : 'Nueva Entrada'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Formulario */}
        {showForm && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Nueva Entrada</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fecha</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rubro</label>
                  <select
                    value={formData.rubro}
                    onChange={(e) => setFormData({...formData, rubro: e.target.value, task_id: ''})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar rubro</option>
                    {rubros.map(rubro => (
                      <option key={rubro} value={rubro}>{rubro}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tarea</label>
                  <select
                    value={formData.task_id}
                    onChange={(e) => setFormData({...formData, task_id: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar tarea</option>
                    {filteredTasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {task.task_code} - {task.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Crew</label>
                  <select
                    value={formData.crew_id}
                    onChange={(e) => setFormData({...formData, crew_id: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar crew</option>
                    {crews.map(crew => (
                      <option key={crew.id} value={crew.id}>{crew.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cantidad</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.qty}
                    onChange={(e) => setFormData({...formData, qty: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                  {validation.error && (
                    <p className="text-red-400 text-sm mt-1">{validation.error}</p>
                  )}
                  {validation.maxQty > 0 && (
                    <p className="text-gray-400 text-sm mt-1">
                      Máximo permitido: {validation.maxQty} | Actual: {validation.currentQty}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Unidad</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    required
                  >
                    <option value="u">u</option>
                    <option value="m2">m2</option>
                    <option value="m3">m3</option>
                    <option value="ml">ml</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Capataz</label>
                  <input
                    type="text"
                    value={formData.foreman}
                    onChange={(e) => setFormData({...formData, foreman: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="Nombre del capataz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    rows={3}
                    placeholder="Observaciones..."
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={!validation.canSubmit || savingEntry}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    validation.canSubmit && !savingEntry
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {savingEntry ? 'Guardando...' : 'Guardar Entrada'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Desde</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hasta</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Entradas */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Fecha</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Tarea</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Crew</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Cantidad</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Unidad</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Capataz</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Notas</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredEntries.map((entry) => {
                  const task = taskById.get(entry.task_id);
                  const crew = crewById.get(entry.crew_id);
                  
                  return (
                    <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-300">{entry.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {task?.task_code} - {task?.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{crew?.name}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-300">{entry.qty}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-300">{entry.unit}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{entry.foreman || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{entry.notes || '—'}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">{filteredEntries.length}</div>
            <div className="text-sm text-gray-400">Total Entradas</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {new Set(filteredEntries.map(e => e.date)).size}
            </div>
            <div className="text-sm text-gray-400">Días Trabajados</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {crews.length}
            </div>
            <div className="text-sm text-gray-400 mb-3">Crews Activas</div>
            <button
              type="button"
              onClick={() => setShowCrewForm((v) => !v)}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {showCrewForm ? 'Cancelar nueva crew' : '+ Nueva Crew'}
            </button>
          </div>
        </div>

        {showCrewForm && (
          <div className="mt-6 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Crear Nueva Crew</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={crewForm.name}
                onChange={(e) => setCrewForm({ ...crewForm, name: e.target.value })}
                placeholder="Nombre de crew"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <input
                type="text"
                value={crewForm.foreman_name}
                onChange={(e) => setCrewForm({ ...crewForm, foreman_name: e.target.value })}
                placeholder="Capataz (opcional)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <input
                type="text"
                value={crewForm.foreman_contact}
                onChange={(e) => setCrewForm({ ...crewForm, foreman_contact: e.target.value })}
                placeholder="Contacto (opcional)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <input
                type="number"
                value={crewForm.member_count}
                onChange={(e) => setCrewForm({ ...crewForm, member_count: e.target.value })}
                placeholder="Integrantes"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <textarea
                value={crewForm.notes}
                onChange={(e) => setCrewForm({ ...crewForm, notes: e.target.value })}
                placeholder="Notas (opcional)"
                rows={2}
                className="md:col-span-2 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleCreateCrew}
                disabled={savingCrew}
                className={`text-white px-4 py-2 rounded-lg transition-colors ${
                  savingCrew ? 'bg-green-800 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {savingCrew ? 'Guardando...' : 'Guardar Crew'}
              </button>
              <button
                type="button"
                onClick={() => setShowCrewForm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


