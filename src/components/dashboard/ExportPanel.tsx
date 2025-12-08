import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileJson, FileText, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrains } from '@/hooks/useRailwayData';
import { useAuditLogs } from '@/hooks/useAuditLog';
import { useMetricsHistory } from '@/hooks/useMetricsHistory';
import { 
  exportToCSV, 
  exportToJSON, 
  formatMetricsForExport, 
  formatAuditLogsForExport,
  formatTrainsForExport 
} from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type ExportFormat = 'csv' | 'json';
type DataType = 'trains' | 'metrics' | 'audit';

export const ExportPanel = () => {
  const [format_, setFormat] = useState<ExportFormat>('csv');
  const [selectedData, setSelectedData] = useState<DataType[]>(['trains']);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  
  const { trains } = useTrains();
  const { logs } = useAuditLogs(100);
  const { data: metrics } = useMetricsHistory(24);
  const { toast } = useToast();

  const dataOptions: { value: DataType; label: string; description: string }[] = [
    { value: 'trains', label: 'Train Data', description: 'Current train status and details' },
    { value: 'metrics', label: 'Performance Metrics', description: 'Last 24h throughput, delays, utilization' },
    { value: 'audit', label: 'Audit Logs', description: 'Controller actions and system events' },
  ];

  const toggleDataType = (type: DataType) => {
    setSelectedData(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  const handleExport = async () => {
    if (selectedData.length === 0) {
      toast({
        title: "Select Data",
        description: "Please select at least one data type to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExported(null);

    try {
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');

      for (const dataType of selectedData) {
        let data: any[] = [];
        let filename = '';

        switch (dataType) {
          case 'trains':
            data = formatTrainsForExport(trains);
            filename = `trains_${timestamp}`;
            break;
          case 'metrics':
            data = formatMetricsForExport(metrics);
            filename = `metrics_${timestamp}`;
            break;
          case 'audit':
            data = formatAuditLogsForExport(logs);
            filename = `audit_logs_${timestamp}`;
            break;
        }

        if (data.length > 0) {
          if (format_ === 'csv') {
            exportToCSV(data, filename);
          } else {
            exportToJSON(data, filename);
          }
        }
      }

      setExported(timestamp);
      toast({
        title: "Export Complete",
        description: `Successfully exported ${selectedData.length} file(s).`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Export Reports</h3>
      </div>

      {/* Data Selection */}
      <div className="space-y-3 mb-4">
        <label className="text-xs font-medium text-muted-foreground">Select Data to Export</label>
        {dataOptions.map((option) => (
          <div
            key={option.value}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedData.includes(option.value) 
                ? 'bg-primary/10 border-primary/30' 
                : 'bg-muted/30 border-border hover:border-muted-foreground/30'
            }`}
            onClick={() => toggleDataType(option.value)}
          >
            <Checkbox
              checked={selectedData.includes(option.value)}
              onCheckedChange={() => toggleDataType(option.value)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">{option.label}</p>
              <p className="text-[10px] text-muted-foreground">{option.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Format Selection */}
      <div className="space-y-2 mb-4">
        <label className="text-xs font-medium text-muted-foreground">Export Format</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFormat('csv')}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
              format_ === 'csv' 
                ? 'bg-primary/10 border-primary/30' 
                : 'bg-muted/30 border-border hover:border-muted-foreground/30'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <div className="text-left">
              <p className="text-xs font-medium">CSV</p>
              <p className="text-[10px] text-muted-foreground">Spreadsheet</p>
            </div>
          </button>
          <button
            onClick={() => setFormat('json')}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
              format_ === 'json' 
                ? 'bg-primary/10 border-primary/30' 
                : 'bg-muted/30 border-border hover:border-muted-foreground/30'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <div className="text-left">
              <p className="text-xs font-medium">JSON</p>
              <p className="text-[10px] text-muted-foreground">Data format</p>
            </div>
          </button>
        </div>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || selectedData.length === 0}
        className="w-full mt-auto"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : exported ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Exported
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export {selectedData.length} File{selectedData.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {exported && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Files downloaded to your device
        </p>
      )}
    </motion.div>
  );
};
