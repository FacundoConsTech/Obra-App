import { useState, useEffect, useRef } from 'react';
import { 
  getCrews, 
  getTasks,
  getDailyEntries, 
  getPaymentReceipts,
  getPayrollPeriodsByIds,
  getTaskPricesByTaskIds,
  queueCreatePayrollPeriod,
  generateReceiptNumber,
  queueCreatePaymentReceipt,
  type Crew
} from '../lib/firebaseQueries';
import { getLocalISODate } from '../lib/dateUtils';

type PayrollEntry = {
  date: string;
  task_code: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  value: number;
};

type PayrollCalculation = {
  crew_id: string;
  crew_name: string;
  start_date: string;
  end_date: string;
  entries: PayrollEntry[];
  total_value: number;
  days_worked: number;
};

type GeneratedReport = {
  receipt_id: string;
  receipt_number: string;
  issue_date: string;
};

export default function PayrollPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [liquidatedAmount, setLiquidatedAmount] = useState(0);
  const hasLoadedRef = useRef(false);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadCrews();
  }, []);

  const loadCrews = async () => {
    try {
      const crewsData = await getCrews();
      setCrews(crewsData);
    } catch (error) {
      console.error('Error loading crews:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayroll = async () => {
    if (!selectedCrew || !dateFrom || !dateTo) return;

    setGeneratedReport(null);
    setShowReceipt(false);
    setLiquidatedAmount(0);
    setCalculating(true);
    try {
      // Obtener entradas diarias del crew en el rango de fechas desde Firebase
      const entriesData = await getDailyEntries({
        crewId: selectedCrew,
        dateFrom,
        dateTo,
      });

      const uniqueTaskIds = [...new Set(entriesData.map((entry) => entry.task_id))];
      const taskIdSet = new Set(uniqueTaskIds);
      const [tasksData, taskPricesByTaskId] = await Promise.all([
        getTasks(),
        getTaskPricesByTaskIds(uniqueTaskIds, dateTo),
      ]);

      const taskById = new Map(
        tasksData
          .filter((task) => taskIdSet.has(task.id))
          .map((task) => [task.id, task] as const)
      );
      const getPriceForDate = (taskId: string, date: string) => {
        const prices = taskPricesByTaskId.get(taskId) || [];
        const price = prices.find((priceItem) =>
          priceItem.valid_from <= date && (!priceItem.valid_to || priceItem.valid_to >= date)
        );
        if (price?.unit_price !== undefined && price?.unit_price !== null) {
          return price.unit_price;
        }
        const task = taskById.get(taskId);
        return task?.unit_price ?? 0;
      };

      const entriesWithPrices = entriesData.map((entry) => {
        const task = taskById.get(entry.task_id);
        const unitPrice = getPriceForDate(entry.task_id, entry.date);
        const value = entry.qty * unitPrice;

        return {
          date: entry.date,
          task_code: task?.task_code || '',
          description: task?.description || '',
          qty: entry.qty,
          unit: entry.unit,
          unit_price: unitPrice,
          value,
        };
      });

      const crew = crews.find(c => c.id === selectedCrew);
      const totalValue = entriesWithPrices.reduce((sum, entry) => sum + entry.value, 0);
      const daysWorked = new Set(entriesWithPrices.map(e => e.date)).size;

      setCalculation({
        crew_id: selectedCrew,
        crew_name: crew?.name || '',
        start_date: dateFrom,
        end_date: dateTo,
        entries: entriesWithPrices,
        total_value: totalValue,
        days_worked: daysWorked,
      });
      void refreshLiquidatedAmount(selectedCrew, dateFrom, dateTo);
    } catch (error) {
      console.error('Error calculating payroll:', error);
    } finally {
      setCalculating(false);
    }
  };

  const refreshLiquidatedAmount = async (crewId: string, startDate: string, endDate: string) => {
    try {
      const receiptsData = await getPaymentReceipts();
      if (receiptsData.length === 0) {
        setLiquidatedAmount(0);
        return;
      }

      const periodIds = [...new Set(receiptsData.map((receipt) => receipt.payroll_period_id))];
      const periodsData = await getPayrollPeriodsByIds(periodIds);
      const periodById = new Map(periodsData.map((period) => [period.id, period]));

      const totalLiquidated = receiptsData.reduce((sum, receipt) => {
        const period = periodById.get(receipt.payroll_period_id);
        if (!period) return sum;
        const sameCrew = period.crew_id === crewId;
        const samePeriod = period.start_date === startDate && period.end_date === endDate;
        return sameCrew && samePeriod ? sum + receipt.amount : sum;
      }, 0);

      setLiquidatedAmount(totalLiquidated);
    } catch (error) {
      console.error('Error loading liquidated amount:', error);
      setLiquidatedAmount(0);
    }
  };

  const generateReceipt = async () => {
    if (!calculation || generatingReport) return;
    if (calculation.entries.length === 0) {
      alert('No hay tareas certificadas en el periodo seleccionado.');
      return;
    }

    try {
      setGeneratingReport(true);
      const queuedPeriod = queueCreatePayrollPeriod({
        crew_id: calculation.crew_id,
        start_date: calculation.start_date,
        end_date: calculation.end_date,
        total_value_completed: calculation.total_value,
        status: 'closed',
      });

      let receiptNumber = '';
      try {
        receiptNumber = await withTimeout(generateReceiptNumber(), 10000, 'generateReceiptNumber');
      } catch (numberError) {
        console.warn('Could not generate sequential receipt number, using fallback.', numberError);
        const year = new Date().getFullYear();
        receiptNumber = `REC-${year}-${Date.now().toString().slice(-6)}`;
      }
      const issueDate = getLocalISODate();

      const reportCopy = {
        generated_at: new Date().toISOString(),
        receipt_number: receiptNumber,
        issue_date: issueDate,
        crew: {
          id: calculation.crew_id,
          name: calculation.crew_name,
        },
        period: {
          start_date: calculation.start_date,
          end_date: calculation.end_date,
        },
        totals: {
          total_amount: calculation.total_value,
          days_worked: calculation.days_worked,
          item_count: calculation.entries.length,
        },
        entries: calculation.entries,
      };

      const queuedReceipt = queueCreatePaymentReceipt({
        payroll_period_id: queuedPeriod.id,
        number: receiptNumber,
        issue_date: issueDate,
        amount: calculation.total_value,
        currency: 'ARS',
        notes: `PAYROLL_REPORT::${JSON.stringify(reportCopy)}`,
      });

      await withTimeout(
        Promise.all([queuedPeriod.commit, queuedReceipt.commit]),
        15000,
        'emitPayrollReport'
      );

      setGeneratedReport({
        receipt_id: queuedReceipt.id,
        receipt_number: receiptNumber,
        issue_date: issueDate,
      });
      await refreshLiquidatedAmount(calculation.crew_id, calculation.start_date, calculation.end_date);
      setShowReceipt(true);
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('No se pudo emitir el informe. Revisa permisos/reglas de Firebase.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const emittedAmount = calculation ? liquidatedAmount : 0;
  const pendingAmount = calculation ? Math.max(0, calculation.total_value - emittedAmount) : 0;

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
              <h1 className="text-3xl font-bold text-white mb-2">Payroll</h1>
              <p className="text-gray-400">Liquidación por cuadrilla</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Selector de Período */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Seleccionar Período</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Crew</label>
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              >
                <option value="">Seleccionar crew</option>
                {crews.map(crew => (
                  <option key={crew.id} value={crew.id}>{crew.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={calculatePayroll}
                disabled={!selectedCrew || !dateFrom || !dateTo || calculating}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                  selectedCrew && dateFrom && dateTo && !calculating
                    ? 'bg-white text-black hover:bg-gray-100'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {calculating ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </div>
        </div>

        {/* Resultado del Cálculo */}
        {calculation && (
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{calculation.crew_name}</h3>
                  <p className="text-gray-400">
                    {calculation.start_date} a {calculation.end_date}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    ${calculation.total_value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400">Total a liquidar</div>
                  <div className="text-xs text-gray-300 mt-1">
                    Liquidado: ${emittedAmount.toLocaleString()} | Pendiente: ${pendingAmount.toLocaleString()}
                  </div>
                  {generatedReport && (
                    <div className="text-xs mt-2 inline-block bg-green-700/40 text-green-200 px-2 py-1 rounded">
                      Liquidado / Informe emitido
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Tarea</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Cantidad</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Unidad</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Precio</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {calculation.entries.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-300">{entry.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {entry.task_code} - {entry.description}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-300">{entry.qty}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-300">{entry.unit}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-300">
                        ${entry.unit_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-300">
                        ${entry.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-800/50">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                      Total del período
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-white">
                      ${calculation.total_value.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-6 border-t border-gray-700">
              <div className="flex gap-4">
                <button
                  onClick={generateReceipt}
                  disabled={generatingReport || !!generatedReport}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    generatingReport || generatedReport
                      ? 'bg-green-800 text-white cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {generatedReport ? 'Informe Emitido' : generatingReport ? 'Emitiendo...' : 'Emitir Informe'}
                </button>
                <button
                  onClick={() => {
                    setCalculation(null);
                    setGeneratedReport(null);
                    setShowReceipt(false);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Nueva Consulta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista Previa del Comprobante */}
        {showReceipt && calculation && (
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-white mb-6">Comprobante de Pago</h3>
            
            <div className="bg-white text-black p-6 rounded-lg">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-bold">Custom Srl</h4>
                  <p className="text-gray-600">CUIL: 30-71538812-6</p>
                  <p className="text-gray-600">Tucuman 2647</p>
                  <p className="text-gray-600">0341 525-2476</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {generatedReport?.receipt_number || 'REC-PENDIENTE'}
                  </p>
                  <p className="text-gray-600">
                    Fecha: {generatedReport?.issue_date || getLocalISODate()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h5 className="font-semibold">Receptor</h5>
                  <p>Crew: {calculation.crew_name}</p>
                  <p>Período: {calculation.start_date} a {calculation.end_date}</p>
                </div>
                <div>
                  <h5 className="font-semibold">Obra</h5>
                  <p>Nombre: ________________</p>
                  <p>Dirección: ________________</p>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="font-semibold mb-2">Detalle</h5>
                <div className="border-t border-b py-2">
                  <div className="flex justify-between">
                    <span>Valor total por tareas certificadas</span>
                    <span>${calculation.total_value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total a liquidar</span>
                  <span>${calculation.total_value.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h5 className="font-semibold">Pago</h5>
                  <p>Forma de pago: ________________</p>
                  <p>Observaciones: ________________</p>
                </div>
                <div>
                  <h5 className="font-semibold">Referencia</h5>
                  <p>Número: {generatedReport?.receipt_number || 'REC-PENDIENTE'}</p>
                  <p>Emitido por: Custom Srl</p>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <div className="text-center">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-sm">Firma y aclaración - Emisor</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-sm">Firma y aclaración - Receptor</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Exportar PDF
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">{crews.length}</div>
            <div className="text-sm text-gray-400">Crews Activas</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {calculation ? calculation.days_worked : 0}
            </div>
            <div className="text-sm text-gray-400">Días Trabajados</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              ${calculation ? calculation.total_value.toLocaleString() : '0'}
            </div>
            <div className="text-sm text-gray-400">Total Calculado</div>
            <div className="text-xs text-gray-400 mt-2">
              Liquidado: ${emittedAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Pendiente: ${pendingAmount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



