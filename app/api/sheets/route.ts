import { google } from 'googleapis';
import { NextResponse } from 'next/server';

let _cache: any[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const COLUMN_MAP = {
  amount: 1,
  customerName: 4,
  customerEmail: 5,
  phone: 6,
  transactionDate: 7,
  university: 10,
  major: 11,
  source: 12,
  paymentMethod: 17,
  couponCode: 18,
  universityFallback: 19,
  majorFallback: 21,
};

function getWithFallback(row: string[], primaryIdx: number, fallbackIdx: number): string {
  const primary = row[primaryIdx]?.trim() || '';
  if (primary && primary !== '-') return primary;
  const fallback = row[fallbackIdx]?.trim() || '';
  if (fallback && fallback !== '-') return fallback;
  return '';
}

function classifyProduct(rawAmount: string | number): string {
  if (!rawAmount) return 'Unknown';
  const cleaned = rawAmount.toString().replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num === 0) return 'Unknown';
  if (num > 10_000_000) return 'Unknown';
  if (num >= 29000 && num <= 48999) return 'PRO 1 Bulan';
  if (num >= 49000 && num <= 56999) return 'PRO Researcher 1 Bulan';
  if (num >= 57000 && num <= 86999) return 'PRO 3 Bulan';
  if (num >= 87000) return 'PRO Researcher 3 Bulan';
  return 'Unknown';
}

