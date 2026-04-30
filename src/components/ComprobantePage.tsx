import { useState, useEffect, useRef } from 'react';
import {
  getPaymentReceiptsList,
  getPaymentReceipt,
  getPayrollPeriodsByIds,
  getCrewsByIds,
  type PaymentReceipt,
  type PayrollPeriod,
  type Crew
} from '../lib/supabaseQueries';
import { formatDateLatam, getLocalISODate } from '../lib/dateUtils';
import LatamDateInput from './LatamDateInput';
import { loadIssuerProfile, saveIssuerProfile, getEmptyIssuerProfile, type IssuerProfile } from '../lib/issuerProfile';

type PaymentReceiptWithRelations = PaymentReceipt & {
  payroll_period: PayrollPeriod & {
    crew: Crew;
  };
};

type PayrollReportArchive = {
  generated_at?: string;
  receipt_number: string;
  issue_date: string;
  crew: { id: string; name: string };
  period: { start_date: string; end_date: string };
  totals: { total_amount: number; days_worked: number; item_count: number };
  entries: Array<{
    date: string;
    task_code: string;
    description: string;
    qty: number;
    unit: string;
    unit_price: number;
    value: number;
  }>;
};

export default function ComprobantePage() {
  const DEBUG_TIMING = true;
  const renderCountRef = useRef(0);
  const mountStartRef = useRef<number | null>(null);
  const loadStartRef = useRef<number | null>(null);
  const loadRunRef = useRef(0);
  const effectRunRef = useRef(0);
  const [receipts, setReceipts] = useState<PaymentReceiptWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceiptWithRelations | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [issuerProfile, setIssuerProfile] = useState<IssuerProfile>(getEmptyIssuerProfile());
  const [savingIssuerProfile, setSavingIssuerProfile] = useState(false);
  const hasLoadedRef = useRef(false);
  renderCountRef.current += 1;
  if (DEBUG_TIMING && mountStartRef.current === null) {
    mountStartRef.current = performance.now();
    console.info('[Comprobantes][timing] mount start');
  }

  useEffect(() => {
    effectRunRef.current += 1;
    if (DEBUG_TIMING) {
      console.info('[Comprobantes][timing] mount effect run', {
        effectRun: effectRunRef.current,
        hasLoaded: hasLoadedRef.current,
      });
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadReceipts();
  }, []);

  useEffect(() => {
    let active = true;
    void loadIssuerProfile()
      .then((profile) => {
        if (active) setIssuerProfile(profile);
      })
      .catch((error) => console.error('Error loading issuer profile:', error));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!DEBUG_TIMING) return;
    if (!loading) {
      const now = performance.now();
      const mountMs = mountStartRef.current ? now - mountStartRef.current : null;
      const loadMs = loadStartRef.current ? now - loadStartRef.current : null;
      console.info('[Comprobantes][timing] first usable render', {
        receipts: receipts.length,
        renderCount: renderCountRef.current,
        mountToUsableMs: mountMs ? Number(mountMs.toFixed(1)) : null,
        loadToUsableMs: loadMs ? Number(loadMs.toFixed(1)) : null,
      });
    }
  }, [loading, receipts.length]);

  const loadReceipts = async () => {
    loadRunRef.current += 1;
    loadStartRef.current = performance.now();
    const runId = loadRunRef.current;
    if (DEBUG_TIMING) {
      console.info('[Comprobantes][timing] loadReceipts start', { runId });
    }

    const t0 = performance.now();
    try {
      const tReceipts0 = performance.now();
      const receiptsData = await getPaymentReceiptsList();
      const tReceipts1 = performance.now();
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] receipts query done', {
          runId,
          count: receiptsData.length,
          ms: Number((tReceipts1 - tReceipts0).toFixed(1)),
        });
      }
      const periodIds = [...new Set(receiptsData.map((receipt) => receipt.payroll_period_id))];
      const tPeriods0 = performance.now();
      const periodsData = await getPayrollPeriodsByIds(periodIds);
      const tPeriods1 = performance.now();
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] payroll periods query done', {
          runId,
          requestedIds: periodIds.length,
          returned: periodsData.length,
          ms: Number((tPeriods1 - tPeriods0).toFixed(1)),
        });
      }
      const crewIds = [...new Set(periodsData.map((period) => period.crew_id))];
      const tCrews0 = performance.now();
      const crewsData = await getCrewsByIds(crewIds);
      const tCrews1 = performance.now();
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] crews query done', {
          runId,
          requestedIds: crewIds.length,
          returned: crewsData.length,
          ms: Number((tCrews1 - tCrews0).toFixed(1)),
        });
      }

      const tMerge0 = performance.now();
      const periodById = new Map(periodsData.map((period) => [period.id, period]));
      const crewById = new Map(crewsData.map((crew) => [crew.id, crew]));

      const receiptsWithRelations = receiptsData
        .map((receipt) => {
          const period = periodById.get(receipt.payroll_period_id);
          if (!period) return null;

          const crew = crewById.get(period.crew_id);
          return {
            ...receipt,
            payroll_period: {
              ...period,
              crew: crew || { id: period.crew_id, name: '', active: true, created_at: new Date(), updated_at: new Date() },
            },
          } as PaymentReceiptWithRelations;
        })
        .filter((receipt): receipt is PaymentReceiptWithRelations => receipt !== null);
      const tMerge1 = performance.now();
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] relation merge done', {
          runId,
          merged: receiptsWithRelations.length,
          ms: Number((tMerge1 - tMerge0).toFixed(1)),
        });
      }

      const tSet0 = performance.now();
      setReceipts(receiptsWithRelations);
      const tSet1 = performance.now();
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] state set scheduled', {
          runId,
          ms: Number((tSet1 - tSet0).toFixed(3)),
        });
        console.info('[Comprobantes][timing] loadReceipts total done', {
          runId,
          ms: Number((tSet1 - t0).toFixed(1)),
        });
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      if (DEBUG_TIMING) {
        console.info('[Comprobantes][timing] loading=false', {
          runId,
          totalMs: Number((performance.now() - t0).toFixed(1)),
        });
      }
      setLoading(false);
    }
  };

  const handleSelectReceipt = async (receipt: PaymentReceiptWithRelations) => {
    try {
      const fullReceipt = await getPaymentReceipt(receipt.id);
      if (!fullReceipt) {
        setSelectedReceipt(receipt);
        return;
      }

      setSelectedReceipt({
        ...receipt,
        ...fullReceipt,
        payroll_period: receipt.payroll_period,
      });
    } catch (error) {
      console.error('Error loading receipt detail:', error);
      setSelectedReceipt(receipt);
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    const receiptDate = getLocalISODate(new Date(receipt.created_at));
    const matchesDateFrom = !filterDateFrom || receiptDate >= filterDateFrom;
    const matchesDateTo = !filterDateTo || receiptDate <= filterDateTo;
    return matchesDateFrom && matchesDateTo;
  });

  const parseArchivedReport = (notes?: string): PayrollReportArchive | null => {
    if (!notes || !notes.startsWith('PAYROLL_REPORT::')) return null;
    const raw = notes.slice('PAYROLL_REPORT::'.length);
    try {
      return JSON.parse(raw) as PayrollReportArchive;
    } catch (error) {
      console.warn('Failed to parse archived payroll report from receipt notes.', error);
      return null;
    }
  };

  const handleSaveIssuerProfile = async () => {
    try {
      setSavingIssuerProfile(true);
      await saveIssuerProfile(issuerProfile);
      alert('Datos del emisor guardados.');
    } catch (error) {
      console.error('Error saving issuer profile:', error);
      alert('No se pudieron guardar los datos del emisor.');
    } finally {
      setSavingIssuerProfile(false);
    }
  };

  const exportToPDF = () => {
    if (!selectedReceipt) return;
    
    // Crear ventana nueva para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receipt = selectedReceipt;
    const archivedReport = parseArchivedReport(receipt.notes);
    const detailRows = archivedReport?.entries?.length
      ? archivedReport.entries
          .map(
            (entry) => `
              <tr>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;">${formatDateLatam(entry.date)}</td>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;">${entry.task_code} - ${entry.description}</td>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">${entry.qty}</td>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:center;">${entry.unit}</td>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">$${entry.unit_price.toLocaleString()}</td>
                <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">$${entry.value.toLocaleString()}</td>
              </tr>
            `
          )
          .join('')
      : '';
    const detailSection = detailRows
      ? `
        <div style="margin-top:20px;">
          <h3>Detalle de cálculo</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f3f3f3;">
                <th style="padding:6px 4px;text-align:left;">Fecha</th>
                <th style="padding:6px 4px;text-align:left;">Tarea</th>
                <th style="padding:6px 4px;text-align:right;">Cant.</th>
                <th style="padding:6px 4px;text-align:center;">Un.</th>
                <th style="padding:6px 4px;text-align:right;">Precio</th>
                <th style="padding:6px 4px;text-align:right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${detailRows}
            </tbody>
          </table>
        </div>
      `
      : '';
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante ${receipt.number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .company-info h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
          }
          .company-info p {
            margin: 2px 0;
            color: #666;
          }
          .receipt-info {
            text-align: right;
          }
          .receipt-info p {
            margin: 2px 0;
          }
          .receipt-number {
            font-size: 18px;
            font-weight: bold;
          }
          .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .section h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          .section p {
            margin: 5px 0;
          }
          .amount-section {
            border: 2px solid #333;
            padding: 20px;
            margin: 20px 0;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 18px;
            padding: 10px 0;
            border-top: 2px solid #333;
            margin-top: 10px;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 30px;
            padding-top: 5px;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${issuerProfile.company_name || '—'}</h1>
            <p>CUIL/CUIT: ${issuerProfile.cuit_cuil || '—'}</p>
            <p>${issuerProfile.address || '—'}</p>
            <p>${issuerProfile.phone || '—'}</p>
          </div>
          <div class="receipt-info">
            <p class="receipt-number">${receipt.number}</p>
            <p>Fecha: ${formatDateLatam(receipt.created_at)}</p>
            <p>Comprobante de Pago</p>
          </div>
        </div>

        ${detailSection}

        <div class="content">
          <div class="section">
            <h3>Receptor</h3>
            <p><strong>Crew:</strong> ${receipt.payroll_period.crew.name}</p>
            <p><strong>Capataz:</strong> ${receipt.payroll_period.crew.foreman_name || 'No especificado'}</p>
            <p><strong>Período:</strong> ${formatDateLatam(receipt.payroll_period.start_date)} a ${formatDateLatam(receipt.payroll_period.end_date)}</p>
          </div>
          <div class="section">
            <h3>Obra</h3>
            <p><strong>Nombre:</strong> ________________</p>
            <p><strong>Dirección:</strong> ________________</p>
            <p><strong>Cliente:</strong> ________________</p>
          </div>
        </div>

        <div class="amount-section">
          <h3>Detalle de Liquidación</h3>
          <div class="amount-row">
            <span>Valor total por tareas certificadas</span>
            <span>$${receipt.amount.toLocaleString()}</span>
          </div>
          <div class="total-row">
            <span>Total a liquidar</span>
            <span>$${receipt.amount.toLocaleString()}</span>
          </div>
        </div>

        <div class="content">
          <div class="section">
            <h3>Pago</h3>
            <p><strong>Forma de pago:</strong> ________________</p>
            <p><strong>Observaciones:</strong> ________________</p>
            <p><strong>Moneda:</strong> ${receipt.currency}</p>
          </div>
          <div class="section">
            <h3>Referencia</h3>
            <p><strong>Número:</strong> ${receipt.number}</p>
            <p><strong>Emitido por:</strong> ${issuerProfile.company_name || '—'}</p>
            <p><strong>Fecha de emisión:</strong> ${formatDateLatam(receipt.created_at)}</p>
          </div>
        </div>

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">
              <p>Firma y aclaración - Emisor</p>
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              <p>Firma y aclaración - Receptor</p>
            </div>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Imprimir PDF
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Cerrar
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
              <h1 className="text-3xl font-bold text-white mb-2">Comprobantes</h1>
              <p className="text-gray-400">Gestión de comprobantes de pago</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Datos del emisor en comprobantes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Empresa / Emisor</label>
              <input
                value={issuerProfile.company_name}
                onChange={(e) => setIssuerProfile((prev) => ({ ...prev, company_name: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                placeholder="Ej: Mi Empresa SRL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">CUIT/CUIL</label>
              <input
                value={issuerProfile.cuit_cuil}
                onChange={(e) => setIssuerProfile((prev) => ({ ...prev, cuit_cuil: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                placeholder="Ej: 30-12345678-9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Dirección</label>
              <input
                value={issuerProfile.address}
                onChange={(e) => setIssuerProfile((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                placeholder="Ej: Calle 123, Ciudad"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Teléfono</label>
              <input
                value={issuerProfile.phone}
                onChange={(e) => setIssuerProfile((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                placeholder="Ej: +54 9 ..."
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveIssuerProfile}
              disabled={savingIssuerProfile}
              className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
                savingIssuerProfile
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              {savingIssuerProfile ? 'Guardando...' : 'Guardar datos del emisor'}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Desde</label>
              <LatamDateInput
                value={filterDateFrom}
                onChange={setFilterDateFrom}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hasta</label>
              <LatamDateInput
                value={filterDateTo}
                onChange={setFilterDateTo}
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

        {/* Lista de Comprobantes */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Número</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Crew</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Período</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Monto</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Fecha</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-mono">{receipt.number}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{receipt.payroll_period.crew.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {formatDateLatam(receipt.payroll_period.start_date)} a {formatDateLatam(receipt.payroll_period.end_date)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-300">
                      ${receipt.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {formatDateLatam(receipt.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleSelectReceipt(receipt)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vista Previa del Comprobante */}
        {selectedReceipt && (
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Comprobante {selectedReceipt.number}</h3>
              <button
                onClick={exportToPDF}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Exportar PDF
              </button>
            </div>
            
            <div className="bg-white text-black p-6 rounded-lg">
              {(() => {
                const archivedReport = parseArchivedReport(selectedReceipt.notes);
                return (
                  <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-bold">{issuerProfile.company_name || '—'}</h4>
                  <p className="text-gray-600">CUIL/CUIT: {issuerProfile.cuit_cuil || '—'}</p>
                  <p className="text-gray-600">{issuerProfile.address || '—'}</p>
                  <p className="text-gray-600">{issuerProfile.phone || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{selectedReceipt.number}</p>
                  <p className="text-gray-600">Fecha: {formatDateLatam(selectedReceipt.created_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h5 className="font-semibold">Receptor</h5>
                  <p>Crew: {selectedReceipt.payroll_period.crew.name}</p>
                  <p>Capataz: {selectedReceipt.payroll_period.crew.foreman_name || 'No especificado'}</p>
                  <p>Período: {formatDateLatam(selectedReceipt.payroll_period.start_date)} a {formatDateLatam(selectedReceipt.payroll_period.end_date)}</p>
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
                    <span>${selectedReceipt.amount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total a liquidar</span>
                  <span>${selectedReceipt.amount.toLocaleString()}</span>
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
                  <p>Número: {selectedReceipt.number}</p>
                  <p>Emitido por: {issuerProfile.company_name || '—'}</p>
                </div>
              </div>

              {archivedReport?.entries?.length ? (
                <div className="mb-6">
                  <h5 className="font-semibold mb-2">Detalle de cálculo</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-1 text-left">Fecha</th>
                          <th className="px-2 py-1 text-left">Tarea</th>
                          <th className="px-2 py-1 text-right">Cant.</th>
                          <th className="px-2 py-1 text-center">Un.</th>
                          <th className="px-2 py-1 text-right">Precio</th>
                          <th className="px-2 py-1 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedReport.entries.map((entry, index) => (
                          <tr key={`${entry.date}-${entry.task_code}-${index}`} className="border-t border-gray-200">
                            <td className="px-2 py-1">{formatDateLatam(entry.date)}</td>
                            <td className="px-2 py-1">{entry.task_code} - {entry.description}</td>
                            <td className="px-2 py-1 text-right">{entry.qty}</td>
                            <td className="px-2 py-1 text-center">{entry.unit}</td>
                            <td className="px-2 py-1 text-right">${entry.unit_price.toLocaleString()}</td>
                            <td className="px-2 py-1 text-right">${entry.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
                  </>
                );
              })()}

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
                onClick={exportToPDF}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Exportar PDF
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
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
            <div className="text-2xl font-bold text-white">{filteredReceipts.length}</div>
            <div className="text-sm text-gray-400">Total Comprobantes</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              ${filteredReceipts.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Liquidado</div>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="text-2xl font-bold text-white">
              {new Set(filteredReceipts.map(r => r.payroll_period.crew_id)).size}
            </div>
            <div className="text-sm text-gray-400">Crews Liquidadas</div>
          </div>
        </div>
      </div>
    </div>
  );
}


