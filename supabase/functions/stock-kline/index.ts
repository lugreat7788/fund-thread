import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getMarketPrefix(symbol: string): string {
  const code = symbol.replace(/\D/g, '');
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh';
  if (code.startsWith('0') || code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) return 'sz';
  if (code.startsWith('4') || code.startsWith('8')) return 'bj';
  return 'sh';
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, period = "daily", count = 60 } = await req.json();
    if (!symbol) throw new Error("Symbol is required");

    const code = symbol.replace(/\D/g, '');
    const prefix = getMarketPrefix(code);
    const fullSymbol = `${prefix}${code}`;

    // scale: 5/15/30/60 for minutes, 240 for daily, 1680 for weekly
    const scaleMap: Record<string, number> = {
      "5min": 5, "15min": 15, "30min": 30, "60min": 60, "daily": 240, "weekly": 1680,
    };
    const scale = scaleMap[period] || 240;

    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullSymbol}&scale=${scale}&ma=no&datalen=${count}`;

    console.log("Fetching K-line:", url);

    const response = await fetch(url, {
      headers: {
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Sina API error:", response.status, text);
      throw new Error(`API request failed: ${response.status}`);
    }

    const text = await response.text();
    
    // Parse the response - Sina returns JSON array
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Parse error, raw:", text.substring(0, 200));
      throw new Error("Failed to parse K-line data");
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize data format
    const klines = data.map((item: any) => ({
      date: item.day,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume),
    }));

    // Also fetch current real-time quote
    const quoteUrl = `https://hq.sinajs.cn/list=${fullSymbol}`;
    let currentPrice = null;
    let changePercent = null;
    try {
      const quoteRes = await fetch(quoteUrl, {
        headers: {
          "Referer": "https://finance.sina.com.cn",
          "User-Agent": "Mozilla/5.0",
        },
      });
      const quoteText = await quoteRes.text();
      const match = quoteText.match(/"(.+)"/);
      if (match) {
        const parts = match[1].split(",");
        if (parts.length > 3) {
          currentPrice = parseFloat(parts[3]);
          const prevClose = parseFloat(parts[2]);
          if (prevClose > 0) {
            changePercent = ((currentPrice - prevClose) / prevClose * 100);
          }
        }
      }
    } catch (e) {
      console.error("Quote fetch error:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      data: klines,
      quote: currentPrice ? { price: currentPrice, changePercent } : null,
    }), {
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
