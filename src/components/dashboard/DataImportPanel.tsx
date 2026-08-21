import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, FileSpreadsheet, FileJson, FileText, Database, CheckCircle2, 
  XCircle, Clock, AlertTriangle, Edit2, Check, X, RefreshCw, Eye, Trash2
} from "lucide-react";
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

interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidatedRow {
  index: number;
  data: Record<string, any>;
  errors: ValidationError[];
  isValid: boolean;
}

const DATA_TYPES = [
  { value: "stations", label: "Stations", icon: Database, description: "Station codes, names, platforms" },
  { value: "block_sections", label: "Block Sections", icon: FileSpreadsheet, description: "Section lines with distances" },
  { value: "signals", label: "Signalling System", icon: AlertTriangle, description: "Signal types and positions" },
  { value: "speed_profiles", label: "Section Speed", icon: FileText, description: "Speed limits by section" },
  { value: "schedules", label: "Passenger Schedule", icon: Clock, description: "Train stopping patterns" },
  { value: "historical_runs", label: "Historical Data", icon: FileJson, description: "Freight train history" },
];

const VALIDATION_RULES: Record<string, Record<string, { required?: boolean; type?: string; min?: number; max?: number; pattern?: RegExp; enum?: string[] }>> = {
  stations: {
    code: { required: true, pattern: /^[A-Z0-9]{2,6}$/ },
    name: { required: true },
    type: { enum: ['junction', 'halt', 'terminal', 'crossing'] },
    platforms: { type: 'number', min: 1, max: 20 },
    latitude: { type: 'number', min: -90, max: 90 },
    longitude: { type: 'number', min: -180, max: 180 },
  },
  block_sections: {
    section_code: { required: true },
    distance_km: { required: true, type: 'number', min: 0.1, max: 100 },
    max_speed: { type: 'number', min: 10, max: 200 },
    gradient: { type: 'number', min: -5, max: 5 },
    track_type: { enum: ['single', 'double'] },
    signalling_type: { enum: ['automatic', 'manual', 'semi-automatic'] },
  },
  signals: {
    signal_code: { required: true },
    signal_type: { required: true, enum: ['home', 'starter', 'advanced_starter', 'distant', 'shunting'] },
    aspect: { enum: ['red', 'yellow', 'double_yellow', 'green'] },
    direction: { enum: ['UP', 'DOWN'] },
    status: { enum: ['working', 'faulty', 'maintenance'] },
  },
  speed_profiles: {
    from_km: { required: true, type: 'number', min: 0 },
    to_km: { required: true, type: 'number', min: 0 },
    max_speed: { required: true, type: 'number', min: 10, max: 200 },
  },
  schedules: {
    sequence_number: { required: true, type: 'number', min: 1 },
    arrival_time: { pattern: /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/ },
    departure_time: { pattern: /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/ },
    halt_duration_minutes: { type: 'number', min: 0, max: 120 },
    platform_number: { type: 'number', min: 1, max: 20 },
  },
  historical_runs: {
    train_number: { required: true },
    train_type: { required: true },
    run_date: { required: true },
    origin_station: { required: true },
    destination_station: { required: true },
    total_delay_minutes: { type: 'number', min: -60, max: 1440 },
  },
};

