import { google } from 'googleapis';
import { NextResponse } from 'next/server';

type Row = (string | undefined)[];

type DataItem = {
  amount: number;
  customerName: string;
  customerEmail: string;
  phone: string;
  transactionDate: string;
  timestamp: number;
  university: string;
  major: string;
  source: string;
  paymentMethod: string;
  couponCode: string;
  product: string;
};

let _cache: DataItem[] | null = null;
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

function getWithFallback(
  row: Row,
  primaryIdx: number,
  fallbackIdx: number
): string {
  const primary = row[primaryIdx]?.trim() || '';
  if (primary && primary !== '-') return primary;

  const fallback = row[fallbackIdx]?.trim() || '';
  if (fallback && fallback !== '-') return fallback;

  return '';
}

function classifyProduct(rawAmount: string | number | undefined): string {
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

function parseDateFast(raw: string | undefined): Date | null {
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

async function fetchAllRows(): Promise<DataItem[]> {
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

  const rows: Row[] = (response.data.values || []) as Row[];

  if (rows.length === 0) return [];

  return rows
    .slice(1)
    .filter((row: Row) => row[COLUMN_MAP.amount] && row[COLUMN_MAP.amount] !== '-')
    .map((row: Row): DataItem => {
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
}

async function getData(): Promise<DataItem[]> {
  const now = Date.now();

  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  const data = await fetchAllRows();
  _cache = data;
  _cacheTime = now;

  return data;
}

function buildSummary(data: DataItem[]) {
  const dailyMap: Record<string, { count: number; ts: number }> = {};
  const sourceMap: Record<string, number> = {};
  const productMap: Record<string, number> = {};

  data.forEach((r) => {
    const d = r.timestamp ? new Date(r.timestamp) : null;

    if (d) {
      const lbl = d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      });

      dailyMap[lbl] = dailyMap[lbl] || { count: 0, ts: d.getTime() };
      dailyMap[lbl].count++;
    }

    sourceMap[r.source] = (sourceMap[r.source] || 0) + 1;
    productMap[r.product] = (productMap[r.product] || 0) + 1;
  });

  return {
    total: data.length,
    daily: Object.entries(dailyMap).map(([k, v]) => [k, v.count]),
    sources: Object.entries(sourceMap),
    products: Object.entries(productMap),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'summary';

    const allData = await getData();

    if (mode === 'summary') {
      return NextResponse.json({
        success: true,
        summary: buildSummary(allData),
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}