import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ImportResult {
  success: boolean;
  recordsImported: number;
  recordsFailed: number;
  errors: string[];
}

// Split one CSV line into fields, respecting RFC4180 double-quoting so a
// quoted field can contain a literal comma (e.g. a freight Description like
// "Iron Ore, Grade B") without shifting every column after it.
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// Parse date from various formats
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try DD/MM/YYYY HH:mm format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{1,2})/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  
  // Try standard date parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Import Route Station Info from RouteSttnInfo.xlsx
export async function importRouteStations(file: File): Promise<ImportResult> {
  const result: ImportResult = { success: false, recordsImported: 0, recordsFailed: 0, errors: [] };
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const stations = rows.map((row: any) => ({
      seq_no: parseInt(row.SEQ_NO) || 0,
      zone_code: row.ZONE_CODE || null,
      division_code: row.DIVISION_CODE || null,
      station_code: row.STATION_CODE,
      station_name: row.STATION_NAME,
      is_junction: row.JUNC_FLAG === 'Y',
      is_cabin: row.CABIN_FLAG === 'Y',
      is_halt: row.HALT_FLAG === 'Y',
      is_ic_flag: row.IC_FLAG === 'Y',
      is_frozen: row.FROZEN_FLAG === 'Y',
      from_station: row.FROM_STATION || null,
      to_station: row.TO_STATION || null,
      block_section: row.BLOCK_SECTION || null,
      reverse_block_section: row.REVERSE_BLOCK_SECTION || null,
      distance_km: parseFloat(row.DISTANCE) || null,
      cumulative_distance_km: parseFloat(row.CUM_DISTANCE) || null,
      signal_type: row.SIGNALTYPE || null,
      traction: row.TRACTION || null,
      no_of_tracks: parseInt(row.NOOFTRACKS) || 2,
    }));

    // Delete existing and insert new
    await supabase.from('route_stations').delete().neq('id', 0);
    
    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < stations.length; i += batchSize) {
      const batch = stations.slice(i, i + batchSize);
      const { error } = await supabase.from('route_stations').insert(batch);
      if (error) {
        result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        result.recordsFailed += batch.length;
      } else {
        result.recordsImported += batch.length;
      }
    }

    result.success = result.recordsFailed === 0;
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

// Import Infrastructure data from KTV-PSA-Infra.xlsx
export async function importInfrastructure(file: File): Promise<ImportResult> {
  const result: ImportResult = { success: false, recordsImported: 0, recordsFailed: 0, errors: [] };
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    // Sheet 1: Stations
    if (workbook.SheetNames[0]) {
      const stationSheet = workbook.Sheets[workbook.SheetNames[0]];
      const stationRows = XLSX.utils.sheet_to_json(stationSheet);
      
      // Update stations with lat/long from infrastructure file
      for (const row of stationRows as any[]) {
        if (row.MAVSTTNCODE) {
          await supabase
            .from('route_stations')
            .update({
              latitude: parseFloat(row.MANLATITUDE) || null,
              longitude: parseFloat(row.MANLONGITUDE) || null,
            })
            .eq('station_code', row.MAVSTTNCODE);
        }
      }
    }

    // Sheet 2: Station Lines (Platforms/Loops)
    if (workbook.SheetNames[1]) {
      const lineSheet = workbook.Sheets[workbook.SheetNames[1]];
      const lineRows = XLSX.utils.sheet_to_json(lineSheet);
      
      await supabase.from('station_lines').delete().neq('id', 0);
      
      const lines = (lineRows as any[]).map((row: any) => ({
        station_code: row.MAVSTTNCODE,
        seq_number: parseInt(row.MANSEQNUMB) || null,
        line_number: row.MAVLINENUMB?.toString() || null,
        line_type: row.MAVLINETYPE || null,
        line_category: row.MACLINECATEGORY || null,
        line_length_m: parseInt(row.MANLINELENGTH) || null,
        direction: row.MAVDRTN || null,
        trains_allowed: parseInt(row.MANNUMBTRAINALLWD) || 1,
        capacity: parseInt(row.MANCAPACITY) || null,
        gauge: row.MACGAUGE || 'B',
        traction_type: row.MACTRTNTYPE || 'E',
        line_name: row.MAVLINENAME || null,
        max_speed: parseInt(row.MANLINESPEED) || 100,
        is_platform: row.MACPLATFORM === 'Y',
      }));

      const batchSize = 100;
      for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        const { error } = await supabase.from('station_lines').insert(batch);
        if (error) {
          result.errors.push(`Station lines batch ${i / batchSize + 1}: ${error.message}`);
          result.recordsFailed += batch.length;
        } else {
          result.recordsImported += batch.length;
        }
      }
    }

    // Sheet 3: Block Sections
    if (workbook.SheetNames[2]) {
      const blockSheet = workbook.Sheets[workbook.SheetNames[2]];
      const blockRows = XLSX.utils.sheet_to_json(blockSheet);
      
      await supabase.from('route_block_sections').delete().neq('id', 0);
      
      const sections = (blockRows as any[]).map((row: any) => ({
        block_section_code: row.MAVBLCKSCTN,
        from_station_code: row.MAVFROMSTTNCODE,
        to_station_code: row.MAVTOSTTNCODE,
        distance_km: parseFloat(row.MANINTRDIST) || 0,
        no_of_lines: parseInt(row.MANNUMBLINES) || 2,
        no_of_signals: parseInt(row.MANNUMBSGNL) || 0,
        signal_type: row.MAVSGNLTYPE || 'AB',
        gauge: row.MAVGAUGE || 'B',
        traction_type: row.MAVTRTNTYPE || 'E',
        division_code: row.MAVDVSNCODE || null,
        max_speed: parseInt(row.MANMAXSPEED) || 130,
        direction: row.MAVDRTN || null,
        traffic_type: row.MAVTRAFFICTYPE || 'CG',
      }));

      // Remove duplicates
      const uniqueSections = sections.filter((s, i, arr) => 
        arr.findIndex(x => x.block_section_code === s.block_section_code) === i
      );

      const batchSize = 50;
      for (let i = 0; i < uniqueSections.length; i += batchSize) {
        const batch = uniqueSections.slice(i, i + batchSize);
        const { error } = await supabase.from('route_block_sections').insert(batch);
        if (error) {
          result.errors.push(`Block sections batch ${i / batchSize + 1}: ${error.message}`);
          result.recordsFailed += batch.length;
        } else {
          result.recordsImported += batch.length;
        }
      }
    }

    result.success = result.recordsFailed === 0;
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

