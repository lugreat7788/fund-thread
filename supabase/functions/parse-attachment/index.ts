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

    const { content, fileName, fileType, userPrompt } = await req.json();

    if (!content) throw new Error("No content provided");

    const isImage = fileType?.startsWith("image/");

    const messages: any[] = [
      {
        role: "system",
        content: "你是一个专业的交易纪律分析助手。用户会上传交易相关的图片、文档或文字内容。请分析内容并提取关键信息，以简洁的中文总结要点。如果是K线图或交易截图，请描述走势、关键价位、形态等。如果是文字内容，请提炼核心规则和要点。"
      },
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: content } },
          { type: "text", text: userPrompt || `请分析这张图片（文件名: ${fileName}），提取交易相关的关键信息和要点。` },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: userPrompt
          ? `以下是文件「${fileName}」的内容，请根据用户要求进行分析：\n\n用户要求：${userPrompt}\n\n文件内容：\n${content}`
          : `以下是文件「${fileName}」的内容，请分析并提取交易相关的关键信息和要点：\n\n${content}`,
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
    const summary = data.choices?.[0]?.message?.content || "无法生成分析结果";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-attachment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
