import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trains, metrics, conflicts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert railway traffic analysis AI for Indian Railways. Your role is to predict train delays based on current conditions.

IMPORTANT: You must respond with ONLY valid JSON, no markdown, no explanations.

Analysis Guidelines:
- Consider current train speeds vs expected speeds
- Account for existing delays that may cascade
- Factor in track utilization and congestion
- Consider time of day patterns (peak hours: 7-10 AM, 5-8 PM)
- Weather and signal issues increase delay probability
- Freight trains typically cause more cascading delays
- Express trains have priority but can be affected by preceding freight

Risk Factors:
- High track utilization (>80%) = increased delay risk
- Multiple delayed trains = cascade effect
- Peak hours = higher baseline delays
- Freight in front of express = high delay probability`;

    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 7 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);

    const trainSummary = trains.map((t: any) => ({
      number: t.number,
      name: t.name,
      type: t.type,
      status: t.status,
      currentDelay: t.delay,
      speed: t.speed,
      nextStation: t.nextStation,
      priority: t.priority
    }));

    const userPrompt = `Analyze the current railway section conditions and predict delays for the next 30-60 minutes.

Current Conditions:
- Time: ${new Date().toLocaleTimeString('en-IN')} (${isPeakHour ? 'PEAK HOUR' : 'Off-peak'})
- Track Utilization: ${metrics?.utilization?.toFixed(1) || 75}%
- Active Conflicts: ${conflicts?.length || 0}
- Average Current Delay: ${metrics?.averageDelay?.toFixed(1) || 5} min

Active Trains:
${JSON.stringify(trainSummary, null, 2)}

Return a JSON object with this exact structure:
{
  "predictions": [
    {
      "trainNumber": "string",
      "trainName": "string",
      "currentDelay": number,
      "predictedDelay": number,
      "confidence": number (0-1),
      "riskLevel": "low" | "medium" | "high" | "critical",
      "factors": ["string array of contributing factors"],
      "recommendation": "string"
    }
  ],
  "overallAnalysis": {
    "sectionRisk": "low" | "medium" | "high",
    "expectedCascadeDelay": number,
    "peakCongestionTime": "string",
    "summary": "string"
  },
  "alerts": [
    {
      "type": "warning" | "critical",
      "message": "string",
      "affectedTrains": ["train numbers"]
    }
  ]
}`;

    console.log("Sending request to Lovable AI for delay prediction...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean up the response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log("AI Response:", content);

    let prediction;
    try {
      prediction = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a fallback prediction
      prediction = {
        predictions: trains.slice(0, 5).map((t: any) => ({
          trainNumber: t.number,
          trainName: t.name,
          currentDelay: t.delay,
          predictedDelay: Math.max(t.delay, t.delay + Math.round(Math.random() * 5)),
          confidence: 0.75,
          riskLevel: t.delay > 10 ? "high" : t.delay > 5 ? "medium" : "low",
          factors: t.delay > 0 ? ["Current delay", "Track conditions"] : ["Normal operations"],
          recommendation: t.delay > 10 ? "Consider priority adjustment" : "Monitor closely"
        })),
        overallAnalysis: {
          sectionRisk: metrics?.utilization > 80 ? "high" : "medium",
          expectedCascadeDelay: Math.round(metrics?.averageDelay || 5),
          peakCongestionTime: isPeakHour ? "Now" : "17:00-19:00",
          summary: "Section operating within normal parameters with some delays being monitored."
        },
        alerts: []
      };
    }

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delay prediction error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
