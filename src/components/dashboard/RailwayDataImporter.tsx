import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Database,
  Train,
  MapPin,
  Route
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  importRouteStations,
  importInfrastructure,
  importPassengerSchedule,
  importFreightData,
  ImportResult,
} from '@/lib/dataImportUtils';

interface ImportJob {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fileName: string;
  status: 'idle' | 'importing' | 'success' | 'error';
  result?: ImportResult;
  importFn: (file: File) => Promise<ImportResult>;
}

export function RailwayDataImporter() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ImportJob[]>([
    {
      id: 'route',
      name: 'Route Stations',
      description: 'Import KTV-PSA route station information',
      icon: <MapPin className="h-5 w-5" />,
      fileName: 'RouteSttnInfo.xlsx',
      status: 'idle',
      importFn: importRouteStations,
    },
    {
      id: 'infra',
      name: 'Infrastructure',
      description: 'Import stations, lines, and block sections',
      icon: <Route className="h-5 w-5" />,
      fileName: 'KTV-PSA-Infra.xlsx',
      status: 'idle',
      importFn: importInfrastructure,
    },
    {
      id: 'passenger',
      name: 'Passenger Schedule',
      description: 'Import passenger train schedules',
      icon: <Train className="h-5 w-5" />,
      fileName: 'KTV_PSA_Passenger_Schedule.xlsx',
      status: 'idle',
      importFn: importPassengerSchedule,
    },
    {
      id: 'freight',
      name: 'Freight Trains',
      description: 'Import freight train movement data',
      icon: <Database className="h-5 w-5" />,
      fileName: 'WAT_GOODS_TRAIN_AUG25.csv',
      status: 'idle',
      importFn: importFreightData,
    },
  ]);

  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = async (jobId: string, file: File) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, status: 'importing' as const } : j
    ));

    try {
      const result = await job.importFn(file);
      
      setJobs(prev => prev.map(j => 
        j.id === jobId ? { 
          ...j, 
          status: result.success ? 'success' as const : 'error' as const,
          result 
        } : j
      ));

      toast({
        title: result.success ? 'Import Successful' : 'Import Completed with Errors',
        description: `${result.recordsImported} records imported, ${result.recordsFailed} failed`,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      setJobs(prev => prev.map(j => 
        j.id === jobId ? { 
          ...j, 
          status: 'error' as const,
          result: { success: false, recordsImported: 0, recordsFailed: 0, errors: [error.message] }
        } : j
      ));

      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleImportFromPublic = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, status: 'importing' as const } : j
    ));

    try {
      const response = await fetch(`/data/${job.fileName}`);
      if (!response.ok) throw new Error(`File not found: ${job.fileName}`);
      
      const blob = await response.blob();
      const file = new File([blob], job.fileName);
      
      const result = await job.importFn(file);
      
      setJobs(prev => prev.map(j => 
        j.id === jobId ? { 
          ...j, 
          status: result.success ? 'success' as const : 'error' as const,
          result 
        } : j
      ));

      toast({
        title: result.success ? 'Import Successful' : 'Import Completed with Errors',
        description: `${result.recordsImported} records imported, ${result.recordsFailed} failed`,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      setJobs(prev => prev.map(j => 
        j.id === jobId ? { 
          ...j, 
          status: 'error' as const,
          result: { success: false, recordsImported: 0, recordsFailed: 0, errors: [error.message] }
        } : j
      ));

      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const importAll = async () => {
    setIsImporting(true);
    
    for (const job of jobs) {
      await handleImportFromPublic(job.id);
    }
    
    setIsImporting(false);
    
    toast({
      title: 'All Imports Complete',
      description: 'Railway data has been imported to the database.',
    });
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'importing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Railway Data Import
          </CardTitle>
          <Button 
            onClick={importAll} 
            disabled={isImporting}
            className="gap-2"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import All Data
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Import railway infrastructure, schedules, and freight data from the uploaded files.
            The data will be stored in the database for analysis and visualization.
          </p>

          <div className="grid gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-muted rounded-lg">
                    {job.icon}
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {job.name}
                      {getStatusIcon(job.status)}
                    </h4>
                    <p className="text-sm text-muted-foreground">{job.description}</p>
                    <p className="text-xs font-mono text-muted-foreground">{job.fileName}</p>
                    {job.result && (
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-green-600">
                          {job.result.recordsImported} imported
                        </Badge>
                        {job.result.recordsFailed > 0 && (
                          <Badge variant="destructive">
                            {job.result.recordsFailed} failed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImportFromPublic(job.id)}
                    disabled={job.status === 'importing'}
                  >
                    {job.status === 'importing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Import'
                    )}
                  </Button>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept={job.fileName.endsWith('.csv') ? '.csv' : '.xlsx,.xls'}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(job.id, e.target.files[0]);
                        }
                      }}
                      disabled={job.status === 'importing'}
                    />
                    <Button size="sm" variant="ghost" asChild>
                      <span>
                        <FileText className="h-4 w-4" />
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
