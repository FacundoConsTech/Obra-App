import { useEffect, useMemo, useState } from 'react';
import {
  getCrews,
  getTasks,
  getDailyEntries,
  getTaskPricesByTaskIds,
  getPaymentReceipts,
  getPayrollPeriodsByIds,
  getPayrollLiquidationItems,
  type Crew,
  type Task,
  type DailyEntry,
  type TaskPrice,
  type PayrollLiquidationItem,
} from '../lib/supabaseQueries';
import { getLocalISODate } from '../lib/dateUtils';

type CrewStats = {
  crew: Crew;
  taskIds: string[];
  plannedQty: number;
  executedQty: number;
  pendingQty: number;
  plannedValue: number;
  executedValue: number;
  pendingValue: number;
  progressPct: number;
  liquidatedValue: number;
  pendingLiquidationValue: number;
};

type TaskBreakdown = {
  task: Task;
  plannedQty: number;
  executedQty: number;
  pendingQty: number;
  progressPct: number;
  executedValue: number;
  pendingValue: number;
  crewSharePct: number;
};

const pickPriceForDate = (pricesByTask: Map<string, TaskPrice[]>, task: Task | undefined, taskId: string, date: string) => {
  const prices = pricesByTask.get(taskId) || [];
  const match = prices.find((price) => price.valid_from <= date && (!price.valid_to || price.valid_to >= date));
  if (match?.unit_price !== undefined && match?.unit_price !== null) return match.unit_price;
  return task?.unit_price ?? 0;
};

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

type StatsPageProps = {
  activeProjectId: string | null;
};

