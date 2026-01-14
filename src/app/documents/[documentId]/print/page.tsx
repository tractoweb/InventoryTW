import { getDocumentDetails } from '@/actions/get-document-details';
import { PrintOnMount } from './print-on-mount';

function money(amount: number) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export default async function DocumentPrintPage({ params }: { params: { documentId: string } }) {
  const documentId = Number(params.documentId);
  const res: any = await getDocumentDetails(documentId);

  if (res?.error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Documento</h1>
        <p>{String(res.error)}</p>
      </div>
    );
  }

  const d = res?.data as any;
  if (!d) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Documento</h1>
        <p>No hay información.</p>
      </div>
    );
  }

  const totals = d?.liquidation?.result?.totals;
  const lines = d?.liquidation?.result?.lines ?? [];

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#111' }}>
      <PrintOnMount />
      <style>{`
        @page { margin: 12mm; }
        h1,h2,h3 { margin: 0 0 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; font-size: 12px; }
        th { text-align: left; }
        .muted { color: #666; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 16px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        .right { text-align: right; }
      `}</style>

      <h1>Documento {d.number}</h1>
      <div className="muted">ID: {d.id} · Fecha: {d.date}</div>

      <div className="grid">
        <div className="card">
          <div className="muted">Proveedor</div>
          <div>{d.customername ?? '-'}</div>
          <div className="muted">País</div>
          <div>{d.customercountryname ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">Tipo</div>
          <div>{d.documenttypename}</div>
          <div className="muted">Almacén</div>
          <div>{d.warehousename}</div>
        </div>
        <div className="card">
          <div className="muted">Compra</div>
          <div>{money(totals?.totalPurchaseCost ?? d.total ?? 0)}</div>
          <div className="muted">Flete</div>
          <div>{money(totals?.totalFreight ?? 0)}</div>
        </div>
        <div className="card">
          <div className="muted">Costo final</div>
          <div>{money(totals?.totalFinalCost ?? 0)}</div>
          <div className="muted">Venta total</div>
          <div>{money(totals?.totalSalePrice ?? 0)}</div>
        </div>
      </div>

      <h2>Artículos</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Item</th>
            <th>Producto</th>
            <th style={{ width: 90 }}>Código</th>
            <th className="right" style={{ width: 60 }}>Cant.</th>
            <th className="right" style={{ width: 110 }}>Costo unit.</th>
            <th className="right" style={{ width: 110 }}>Flete unit.</th>
            <th className="right" style={{ width: 110 }}>Costo final</th>
            <th className="right" style={{ width: 110 }}>Venta unit.</th>
            <th className="right" style={{ width: 120 }}>Venta total</th>
          </tr>
        </thead>
        <tbody>
          {(d.items ?? []).map((it: any, idx: number) => {
            const l = lines[idx];
            return (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.productname}</td>
                <td>{it.productcode ?? '-'}</td>
                <td className="right">{it.quantity}</td>
                <td className="right">{money(it.unitcost)}</td>
                <td className="right">{money(l?.unitFreight ?? 0)}</td>
                <td className="right">{money(l?.unitFinalCost ?? it.unitcost)}</td>
                <td className="right">{money(l?.unitSalePrice ?? 0)}</td>
                <td className="right">{money(l?.totalSalePrice ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totals && (
        <div style={{ marginTop: 14 }}>
          <h3>Resumen</h3>
          <div className="grid">
            <div className="card">
              <div className="muted">Descuento</div>
              <div>{money(totals.totalDiscount)}</div>
            </div>
            <div className="card">
              <div className="muted">IVA</div>
              <div>{money(totals.totalIVA)}</div>
            </div>
            <div className="card">
              <div className="muted">Utilidad</div>
              <div>{money(totals.totalProfit)}</div>
            </div>
            <div className="card">
              <div className="muted">Margen</div>
              <div>{Number(totals.profitMarginPercentage ?? 0).toFixed(2)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
