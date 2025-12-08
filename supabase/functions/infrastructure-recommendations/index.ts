import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SectionAnalysis {
  sectionId: number;
  sectionName: string;
  currentCapacity: number;
  currentTrains: number;
  utilizationPercent: number;
  signallingType: string;
  trackCount: number;
  hasLoops: boolean;
  loopCount: number;
  hasCrossovers: boolean;
  blockLengthKm: number;
}

interface UpgradeOption {
  type: string;
  description: string;
  capacityGain: number;
  percentGain: number;
  costEstimate: string;
  implementationTime: string;
  priority: number;
}

// Throughput calculation based on railway engineering principles
function calculateCapacity(
  signalling: string,
  blockLength: number,
  tracks: number,
  loops: number,
  crossovers: boolean
): number {
  let base: number;
  let signalBonus = 0;

  switch (signalling) {
    case "automatic":
      base = 48;
      if (blockLength <= 1.5) signalBonus = 24;
      else if (blockLength <= 2) signalBonus = 12;
      break;
    case "semi-automatic":
      base = 36;
      if (blockLength <= 3) signalBonus = 8;
      break;
    default: // absolute
      base = 24;
      if (blockLength > 10) signalBonus = -4;
      else if (blockLength <= 5) signalBonus = 4;
  }

  const loopBonus = Math.round(base * 0.15 * Math.min(loops, 4));
  const crossoverBonus = crossovers ? Math.round(base * 0.1) : 0;

  return Math.round((base + signalBonus + loopBonus + crossoverBonus) * tracks);
}

