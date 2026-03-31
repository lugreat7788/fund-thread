import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuoteItem {
  symbol: string;
  label: string;
  price: number;
  changePercent: number;
  category: string;
}

// ─── Fetch A-share indices from Sina Finance (batch) ───
async function fetchCNIndices(): Promise<QuoteItem[]> {
  const targets = [
    { code: "sh000001", label: "上证指数" },
    { code: "sz399001", label: "深证成指" },
    { code: "sz399006", label: "创业板指" },
  ];
  const list = targets.map((t) => t.code).join(",");
  const url = `https://hq.sinajs.cn/list=${list}`;

  const response = await fetch(url, {
    headers: {
      Referer: "https://finance.sina.com.cn",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  const text = await response.text();

  const results: QuoteItem[] = [];
  for (const t of targets) {
    // Format: var hq_str_sh000001="上证指数,3350.20,3339.50,open,high,low,..."
    const pattern = new RegExp(`hq_str_${t.code}="([^"]+)"`);
    const match = text.match(pattern);
    if (!match) continue;
    const parts = match[1].split(",");
    if (parts.length < 4) continue;
    const price = parseFloat(parts[3]);
    const prevClose = parseFloat(parts[2]);
    if (!price || !prevClose) continue;
    results.push({
      symbol: t.code,
      label: t.label,
      price,
      changePercent: ((price - prevClose) / prevClose) * 100,
      category: "cn_index",
    });
  }
  return results;
}

// ─── Fetch global market quotes from Yahoo Finance (batch) ───
async function fetchGlobalQuotes(): Promise<QuoteItem[]> {
  const targets: Array<{ symbol: string; label: string; category: string }> = [
    { symbol: "SPY", label: "标普500", category: "us_index" },
    { symbol: "QQQ", label: "纳斯达克", category: "us_index" },
    { symbol: "DIA", label: "道琼斯", category: "us_index" },
    { symbol: "^HSI", label: "恒生指数", category: "hk_index" },
    { symbol: "^N225", label: "日经225", category: "global_index" },
    { symbol: "^VIX", label: "恐慌指数VIX", category: "macro" },
    { symbol: "GC=F", label: "黄金", category: "macro" },
    { symbol: "CL=F", label: "原油", category: "macro" },
    { symbol: "DX-Y.NYB", label: "美元指数", category: "macro" },
    { symbol: "BTC-USD", label: "比特币", category: "crypto" },
  ];

  const symbols = targets.map((t) => encodeURIComponent(t.symbol)).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) throw new Error(`Yahoo Finance quote API failed: ${response.status}`);
  const json = await response.json();
  const quotes: any[] = json?.quoteResponse?.result ?? [];

  const results: QuoteItem[] = [];
  for (const q of quotes) {
    const target = targets.find((t) => t.symbol === q.symbol);
    if (!target) continue;
    results.push({
      symbol: q.symbol,
      label: target.label,
      price: q.regularMarketPrice ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      category: target.category,
    });
  }
  return results;
}

// ─── Calculate Fear/Greed Score (0 = extreme fear, 100 = extreme greed) ───
function calcFearGreedScore(quotes: QuoteItem[]): number {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const vixQuote = quotes.find((q) => q.symbol === "^VIX");
  const spyQuote = quotes.find((q) => q.symbol === "SPY");
  const goldQuote = quotes.find((q) => q.symbol === "GC=F");

  let score = 50; // default neutral
  let totalWeight = 0;
  let weightedScore = 0;

  // Factor 1: VIX (40% weight) — lower VIX = more greed
  if (vixQuote && vixQuote.price > 0) {
    // VIX typical range: 10 (very greedy) to 40 (very fearful)
    const vixScore = clamp((40 - vixQuote.price) / (40 - 10), 0, 1) * 100;
    weightedScore += vixScore * 0.4;
    totalWeight += 0.4;
  }

  // Factor 2: Market Momentum via SPY (35% weight) — SPY going up = more greed
  if (spyQuote) {
    // changePercent: -5% = very fearful (0), 0% = neutral (50), +5% = very greedy (100)
    const momentumScore = clamp(50 + spyQuote.changePercent * 10, 0, 100);
    weightedScore += momentumScore * 0.35;
    totalWeight += 0.35;
  }

  // Factor 3: Safe Haven Demand via Gold (25% weight) — gold going up = more fear
  if (goldQuote) {
    // gold +3% = extreme fear (0), 0% = neutral (50), -3% = extreme greed (100)
    const safeHavenScore = clamp(50 - goldQuote.changePercent * 8, 0, 100);
    weightedScore += safeHavenScore * 0.25;
    totalWeight += 0.25;
  }

  if (totalWeight > 0) {
    score = weightedScore / totalWeight;
  }

  return Math.round(score);
}

function getSentimentLabel(score: number): { label: string; level: string } {
  if (score <= 25) return { label: "极度恐慌", level: "extreme_fear" };
  if (score <= 45) return { label: "恐慌", level: "fear" };
  if (score <= 55) return { label: "中性", level: "neutral" };
  if (score <= 75) return { label: "贪婪", level: "greed" };
  return { label: "极度贪婪", level: "extreme_greed" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Fetch CN indices and global quotes in parallel
    const [cnIndices, globalQuotes] = await Promise.allSettled([
      fetchCNIndices(),
      fetchGlobalQuotes(),
    ]);

    const cnData = cnIndices.status === "fulfilled" ? cnIndices.value : [];
    const globalData = globalQuotes.status === "fulfilled" ? globalQuotes.value : [];
    const allQuotes = [...cnData, ...globalData];

    const fearGreedScore = calcFearGreedScore(allQuotes);
    const sentiment = getSentimentLabel(fearGreedScore);

    // Separate by category for structured response
    const usIndices = globalData.filter((q) => q.category === "us_index");
    const hkGlobalIndices = globalData.filter((q) =>
      q.category === "hk_index" || q.category === "global_index"
    );
    const macroIndicators = globalData.filter((q) => q.category === "macro");
    const crypto = globalData.filter((q) => q.category === "crypto");

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fearGreedScore,
          sentimentLabel: sentiment.label,
          sentimentLevel: sentiment.level,
          cnIndices: cnData,
          usIndices,
          hkGlobalIndices,
          macroIndicators,
          crypto,
          updatedAt: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("market-sentiment error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
