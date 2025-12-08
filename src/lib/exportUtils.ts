import { format } from 'date-fns';

// Export data to CSV
export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

// Export data to JSON
export const exportToJSON = (data: any, filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

// Download file helper
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format metrics for export
export const formatMetricsForExport = (metrics: any[]) => {
  return metrics.map(m => ({
    timestamp: format(new Date(m.timestamp), 'yyyy-MM-dd HH:mm:ss'),
    throughput: m.throughput,
    average_delay: m.averageDelay,
    utilization: m.utilization,
    on_time_performance: m.onTimePerformance,
    active_trains: m.activeTrains,
    pending_conflicts: m.pendingConflicts,
  }));
};

// Format audit logs for export
export const formatAuditLogsForExport = (logs: any[]) => {
  return logs.map(log => ({
    timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
    action: log.action_type,
    entity: log.entity_type,
    entity_id: log.entity_id || '',
    description: log.description,
    user: log.user_id,
  }));
};

// Format trains for export
export const formatTrainsForExport = (trains: any[]) => {
  return trains.map(train => ({
    number: train.number,
    name: train.name,
    type: train.type,
    status: train.status,
    priority: train.priority,
    origin: train.origin,
    destination: train.destination,
    scheduled_time: train.scheduledTime,
    actual_time: train.actualTime || '',
    delay: train.delay,
    speed: train.speed,
    current_section: train.currentSection,
    next_station: train.nextStation || '',
  }));
};

// Generate PDF report (uses print functionality)
export const generatePDFReport = (title: string, content: HTMLElement | null) => {
  if (!content) return;
  
  const printWindow = window.open('', '', 'height=600,width=800');
  if (!printWindow) return;
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Railway Control Report</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          color: #1a1a1a;
          line-height: 1.6;
        }
        h1 { 
          color: #0066cc;
          border-bottom: 2px solid #0066cc;
          padding-bottom: 10px;
        }
        h2 { color: #333; margin-top: 30px; }
        table { 
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td { 
          border: 1px solid #ddd;
          padding: 12px 8px;
          text-align: left;
        }
        th { background-color: #f5f5f5; font-weight: 600; }
        tr:nth-child(even) { background-color: #fafafa; }
        .header { 
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .timestamp { 
          color: #666;
          font-size: 12px;
        }
        .metric-card {
          display: inline-block;
          padding: 15px;
          margin: 10px 10px 10px 0;
          background: #f5f5f5;
          border-radius: 8px;
          min-width: 120px;
        }
        .metric-value { font-size: 24px; font-weight: bold; color: #0066cc; }
        .metric-label { font-size: 12px; color: #666; }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <span class="timestamp">Generated: ${format(new Date(), 'PPpp')}</span>
      </div>
      ${content.innerHTML}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};
