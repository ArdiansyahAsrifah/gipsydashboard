'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend
);

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Summary {
  total: number; totalPaid: number; totalCoupon: number;
  totalRevenue: number; avgOrder: number; convRate: number;
  mrr: number; arr: number;
  thisMonth: { reg: number; paid: number; revenue: number };
  lastMonth: { reg: number; paid: number; revenue: number };
  daily: [string, number][];
  revDaily: [string, number][];
  sources: [string, number][];
  universities: [string, number][];
  majors: [string, number][];
  products: [string, number][];
  payments: [string, number][];
  coupons: [string, number][];
  hours: [number, number][];
  cohort: [string, { total: number; paid: number }][];
}

interface TableState {
  rows: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const NAV_ITEMS = [
  { id: 'Overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'Revenue', label: 'Revenue', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'Customers', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'Analytics', label: 'Analytics', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
] as const;
type Tab = typeof NAV_ITEMS[number]['id'];

const PROD_COLORS: Record<string, string> = {
  'PRO 1 Bulan': '#2DD4BF',
  'PRO Researcher 1 Bulan': '#0EA5E9',
  'PRO 3 Bulan': '#F59E0B',
  'PRO Researcher 3 Bulan': '#A78BFA',
  Unknown: '#4B5563',
};

const PILL_CLASS: Record<string, string> = {
  'PRO 1 Bulan': 'pill-teal',
  'PRO Researcher 1 Bulan': 'pill-blue',
  'PRO 3 Bulan': 'pill-amber',
  'PRO Researcher 3 Bulan': 'pill-purple',
  Unknown: 'pill-gray',
};

// ─── Formatters ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const clean = (v: any) => !v || v === '-' || String(v).trim() === '' ? 'Unknown' : String(v).trim();

function relativeTime(ts: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(ts: number): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function exportCSV(rows: any[]) {
  const headers = ['Nama', 'Email', 'Telepon', 'Universitas', 'Jurusan', 'Produk', 'Amount', 'Sumber', 'Metode Bayar', 'Kupon', 'Tanggal'];
  const data = rows.map(r => [
    clean(r.customerName), clean(r.customerEmail), r.phone || '',
    clean(r.university), clean(r.major), clean(r.product),
    r.amount, clean(r.source), clean(r.paymentMethod),
    r.couponCode || '', r.transactionDate || '',
  ]);
  const csv = [headers, ...data].map(row =>
    row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gipsy-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ─────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('id-ID'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontSize: 12, color: '#9CA3AF' }}>{time}</span>;
}

function Avatar({ name, dark }: { name: string; dark: boolean }) {
  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: dark ? '#134E4A' : '#CCFBF1',
      color: dark ? '#2DD4BF' : '#0D9488',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 600, flexShrink: 0,
    }}>{initials || '?'}</div>
  );
}