export const DataImportPanel = () => {
  const [selectedDataType, setSelectedDataType] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [validatedData, setValidatedData] = useState<ValidatedRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedDataType) {
      toast.error("Please select a data type first");
      return;
    }

    setSelectedFile(file);
    
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
      
      // Transform and validate data
      const transformed = data.map(item => transformDataForTable(item, selectedDataType));
      const validated = validateData(transformed, selectedDataType);
      setValidatedData(validated);
      setActiveTab("preview");
      
      const errorCount = validated.filter(r => !r.isValid).length;
      if (errorCount > 0) {
        toast.warning(`Found ${errorCount} rows with validation errors`);
      } else {
        toast.success(`All ${validated.length} rows validated successfully`);
      }
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

  const transformDataForTable = (item: any, dataType: string): Record<string, any> => {
    const mapping: Record<string, Record<string, string>> = {
      stations: {
        station_code: 'code', station_name: 'name', station_type: 'type',
        num_platforms: 'platforms', lat: 'latitude', lng: 'longitude',
      },
      block_sections: {
        section_id: 'section_code', from_station: 'from_station_id',
        to_station: 'to_station_id', distance: 'distance_km', speed_limit: 'max_speed',
      },
      signals: {
        signal_id: 'signal_code', type: 'signal_type', km_position: 'position_km',
      },
      speed_profiles: {
        start_km: 'from_km', end_km: 'to_km', speed: 'max_speed',
      },
      schedules: {
        arr: 'arrival_time', dep: 'departure_time', halt: 'halt_duration_minutes',
        platform: 'platform_number', seq: 'sequence_number',
      },
      historical_runs: {
        train_no: 'train_number', type: 'train_type', date: 'run_date',
        from: 'origin_station', to: 'destination_station', sched_dep: 'scheduled_departure',
        actual_dep: 'actual_departure', sched_arr: 'scheduled_arrival',
        actual_arr: 'actual_arrival', delay: 'total_delay_minutes',
        reason: 'delay_reason', weather: 'weather_condition',
        tonnage: 'load_tonnage', wagons: 'wagons_count',
      }
    };

    const transformed: Record<string, any> = {};
    const typeMapping = mapping[dataType] || {};

    Object.keys(item).forEach(key => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const mappedKey = typeMapping[normalizedKey] || typeMapping[key.toLowerCase()] || normalizedKey;
      transformed[mappedKey] = item[key];
    });

    return transformed;
  };

  const validateData = (data: Record<string, any>[], dataType: string): ValidatedRow[] => {
    const rules = VALIDATION_RULES[dataType] || {};
    
    return data.map((row, index) => {
      const errors: ValidationError[] = [];
      
      Object.entries(rules).forEach(([field, rule]) => {
        const value = row[field];
        
        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({
            row: index,
            field,
            value,
            message: `${field} is required`,
            severity: 'error'
          });
          return;
        }
        
        if (value === undefined || value === null || value === '') return;
        
        // Type check
        if (rule.type === 'number') {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            errors.push({
              row: index,
              field,
              value,
              message: `${field} must be a number`,
              severity: 'error'
            });
            return;
          }
          
          if (rule.min !== undefined && numValue < rule.min) {
            errors.push({
              row: index,
              field,
              value,
              message: `${field} must be at least ${rule.min}`,
              severity: 'error'
            });
          }
          
          if (rule.max !== undefined && numValue > rule.max) {
            errors.push({
              row: index,
              field,
              value,
              message: `${field} must be at most ${rule.max}`,
              severity: 'error'
            });
          }
        }
        
        // Pattern check
        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors.push({
            row: index,
            field,
            value,
            message: `${field} has invalid format`,
            severity: 'error'
          });
        }
        
        // Enum check
        if (rule.enum && !rule.enum.includes(String(value).toLowerCase())) {
          errors.push({
            row: index,
            field,
            value,
            message: `${field} must be one of: ${rule.enum.join(', ')}`,
            severity: 'warning'
          });
        }
      });
      
      return {
        index,
        data: row,
        errors,
        isValid: errors.filter(e => e.severity === 'error').length === 0
      };
    });
  };

  const handleCellEdit = (rowIndex: number, field: string) => {
    const row = validatedData.find(r => r.index === rowIndex);
    if (row) {
      setEditingCell({ row: rowIndex, field });
      setEditValue(String(row.data[field] || ''));
    }
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    
    setValidatedData(prev => {
      const updated = prev.map(row => {
        if (row.index === editingCell.row) {
          const newData = { ...row.data, [editingCell.field]: editValue };
          // Re-validate this row
          const revalidated = validateData([newData], selectedDataType)[0];
          return { ...revalidated, index: row.index };
        }
        return row;
      });
      return updated;
    });
    
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleDeleteRow = (rowIndex: number) => {
    setValidatedData(prev => prev.filter(row => row.index !== rowIndex));
  };

  const handleRevalidate = () => {
    const data = validatedData.map(r => r.data);
    const revalidated = validateData(data, selectedDataType);
    setValidatedData(revalidated);
    
    const errorCount = revalidated.filter(r => !r.isValid).length;
    if (errorCount > 0) {
      toast.warning(`Still ${errorCount} rows with errors`);
    } else {
      toast.success("All rows are now valid!");
    }
  };

  const handleImport = async () => {
    if (!selectedDataType || validatedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    const validRows = validatedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import. Please fix errors first.");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('data_imports')
        .insert({
          file_name: selectedFile?.name || 'manual_import',
          file_type: selectedFile?.name.split('.').pop() || 'unknown',
          data_type: selectedDataType,
          records_total: validatedData.length,
          status: 'processing'
        })
        .select()
        .single();

      if (importError) throw importError;

      let imported = 0;
      let failed = 0;

      const batchSize = 50;
      const dataToImport = validRows.map(r => r.data);
      
      for (let i = 0; i < dataToImport.length; i += batchSize) {
        const batch = dataToImport.slice(i, i + batchSize);
        
        try {
          let error: any = null;
          
          // Type-safe insert based on selected data type
          if (selectedDataType === 'stations') {
            const result = await supabase.from('stations').insert(batch as any[]);
            error = result.error;
          } else if (selectedDataType === 'block_sections') {
            const result = await supabase.from('block_sections').insert(batch as any[]);
            error = result.error;
          } else if (selectedDataType === 'signals') {
            const result = await supabase.from('signals').insert(batch as any[]);
            error = result.error;
          } else if (selectedDataType === 'speed_profiles') {
            const result = await supabase.from('speed_profiles').insert(batch as any[]);
            error = result.error;
          } else if (selectedDataType === 'schedules') {
            const result = await supabase.from('schedules').insert(batch as any[]);
            error = result.error;
          } else if (selectedDataType === 'historical_runs') {
            const result = await supabase.from('historical_runs').insert(batch as any[]);
            error = result.error;
          }

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

        setProgress(Math.round(((i + batch.length) / dataToImport.length) * 100));
      }

      await supabase
        .from('data_imports')
        .update({
          records_imported: imported,
          records_failed: failed + (validatedData.length - validRows.length),
          status: failed === 0 ? 'completed' : 'completed_with_errors',
          completed_at: new Date().toISOString()
        })
        .eq('id', importRecord.id);

      toast.success(`Import completed: ${imported} records imported, ${failed} failed`);
      loadImportHistory();
      
      // Reset state
      setValidatedData([]);
      setSelectedFile(null);
      setActiveTab("upload");
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
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

  useEffect(() => {
    loadImportHistory();
  }, []);

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

  const validCount = validatedData.filter(r => r.isValid).length;
  const errorCount = validatedData.filter(r => !r.isValid).length;
  const allFields = validatedData.length > 0 ? Object.keys(validatedData[0].data) : [];

  const getCellError = (row: ValidatedRow, field: string) => {
    return row.errors.find(e => e.field === field);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="upload" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-2" disabled={validatedData.length === 0}>
          <Eye className="h-4 w-4" />
          Preview & Validate
          {validatedData.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {validatedData.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2">
          <Database className="h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>

      {/* Upload Tab */}
      <TabsContent value="upload" className="space-y-4">
        <div className="grid gap-6 lg:grid-cols-2">
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
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    disabled={!selectedDataType}
                  />
                  <label htmlFor="file-upload" className={selectedDataType ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {!selectedDataType ? "Select data type first" : "Click to select or drag & drop"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">CSV, JSON, XML (Max 10MB)</p>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Expected Format
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDataType && VALIDATION_RULES[selectedDataType] ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Required fields marked with *</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(VALIDATION_RULES[selectedDataType]).map(([field, rule]) => (
                      <div key={field} className="text-xs bg-muted/50 px-2 py-1 rounded flex items-center justify-between">
                        <span className="font-mono">{field}{rule.required && '*'}</span>
                        {rule.type && <Badge variant="outline" className="text-[10px]">{rule.type}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a data type to see required fields</p>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Preview & Validate Tab */}
      <TabsContent value="preview" className="space-y-4">
        {/* Validation Summary */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Validation Preview
                {selectedFile && (
                  <Badge variant="secondary" className="ml-2">{selectedFile.name}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRevalidate}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Revalidate
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0}
                  size="sm"
                >
                  {importing ? "Importing..." : `Import ${validCount} Valid Rows`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">{validCount} valid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">{errorCount} with errors</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: {validatedData.length} rows
              </div>
            </div>

            {importing && (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Importing...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Data Table */}
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    {allFields.slice(0, 6).map(field => (
                      <TableHead key={field} className="font-mono text-xs">{field}</TableHead>
                    ))}
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedData.map((row) => (
                    <TableRow 
                      key={row.index} 
                      className={row.isValid ? "" : "bg-red-500/5"}
                    >
                      <TableCell className="text-muted-foreground">{row.index + 1}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-400">{row.errors.length}</span>
                          </div>
                        )}
                      </TableCell>
                      {allFields.slice(0, 6).map(field => {
                        const error = getCellError(row, field);
                        const isEditing = editingCell?.row === row.index && editingCell?.field === field;
                        
                        return (
                          <TableCell 
                            key={field}
                            className={error ? (error.severity === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10') : ''}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-7 text-xs w-24"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCellSave();
                                    if (e.key === 'Escape') handleCellCancel();
                                  }}
                                />
                                <Button size="icon" variant="ghost" aria-label="Save cell edit" className="h-6 w-6" onClick={handleCellSave}>
                                  <Check className="h-3 w-3 text-green-500" />
                                </Button>
                                <Button size="icon" variant="ghost" aria-label="Cancel cell edit" className="h-6 w-6" onClick={handleCellCancel}>
                                  <X className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group">
                                <span className="text-xs truncate max-w-[100px]" title={String(row.data[field] || '')}>
                                  {String(row.data[field] || '-')}
                                </span>
                                {error && (
                                  <span className="text-[10px] text-red-400" title={error.message}>⚠</span>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Edit cell"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleCellEdit(row.index, field)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete row"
                          className="h-6 w-6 text-red-400 hover:text-red-500"
                          onClick={() => handleDeleteRow(row.index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Error Summary */}
            {errorCount > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm font-medium text-red-400 mb-2">Validation Errors:</p>
                <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                  {validatedData
                    .filter(r => !r.isValid)
                    .slice(0, 10)
                    .flatMap(r => r.errors.map(e => (
                      <li key={`${r.index}-${e.field}`} className="flex items-center gap-2">
                        <span className="text-red-400">Row {r.index + 1}:</span>
                        <span>{e.message}</span>
                        <span className="text-muted-foreground/50">({e.value})</span>
                      </li>
                    )))}
                  {errorCount > 10 && (
                    <li className="text-muted-foreground">...and more errors</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history">
        <Card className="bg-card/50 backdrop-blur border-border/50">
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
      </TabsContent>
    </Tabs>
  );
};
