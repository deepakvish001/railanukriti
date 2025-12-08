import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, FileJson, FileText, Database, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportHistory {
  id: string;
  file_name: string;
  file_type: string;
  data_type: string;
  records_total: number;
  records_imported: number;
  records_failed: number;
  status: string;
  created_at: string;
}

const DATA_TYPES = [
  { value: "stations", label: "Stations", icon: Database, description: "Station codes, names, platforms" },
  { value: "block_sections", label: "Block Sections", icon: FileSpreadsheet, description: "Section lines with distances" },
  { value: "signals", label: "Signalling System", icon: AlertTriangle, description: "Signal types and positions" },
  { value: "speed_profiles", label: "Section Speed", icon: FileText, description: "Speed limits by section" },
  { value: "schedules", label: "Passenger Schedule", icon: Clock, description: "Train stopping patterns" },
  { value: "historical_runs", label: "Historical Data", icon: FileJson, description: "Freight train history" },
];

export const DataImportPanel = () => {
  const [selectedDataType, setSelectedDataType] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Parse file for preview
    try {
      const text = await file.text();
      let data: any[] = [];
      
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
        if (!Array.isArray(data)) data = [data];
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else if (file.name.endsWith('.xml')) {
        data = parseXML(text);
      }
      
      setPreviewData(data.slice(0, 5));
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Failed to parse file. Please check the format.");
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });
  };

  const parseXML = (text: string): any[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const items = doc.querySelectorAll('record, item, row');
    return Array.from(items).map(item => {
      const obj: any = {};
      Array.from(item.children).forEach(child => {
        obj[child.tagName] = child.textContent;
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedDataType) {
      toast.error("Please select a file and data type");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const text = await selectedFile.text();
      let data: any[] = [];

      if (selectedFile.name.endsWith('.json')) {
        data = JSON.parse(text);
        if (!Array.isArray(data)) data = [data];
      } else if (selectedFile.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else if (selectedFile.name.endsWith('.xml')) {
        data = parseXML(text);
      }

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('data_imports')
        .insert({
          file_name: selectedFile.name,
          file_type: selectedFile.name.split('.').pop() || 'unknown',
          data_type: selectedDataType,
          records_total: data.length,
          status: 'processing'
        })
        .select()
        .single();

      if (importError) throw importError;

      let imported = 0;
      let failed = 0;

      // Import data in batches
      const batchSize = 50;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          const transformedBatch = batch.map(item => transformDataForTable(item, selectedDataType));
          const { error } = await supabase
            .from(selectedDataType as 'stations' | 'block_sections' | 'signals' | 'speed_profiles' | 'schedules' | 'historical_runs')
            .insert(transformedBatch);

          if (error) {
            failed += batch.length;
            console.error("Batch import error:", error);
          } else {
            imported += batch.length;
          }
        } catch (e) {
          failed += batch.length;
          console.error("Batch error:", e);
        }

        setProgress(Math.round(((i + batch.length) / data.length) * 100));
      }

      // Update import record
      await supabase
        .from('data_imports')
        .update({
          records_imported: imported,
          records_failed: failed,
          status: failed === 0 ? 'completed' : 'completed_with_errors',
          completed_at: new Date().toISOString()
        })
        .eq('id', importRecord.id);

      toast.success(`Import completed: ${imported} records imported, ${failed} failed`);
      loadImportHistory();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed. Please check file format.");
    } finally {
      setImporting(false);
      setSelectedFile(null);
      setPreviewData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const transformDataForTable = (item: any, dataType: string): any => {
    // Map common field names to database columns
    const mapping: Record<string, Record<string, string>> = {
      stations: {
        station_code: 'code',
        station_name: 'name',
        station_type: 'type',
        num_platforms: 'platforms',
        lat: 'latitude',
        lng: 'longitude',
      },
      block_sections: {
        section_id: 'section_code',
        from_station: 'from_station_id',
        to_station: 'to_station_id',
        distance: 'distance_km',
        speed_limit: 'max_speed',
      },
      signals: {
        signal_id: 'signal_code',
        type: 'signal_type',
        km_position: 'position_km',
      },
      speed_profiles: {
        start_km: 'from_km',
        end_km: 'to_km',
        speed: 'max_speed',
      },
      schedules: {
        arr: 'arrival_time',
        dep: 'departure_time',
        halt: 'halt_duration_minutes',
        platform: 'platform_number',
        seq: 'sequence_number',
      },
      historical_runs: {
        train_no: 'train_number',
        type: 'train_type',
        date: 'run_date',
        from: 'origin_station',
        to: 'destination_station',
        sched_dep: 'scheduled_departure',
        actual_dep: 'actual_departure',
        sched_arr: 'scheduled_arrival',
        actual_arr: 'actual_arrival',
        delay: 'total_delay_minutes',
        reason: 'delay_reason',
        weather: 'weather_condition',
        tonnage: 'load_tonnage',
        wagons: 'wagons_count',
      }
    };

    const transformed: any = {};
    const typeMapping = mapping[dataType] || {};

    Object.keys(item).forEach(key => {
      const mappedKey = typeMapping[key.toLowerCase()] || key.toLowerCase();
      transformed[mappedKey] = item[key];
    });

    return transformed;
  };

  const loadImportHistory = async () => {
    const { data, error } = await supabase
      .from('data_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setImportHistory(data as ImportHistory[]);
    }
  };

  useState(() => {
    loadImportHistory();
  });

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'json': return <FileJson className="h-4 w-4" />;
      case 'csv': return <FileSpreadsheet className="h-4 w-4" />;
      case 'xml': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-amber-500/20 text-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload Section */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Data File
          </CardTitle>
          <CardDescription>
            Supports CSV, JSON, and XML formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Data Type</label>
            <Select value={selectedDataType} onValueChange={setSelectedDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type to import" />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">- {type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select File</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.xml"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {selectedFile ? selectedFile.name : "Click to select or drag & drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV, JSON, XML (Max 10MB)
                </p>
              </label>
            </div>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Preview (first 5 rows)</label>
              <div className="bg-muted/30 rounded-lg p-3 overflow-x-auto text-xs">
                <pre className="text-muted-foreground">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Import Button */}
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || !selectedDataType || importing}
            className="w-full"
          >
            {importing ? "Importing..." : "Import Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Expected Format Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Expected Data Format
          </CardTitle>
          <CardDescription>
            Column mappings for each data type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDataType ? (
            <div className="space-y-3">
              {selectedDataType === 'stations' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    code, name, type, platforms, latitude, longitude, zone, division
                  </code>
                </div>
              )}
              {selectedDataType === 'block_sections' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    section_code, from_station_id, to_station_id, distance_km, max_speed, gradient, track_type, electrified, signalling_type
                  </code>
                </div>
              )}
              {selectedDataType === 'signals' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    signal_code, station_id, block_section_id, signal_type, aspect, position_km, direction, status
                  </code>
                </div>
              )}
              {selectedDataType === 'speed_profiles' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    block_section_id, from_km, to_km, max_speed, reason, train_type
                  </code>
                </div>
              )}
              {selectedDataType === 'schedules' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    train_id, station_id, sequence_number, arrival_time, departure_time, halt_duration_minutes, platform_number
                  </code>
                </div>
              )}
              {selectedDataType === 'historical_runs' && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs block">
                    train_number, train_type, run_date, origin_station, destination_station, scheduled_departure, actual_departure, scheduled_arrival, actual_arrival, total_delay_minutes, delay_reason
                  </code>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a data type to see expected format
            </p>
          )}

          {/* Sample Templates */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-2">Sample CSV format:</p>
            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto">
{selectedDataType === 'stations' ? 
`code,name,type,platforms,latitude,longitude,zone,division
JBP,Jabalpur Jn,junction,6,23.1686,79.9339,WCR,Jabalpur
ITR,Itarsi Jn,junction,8,22.6132,77.7619,WCR,Bhopal` : 
selectedDataType === 'block_sections' ?
`section_code,distance_km,max_speed,gradient,track_type,electrified,signalling_type
JBP-NSP,12.5,110,0.5,double,true,automatic
NSP-SCT,8.3,100,0.2,double,true,automatic` :
`code,name,value
SAMPLE_1,Sample Name,100
SAMPLE_2,Another Sample,200`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Import History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No imports yet. Upload your first file above.
                  </TableCell>
                </TableRow>
              ) : (
                importHistory.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="flex items-center gap-2">
                      {getFileIcon(item.file_type)}
                      <span className="truncate max-w-[200px]">{item.file_name}</span>
                    </TableCell>
                    <TableCell>{item.file_type.toUpperCase()}</TableCell>
                    <TableCell className="capitalize">{item.data_type.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <span className="text-green-400">{item.records_imported}</span>
                      {item.records_failed > 0 && (
                        <span className="text-red-400"> / {item.records_failed} failed</span>
                      )}
                      <span className="text-muted-foreground"> of {item.records_total}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