function KpiCard({ label, value, sub, icon, trend, dark }: {
  label: string; value: string; sub: string; icon: string; trend?: number | null; dark: boolean;
}) {
  const up = trend == null ? null : trend >= 0;
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="kpi-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
        {trend != null && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            color: up ? '#2DD4BF' : '#F87171',
            background: up ? 'rgba(45,212,191,.1)' : 'rgba(248,113,113,.1)',
            padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap',
          }}>
            {up ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs lalu
          </span>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function SkeletonBox({ h = 20, w = '100%', mb = 0 }: { h?: number; w?: string | number; mb?: number }) {
  return <div style={{ height: h, width: w, borderRadius: 6, background: '#1F2937', marginBottom: mb, animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

function SkeletonKpi() {
  return (
    <div className="kpi-card">
      <SkeletonBox h={36} w={36} mb={16} />
      <SkeletonBox h={24} w="60%" mb={8} />
      <SkeletonBox h={12} w="80%" mb={4} />
      <SkeletonBox h={10} w="50%" />
    </div>
  );
}

function SkeletonChart({ h = 200 }: { h?: number }) {
  return (
    <div className="card">
      <SkeletonBox h={14} w="40%" mb={8} />
      <SkeletonBox h={10} w="60%" mb={20} />
      <SkeletonBox h={h} />
    </div>
  );
}

function HBars({ data, color, onClickBar }: {
  data: [string, number][]; color: string; onClickBar?: (label: string) => void;
}) {
  const max = data[0]?.[1] || 1;
  if (data.length === 0) return <div className="empty-state">Tidak ada data</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(([lbl, cnt]) => (
        <div
          key={lbl}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClickBar ? 'pointer' : 'default' }}
          onClick={() => onClickBar?.(lbl)}
          title={onClickBar ? `Filter: ${lbl}` : undefined}
        >
          <div className="hbar-label" title={lbl}>{lbl}</div>
          <div style={{ flex: 1, height: 5, background: '#1F2937', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: color, width: `${Math.round((cnt / max) * 100)}%`, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', width: 32, textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>{fmtN(cnt)}</div>
        </div>
      ))}
    </div>
  );
}

function CustomSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select value={value} onChange={e => onChange(e.target.value)} className="custom-select">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg style={{ position: 'absolute', right: 8, pointerEvents: 'none' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function CustomerModal({ record, onClose, dark }: { record: any; onClose: () => void; dark: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <Avatar name={clean(record.customerName)} dark={dark} />
          <div>
            <div className="modal-name">{clean(record.customerName)}</div>
            <div className="modal-email">{clean(record.customerEmail)}</div>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Telepon', record.phone || '—'],
            ['Produk', clean(record.product)],
            ['Amount', record.amount > 0 ? fmt(record.amount) : 'Gratis'],
            ['Metode Bayar', clean(record.paymentMethod)],
            ['Universitas', clean(record.university)],
            ['Jurusan', clean(record.major)],
            ['Sumber', clean(record.source)],
            ['Kupon', record.couponCode || '—'],
            ['Waktu', relativeTime(record.timestamp)],
            ['Tanggal', record.transactionDate || '—'],
          ].map(([label, value]) => (
            <div key={label} className="modal-field">
              <div className="modal-field-label">{label}</div>
              <div className="modal-field-value">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ products: string[]; sources: string[] }>({ products: [], sources: [] });
  const [lastSync, setLastSync] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [tableState, setTableState] = useState<TableState | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [dark, setDark] = useState(true);

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Table controls
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const LIMIT = 50;

  // ── Fetch summary ──────────────────────────────────────────────────────────────
  const fetchSummary = useCallback(() => {
    setSummaryLoading(true);
    setSummaryError(null);
    const p = new URLSearchParams({ mode: 'summary' });
    if (filterProduct) p.set('product', filterProduct);
    if (filterSource) p.set('source', filterSource);
    if (dateStart) p.set('dateStart', dateStart);
    if (dateEnd) p.set('dateEnd', dateEnd);

    fetch(`/api/sheets?${p}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setSummary(json.summary);
          setFilterOptions(json.filterOptions);
          setLastSync(json.lastSync || '');
        } else {
          setSummaryError(json.error);
        }
      })
      .catch(e => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));
  }, [filterProduct, filterSource, dateStart, dateEnd]);

  // ── Fetch table ────────────────────────────────────────────────────────────────
  const fetchTable = useCallback(() => {
    setTableLoading(true);
    setTableError(null);
    const p = new URLSearchParams({
      mode: 'table',
      page: String(page),
      limit: String(LIMIT),
      sortCol,
      sortDir,
    });
    if (filterProduct) p.set('product', filterProduct);
    if (filterSource) p.set('source', filterSource);
    if (dateStart) p.set('dateStart', dateStart);
    if (dateEnd) p.set('dateEnd', dateEnd);
    if (search) p.set('search', search);

    fetch(`/api/sheets?${p}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setTableState(json);
        else setTableError(json.error);
      })
      .catch(e => setTableError(e.message))
      .finally(() => setTableLoading(false));
  }, [page, sortCol, sortDir, filterProduct, filterSource, dateStart, dateEnd, search]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchTable(); }, [fetchTable]);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(1);
  };

  const handleDrillDown = (field: string, value: string) => {
    if (field === 'source') setFilterSource(value === 'Unknown' ? '' : value);
    if (field === 'product') setFilterProduct(value === 'Unknown' ? '' : value);
    setPage(1);
  };

  const hasFilter = !!(filterProduct || filterSource || dateStart || dateEnd);

  const resetFilters = () => {
    setFilterProduct(''); setFilterSource('');
    setDateStart(''); setDateEnd('');
    setSearch(''); setPage(1);
  };

  const trend = (cur: number, prev: number) => prev === 0 ? null : ((cur - prev) / prev) * 100;

  // ── Chart theme ────────────────────────────────────────────────────────────────
  const tealColor = '#2DD4BF';
  const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const labelColor = dark ? '#6B7280' : '#9CA3AF';
  const tooltipDefaults = {
    backgroundColor: dark ? '#1F2937' : '#FFFFFF',
    borderColor: dark ? '#374151' : '#E5E7EB',
    borderWidth: 1,
    titleColor: dark ? '#F9FAFB' : '#111827',
    bodyColor: dark ? '#9CA3AF' : '#6B7280',
    padding: 10, cornerRadius: 8,
  };
  const baseLineOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipDefaults },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 }, maxTicksLimit: 10 } },
      y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 } }, beginAtZero: true },
    },
  };

  // ── Tab renderers ──────────────────────────────────────────────────────────────
  const renderOverview = () => {
    if (summaryLoading) return (
      <>
        <div className="kpi-row">{[1,2,3,4].map(i => <SkeletonKpi key={i} />)}</div>
        <div className="row2" style={{ marginBottom: 16 }}><SkeletonChart h={220} /><SkeletonChart h={220} /></div>
        <div className="row3"><SkeletonChart /><SkeletonChart /><SkeletonChart /></div>
      </>
    );
    if (!summary) return null;

    const trevenue = trend(summary.thisMonth.revenue, summary.lastMonth.revenue);
    const treg = trend(summary.thisMonth.reg, summary.lastMonth.reg);

    return (
      <>
        <div className="kpi-row">
          <KpiCard dark={dark} label="Total Revenue" value={fmt(summary.totalRevenue)} sub={`${fmtN(summary.totalPaid)} transaksi berbayar`} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" trend={trevenue} />
          <KpiCard dark={dark} label="Total Customers" value={fmtN(summary.total)} sub={`${fmtN(summary.totalPaid)} berbayar`} icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" trend={treg} />
          <KpiCard dark={dark} label="Conversion Rate" value={`${summary.convRate.toFixed(2)}%`} sub="free → paid" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          <KpiCard dark={dark} label="Avg Order Value" value={fmt(summary.avgOrder)} sub="per transaksi berbayar" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </div>

        <div className="row2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-hd">
              <div><div className="card-title">Tren Registrasi</div><div className="card-subtitle">{summary.daily.length} hari data</div></div>
            </div>
            {summary.daily.length === 0
              ? <div className="empty-state">Tidak ada data</div>
              : <div style={{ position: 'relative', height: 220 }}>
                <Line data={{
                  labels: summary.daily.map(d => d[0]),
                  datasets: [{
                    label: 'Registrasi', data: summary.daily.map(d => d[1]),
                    borderColor: tealColor, borderWidth: 2, backgroundColor: 'rgba(45,212,191,0.07)',
                    fill: true, tension: 0.4, pointBackgroundColor: tealColor,
                    pointRadius: 2, pointHoverRadius: 4, pointBorderColor: 'transparent',
                  }],
                }} options={baseLineOpts} />
              </div>
            }
          </div>

          <div className="card">
            <div className="card-hd"><div><div className="card-title">Distribusi Produk</div><div className="card-subtitle">Klik untuk filter</div></div></div>
            {summary.products.length === 0
              ? <div className="empty-state">Tidak ada data</div>
              : <>
                <div style={{ position: 'relative', height: 140, marginBottom: 14 }}>
                  <Doughnut data={{
                    labels: summary.products.map(([k]) => k),
                    datasets: [{ data: summary.products.map(([, v]) => v), backgroundColor: summary.products.map(([k]) => PROD_COLORS[k] || '#4B5563'), borderWidth: 0, hoverOffset: 4 }],
                  }} options={{
                    responsive: true, maintainAspectRatio: false, cutout: '68%',
                    plugins: { legend: { display: false }, tooltip: { ...tooltipDefaults, callbacks: { label: (ctx: any) => `${ctx.label}: ${fmtN(ctx.parsed)}` } } },
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                  {summary.products.map(([k, v]) => {
                    const total = summary.products.reduce((s, [, n]) => s + n, 0);
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => handleDrillDown('product', k)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: PROD_COLORS[k] || '#4B5563', flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 75 }}>{k.replace('PRO ', '').replace(' Bulan', 'bln')}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 500, color: dark ? '#E5E7EB' : '#374151' }}>{((v / total) * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            }
          </div>
        </div>

        <div className="row2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-hd"><div><div className="card-title">Funnel Konversi</div><div className="card-subtitle">Total registrasi → berbayar → pakai kupon</div></div></div>
            <div style={{ position: 'relative', height: 160 }}>
              <Bar data={{
                labels: ['Registrasi', 'Berbayar', 'Pakai Kupon'],
                datasets: [{ data: [summary.total, summary.totalPaid, summary.totalCoupon], backgroundColor: [tealColor, '#0EA5E9', '#A78BFA'], borderRadius: 6, borderSkipped: false as any }],
              }} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...tooltipDefaults, callbacks: { label: (ctx: any) => `${fmtN(ctx.parsed.y)} users` } } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: labelColor, font: { size: 11 } } },
                  y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 } }, beginAtZero: true },
                },
              }} />
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div><div className="card-title">Bulan Ini vs Lalu</div></div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Registrasi', cur: summary.thisMonth.reg, prev: summary.lastMonth.reg, fmt: fmtN },
                { label: 'Berbayar', cur: summary.thisMonth.paid, prev: summary.lastMonth.paid, fmt: fmtN },
                { label: 'Revenue', cur: summary.thisMonth.revenue, prev: summary.lastMonth.revenue, fmt: fmt },
              ].map(({ label, cur, prev, fmt: f }) => {
                const d = trend(cur, prev);
                const up = d == null ? null : d >= 0;
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#6B7280' }}>{f(prev)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: dark ? '#F9FAFB' : '#111827' }}>{f(cur)}</span>
                        {d != null && <span style={{ fontSize: 10, color: up ? '#2DD4BF' : '#F87171', background: up ? 'rgba(45,212,191,.1)' : 'rgba(248,113,113,.1)', padding: '1px 6px', borderRadius: 99 }}>{up ? '↑' : '↓'}{Math.abs(d).toFixed(1)}%</span>}
                      </div>
                    </div>
                    <div style={{ height: 4, background: dark ? '#1F2937' : '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, prev === 0 ? 100 : (cur / Math.max(cur, prev)) * 100)}%`, background: up == null ? tealColor : up ? tealColor : '#F87171', borderRadius: 99, transition: 'width .6s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="row3" style={{ marginBottom: 16 }}>
          <div className="card"><div className="card-hd"><div className="card-title">Sumber Traffic</div><div className="card-subtitle">Klik untuk filter</div></div><HBars data={summary.sources} color={tealColor} onClickBar={v => handleDrillDown('source', v)} /></div>
          <div className="card"><div className="card-hd"><div className="card-title">Top Universitas</div></div><HBars data={summary.universities} color="#0EA5E9" /></div>
          <div className="card"><div className="card-hd"><div className="card-title">Top Jurusan</div></div><HBars data={summary.majors} color="#A78BFA" /></div>
        </div>
      </>
    );
  };

  const renderRevenue = () => {
    if (summaryLoading) return <><div className="kpi-row">{[1,2,3,4].map(i => <SkeletonKpi key={i} />)}</div><SkeletonChart h={200} /></>;
    if (!summary) return null;
    const trevenue = trend(summary.thisMonth.revenue, summary.lastMonth.revenue);
    return (
      <>
        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginBottom: 16 }}>
          <KpiCard dark={dark} label="Total Revenue" value={fmt(summary.totalRevenue)} sub={`${fmtN(summary.totalPaid)} transaksi`} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" trend={trevenue} />
          <KpiCard dark={dark} label="Avg Order" value={fmt(summary.avgOrder)} sub="per transaksi berbayar" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          <KpiCard dark={dark} label="MRR (est.)" value={fmt(summary.mrr)} sub="Bulan ini" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          <KpiCard dark={dark} label="ARR (est.)" value={fmt(summary.arr)} sub="Proyeksi tahunan" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd"><div><div className="card-title">Tren Revenue Harian</div></div></div>
          {summary.revDaily.length === 0
            ? <div className="empty-state">Tidak ada data revenue</div>
            : <div style={{ position: 'relative', height: 200 }}>
              <Line data={{
                labels: summary.revDaily.map(d => d[0]),
                datasets: [{
                  label: 'Revenue', data: summary.revDaily.map(d => d[1]),
                  borderColor: '#F59E0B', borderWidth: 2, backgroundColor: 'rgba(245,158,11,0.07)',
                  fill: true, tension: 0.4, pointBackgroundColor: '#F59E0B', pointRadius: 2, pointHoverRadius: 4, pointBorderColor: 'transparent',
                }],
              }} options={{
                ...baseLineOpts,
                plugins: { ...baseLineOpts.plugins, tooltip: { ...tooltipDefaults, callbacks: { label: (ctx: any) => fmt(ctx.parsed.y) } } },
                scales: { ...baseLineOpts.scales, y: { ...baseLineOpts.scales.y, ticks: { ...baseLineOpts.scales.y.ticks, callback: (v: any) => fmt(v) } } },
              }} />
            </div>
          }
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd"><div><div className="card-title">Revenue per Produk</div></div><span style={{ fontSize: 13, fontWeight: 600, color: tealColor }}>{fmt(summary.totalRevenue)}</span></div>
          {summary.products.map(([k, cnt]) => {
            const pct = Math.round((cnt / (summary.totalPaid || 1)) * 100);
            return (
              <div key={k} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{k}</span>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{pct}% ({fmtN(cnt)} tx)</span>
                </div>
                <div style={{ height: 6, background: dark ? '#1F2937' : '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: PROD_COLORS[k] || '#4B5563', borderRadius: 99, transition: 'width .6s' }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="row2">
          <div className="card"><div className="card-hd"><div className="card-title">Metode Pembayaran</div></div><HBars data={summary.payments} color={tealColor} /></div>
          <div className="card"><div className="card-hd"><div className="card-title">Top Kode Kupon</div><div className="card-subtitle">{fmtN(summary.totalCoupon)} penggunaan</div></div>
            {summary.coupons.length > 0 ? <HBars data={summary.coupons} color="#A78BFA" /> : <div className="empty-state">Belum ada kupon</div>}
          </div>
        </div>
      </>
    );
  };

  const renderCustomers = () => {
    if (summaryLoading) return <div className="row3"><SkeletonChart /><SkeletonChart /><SkeletonChart /></div>;
    if (!summary) return null;
    return (
      <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd"><div><div className="card-title">Cohort Konversi</div><div className="card-subtitle">Registrasi vs berbayar per bulan</div></div></div>
          {summary.cohort.length === 0
            ? <div className="empty-state">Tidak ada data cohort</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.cohort.map(([month, { total, paid: p }]) => {
                const rate = total > 0 ? (p / total) * 100 : 0;
                return (
                  <div key={month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', width: 80, flexShrink: 0 }}>{month}</div>
                    <div style={{ flex: 1, position: 'relative', height: 22, background: dark ? '#1F2937' : '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${rate}%`, background: tealColor, borderRadius: 4, transition: 'width .6s' }} />
                      <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#F9FAFB', fontWeight: 500 }}>
                        {p}/{total} ({rate.toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
        <div className="row3">
          <div className="card"><div className="card-hd"><div className="card-title">Top Universitas</div></div><HBars data={summary.universities} color="#0EA5E9" /></div>
          <div className="card"><div className="card-hd"><div className="card-title">Top Jurusan</div></div><HBars data={summary.majors} color="#A78BFA" /></div>
          <div className="card"><div className="card-hd"><div className="card-title">Sumber Traffic</div><div className="card-subtitle">Klik untuk filter</div></div><HBars data={summary.sources} color={tealColor} onClickBar={v => handleDrillDown('source', v)} /></div>
        </div>
      </>
    );
  };

  const renderAnalytics = () => {
    if (summaryLoading) return <><SkeletonChart h={300} /></>;
    if (!summary) return null;
    let cum = 0;
    const cumData = summary.daily.map(([, cnt]) => { cum += cnt; return cum; });
    const maxH = Math.max(...summary.hours.map(([, c]) => c), 1);
    return (
      <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd"><div><div className="card-title">Registrasi Harian + Kumulatif</div><div className="card-subtitle">Garis putus = kumulatif (sumbu kanan)</div></div></div>
          {summary.daily.length === 0
            ? <div className="empty-state">Tidak ada data</div>
            : <div style={{ position: 'relative', height: 280 }}>
              <Line data={{
                labels: summary.daily.map(d => d[0]),
                datasets: [
                  { label: 'Harian', data: summary.daily.map(d => d[1]), borderColor: tealColor, borderWidth: 2, backgroundColor: 'rgba(45,212,191,0.07)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 4, pointBorderColor: 'transparent', pointBackgroundColor: tealColor, yAxisID: 'y' },
                  { label: 'Kumulatif', data: cumData, borderColor: '#A78BFA', borderWidth: 2, backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 3, borderDash: [4, 4] as any, yAxisID: 'y1' },
                ],
              }} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, labels: { color: labelColor, font: { size: 11 }, boxWidth: 12, padding: 16 } }, tooltip: tooltipDefaults },
                scales: {
                  x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 }, maxTicksLimit: 10 } },
                  y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 } }, beginAtZero: true, position: 'left' as const },
                  y1: { grid: { display: false }, ticks: { color: '#A78BFA', font: { size: 10 } }, beginAtZero: true, position: 'right' as const },
                },
              }} />
            </div>
          }
        </div>

        <div className="row2">
          <div className="card">
            <div className="card-hd"><div><div className="card-title">Bulan Ini vs Lalu</div></div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Registrasi', cur: summary.thisMonth.reg, prev: summary.lastMonth.reg, f: fmtN },
                { label: 'Berbayar', cur: summary.thisMonth.paid, prev: summary.lastMonth.paid, f: fmtN },
                { label: 'Revenue', cur: summary.thisMonth.revenue, prev: summary.lastMonth.revenue, f: fmt },
              ].map(({ label, cur, prev, f }) => {
                const d = trend(cur, prev);
                const up = d == null ? null : d >= 0;
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{f(prev)}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#F9FAFB' : '#111827' }}>{f(cur)}</span>
                        {d != null && <span style={{ fontSize: 10, color: up ? '#2DD4BF' : '#F87171', background: up ? 'rgba(45,212,191,.1)' : 'rgba(248,113,113,.1)', padding: '1px 6px', borderRadius: 99 }}>{up ? '↑' : '↓'}{Math.abs(d).toFixed(1)}%</span>}
                      </div>
                    </div>
                    <div style={{ height: 4, background: dark ? '#1F2937' : '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, prev === 0 ? 100 : (cur / Math.max(cur, prev)) * 100)}%`, background: up == null ? tealColor : up ? tealColor : '#F87171', borderRadius: 99, transition: 'width .6s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div><div className="card-title">Distribusi Jam Transaksi</div><div className="card-subtitle">Jam berapa user biasa beli</div></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 3 }}>
              {summary.hours.map(([h, cnt]) => (
                <div key={h} title={`${h}:00 — ${fmtN(cnt)} transaksi`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ height: 40, width: '100%', background: dark ? '#1F2937' : '#E5E7EB', borderRadius: 3, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', background: tealColor, opacity: 0.2 + (cnt / maxH) * 0.8, height: `${Math.max(4, (cnt / maxH) * 100)}%`, transition: 'height .5s', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 8, color: '#4B5563' }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  const tabContent: Record<Tab, () => JSX.Element | null> = {
    Overview: renderOverview, Revenue: renderRevenue,
    Customers: renderCustomers, Analytics: renderAnalytics,
  };

  const activeLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard';

  // ── CSS variables per mode ─────────────────────────────────────────────────────
  const D = {
    bg: '#111827', bg2: '#0D1117', bg3: '#161D2A', bg4: '#1F2937',
    border: '#1F2937', border2: '#374151',
    text: '#F9FAFB', text2: '#D1D5DB', text3: '#9CA3AF', text4: '#6B7280',
    accent: '#2DD4BF', accentBg: '#0D2D29', accentBg2: '#134E4A',
  };
  const L = {
    bg: '#F3F4F6', bg2: '#FFFFFF', bg3: '#FFFFFF', bg4: '#E5E7EB',
    border: '#E5E7EB', border2: '#D1D5DB',
    text: '#111827', text2: '#374151', text3: '#6B7280', text4: '#9CA3AF',
    accent: '#0D9488', accentBg: '#CCFBF1', accentBg2: '#CCFBF1',
  };
  const C = dark ? D : L;

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${C.bg};color:${C.text};transition:background .2s,color .2s;}
        .layout{display:flex;min-height:100vh;background:${C.bg};}
        .sidebar{width:200px;min-width:200px;background:${C.bg2};border-right:0.5px solid ${C.border};display:flex;flex-direction:column;transition:background .2s,border-color .2s;}
        .sb-brand{display:flex;align-items:center;gap:10px;padding:20px 20px 24px;}
        .sb-icon{width:32px;height:32px;border-radius:8px;background:${C.accentBg2};display:flex;align-items:center;justify-content:center;}
        .sb-name{font-size:15px;font-weight:600;color:${C.text};}
        .sb-nav{flex:1;padding:0 10px;}
        .sb-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;color:${C.text4};font-size:13px;font-weight:400;transition:all .15s;margin-bottom:2px;user-select:none;}
        .sb-item:hover{background:${C.bg};color:${C.accent};}
        .sb-item.active{background:${C.accentBg};color:${C.accent};font-weight:500;}
        .sb-footer{padding:16px 10px 20px;}
        .sb-info{background:${C.bg2};border:0.5px solid ${C.border};border-radius:10px;padding:14px;}
        .sb-info-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
        .sb-info-label{font-size:10px;color:${C.text4};}
        .sb-info-value{font-size:11px;font-weight:500;color:${C.text};}
        .sb-refresh{width:100%;padding:7px;background:transparent;border:0.5px solid ${C.border2};border-radius:6px;font-size:11px;color:${C.accent};cursor:pointer;font-family:inherit;transition:background .15s;}
        .sb-refresh:hover{background:${C.accentBg};}
        .sb-refresh:disabled{opacity:.5;cursor:not-allowed;}
        .main{flex:1;min-width:0;display:flex;flex-direction:column;background:${C.bg};}
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-bottom:0.5px solid ${C.border};background:${C.bg2};transition:background .2s;}
        .topbar-left{display:flex;align-items:center;gap:10px;}
        .topbar-title{font-size:18px;font-weight:600;color:${C.text};}
        .topbar-right{display:flex;align-items:center;gap:10px;}
        .filter-badge{display:flex;align-items:center;gap:4px;background:rgba(45,212,191,.1);border:0.5px solid rgba(45,212,191,.3);color:${C.accent};font-size:10px;padding:3px 8px;border-radius:99px;}
        .top-badge{display:flex;align-items:center;gap:6px;background:${C.bg};border:0.5px solid ${C.border};border-radius:8px;padding:6px 12px;font-size:12px;color:${C.text3};}
        .notif-dot{width:8px;height:8px;border-radius:50%;background:${C.accent};display:inline-block;}
        .avatar-top{width:32px;height:32px;border-radius:50%;background:${C.accent};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${dark ? '#0D2D29' : '#FFFFFF'};cursor:pointer;flex-shrink:0;}
        .theme-btn{width:32px;height:32px;border-radius:8px;border:0.5px solid ${C.border};background:${C.bg};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:background .15s;}
        .theme-btn:hover{background:${C.bg4};}
        .content{flex:1;padding:20px 28px 60px;overflow-y:auto;}
        .mobile-tabbar{display:none;border-bottom:0.5px solid ${C.border};margin-bottom:20px;overflow-x:auto;}
        .tab-ul-item{font-size:12px;padding:8px 14px;cursor:pointer;color:${C.text4};border-bottom:2px solid transparent;margin-bottom:-0.5px;transition:all .15s;user-select:none;white-space:nowrap;}
        .tab-ul-item:hover{color:${C.text2};}
        .tab-ul-item.active{color:${C.accent};border-bottom-color:${C.accent};font-weight:500;}
        .filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:20px;flex-wrap:wrap;min-height:34px;}
        .filter-label{font-size:11px;color:${C.text4};flex-shrink:0;}
        .custom-select{appearance:none;-webkit-appearance:none;font-size:11px;padding:6px 28px 6px 10px;border-radius:8px;border:0.5px solid ${C.border2};background:${C.bg2};color:${C.text2};cursor:pointer;font-family:inherit;outline:none;}
        .date-input{font-size:11px;padding:6px 10px;border-radius:8px;border:0.5px solid ${C.border2};background:${C.bg2};color:${C.text2};cursor:pointer;font-family:inherit;outline:none;color-scheme:${dark ? 'dark' : 'light'};}
        .date-input:focus{border-color:${C.accent};}
        .reset-btn{font-size:11px;padding:5px 12px;border-radius:8px;border:0.5px solid rgba(248,113,113,.3);background:rgba(248,113,113,.08);color:#F87171;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .reset-btn:hover{background:rgba(248,113,113,.15);}
        .kpi-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px;}
        .kpi-card{background:${C.bg3};border:0.5px solid ${C.border};border-radius:14px;padding:20px;transition:border-color .15s,transform .15s,background .2s;cursor:default;}
        .kpi-card:hover{border-color:rgba(45,212,191,.4);transform:translateY(-1px);}
        .kpi-icon{width:36px;height:36px;background:${C.accentBg};border-radius:10px;display:flex;align-items:center;justify-content:center;}
        .kpi-value{font-size:24px;font-weight:600;color:${C.text};line-height:1;margin-bottom:6px;}
        .kpi-label{font-size:12px;color:${C.text3};margin-bottom:2px;}
        .kpi-sub{font-size:11px;color:${C.text4};}
        .row2{display:grid;grid-template-columns:2fr 1fr;gap:16px;}
        .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
        .card{background:${C.bg3};border:0.5px solid ${C.border};border-radius:14px;padding:20px;transition:background .2s,border-color .2s;}
        .card-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:8px;}
        .card-title{font-size:14px;font-weight:500;color:${C.text};}
        .card-subtitle{font-size:11px;color:${C.text4};margin-top:2px;}
        .hbar-label{font-size:12px;color:${C.text3};width:130px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .empty-state{display:flex;align-items:center;justify-content:center;height:80px;font-size:12px;color:${C.text4};border:0.5px dashed ${C.border};border-radius:8px;}
        .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:500;white-space:nowrap;}
        .pill-teal{background:rgba(45,212,191,.12);color:#2DD4BF;}
        .pill-blue{background:rgba(14,165,233,.12);color:#38BDF8;}
        .pill-amber{background:rgba(245,158,11,.12);color:#FCD34D;}
        .pill-purple{background:rgba(167,139,250,.12);color:#C4B5FD;}
        .pill-gray{background:${C.bg4};color:${C.text3};}
        .divider{height:0.5px;background:${C.border};margin:20px 0;}
        .tbl-wrap{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;}
        thead th{text-align:left;font-size:11px;color:${C.text4};padding:0 12px 10px;border-bottom:0.5px solid ${C.border};font-weight:400;white-space:nowrap;cursor:pointer;user-select:none;}
        thead th:hover{color:${C.text2};}
        thead th.sort-on{color:${C.accent};}
        tbody tr{border-bottom:0.5px solid ${C.border};transition:background .1s;cursor:pointer;}
        tbody tr:last-child{border-bottom:none;}
        tbody tr:hover{background:${C.bg4};}
        tbody tr.row-today{background:rgba(45,212,191,0.04);}
        tbody td{padding:10px 12px;font-size:12px;color:${C.text2};vertical-align:middle;}
        .td-name{font-weight:500;font-size:13px;color:${C.text};}
        .td-mono{font-family:'SF Mono','Fira Code',monospace;font-size:11px;color:${C.text4};}
        .td-trunc{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .tbl-footer{display:flex;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap;gap:8px;}
        .tbl-info{font-size:11px;color:${C.text4};}
        .pg{display:flex;gap:4px;}
        .pgb{font-size:11px;padding:5px 10px;border-radius:8px;border:0.5px solid ${C.border2};background:${C.bg2};color:${C.text4};cursor:pointer;transition:all .15s;}
        .pgb:hover{background:${C.bg4};color:${C.text2};}
        .pgb.on{background:${C.accentBg};border-color:${C.accent};color:${C.accent};font-weight:500;}
        .pgb:disabled{opacity:.3;cursor:not-allowed;}
        .btn-export{font-size:11px;padding:6px 14px;border-radius:8px;border:0.5px solid rgba(45,212,191,.3);background:rgba(45,212,191,.08);color:${C.accent};cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;transition:background .15s;}
        .btn-export:hover{background:rgba(45,212,191,.15);}
        .btn-retry{font-size:11px;padding:5px 12px;border-radius:8px;border:0.5px solid rgba(248,113,113,.3);background:transparent;color:#F87171;cursor:pointer;font-family:inherit;}
        .error-box{background:rgba(239,68,68,.1);border:0.5px solid rgba(239,68,68,.3);border-radius:10px;padding:16px 20px;color:#FCA5A5;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
        .spin{width:28px;height:28px;border:2px solid ${C.bg4};border-top-color:${C.accent};border-radius:50%;animation:rot .7s linear infinite;}
        .modal-box{background:${C.bg3};border:0.5px solid ${C.border2};border-radius:16px;padding:28px;width:420px;max-width:90vw;}
        .modal-name{font-size:16px;font-weight:600;color:${C.text};}
        .modal-email{font-size:12px;color:${C.text4};}
        .modal-close{margin-left:auto;background:none;border:none;color:${C.text4};cursor:pointer;font-size:20px;}
        .modal-field{background:${C.bg2};border-radius:8px;padding:10px 12px;}
        .modal-field-label{font-size:10px;color:${C.text4};margin-bottom:4px;}
        .modal-field-value{font-size:12px;color:${C.text2};font-weight:500;}
        .search-box{margin-bottom:14px;display:flex;align-items:center;gap:8px;background:${C.bg2};border:0.5px solid ${C.border2};border-radius:8px;padding:8px 12px;}
        .search-input{background:transparent;border:none;outline:none;font-size:12px;color:${C.text2};width:100%;font-family:inherit;}
        .search-clear{background:none;border:none;color:${C.text4};cursor:pointer;font-size:16px;line-height:1;padding:0;}
        @keyframes rot{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
        @media(max-width:1024px){
          .sidebar{display:none;}
          .mobile-tabbar{display:flex;}
          .kpi-row{grid-template-columns:repeat(2,1fr);}
          .row2,.row3{grid-template-columns:1fr;}
          .topbar{padding:12px 16px;}
          .content{padding:16px 16px 60px;}
        }
        @media(max-width:480px){.kpi-card{padding:14px;}}
      `}</style>

      {selectedRecord && <CustomerModal record={selectedRecord} onClose={() => setSelectedRecord(null)} dark={dark} />}

      <div className="layout">
        <aside className="sidebar">
          <div className="sb-brand">
            <div className="sb-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 13H2L8 1Z" fill="#2DD4BF" /></svg>
            </div>
            <span className="sb-name">GipsyAI</span>
          </div>
          <nav className="sb-nav">
            {NAV_ITEMS.map(item => (
              <div key={item.id} className={`sb-item${activeTab === item.id ? ' active' : ''}`} onClick={() => setActiveTab(item.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                {item.label}
              </div>
            ))}
          </nav>
          <div className="sb-footer">
            <div className="sb-info">
              <div className="sb-info-row">
                <span className="sb-info-label">Total Records</span>
                <span className="sb-info-value">{summary ? fmtN(summary.total) : '—'}</span>
              </div>
              <div className="sb-info-row">
                <span className="sb-info-label">Last Sync</span>
                <span className="sb-info-value">{lastSync ? new Date(lastSync).toLocaleTimeString('id-ID') : '—'}</span>
              </div>
              <button className="sb-refresh" onClick={() => { fetchSummary(); fetchTable(); }} disabled={summaryLoading}>
                {summaryLoading ? 'Memuat...' : '↻ Refresh'}
              </button>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
              <span className="topbar-title">{activeLabel}</span>
              {hasFilter && <span className="filter-badge"><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, display: 'inline-block' }} />Filter aktif</span>}
            </div>
            <div className="topbar-right">
              <LiveClock />
              <button className="theme-btn" onClick={() => setDark(d => !d)} title="Toggle theme">
                {dark ? '☀️' : '🌙'}
              </button>
              <div className="top-badge">
                <span className="notif-dot" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
              </div>
              <div className="avatar-top">U</div>
            </div>
          </header>

          <div className="content">
            <div className="mobile-tabbar">
              {NAV_ITEMS.map(item => (
                <div key={item.id} className={`tab-ul-item${activeTab === item.id ? ' active' : ''}`} onClick={() => setActiveTab(item.id)}>{item.label}</div>
              ))}
            </div>

            {/* FILTER BAR */}
            <div className="filter-bar">
              <span className="filter-label">Filter:</span>
              <CustomSelect
                value={filterProduct}
                onChange={v => { setFilterProduct(v); setPage(1); }}
                options={[{ value: '', label: 'Semua Produk' }, ...filterOptions.products.map(p => ({ value: p, label: p }))]}
              />
              <CustomSelect
                value={filterSource}
                onChange={v => { setFilterSource(v); setPage(1); }}
                options={[{ value: '', label: 'Semua Sumber' }, ...filterOptions.sources.map(s => ({ value: s, label: s }))]}
              />
              <input type="date" className="date-input" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1); }} />
              <span style={{ fontSize: 11, color: C.text4 }}>—</span>
              <input type="date" className="date-input" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1); }} />
              <button className="reset-btn" style={{ visibility: hasFilter ? 'visible' : 'hidden' }} onClick={resetFilters}>✕ Reset</button>
            </div>

            {summaryError && (
              <div className="error-box">
                <span>Error: {summaryError}</span>
                <button className="btn-retry" onClick={fetchSummary}>Coba Lagi</button>
              </div>
            )}

            {tabContent[activeTab]?.()}

            {/* TABLE */}
            <div className="divider" />
            <div className="card">
              <div className="card-hd">
                <div>
                  <div className="card-title">Customer Records</div>
                  <div className="card-subtitle">{tableState ? fmtN(tableState.pagination.total) : '—'} records</div>
                </div>
                <button className="btn-export" onClick={() => tableState && exportCSV(tableState.rows)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  Export CSV
                </button>
              </div>

              <div className="search-box">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input
                  className="search-input"
                  placeholder="Cari nama, email, atau universitas..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                />
                {search && <button className="search-clear" onClick={() => handleSearch('')}>×</button>}
              </div>

              {tableLoading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spin" /></div>
                : tableError
                  ? <div className="error-box"><span>{tableError}</span><button className="btn-retry" onClick={fetchTable}>Retry</button></div>
                  : !tableState || tableState.rows.length === 0
                    ? <div className="empty-state">Tidak ada data yang cocok</div>
                    : <>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr>
                              {[
                                { key: 'customerName', label: 'Nama' },
                                { key: 'customerEmail', label: 'Email' },
                                { key: 'university', label: 'Universitas' },
                                { key: 'product', label: 'Produk' },
                                { key: 'amount', label: 'Amount' },
                                { key: 'source', label: 'Sumber' },
                                { key: 'timestamp', label: 'Tanggal' },
                              ].map(col => (
                                <th key={col.key} className={sortCol === col.key ? 'sort-on' : ''} onClick={() => handleSort(col.key)}>
                                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableState.rows.map((r: any, i: number) => (
                              <tr key={i} className={isToday(r.timestamp) ? 'row-today' : ''} onClick={() => setSelectedRecord(r)}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Avatar name={clean(r.customerName)} dark={dark} />
                                    <div>
                                      <div className="td-name td-trunc">{clean(r.customerName)}</div>
                                      <div className="td-mono">{r.phone || '—'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="td-mono td-trunc">{clean(r.customerEmail)}</td>
                                <td className="td-trunc" style={{ fontSize: 12, color: C.text3 }}>{clean(r.university)}</td>
                                <td><span className={`pill ${PILL_CLASS[clean(r.product)] || 'pill-gray'}`}>{clean(r.product)}</span></td>
                                <td style={{ fontFamily: 'monospace', fontSize: 11, color: r.amount > 0 ? '#2DD4BF' : C.text4 }}>
                                  {r.amount > 0 ? fmt(r.amount) : 'Gratis'}
                                </td>
                                <td className="td-mono">{clean(r.source)}</td>
                                <td>
                                  <div style={{ fontSize: 11, color: C.text3 }}>{relativeTime(r.timestamp)}</div>
                                  {isToday(r.timestamp) && <div style={{ fontSize: 9, color: C.accent, fontWeight: 600 }}>HARI INI</div>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="tbl-footer">
                        <span className="tbl-info">
                          {fmtN((tableState.pagination.page - 1) * LIMIT + 1)}–{fmtN(Math.min(tableState.pagination.page * LIMIT, tableState.pagination.total))} dari {fmtN(tableState.pagination.total)} records
                        </span>
                        <div className="pg">
                          <button className="pgb" onClick={() => setPage(1)} disabled={page === 1}>«</button>
                          <button className="pgb" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
                          {Array.from({ length: Math.min(5, tableState.pagination.totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, tableState.pagination.totalPages - 4));
                            return start + i;
                          }).map(p => (
                            <button key={p} className={`pgb${page === p ? ' on' : ''}`} onClick={() => setPage(p)}>{p}</button>
                          ))}
                          <button className="pgb" onClick={() => setPage(p => p + 1)} disabled={page === tableState.pagination.totalPages}>›</button>
                          <button className="pgb" onClick={() => setPage(tableState.pagination.totalPages)} disabled={page === tableState.pagination.totalPages}>»</button>
                        </div>
                      </div>
                    </>
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}