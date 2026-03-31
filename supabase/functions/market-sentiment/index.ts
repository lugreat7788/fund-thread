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
  marketState?: string; // REGULAR, PRE, POST, CLOSED
  marketTime?: string;  // ISO timestamp of last trade
}

// ─── Fetch A-share indices from Sina Finance ───
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
    const pattern = new RegExp(`hq_str_${t.code}="([^"]+)"`);
    const match = text.match(pattern);
    if (!match) continue;
    const parts = match[1].split(",");
    if (parts.length < 32) continue;
    const price = parseFloat(parts[3]);
    const prevClose = parseFloat(parts[2]);
    // parts[30] = date (2026-03-31), parts[31] = time (15:00:00)
    const dateStr = parts[30];
    const timeStr = parts[31];
    if (!price || !prevClose) continue;

    // Determine market state from time — A-shares: 9:30-15:00 CST
    const now = new Date();
    const cstHour = (now.getUTCHours() + 8) % 24;
    const cstMin = now.getUTCMinutes();
    const cstTime = cstHour * 60 + cstMin;
    const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    const cnOpen = isWeekday && cstTime >= 570 && cstTime <= 900; // 9:30-15:00

    results.push({
      symbol: t.code,
      label: t.label,
      price,
      changePercent: ((price - prevClose) / prevClose) * 100,
      category: "cn_index",
      marketState: cnOpen ? "REGULAR" : "CLOSED",
      marketTime: dateStr && timeStr ? `${dateStr}T${timeStr}` : undefined,
    });
  }
  return results;
}

