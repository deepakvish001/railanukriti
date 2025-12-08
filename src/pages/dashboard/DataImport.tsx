import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DataImportPanel } from "@/components/dashboard/DataImportPanel";

const DataImport = () => {
  return (
    <DashboardLayout title="Data Import">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Import railway data from CSV, Excel, JSON, or XML files
        </p>
        <DataImportPanel />
      </div>
    </DashboardLayout>
  );
};

export default DataImport;
