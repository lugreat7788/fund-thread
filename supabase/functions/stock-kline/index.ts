import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Market = 'cn' | 'us';

function detectMarket(symbol: string): Market {
  // Pure digits → A-share; contains letters → US stock
  return /^[0-9]+$/.test(symbol.trim()) ? 'cn' : 'us';
}

function getMarketPrefix(code: string): string {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh';
  if (code.startsWith('0') || code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) return 'sz';
  if (code.startsWith('4') || code.startsWith('8')) return 'bj';
  return 'sh';
}

// ─── A-share via Sina Finance ───
async function fetchCNKline(symbol: string, period: string, count: number) {
  const code = symbol.replace(/\D/g, '');
  const prefix = getMarketPrefix(code);
  const fullSymbol = `${prefix}${code}`;

  const scaleMap: Record<string, number> = {
    "5min": 5, "15min": 15, "30min": 30, "60min": 60, "daily": 240, "weekly": 1680,
  };
  const scale = scaleMap[period] || 240;

  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullSymbol}&scale=${scale}&ma=no&datalen=${count}`;
  console.log("Fetching CN K-line:", url);

  const response = await fetch(url, {
    headers: { "Referer": "https://finance.sina.com.cn", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!response.ok) throw new Error(`Sina API failed: ${response.status}`);

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Failed to parse CN K-line data"); }

  if (!Array.isArray(data) || data.length === 0) return { klines: [], quote: null };

  const klines = data.map((item: any) => ({
    date: item.day, open: parseFloat(item.open), high: parseFloat(item.high),
    low: parseFloat(item.low), close: parseFloat(item.close), volume: parseInt(item.volume),
  }));

  // Real-time quote
  let quote = null;
  try {
    const quoteRes = await fetch(`https://hq.sinajs.cn/list=${fullSymbol}`, {
      headers: { "Referer": "https://finance.sina.com.cn", "User-Agent": "Mozilla/5.0" },
    });
    const quoteText = await quoteRes.text();
    const match = quoteText.match(/"(.+)"/);
    if (match) {
      const parts = match[1].split(",");
      if (parts.length > 3) {
        const price = parseFloat(parts[3]);
        const prevClose = parseFloat(parts[2]);
        if (prevClose > 0) quote = { price, changePercent: (price - prevClose) / prevClose * 100 };
      }
    }
  } catch (e) { console.error("CN quote error:", e); }

  return { klines, quote };
}

// ─── US stock via Yahoo Finance ───
async function fetchUSKline(symbol: string, period: string, count: number) {
  const ticker = symbol.toUpperCase().trim();

  // Map period to Yahoo Finance interval & range
  const configMap: Record<string, { interval: string; range: string }> = {
    "5min": { interval: "5m", range: "5d" },
    "15min": { interval: "15m", range: "5d" },
    "30min": { interval: "30m", range: "10d" },
    "60min": { interval: "60m", range: "1mo" },
    "daily": { interval: "1d", range: "3mo" },
    "weekly": { interval: "1wk", range: "1y" },
  };
  const config = configMap[period] || configMap["daily"];

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${config.interval}&range=${config.range}`;
  console.log("Fetching US K-line:", url);

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Yahoo API error:", response.status, text.substring(0, 200));
    throw new Error(`Yahoo API failed: ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) return { klines: [], quote: null };

  const timestamps = result.timestamp || [];
  const ohlcv = result.indicators?.quote?.[0] || {};
  const meta = result.meta || {};

  const klines = timestamps.map((ts: number, i: number) => {
    const d = new Date(ts * 1000);
    const dateStr = config.interval.includes('m')
      ? d.toISOString().slice(0, 16).replace('T', ' ')
      : d.toISOString().slice(0, 10);
    return {
      date: dateStr,
      open: ohlcv.open?.[i] ?? 0,
      high: ohlcv.high?.[i] ?? 0,
      low: ohlcv.low?.[i] ?? 0,
      close: ohlcv.close?.[i] ?? 0,
      volume: ohlcv.volume?.[i] ?? 0,
    };
  }).filter((k: any) => k.open > 0 && k.close > 0);

  // Quote from meta
  let quote = null;
  if (meta.regularMarketPrice) {
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    if (prevClose > 0) {
      quote = { price, changePercent: (price - prevClose) / prevClose * 100 };
    }
  }

  return { klines: klines.slice(-count), quote };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, period = "daily", count = 60, market: forceMarket } = await req.json();
    if (!symbol) throw new Error("Symbol is required");

    const market: Market = forceMarket || detectMarket(symbol);
    console.log(`Market: ${market}, Symbol: ${symbol}, Period: ${period}`);

    const { klines, quote } = market === 'us'
      ? await fetchUSKline(symbol, period, count)
      : await fetchCNKline(symbol, period, count);

    return new Response(JSON.stringify({ success: true, data: klines, quote, market }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stock-kline error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
