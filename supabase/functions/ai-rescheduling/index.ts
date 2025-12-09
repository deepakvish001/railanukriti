import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DisruptionData {
  id: string;
  disruption_type: string;
  severity: string;
  station_code?: string;
  block_section_code?: string;
  description?: string;
  max_speed_allowed?: number;
}

interface AffectedTrain {
  loadId: string;
  stationsAffected: string[];
  estimatedDelayMinutes: number;
}

interface ReschedulingRequest {
  disruptions: DisruptionData[];
  affectedTrains: {
    disruption: DisruptionData;
    trains: AffectedTrain[];
  }[];
  networkState: {
    totalTrains: number;
    totalDisruptions: number;
    averageDelay: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const requestData: ReschedulingRequest = await req.json();
    const { disruptions, affectedTrains, networkState } = requestData;

    if (!disruptions || disruptions.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context for AI analysis
    const disruptionSummary = disruptions.map(d => 
      `- ${d.disruption_type.toUpperCase()} at ${d.block_section_code || d.station_code || 'unknown location'} (Severity: ${d.severity})${d.description ? `: ${d.description}` : ''}`
    ).join('\n');

    const trainSummary = affectedTrains.flatMap(at => 
      at.trains.slice(0, 5).map(t => 
        `- Train ${t.loadId}: affected at ${t.stationsAffected.join(', ')}, estimated delay ${t.estimatedDelayMinutes}min`
      )
    ).join('\n');

    const systemPrompt = `You are an expert Indian Railways traffic control AI assistant. Your role is to analyze disruptions and recommend optimal rescheduling strategies for freight trains to minimize delays and maximize throughput.

Key considerations:
1. Freight train priority is lower than passenger trains
2. Block sections can only have one train at a time (Absolute Block) or multiple with safe spacing (Automatic Block)
3. Loop lines allow trains to cross or overtake
4. Junctions provide alternate route options
5. Speed restrictions affect travel time calculations
6. Cascade delays can affect multiple following trains

Provide specific, actionable recommendations for each affected train.`;

    const userPrompt = `Analyze the following railway disruption scenario and provide intelligent rescheduling suggestions:

## Current Network State
- Total active trains: ${networkState.totalTrains}
- Active disruptions: ${networkState.totalDisruptions}
- Average delay: ${networkState.averageDelay.toFixed(1)} minutes

## Active Disruptions
${disruptionSummary}

## Affected Trains
${trainSummary}

For each significantly affected train, provide a rescheduling recommendation in the following JSON format:
{
  "suggestions": [
    {
      "trainId": "train load ID",
      "type": "delay_departure" | "speed_adjustment" | "alternate_route" | "hold_at_station" | "priority_change",
      "priority": "high" | "medium" | "low",
      "description": "brief action description",
      "details": "detailed reasoning and steps",
      "estimatedBenefit": "expected time/delay savings",
      "suggestedAction": {
        "delayMinutes": number (if applicable),
        "holdStation": "station code" (if applicable),
        "speedReduction": number in km/h (if applicable),
        "alternateRoute": ["station codes"] (if applicable)
      }
    }
  ],
  "overallAnalysis": "brief analysis of the network situation",
  "prioritizedActions": ["top 3 most critical actions to take"]
}

Focus on:
1. Preventing cascade delays
2. Optimal use of loop lines for overtaking
3. Traffic flow balancing
4. Minimizing total network delay
5. Practical feasibility of recommendations`;

    console.log('Calling Lovable AI for rescheduling analysis...');

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          suggestions: []
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ 
          error: "AI credits exhausted. Please add credits to continue.",
          suggestions: []
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log('AI Response received, parsing...');

    // Extract JSON from the response
    let parsedSuggestions;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (jsonMatch) {
        parsedSuggestions = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, create a structured response from the text
        parsedSuggestions = {
          suggestions: [],
          overallAnalysis: content.slice(0, 500),
          prioritizedActions: []
        };
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      parsedSuggestions = {
        suggestions: [],
        overallAnalysis: content.slice(0, 500),
        prioritizedActions: [],
        rawResponse: content
      };
    }

    return new Response(JSON.stringify(parsedSuggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in ai-rescheduling function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});