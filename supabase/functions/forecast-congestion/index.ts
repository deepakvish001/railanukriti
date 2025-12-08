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
    const { trains, sections, occupancyHistory, currentMetrics } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert railway traffic forecasting AI for Indian Railways. Your role is to predict section congestion over the next 15, 30, 45, and 60 minutes.

IMPORTANT: You must respond with ONLY valid JSON, no markdown, no explanations.

Forecasting Guidelines:
- Analyze current train positions and speeds to predict future section occupancy
- Consider train types (express moves faster than freight)
- Account for scheduled arrivals and departures
- Factor in current delays and their cascade effects
- Use historical occupancy patterns if available
- Peak hours (7-10 AM, 5-8 PM) typically have higher congestion

Congestion Levels:
- Low (0-30%): Normal operations, minimal delays expected
- Medium (31-60%): Moderate traffic, some delays possible
- High (61-80%): Heavy traffic, delays likely
- Critical (81-100%): Severe congestion, significant delays expected`;

    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 7 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);

    const trainSummary = trains?.slice(0, 10).map((t: any) => ({
      number: t.number,
      type: t.type,
      currentSection: t.currentSection,
      speed: t.speed,
      status: t.status,
      delay: t.delay,
      destination: t.destination
    })) || [];

    const sectionSummary = sections?.slice(0, 8).map((s: any) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      maxSpeed: s.maxSpeed
    })) || [];

    // Calculate recent occupancy patterns
    const recentOccupancy = occupancyHistory?.slice(0, 20).map((h: any) => ({
      sectionId: h.sectionId,
      trainType: h.trainType,
      dwellTime: h.exitedAt ? 
        Math.round((new Date(h.exitedAt).getTime() - new Date(h.enteredAt).getTime()) / 1000) : 
        'ongoing'
    })) || [];

    const userPrompt = `Forecast section congestion for the next hour based on current conditions.

Current Time: ${new Date().toLocaleTimeString('en-IN')} (${isPeakHour ? 'PEAK HOUR' : 'Off-peak'})
Current Utilization: ${currentMetrics?.utilization?.toFixed(1) || 50}%
Active Trains: ${trains?.length || 0}
Active Conflicts: ${currentMetrics?.pendingConflicts || 0}

Sections:
${JSON.stringify(sectionSummary, null, 2)}

Active Trains:
${JSON.stringify(trainSummary, null, 2)}

Recent Occupancy Patterns:
${JSON.stringify(recentOccupancy, null, 2)}

Return a JSON object with this exact structure:
{
  "forecasts": [
    {
      "timeframe": "15min" | "30min" | "45min" | "60min",
      "timestamp": "HH:MM",
      "overallCongestion": number (0-100),
      "level": "low" | "medium" | "high" | "critical",
      "sectionForecasts": [
        {
          "sectionId": number,
          "sectionName": "string",
          "predictedOccupancy": number (0-100),
          "expectedTrains": number,
          "bottleneckRisk": boolean
        }
      ]
    }
  ],
  "hotspots": [
    {
      "sectionId": number,
      "sectionName": "string",
      "peakTime": "HH:MM",
      "peakCongestion": number,
      "reason": "string"
    }
  ],
  "recommendations": [
    {
      "priority": "low" | "medium" | "high",
      "action": "string",
      "targetSection": number | null,
      "expectedImpact": "string"
    }
  ],
  "summary": "string"
}`;

    console.log("Sending congestion forecast request to Lovable AI...");

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
        max_tokens: 2500,
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
    
    console.log("AI Forecast Response:", content);

    let forecast;
    try {
      forecast = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a fallback forecast
      const now = new Date();
      const baseUtilization = currentMetrics?.utilization || 50;
      
      forecast = {
        forecasts: [
          { timeframe: "15min", timestamp: new Date(now.getTime() + 15 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), overallCongestion: Math.min(100, baseUtilization + 5), level: baseUtilization > 70 ? "high" : "medium", sectionForecasts: [] },
          { timeframe: "30min", timestamp: new Date(now.getTime() + 30 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), overallCongestion: Math.min(100, baseUtilization + 10), level: baseUtilization > 65 ? "high" : "medium", sectionForecasts: [] },
          { timeframe: "45min", timestamp: new Date(now.getTime() + 45 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), overallCongestion: Math.min(100, baseUtilization + 8), level: baseUtilization > 60 ? "high" : "medium", sectionForecasts: [] },
          { timeframe: "60min", timestamp: new Date(now.getTime() + 60 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), overallCongestion: Math.min(100, baseUtilization + 3), level: "medium", sectionForecasts: [] }
        ],
        hotspots: [],
        recommendations: [
          { priority: "medium", action: "Monitor section utilization closely", targetSection: null, expectedImpact: "Early detection of congestion" }
        ],
        summary: "Forecast generated with limited data. Continue monitoring for more accurate predictions."
      };
    }

    return new Response(JSON.stringify(forecast), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Congestion forecast error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
