import { useState, useEffect } from 'react';
import { 
  getCrews, 
  getDailyEntries, 
  getTask, 
  getCurrentTaskPrice,
  createPayrollPeriod,
  generateReceiptNumber,
  createPaymentReceipt,
  type Crew,
  type Task
} from '../lib/firebaseQueries';

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

export default function PayrollPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
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

    setCalculating(true);
    try {
      // Obtener entradas diarias del crew en el rango de fechas desde Firebase
      const entriesData = await getDailyEntries({
        crewId: selectedCrew,
        dateFrom,
        dateTo,
      });

      // Obtener precios vigentes para cada tarea
      const entriesWithPrices = await Promise.all(
        entriesData.map(async (entry) => {
          const task = await getTask(entry.task_id);
          const priceData = await getCurrentTaskPrice(entry.task_id, entry.date);

          const unitPrice = priceData?.unit_price || 0;
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
        })
      );

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
    } catch (error) {
      console.error('Error calculating payroll:', error);
    } finally {
      setCalculating(false);
    }
  };

  const generateReceipt = async () => {
    if (!calculation) return;

    try {
      // Crear período de payroll
      const periodId = await createPayrollPeriod({
        crew_id: calculation.crew_id,
        start_date: calculation.start_date,
        end_date: calculation.end_date,
        total_value_completed: calculation.total_value,
        status: 'closed',
      });

      // Generar número de comprobante
      const receiptNumber = await generateReceiptNumber();

      // Crear comprobante
      await createPaymentReceipt({
        payroll_period_id: periodId,
        number: receiptNumber,
        issue_date: new Date().toISOString().split('T')[0],
        amount: calculation.total_value,
        currency: 'ARS',
      });

      setShowReceipt(true);
    } catch (error) {
      console.error('Error generating receipt:', error);
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
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Emitir Comprobante
                </button>
                <button
                  onClick={() => setCalculation(null)}
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
                  <p className="text-lg font-semibold">REC-2025-0001</p>
                  <p className="text-gray-600">Fecha: {new Date().toLocaleDateString()}</p>
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
                  <p>Número: REC-2025-0001</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

