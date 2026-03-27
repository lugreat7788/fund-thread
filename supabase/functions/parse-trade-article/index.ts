import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { content, fileName, fileType } = await req.json();
    if (!content) throw new Error("No content provided");

    const isImage = fileType?.startsWith("image/");

    const systemPrompt = `你是一个专业的交易策略解析助手。用户会上传交易策略文章（文字、图片或文档）。
请从中提取所有明确的操作节点，包括：建仓、加仓、减仓、平仓等操作。

请严格按以下JSON格式返回结果，不要包含其他文字：
{
  "orders": [
    {
      "symbol": "股票代码，如 600519 或 AAPL",
      "name": "股票名称，如 贵州茅台",
      "direction": "long 或 short",
      "action": "open(建仓) / add(加仓) / reduce(减仓) / close(平仓)",
      "target_price": 数字，目标价格,
      "shares": 数字，建议股数（如果文章未提及填0）,
      "currency": "CNY/USD/HKD/SEK/EUR/GBP/JPY",
      "strategy": "trend/value/event_driven/arbitrage/speculation/defensive",
      "reason": "操作理由摘要"
    }
  ],
  "summary": "文章整体策略概述"
}

注意事项：
- 必须提取所有具有明确价位的操作节点
- currency 根据股票所在市场判断（A股=CNY, 美股=USD, 港股=HKD）
- 如果文章中没有明确操作节点，orders 返回空数组
- target_price 必须是数字，不能是字符串`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: content } },
          { type: "text", text: `请分析这张图片（${fileName}），提取所有交易操作节点。` },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `请分析以下文章内容，提取所有交易操作节点：\n\n${content}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "extract_trade_orders",
            description: "Extract trade operation nodes from the article",
            parameters: {
              type: "object",
              properties: {
                orders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string" },
                      name: { type: "string" },
                      direction: { type: "string", enum: ["long", "short"] },
                      action: { type: "string", enum: ["open", "add", "reduce", "close"] },
                      target_price: { type: "number" },
                      shares: { type: "number" },
                      currency: { type: "string", enum: ["CNY", "USD", "HKD", "SEK", "EUR", "GBP", "JPY"] },
                      strategy: { type: "string", enum: ["trend", "value", "event_driven", "arbitrage", "speculation", "defensive"] },
                      reason: { type: "string" },
                    },
                    required: ["symbol", "name", "direction", "action", "target_price", "reason"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
              },
              required: ["orders", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_trade_orders" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "额度不足，请充值后再试" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content_text = data.choices?.[0]?.message?.content || "";
    try {
      const jsonMatch = content_text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {}

    return new Response(JSON.stringify({ orders: [], summary: "无法解析文章内容" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-trade-article error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