// Generate upgrade options based on current infrastructure
function generateUpgradeOptions(analysis: SectionAnalysis): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  const currentCapacity = analysis.currentCapacity;

  // Option 1: Convert to Automatic Block (if not already)
  if (analysis.signallingType !== "automatic") {
    const newCapacity = calculateCapacity(
      "automatic",
      1.5, // Typical AT block length
      analysis.trackCount,
      analysis.loopCount,
      analysis.hasCrossovers
    );
    options.push({
      type: "signalling_upgrade",
      description: `Upgrade to Automatic Block signalling with 1.5km block sections`,
      capacityGain: newCapacity - currentCapacity,
      percentGain: Math.round(((newCapacity - currentCapacity) / currentCapacity) * 100),
      costEstimate: "₹50-100 Crore",
      implementationTime: "18-24 months",
      priority: analysis.utilizationPercent > 80 ? 1 : 2
    });
  }

  // Option 2: Add Loop Lines
  if (analysis.loopCount < 4) {
    const additionalLoops = 2;
    const newCapacity = calculateCapacity(
      analysis.signallingType,
      analysis.blockLengthKm,
      analysis.trackCount,
      analysis.loopCount + additionalLoops,
      analysis.hasCrossovers
    );
    options.push({
      type: "add_loops",
      description: `Add ${additionalLoops} loop lines for overtaking and crossing`,
      capacityGain: newCapacity - currentCapacity,
      percentGain: Math.round(((newCapacity - currentCapacity) / currentCapacity) * 100),
      costEstimate: `₹${additionalLoops * 5}-${additionalLoops * 10} Crore`,
      implementationTime: "6-12 months",
      priority: analysis.utilizationPercent > 70 ? 2 : 3
    });
  }

  // Option 3: Add Second Main Line
  if (analysis.trackCount < 2) {
    const newCapacity = calculateCapacity(
      analysis.signallingType,
      analysis.blockLengthKm,
      2,
      analysis.loopCount,
      analysis.hasCrossovers
    );
    options.push({
      type: "double_line",
      description: "Convert to double line section",
      capacityGain: newCapacity - currentCapacity,
      percentGain: Math.round(((newCapacity - currentCapacity) / currentCapacity) * 100),
      costEstimate: "₹100-200 Crore per km",
      implementationTime: "24-36 months",
      priority: analysis.utilizationPercent > 85 ? 1 : 3
    });
  }

  // Option 4: Add Crossovers
  if (!analysis.hasCrossovers && analysis.trackCount >= 2) {
    const newCapacity = calculateCapacity(
      analysis.signallingType,
      analysis.blockLengthKm,
      analysis.trackCount,
      analysis.loopCount,
      true
    );
    options.push({
      type: "add_crossovers",
      description: "Install crossovers for operational flexibility",
      capacityGain: newCapacity - currentCapacity,
      percentGain: Math.round(((newCapacity - currentCapacity) / currentCapacity) * 100),
      costEstimate: "₹1-3 Crore per crossover",
      implementationTime: "3-6 months",
      priority: 3
    });
  }

  // Option 5: Reduce Block Length (add more signals)
  if (analysis.signallingType === "automatic" && analysis.blockLengthKm > 2) {
    const newCapacity = calculateCapacity(
      analysis.signallingType,
      1.5,
      analysis.trackCount,
      analysis.loopCount,
      analysis.hasCrossovers
    );
    if (newCapacity > currentCapacity) {
      options.push({
        type: "add_signals",
        description: "Add intermediate signals to reduce block length to 1.5km",
        capacityGain: newCapacity - currentCapacity,
        percentGain: Math.round(((newCapacity - currentCapacity) / currentCapacity) * 100),
        costEstimate: "₹20-40 Crore",
        implementationTime: "12-18 months",
        priority: 2
      });
    }
  }

  // Sort by priority and capacity gain
  return options.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.capacityGain - a.capacityGain;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch track sections with infrastructure data
    const { data: sections, error: sectionsError } = await supabase
      .from("track_sections")
      .select("*");

    if (sectionsError) throw sectionsError;

    // Fetch active train counts per section
    const { data: trains, error: trainsError } = await supabase
      .from("trains")
      .select("current_section")
      .not("current_section", "is", null);

    if (trainsError) throw trainsError;

    // Count trains per section
    const trainCounts: Record<number, number> = {};
    trains?.forEach((t: any) => {
      trainCounts[t.current_section] = (trainCounts[t.current_section] || 0) + 1;
    });

    // Fetch loop counts per section
    const { data: loops, error: loopsError } = await supabase
      .from("loop_lines")
      .select("track_section_id");

    const loopCounts: Record<number, number> = {};
    loops?.forEach((l: any) => {
      loopCounts[l.track_section_id] = (loopCounts[l.track_section_id] || 0) + 1;
    });

    // Analyze each section
    const analysisResults: SectionAnalysis[] = [];
    const recommendations: any[] = [];

    for (const section of sections || []) {
      const loopCount = loopCounts[section.id] || 0;
      const signalling = section.signalling_type || "absolute";
      const blockLength = section.block_length_km || 10;
      const trackCount = section.track_count || 1;
      const hasCrossovers = section.has_crossover || false;

      const capacity = calculateCapacity(
        signalling,
        blockLength,
        trackCount,
        loopCount,
        hasCrossovers
      );

      // Estimate current utilization (trains * average section time)
      const currentTrains = trainCounts[section.id] || 0;
      // Assume each train occupies section for ~30 mins on average
      const dailyTrainEstimate = currentTrains * 48; // extrapolate to daily
      const utilizationPercent = Math.min(100, Math.round((dailyTrainEstimate / capacity) * 100));

      const analysis: SectionAnalysis = {
        sectionId: section.id,
        sectionName: section.name,
        currentCapacity: capacity,
        currentTrains: dailyTrainEstimate,
        utilizationPercent,
        signallingType: signalling,
        trackCount,
        hasLoops: loopCount > 0,
        loopCount,
        hasCrossovers,
        blockLengthKm: blockLength
      };

      analysisResults.push(analysis);

      // Generate recommendations for congested sections (>60% utilization)
      if (utilizationPercent > 60) {
        const upgradeOptions = generateUpgradeOptions(analysis);
        
        // Get AI-enhanced recommendation if available
        let aiInsight = "";
        if (lovableApiKey && upgradeOptions.length > 0) {
          try {
            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: `You are a railway infrastructure expert. Analyze section utilization and provide a concise recommendation in 2-3 sentences. Focus on the most impactful upgrade considering cost-benefit ratio.`
                  },
                  {
                    role: "user",
                    content: `Section: ${section.name}
Utilization: ${utilizationPercent}%
Current: ${signalling} block, ${trackCount} track(s), ${loopCount} loops, ${hasCrossovers ? 'has' : 'no'} crossovers
Capacity: ${capacity} trains/day
Top upgrade option: ${upgradeOptions[0]?.description} (+${upgradeOptions[0]?.capacityGain} trains, ${upgradeOptions[0]?.costEstimate})

Provide a brief recommendation.`
                  }
                ],
                max_tokens: 150
              })
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiInsight = aiData.choices?.[0]?.message?.content || "";
            }
          } catch (aiError) {
            console.error("AI insight error:", aiError);
          }
        }

        recommendations.push({
          sectionId: section.id,
          sectionName: section.name,
          utilizationPercent,
          currentCapacity: capacity,
          severity: utilizationPercent > 80 ? "critical" : utilizationPercent > 70 ? "high" : "medium",
          upgradeOptions: upgradeOptions.slice(0, 3), // Top 3 options
          aiInsight,
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Store recommendations in database
    for (const rec of recommendations) {
      const topOption = rec.upgradeOptions[0];
      if (topOption) {
        await supabase.from("ai_recommendations").insert({
          type: "reroute", // Using existing enum, represents infrastructure change
          reason: `Section ${rec.sectionName} at ${rec.utilizationPercent}% utilization`,
          action: topOption.description,
          impact: `+${topOption.capacityGain} trains/day capacity (${topOption.percentGain}% increase)`,
          confidence: rec.severity === "critical" ? 0.95 : rec.severity === "high" ? 0.85 : 0.75,
          is_active: true
        });
      }
    }

    console.log(`Generated ${recommendations.length} infrastructure recommendations`);

    return new Response(
      JSON.stringify({
        success: true,
        analysisCount: analysisResults.length,
        recommendations,
        summary: {
          congestedSections: recommendations.length,
          criticalSections: recommendations.filter(r => r.severity === "critical").length,
          totalCapacityGainPossible: recommendations.reduce(
            (sum, r) => sum + (r.upgradeOptions[0]?.capacityGain || 0), 0
          )
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Infrastructure analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