// Import Passenger Schedule from KTV_PSA_Passenger_Schedule.xlsx
export async function importPassengerSchedule(file: File): Promise<ImportResult> {
  const result: ImportResult = { success: false, recordsImported: 0, recordsFailed: 0, errors: [] };
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    // Sheet 1: Train Master
    if (workbook.SheetNames[0]) {
      const trainSheet = workbook.Sheets[workbook.SheetNames[0]];
      const trainRows = XLSX.utils.sheet_to_json(trainSheet);
      
      await supabase.from('passenger_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('passenger_trains').delete().neq('id', 0);
      
      const trains = (trainRows as any[]).map((row: any) => ({
        train_id: row.TRAINID?.toString() || '',
        proposal_id: row.PROPOSAL_ID?.toString() || null,
        train_number: row.TRAIN_NUMBER?.toString() || '',
        train_name: row.TRAIN_NAME || null,
        source_station: row.SOURCE || '',
        destination_station: row.DESTINATION || '',
        train_type: row.TRAIN_TYPE || null,
        route_type: row.ROUTE_TYPE || null,
        day_of_services: row.DAY_OF_SERVICES || null,
        no_of_coaches: parseInt(row.NO_OF_COACHES) || null,
        train_composition: row.TRAIN_COMPOSITION || null,
        reverse_train_number: row.REVERSE_TRAIN_NUMBER?.toString() || null,
      }));

      // Insert trains in batches
      const batchSize = 50;
      for (let i = 0; i < trains.length; i += batchSize) {
        const batch = trains.slice(i, i + batchSize);
        const { error } = await supabase.from('passenger_trains').insert(batch);
        if (error) {
          result.errors.push(`Passenger trains batch ${i / batchSize + 1}: ${error.message}`);
          result.recordsFailed += batch.length;
        } else {
          result.recordsImported += batch.length;
        }
      }
    }

    // Sheet 2: Schedule Details
    if (workbook.SheetNames[1]) {
      const scheduleSheet = workbook.Sheets[workbook.SheetNames[1]];
      const scheduleRows = XLSX.utils.sheet_to_json(scheduleSheet);
      
      const schedules = (scheduleRows as any[]).map((row: any) => ({
        train_id: row.TRAINID?.toString() || '',
        train_number: row.TRAIN_NO?.toString() || '',
        route_seq_no: parseInt(row.ROUTE_SEQ_NO) || 0,
        direction: row.DIRECTION || null,
        station_code: row.STTN_CODE || '',
        is_halt: row.HALT_FLAG === 'Y',
        block_section: row.BLOCK_SCTN || null,
        prev_block_section: row.PREV_BLCK_SCTN || null,
        cumulative_distance: parseFloat(row.CUM_DISTANCE) || null,
        signal_type: row.SGNL_TYPE || null,
        arrival_seconds: parseInt(row.ARRIVAL) || null,
        departure_seconds: parseInt(row.DEPARTURE) || null,
        day_of_run: parseInt(row.DAY_OF_RUN) || 1,
        platform: row.PLATFORM || null,
      }));

      const batchSize = 500;
      for (let i = 0; i < schedules.length; i += batchSize) {
        const batch = schedules.slice(i, i + batchSize);
        const { error } = await supabase.from('passenger_schedule').insert(batch);
        if (error) {
          result.errors.push(`Schedule batch ${i / batchSize + 1}: ${error.message}`);
          result.recordsFailed += batch.length;
        } else {
          result.recordsImported += batch.length;
        }
      }
    }

    result.success = result.recordsFailed === 0;
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

// Import Freight Train Data from CSV
export async function importFreightData(file: File): Promise<ImportResult> {
  const result: ImportResult = { success: false, recordsImported: 0, recordsFailed: 0, errors: [] };
  
  try {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    
    // First, get existing freight trains to link movements
    const { data: existingTrains } = await supabase
      .from('freight_trains')
      .select('id, load_id');
    
    const trainIdMap = new Map<string, string>();
    existingTrains?.forEach(t => trainIdMap.set(t.load_id, t.id));
    
    // Group movements by LoadId to create train records
    const trainMap = new Map<string, any>();
    const movements: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCsvLine(line);
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.trim() || null;
      });

      if (!row.LoadId) continue;

      // Create or update train record (only if not already in DB)
      if (!trainMap.has(row.LoadId) && !trainIdMap.has(row.LoadId)) {
        trainMap.set(row.LoadId, {
          load_id: row.LoadId,
          rake_id: row.RakeId || null,
          from_zone: row['From Zone'] || null,
          from_division: row['From Division'] || null,
          from_section: row['From Section'] || null,
          source_station: row.Source || '',
          to_zone: row['Zone To'] || null,
          to_division: row['Division To'] || null,
          to_section: row['Section To'] || null,
          destination_station: row.Destination || '',
          load_type: row['Load Type'] || null,
          total_km: parseFloat(row['Total Km']) || null,
          commodity: row.Commodity || null,
          description: row.Description || null,
          is_ic_station: row['Ic Sttn'] === 'Y',
          loco_type: row.LE || null,
        });
      }

      // Parse times
      const arrivalTime = parseDate(row['Arrival Time']);
      const departTime = parseDate(row['Depart Time']);
      
      // Calculate halt time (difference between departure and arrival at same station)
      let haltMinutes = 0;
      if (arrivalTime && departTime && departTime > arrivalTime) {
        haltMinutes = Math.round((departTime.getTime() - arrivalTime.getTime()) / 60000);
      }
      
      // Determine if this is a stoppage (halt > 30 minutes indicates unscheduled stoppage)
      const isStoppage = haltMinutes > 30;
      
      // Calculate speed from block_km and block_hrs
      let speed = parseFloat(row.Speed) || null;
      const blockKm = parseFloat(row['Block Km']) || 0;
      const blockHrs = parseFloat(row['Block Hrs']) || 0;
      if (!speed && blockKm > 0 && blockHrs > 0) {
        speed = Math.round(blockKm / blockHrs);
      }

      movements.push({
        load_id: row.LoadId,
        station_code: row.Sttn || '',
        block_section: row['Block Section'] || null,
        block_km: blockKm || null,
        block_hours: blockHrs || null,
        speed: speed,
        arrival_time: arrivalTime?.toISOString() || null,
        departure_time: departTime?.toISOString() || null,
        halt_minutes: haltMinutes > 0 ? haltMinutes : null,
        delay_minutes: 0,
        is_stoppage: isStoppage,
        stoppage_reason: isStoppage ? 'Unscheduled halt' : null,
      });
    }

    // Clear existing movements only
    await supabase.from('freight_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert any new trains that don't exist
    const newTrains = Array.from(trainMap.values());
    if (newTrains.length > 0) {
      const trainBatchSize = 100;
      for (let i = 0; i < newTrains.length; i += trainBatchSize) {
        const batch = newTrains.slice(i, i + trainBatchSize);
        const { data: insertedTrains, error } = await supabase
          .from('freight_trains')
          .insert(batch)
          .select('id, load_id');
        
        if (error) {
          result.errors.push(`Freight trains batch ${i / trainBatchSize + 1}: ${error.message}`);
          result.recordsFailed += batch.length;
        } else {
          // Add newly inserted trains to the map
          insertedTrains?.forEach(t => trainIdMap.set(t.load_id, t.id));
          result.recordsImported += batch.length;
        }
      }
    }

    // Add freight_train_id to movements
    const movementsWithTrainId = movements.map(m => ({
      ...m,
      freight_train_id: trainIdMap.get(m.load_id) || null,
    }));

    // Insert movements in batches
    const movementBatchSize = 500;
    for (let i = 0; i < movementsWithTrainId.length; i += movementBatchSize) {
      const batch = movementsWithTrainId.slice(i, i + movementBatchSize);
      const { error } = await supabase.from('freight_movements').insert(batch);
      if (error) {
        result.errors.push(`Movements batch ${Math.floor(i / movementBatchSize) + 1}: ${error.message}`);
        result.recordsFailed += batch.length;
      } else {
        result.recordsImported += batch.length;
      }
    }

    result.success = result.recordsFailed === 0;
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}