// ─── Fetch global quotes from Yahoo Finance ───
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
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketTime,marketState,regularMarketPreviousClose`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) throw new Error(`Yahoo Finance API failed: ${response.status}`);
  const json = await response.json();
  const quotes: any[] = json?.quoteResponse?.result ?? [];

  const results: QuoteItem[] = [];
  for (const q of quotes) {
    const target = targets.find((t) => t.symbol === q.symbol);
    if (!target) continue;

    const price = q.regularMarketPrice ?? 0;
    const changePct = q.regularMarketChangePercent ?? 0;
    const state = q.marketState ?? "CLOSED";
    const epoch = q.regularMarketTime ?? 0;
    const marketTime = epoch ? new Date(epoch * 1000).toISOString() : undefined;

    results.push({
      symbol: q.symbol,
      label: target.label,
      price,
      changePercent: changePct,
      category: target.category,
      marketState: state,
      marketTime,
    });
  }
  return results;
}

// ─── Fear/Greed Score ───
function calcFearGreedScore(quotes: QuoteItem[]): number {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const vixQuote = quotes.find((q) => q.symbol === "^VIX");
  const spyQuote = quotes.find((q) => q.symbol === "SPY");
  const goldQuote = quotes.find((q) => q.symbol === "GC=F");

  let totalWeight = 0;
  let weightedScore = 0;

  if (vixQuote && vixQuote.price > 0) {
    const vixScore = clamp((40 - vixQuote.price) / (40 - 10), 0, 1) * 100;
    weightedScore += vixScore * 0.4;
    totalWeight += 0.4;
  }

  if (spyQuote) {
    const momentumScore = clamp(50 + spyQuote.changePercent * 10, 0, 100);
    weightedScore += momentumScore * 0.35;
    totalWeight += 0.35;
  }

  if (goldQuote) {
    const safeHavenScore = clamp(50 - goldQuote.changePercent * 8, 0, 100);
    weightedScore += safeHavenScore * 0.25;
    totalWeight += 0.25;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;
}

function getSentimentLabel(score: number): { label: string; level: string } {
  if (score <= 25) return { label: "极度恐慌", level: "extreme_fear" };
  if (score <= 45) return { label: "恐慌", level: "fear" };
  if (score <= 55) return { label: "中性", level: "neutral" };
  if (score <= 75) return { label: "贪婪", level: "greed" };
  return { label: "极度贪婪", level: "extreme_greed" };
}

// ─── Generate investment advice ───
function generateAdvice(
  score: number,
  level: string,
  vix: number | undefined,
  spyChange: number | undefined,
  nasdaqChange: number | undefined,
): string[] {
  const tips: string[] = [];

  // Main sentiment advice
  if (level === "extreme_fear") {
    tips.push("市场极度恐慌，往往是优质标的的黄金买入机会");
    tips.push("建议：关注核心持仓标的是否触发加仓节点，分批建仓");
    tips.push("注意：不要一次性 All-in，保留至少30%现金应对继续下跌");
  } else if (level === "fear") {
    tips.push("市场情绪偏悲观，可以开始关注被错杀的优质标的");
    tips.push("建议：按定投纪律执行，优先补仓基本面良好的持仓");
    tips.push("注意：避免追跌抄底垃圾股，只买看得懂的标的");
  } else if (level === "neutral") {
    tips.push("市场情绪中性，维持正常仓位和纪律操作");
    tips.push("建议：正常定投，不追涨不杀跌，等待明确信号");
  } else if (level === "greed") {
    tips.push("市场偏乐观，需警惕追高风险");
    tips.push("建议：检查持仓是否触达减仓节点，开始逐步止盈");
    tips.push("注意：不宜大幅加仓，可将新资金转为现金储备");
  } else {
    tips.push("市场极度贪婪，高位风险积聚");
    tips.push("建议：开始分批减仓，至少保留6成底仓，将浮盈兑现");
    tips.push("注意：不要被 FOMO 情绪驱动追高，现金为王等待回调");
  }

  // VIX specific
  if (vix != null) {
    if (vix > 35) tips.push(`VIX ${vix.toFixed(1)} 处于恐慌区间，市场波动极大，降低交易频率`);
    else if (vix > 25) tips.push(`VIX ${vix.toFixed(1)} 偏高，短线波动加剧，注意设好止损`);
    else if (vix < 13) tips.push(`VIX ${vix.toFixed(1)} 极低，市场可能过度自满，注意黑天鹅风险`);
  }

  // Momentum specific
  if (spyChange != null && nasdaqChange != null) {
    const avgChange = (spyChange + nasdaqChange) / 2;
    if (avgChange < -3) tips.push("美股今日大跌，短期可能超卖，但不急于接飞刀");
    else if (avgChange > 3) tips.push("美股今日大涨，短期获利盘较多，谨慎追高");
  }

  return tips;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const [cnIndices, globalQuotes] = await Promise.allSettled([
      fetchCNIndices(),
      fetchGlobalQuotes(),
    ]);

    const cnData = cnIndices.status === "fulfilled" ? cnIndices.value : [];
    const globalData = globalQuotes.status === "fulfilled" ? globalQuotes.value : [];
    const allQuotes = [...cnData, ...globalData];

    const fearGreedScore = calcFearGreedScore(allQuotes);
    const sentiment = getSentimentLabel(fearGreedScore);

    const usIndices = globalData.filter((q) => q.category === "us_index");
    const hkGlobalIndices = globalData.filter((q) =>
      q.category === "hk_index" || q.category === "global_index"
    );
    const macroIndicators = globalData.filter((q) => q.category === "macro");
    const crypto = globalData.filter((q) => q.category === "crypto");

    // Determine overall market state
    const spyState = globalData.find((q) => q.symbol === "SPY")?.marketState ?? "CLOSED";
    const vixPrice = globalData.find((q) => q.symbol === "^VIX")?.price;
    const spyChange = globalData.find((q) => q.symbol === "SPY")?.changePercent;
    const qqqChange = globalData.find((q) => q.symbol === "QQQ")?.changePercent;

    // Get the most recent market timestamp
    const timestamps = allQuotes
      .map((q) => q.marketTime)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime())
      .filter((t) => !isNaN(t));
    const latestDataTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : undefined;

    const advice = generateAdvice(fearGreedScore, sentiment.level, vixPrice, spyChange, qqqChange);

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
          usMarketState: spyState,
          latestDataTime,
          advice,
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
