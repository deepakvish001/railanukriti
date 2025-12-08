import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackSection {
  id: number
  name: string
  signalling_type: string | null
  block_length_km: number | null
  track_count: number | null
  has_loop: boolean | null
  has_crossover: boolean | null
  theoretical_capacity: number | null
  status: string
}

interface LoopLine {
  track_section_id: number
}

interface Crossover {
  from_track_id: number
}

interface Train {
  current_section: number | null
}

function calculateCapacity(section: TrackSection, loopCount: number, crossoverCount: number): number {
  const signallingType = section.signalling_type || 'absolute'
  const blockLength = section.block_length_km || 10
  const trackCount = section.track_count || 1
  
  // Base capacity based on signalling type
  let baseCapacity: number
  switch (signallingType) {
    case 'automatic':
      baseCapacity = Math.floor(60 / (blockLength * 2)) // AT: Higher capacity
      break
    case 'semi-automatic':
      baseCapacity = Math.floor(60 / (blockLength * 3)) // Semi-AT: Medium capacity
      break
    default:
      baseCapacity = Math.floor(60 / (blockLength * 4)) // AB: Lower capacity
  }
  
  // Track count multiplier
  baseCapacity *= trackCount
  
  // Loop bonus: +2 trains/hour per loop
  const loopBonus = loopCount * 2
  
  // Crossover bonus: +1 train/hour per crossover
  const crossoverBonus = crossoverCount * 1
  
  return baseCapacity + loopBonus + crossoverBonus
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting periodic section analysis...')

    // Fetch all track sections
    const { data: sections, error: sectionsError } = await supabase
      .from('track_sections')
      .select('*')
    
    if (sectionsError) throw sectionsError

    // Fetch loops, crossovers, and current trains
    const [loopsResult, crossoversResult, trainsResult] = await Promise.all([
      supabase.from('loop_lines').select('track_section_id'),
      supabase.from('crossovers').select('from_track_id'),
      supabase.from('trains').select('current_section')
    ])

    const loops = loopsResult.data || []
    const crossovers = crossoversResult.data || []
    const trains = trainsResult.data || []

    // Count loops and crossovers per section
    const loopCounts: Record<number, number> = {}
    const crossoverCounts: Record<number, number> = {}
    const trainCounts: Record<number, number> = {}

    loops.forEach((l: LoopLine) => {
      if (l.track_section_id) {
        loopCounts[l.track_section_id] = (loopCounts[l.track_section_id] || 0) + 1
      }
    })

    crossovers.forEach((c: Crossover) => {
      if (c.from_track_id) {
        crossoverCounts[c.from_track_id] = (crossoverCounts[c.from_track_id] || 0) + 1
      }
    })

    trains.forEach((t: Train) => {
      if (t.current_section) {
        trainCounts[t.current_section] = (trainCounts[t.current_section] || 0) + 1
      }
    })

    const alerts: Array<{
      section_id: number
      alert_type: string
      severity: string
      title: string
      description: string
      current_utilization: number
      recommended_action: string
      estimated_capacity_gain: number
    }> = []

    // Analyze each section
    for (const section of (sections || [])) {
      const loopCount = loopCounts[section.id] || 0
      const crossoverCount = crossoverCounts[section.id] || 0
      const currentTrains = trainCounts[section.id] || 0
      
      const capacity = calculateCapacity(section, loopCount, crossoverCount)
      const utilization = capacity > 0 ? (currentTrains / capacity) * 100 : 0

      // Generate alerts based on utilization thresholds
      if (utilization >= 90) {
        alerts.push({
          section_id: section.id,
          alert_type: 'capacity_critical',
          severity: 'critical',
          title: `Critical Congestion: ${section.name}`,
          description: `Section is operating at ${utilization.toFixed(1)}% capacity with ${currentTrains} trains. Immediate action required to prevent delays.`,
          current_utilization: utilization,
          recommended_action: section.signalling_type === 'absolute' 
            ? 'Convert to Automatic Signalling (AT) for immediate capacity boost'
            : section.track_count === 1 
              ? 'Add second main line or additional loop lines'
              : 'Add more crossovers for flexible train movements',
          estimated_capacity_gain: section.signalling_type === 'absolute' ? 8 : 4
        })
      } else if (utilization >= 75) {
        alerts.push({
          section_id: section.id,
          alert_type: 'capacity_high',
          severity: 'high',
          title: `High Utilization: ${section.name}`,
          description: `Section is operating at ${utilization.toFixed(1)}% capacity. Consider infrastructure upgrades to prevent future bottlenecks.`,
          current_utilization: utilization,
          recommended_action: loopCount < 2 
            ? 'Add loop lines for better train crossing capability'
            : 'Reduce block length or upgrade signalling system',
          estimated_capacity_gain: 4
        })
      } else if (utilization >= 60 && section.signalling_type === 'absolute') {
        alerts.push({
          section_id: section.id,
          alert_type: 'upgrade_recommended',
          severity: 'medium',
          title: `Upgrade Recommended: ${section.name}`,
          description: `Section with Absolute Block signalling at ${utilization.toFixed(1)}% utilization. AT conversion would significantly improve capacity.`,
          current_utilization: utilization,
          recommended_action: 'Convert from Absolute Block to Automatic Signalling for 40-60% capacity increase',
          estimated_capacity_gain: 6
        })
      }

      // Check for single track bottlenecks
      if (section.track_count === 1 && utilization >= 50 && !section.has_loop) {
        alerts.push({
          section_id: section.id,
          alert_type: 'single_track_bottleneck',
          severity: utilization >= 70 ? 'high' : 'medium',
          title: `Single Track Bottleneck: ${section.name}`,
          description: `Single track section without loops at ${utilization.toFixed(1)}% utilization. Adding loops would enable simultaneous train movements.`,
          current_utilization: utilization,
          recommended_action: 'Add at least one loop line to enable train crossings',
          estimated_capacity_gain: 3
        })
      }
    }

    console.log(`Generated ${alerts.length} alerts`)

    // Clear old unacknowledged alerts and insert new ones
    if (alerts.length > 0) {
      // Delete expired alerts
      await supabase
        .from('infrastructure_alerts')
        .delete()
        .lt('expires_at', new Date().toISOString())

      // Insert new alerts
      const { error: insertError } = await supabase
        .from('infrastructure_alerts')
        .insert(alerts)

      if (insertError) {
        console.error('Error inserting alerts:', insertError)
        throw insertError
      }

      console.log(`Successfully inserted ${alerts.length} alerts`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsGenerated: alerts.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Periodic analysis error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})