export default function StatsPage({ activeProjectId }: StatsPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [crews, setCrews] = useState<Crew[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [pricesByTaskId, setPricesByTaskId] = useState<Map<string, TaskPrice[]>>(new Map());
  const [liquidationItems, setLiquidationItems] = useState<PayrollLiquidationItem[]>([]);
  const [receiptLiquidatedByCrew, setReceiptLiquidatedByCrew] = useState<Map<string, number>>(new Map());

  const [selectedCrewId, setSelectedCrewId] = useState<string>('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      if (!activeProjectId) {
        if (!active) return;
        setCrews([]);
        setTasks([]);
        setEntries([]);
        setPricesByTaskId(new Map());
        setLiquidationItems([]);
        setReceiptLiquidatedByCrew(new Map());
        setSelectedCrewId('');
        setLoading(false);
        return;
      }

      try {
        const [crewsData, tasksData, entriesData, receiptsData, liquidationRows] = await Promise.all([
          getCrews(activeProjectId),
          getTasks(activeProjectId),
          getDailyEntries({ projectId: activeProjectId }),
          getPaymentReceipts(activeProjectId),
          getPayrollLiquidationItems(activeProjectId).catch(() => []),
        ]);

        const taskIds = tasksData.map((task) => task.id);
        const [taskPricesMap, periodsData] = await Promise.all([
          getTaskPricesByTaskIds(taskIds).catch(() => new Map<string, TaskPrice[]>()),
          receiptsData.length > 0
            ? getPayrollPeriodsByIds(
                [...new Set(receiptsData.map((receipt) => receipt.payroll_period_id))],
                activeProjectId
              )
            : Promise.resolve([]),
        ]);

        const periodById = new Map(periodsData.map((period) => [period.id, period] as const));
        const receiptLiquidatedMap = receiptsData.reduce((map, receipt) => {
          const period = periodById.get(receipt.payroll_period_id);
          if (!period) return map;
          map.set(period.crew_id, (map.get(period.crew_id) || 0) + receipt.amount);
          return map;
        }, new Map<string, number>());

        if (!active) return;
        setCrews(crewsData);
        setTasks(tasksData);
        setEntries(entriesData);
        setPricesByTaskId(taskPricesMap);
        setLiquidationItems(liquidationRows);
        setReceiptLiquidatedByCrew(receiptLiquidatedMap);

        if (crewsData.length > 0) {
          setSelectedCrewId((prev) => (prev && crewsData.some((crew) => crew.id === prev) ? prev : crewsData[0].id));
        } else {
          setSelectedCrewId('');
        }
      } catch (err) {
        console.error('Error loading stats data:', err);
        if (active) setError('No se pudieron cargar las estadísticas en este momento.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [activeProjectId]);

  const stats = useMemo(() => {
    const today = getLocalISODate();
    const taskById = new Map(tasks.map((task) => [task.id, task] as const));

    const executedQtyByTaskId = new Map<string, number>();
    const executedValueByTaskId = new Map<string, number>();
    const executedQtyByCrewId = new Map<string, number>();
    const executedValueByCrewId = new Map<string, number>();

    for (const entry of entries) {
      const task = taskById.get(entry.task_id);
      const unitPrice = pickPriceForDate(pricesByTaskId, task, entry.task_id, entry.date);
      const value = entry.qty * unitPrice;

      executedQtyByTaskId.set(entry.task_id, (executedQtyByTaskId.get(entry.task_id) || 0) + entry.qty);
      executedValueByTaskId.set(entry.task_id, (executedValueByTaskId.get(entry.task_id) || 0) + value);
      executedQtyByCrewId.set(entry.crew_id, (executedQtyByCrewId.get(entry.crew_id) || 0) + entry.qty);
      executedValueByCrewId.set(entry.crew_id, (executedValueByCrewId.get(entry.crew_id) || 0) + value);
    }

    const liquidatedValueByCrewFromItems = liquidationItems.reduce((map, item) => {
      map.set(item.crew_id, (map.get(item.crew_id) || 0) + item.line_amount);
      return map;
    }, new Map<string, number>());

    const crewTaskIds = new Map<string, Set<string>>();

    for (const crew of crews) {
      crewTaskIds.set(crew.id, new Set());
    }

    for (const task of tasks) {
      const normalizedRubro = task.rubro.trim().toLowerCase();
      const matchingCrew = crews.find((crew) => crew.name.trim().toLowerCase() === normalizedRubro);
      if (matchingCrew) {
        crewTaskIds.get(matchingCrew.id)?.add(task.id);
      }
    }

    for (const entry of entries) {
      if (!crewTaskIds.has(entry.crew_id)) {
        crewTaskIds.set(entry.crew_id, new Set());
      }
      crewTaskIds.get(entry.crew_id)?.add(entry.task_id);
    }

    const crewStats: CrewStats[] = crews.map((crew) => {
      const taskIds = [...(crewTaskIds.get(crew.id) || new Set<string>())];
      let plannedQty = 0;
      let plannedValue = 0;

      for (const taskId of taskIds) {
        const task = taskById.get(taskId);
        if (!task) continue;

        const taskPlannedQty = task.total_qty || 0;
        plannedQty += taskPlannedQty;

        const todayPrice = pickPriceForDate(pricesByTaskId, task, taskId, today);
        plannedValue += taskPlannedQty * todayPrice;
      }

      const executedQty = executedQtyByCrewId.get(crew.id) || 0;
      const executedValue = executedValueByCrewId.get(crew.id) || 0;
      const pendingQty = Math.max(0, plannedQty - executedQty);
      const pendingValue = Math.max(0, plannedValue - executedValue);
      const progressPct = plannedQty > 0 ? clampPct((executedQty / plannedQty) * 100) : executedValue > 0 ? 100 : 0;

      const liquidatedFromItems = liquidatedValueByCrewFromItems.get(crew.id) || 0;
      const liquidatedFromReceipts = receiptLiquidatedByCrew.get(crew.id) || 0;
      const liquidatedValue = liquidatedFromItems > 0 ? liquidatedFromItems : liquidatedFromReceipts;
      const pendingLiquidationValue = Math.max(0, executedValue - liquidatedValue);

      return {
        crew,
        taskIds,
        plannedQty,
        executedQty,
        pendingQty,
        plannedValue,
        executedValue,
        pendingValue,
        progressPct,
        liquidatedValue,
        pendingLiquidationValue,
      };
    });

    const taskStatus = tasks.reduce(
      (acc, task) => {
        const planned = task.total_qty || 0;
        const executed = executedQtyByTaskId.get(task.id) || 0;

        if (executed <= 0) {
          acc.notStarted += 1;
        } else if (planned > 0 && executed >= planned) {
          acc.completed += 1;
        } else {
          acc.inProgress += 1;
        }

        return acc;
      },
      { completed: 0, inProgress: 0, notStarted: 0 }
    );

    const totals = crewStats.reduce(
      (acc, crew) => {
        acc.plannedQty += crew.plannedQty;
        acc.executedQty += crew.executedQty;
        acc.pendingQty += crew.pendingQty;
        acc.plannedValue += crew.plannedValue;
        acc.executedValue += crew.executedValue;
        acc.pendingValue += crew.pendingValue;
        acc.liquidatedValue += crew.liquidatedValue;
        acc.pendingLiquidationValue += crew.pendingLiquidationValue;
        return acc;
      },
      {
        plannedQty: 0,
        executedQty: 0,
        pendingQty: 0,
        plannedValue: 0,
        executedValue: 0,
        pendingValue: 0,
        liquidatedValue: 0,
        pendingLiquidationValue: 0,
      }
    );

    const overallProgressPct = totals.plannedQty > 0 ? clampPct((totals.executedQty / totals.plannedQty) * 100) : 0;

    return {
      crewStats,
      totals,
      taskStatus,
      overallProgressPct,
      executedQtyByTaskId,
      executedValueByTaskId,
      taskById,
    };
  }, [crews, tasks, entries, pricesByTaskId, liquidationItems, receiptLiquidatedByCrew]);

  const selectedCrewStats = stats.crewStats.find((crew) => crew.crew.id === selectedCrewId) || null;

  const selectedCrewBreakdown = useMemo<TaskBreakdown[]>(() => {
    if (!selectedCrewStats) return [];

    const totalExecutedValue = Math.max(
      1,
      selectedCrewStats.taskIds.reduce((sum, taskId) => sum + (stats.executedValueByTaskId.get(taskId) || 0), 0)
    );

    return selectedCrewStats.taskIds
      .map((taskId) => {
        const task = stats.taskById.get(taskId);
        if (!task) return null;

        const plannedQty = task.total_qty || 0;
        const executedQty = stats.executedQtyByTaskId.get(taskId) || 0;
        const pendingQty = Math.max(0, plannedQty - executedQty);

        const unitPrice = pickPriceForDate(pricesByTaskId, task, taskId, getLocalISODate());
        const executedValue = stats.executedValueByTaskId.get(taskId) || 0;
        const pendingValue = pendingQty * unitPrice;
        const progressPct = plannedQty > 0 ? clampPct((executedQty / plannedQty) * 100) : executedQty > 0 ? 100 : 0;
        const crewSharePct = clampPct((executedValue / totalExecutedValue) * 100);

        return {
          task,
          plannedQty,
          executedQty,
          pendingQty,
          progressPct,
          executedValue,
          pendingValue,
          crewSharePct,
        } as TaskBreakdown;
      })
      .filter((task): task is TaskBreakdown => task !== null)
      .sort((a, b) => b.executedValue - a.executedValue);
  }, [selectedCrewStats, stats.taskById, stats.executedQtyByTaskId, stats.executedValueByTaskId, pricesByTaskId]);

  const selectedCrewDonut = useMemo(() => {
    if (!selectedCrewStats) return { css: '#22c55e 0deg 360deg', pct: 0 };
    const pct = selectedCrewStats.progressPct;
    return {
      pct,
      css: `#22c55e 0deg ${pct * 3.6}deg, #334155 ${pct * 3.6}deg 360deg`,
    };
  }, [selectedCrewStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Cargando estadísticas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black px-6 py-10">
        <div className="max-w-7xl mx-auto rounded-2xl border border-red-700/50 bg-red-900/20 p-6 text-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white mb-2">Stats Operativos</h1>
          <p className="text-gray-400">Progreso por cuadrilla, composición por tarea y avance total de obra.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Progreso total del proyecto</p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.overallProgressPct.toFixed(1)}%</p>
          </article>
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Valor ejecutado</p>
            <p className="mt-2 text-3xl font-bold text-white">${stats.totals.executedValue.toLocaleString()}</p>
          </article>
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Valor pendiente</p>
            <p className="mt-2 text-3xl font-bold text-white">${stats.totals.pendingValue.toLocaleString()}</p>
          </article>
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Liquidado / Pendiente</p>
            <p className="mt-2 text-lg font-semibold text-white">${stats.totals.liquidatedValue.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Pendiente: ${stats.totals.pendingLiquidationValue.toLocaleString()}</p>
          </article>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Crews activas</p>
            <p className="mt-2 text-2xl font-bold text-white">{crews.length}</p>
          </article>
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Tareas completadas</p>
            <p className="mt-2 text-2xl font-bold text-white">{stats.taskStatus.completed}</p>
            <p className="text-xs text-gray-400">En progreso: {stats.taskStatus.inProgress}</p>
          </article>
          <article className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700">
            <p className="text-sm text-gray-400">Tareas sin iniciar</p>
            <p className="mt-2 text-2xl font-bold text-white">{stats.taskStatus.notStarted}</p>
          </article>
        </section>

        <section className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Progreso por crew</h2>
          <div className="space-y-4">
            {stats.crewStats.map((crewStat) => (
              <button
                key={crewStat.crew.id}
                onClick={() => setSelectedCrewId(crewStat.crew.id)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  selectedCrewId === crewStat.crew.id
                    ? 'border-cyan-300/40 bg-cyan-300/10'
                    : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{crewStat.crew.name}</p>
                    <p className="text-xs text-gray-400">
                      Planificado: {crewStat.plannedQty.toLocaleString()} | Ejecutado: {crewStat.executedQty.toLocaleString()} | Pendiente:{' '}
                      {crewStat.pendingQty.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm text-gray-300">
                    Liquidado: ${crewStat.liquidatedValue.toLocaleString()} · Pendiente: ${crewStat.pendingLiquidationValue.toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 h-3 w-full rounded-full bg-gray-700">
                  <div
                    className="h-3 rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${crewStat.progressPct.toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">Avance: {crewStat.progressPct.toFixed(1)}%</p>
              </button>
            ))}
          </div>
        </section>

        {selectedCrewStats && (
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6">
            <article className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Composición de {selectedCrewStats.crew.name}</h3>
              <div className="flex items-center gap-5">
                <div
                  className="h-32 w-32 rounded-full"
                  style={{
                    background: `conic-gradient(${selectedCrewDonut.css})`,
                  }}
                />
                <div>
                  <p className="text-sm text-gray-400">Progreso de la crew</p>
                  <p className="text-3xl font-bold text-white">{selectedCrewDonut.pct.toFixed(1)}%</p>
                  <p className="text-sm text-gray-400 mt-1">Ejecutado: ${selectedCrewStats.executedValue.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">Pendiente: ${selectedCrewStats.pendingValue.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedCrewBreakdown.slice(0, 5).map((item) => (
                  <div key={item.task.id}>
                    <div className="flex justify-between text-xs text-gray-300 mb-1">
                      <span>{item.task.task_code} · {item.task.description}</span>
                      <span>{item.crewSharePct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-700">
                      <div className="h-2 rounded-full bg-green-400" style={{ width: `${item.crewSharePct.toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 overflow-x-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Detalle por tarea de la crew</h3>
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-gray-700 text-sm text-gray-300">
                    <th className="py-2 text-left">Tarea</th>
                    <th className="py-2 text-right">Planificada</th>
                    <th className="py-2 text-right">Ejecutada</th>
                    <th className="py-2 text-right">Pendiente</th>
                    <th className="py-2 text-right">Avance</th>
                    <th className="py-2 text-right">Valor ejecutado</th>
                    <th className="py-2 text-right">Valor pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCrewBreakdown.map((item) => (
                    <tr key={item.task.id} className="border-b border-gray-800 text-sm text-gray-200">
                      <td className="py-3 pr-2">
                        <p className="font-medium text-white">{item.task.task_code}</p>
                        <p className="text-xs text-gray-400">{item.task.description}</p>
                      </td>
                      <td className="py-3 text-right">{item.plannedQty.toLocaleString()}</td>
                      <td className="py-3 text-right">{item.executedQty.toLocaleString()}</td>
                      <td className="py-3 text-right">{item.pendingQty.toLocaleString()}</td>
                      <td className="py-3 text-right">{item.progressPct.toFixed(1)}%</td>
                      <td className="py-3 text-right">${item.executedValue.toLocaleString()}</td>
                      <td className="py-3 text-right">${item.pendingValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