function parseDateFast(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3) {
    const attempt = new Date(`${parts[1]} ${parts[0]} ${parts[2]}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  return null;
}

async function fetchAllRows(): Promise<any[]> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: 'Sheet1!A:V',
  });

  const rows: string[][] = (response.data.values as string[][]) || [];
  console.log('[sheets] raw rows:', rows.length);

  if (rows.length === 0) return [];

  const data = rows
    .slice(1)
    .filter((row) => row[COLUMN_MAP.amount] && row[COLUMN_MAP.amount] !== '-')
    .map((row) => {
      const rawAmount = row[COLUMN_MAP.amount] || '';
      const cleaned = rawAmount.toString().replace(/[^\d]/g, '');
      const amount = parseInt(cleaned, 10) || 0;

      const rawDate = row[COLUMN_MAP.transactionDate]?.trim() || '';
      const dateObj = parseDateFast(rawDate);

      const university =
        getWithFallback(row, COLUMN_MAP.university, COLUMN_MAP.universityFallback) ||
        'Tidak Diketahui';
      const major =
        getWithFallback(row, COLUMN_MAP.major, COLUMN_MAP.majorFallback) || '';

      return {
        amount,
        customerName: row[COLUMN_MAP.customerName]?.trim() || '',
        customerEmail: row[COLUMN_MAP.customerEmail]?.toLowerCase().trim() || '',
        phone: row[COLUMN_MAP.phone]?.trim() || '',
        transactionDate: rawDate,
        timestamp: dateObj ? dateObj.getTime() : 0,
        university,
        major,
        source: row[COLUMN_MAP.source]?.trim() || 'Tidak Diketahui',
        paymentMethod: row[COLUMN_MAP.paymentMethod]?.trim() || '',
        couponCode: row[COLUMN_MAP.couponCode]?.toUpperCase().trim() || '',
        product: classifyProduct(rawAmount),
      };
    });

  console.log('[sheets] processed rows:', data.length);
  return data;
}

async function getData(): Promise<any[]> {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    console.log('[sheets] serving from cache');
    return _cache;
  }
  const data = await fetchAllRows();
  _cache = data;
  _cacheTime = now;
  return data;
}

function buildSummary(data: any[]): any {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const paid = data.filter((r) => r.amount > 0);
  const coupon = paid.filter((r) => r.couponCode);

  let totalRevenue = 0;
  let thisMRevenue = 0,
    lastMRevenue = 0;
  let thisMReg = 0,
    lastMReg = 0;
  let thisMPaid = 0,
    lastMPaid = 0;

  const dailyMap: Record<string, { count: number; ts: number }> = {};
  const revDailyMap: Record<string, { amount: number; ts: number }> = {};
  const sourceMap: Record<string, number> = {};
  const univMap: Record<string, number> = {};
  const majorMap: Record<string, number> = {};
  const productMap: Record<string, number> = {};
  const paymentMap: Record<string, number> = {};
  const couponMap: Record<string, number> = {};
  const hourMap: Record<number, number> = {};
  const cohortMap: Record<string, { total: number; paid: number; ts: number }> = {};

  data.forEach((r) => {
    const d = r.timestamp ? new Date(r.timestamp) : null;
    const m = d ? d.getMonth() : -1;
    const y = d ? d.getFullYear() : -1;
    const isThisM = m === thisMonth && y === thisYear;
    const isLastM = m === lastMonth && y === lastMonthYear;

    if (isThisM) thisMReg++;
    if (isLastM) lastMReg++;

    if (d) {
      const lbl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      dailyMap[lbl] = dailyMap[lbl] || { count: 0, ts: d.getTime() };
      dailyMap[lbl].count++;
      dailyMap[lbl].ts = Math.min(dailyMap[lbl].ts, d.getTime());

      if (r.amount > 0) {
        const h = d.getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      }

      const cohortKey = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      cohortMap[cohortKey] = cohortMap[cohortKey] || { total: 0, paid: 0, ts: d.getTime() };
      cohortMap[cohortKey].total++;
      cohortMap[cohortKey].ts = Math.min(cohortMap[cohortKey].ts, d.getTime());
    }

    const src = r.source || 'Unknown';
    const univ = r.university || 'Unknown';
    const maj = r.major || 'Unknown';
    const prod = r.product || 'Unknown';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
    univMap[univ] = (univMap[univ] || 0) + 1;
    if (maj) majorMap[maj] = (majorMap[maj] || 0) + 1;
    if (prod !== 'Unknown') productMap[prod] = (productMap[prod] || 0) + 1;

    if (r.amount > 0) {
      totalRevenue += r.amount;
      if (isThisM) {
        thisMRevenue += r.amount;
        thisMPaid++;
      }
      if (isLastM) {
        lastMRevenue += r.amount;
        lastMPaid++;
      }

      if (d) {
        const lbl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        revDailyMap[lbl] = revDailyMap[lbl] || { amount: 0, ts: d.getTime() };
        revDailyMap[lbl].amount += r.amount;
      }

      const pm = r.paymentMethod || 'Unknown';
      paymentMap[pm] = (paymentMap[pm] || 0) + 1;
    }
  });

  const cohortPaidCount: Record<string, number> = {};
  paid.forEach((r) => {
    const d = r.timestamp ? new Date(r.timestamp) : null;
    if (!d) return;
    const key = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    cohortPaidCount[key] = (cohortPaidCount[key] || 0) + 1;
  });
  Object.keys(cohortMap).forEach((k) => {
    cohortMap[k].paid = cohortPaidCount[k] || 0;
  });

  paid.forEach((r) => {
    if (r.couponCode) {
      couponMap[r.couponCode] = (couponMap[r.couponCode] || 0) + 1;
    }
  });

  const sortedDaily = Object.entries(dailyMap)
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([lbl, v]) => [lbl, v.count]);

  const sortedRevDaily = Object.entries(revDailyMap)
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([lbl, v]) => [lbl, v.amount]);

  const sortedCohort = Object.entries(cohortMap)
    .sort((a, b) => a[1].ts - b[1].ts)
    .slice(-6)
    .map(([month, v]) => [month, { total: v.total, paid: v.paid }]);

  const topSort = (m: Record<string, number>, n = 7): [string, number][] =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  const MONTHLY_PRICE: Record<string, number> = {
    'PRO 1 Bulan': 39000,
    'PRO Researcher 1 Bulan': 53000,
    'PRO 3 Bulan': 72000 / 3,
    'PRO Researcher 3 Bulan': 97000 / 3,
  };

  let mrr = 0;
  data
    .filter((r) => r.amount > 0)
    .forEach((r) => {
      const d = r.timestamp ? new Date(r.timestamp) : null;
      if (d && d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        mrr += MONTHLY_PRICE[r.product] || 0;
      }
    });

  // suppress unused var warnings
  void lastMRevenue;
  void lastMPaid;

  return {
    total: data.length,
    totalPaid: paid.length,
    totalCoupon: coupon.length,
    totalRevenue,
    avgOrder: paid.length ? Math.round(totalRevenue / paid.length) : 0,
    convRate: data.length ? (paid.length / data.length) * 100 : 0,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    thisMonth: { reg: thisMReg, paid: thisMPaid, revenue: thisMRevenue },
    lastMonth: { reg: lastMReg, paid: lastMPaid, revenue: lastMRevenue },
    daily: sortedDaily,
    revDaily: sortedRevDaily,
    sources: topSort(sourceMap, 10),
    universities: topSort(univMap, 10),
    majors: topSort(majorMap, 10),
    products: Object.entries(productMap),
    payments: topSort(paymentMap, 8),
    coupons: topSort(couponMap, 8),
    hours: Array.from({ length: 24 }, (_, i) => [i, hourMap[i] || 0]),
    cohort: sortedCohort,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'summary';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const product = searchParams.get('product') || '';
    const source = searchParams.get('source') || '';
    const dateStart = searchParams.get('dateStart') || '';
    const dateEnd = searchParams.get('dateEnd') || '';
    const sortCol = searchParams.get('sortCol') || 'timestamp';
    const sortDir = searchParams.get('sortDir') || 'desc';

    const allData = await getData();

    if (mode === 'summary') {
      let filtered = allData;
      if (product) filtered = filtered.filter((r) => r.product === product);
      if (source) filtered = filtered.filter((r) => r.source === source);
      if (dateStart || dateEnd) {
        const ds = dateStart ? new Date(dateStart).getTime() : 0;
        const de = dateEnd ? new Date(dateEnd + 'T23:59:59').getTime() : Infinity;
        filtered = filtered.filter((r) => r.timestamp >= ds && r.timestamp <= de);
      }

      const summary = buildSummary(filtered);
      const allProducts = [...new Set(allData.map((r) => r.product).filter(Boolean))].sort();
      const allSources = [...new Set(allData.map((r) => r.source).filter(Boolean))].sort();

      return NextResponse.json(
        {
          success: true,
          mode: 'summary',
          summary,
          filterOptions: { products: allProducts, sources: allSources },
          cached: _cacheTime > 0,
          lastSync: new Date(_cacheTime).toISOString(),
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (mode === 'table') {
      let filtered = allData;

      if (product) filtered = filtered.filter((r) => r.product === product);
      if (source) filtered = filtered.filter((r) => r.source === source);
      if (dateStart || dateEnd) {
        const ds = dateStart ? new Date(dateStart).getTime() : 0;
        const de = dateEnd ? new Date(dateEnd + 'T23:59:59').getTime() : Infinity;
        filtered = filtered.filter((r) => r.timestamp >= ds && r.timestamp <= de);
      }
      if (search) {
        filtered = filtered.filter(
          (r) =>
            r.customerName.toLowerCase().includes(search) ||
            r.customerEmail.toLowerCase().includes(search) ||
            r.university.toLowerCase().includes(search)
        );
      }

      filtered = [...filtered].sort((a, b) => {
        let va: string | number, vb: string | number;
        if (sortCol === 'amount' || sortCol === 'timestamp') {
          va = a[sortCol] || 0;
          vb = b[sortCol] || 0;
        } else {
          va = (a[sortCol] || '').toLowerCase();
          vb = (b[sortCol] || '').toLowerCase();
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const safePage = Math.max(1, Math.min(page, totalPages));
      const rows = filtered.slice((safePage - 1) * limit, safePage * limit);

      return NextResponse.json({
        success: true,
        mode: 'table',
        rows,
        pagination: { page: safePage, limit, total, totalPages },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    const err = error as Error;
    console.error('[sheets] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}