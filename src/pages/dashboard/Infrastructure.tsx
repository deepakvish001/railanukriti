import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, FlaskConical, Pencil, Brain } from "lucide-react";
import { ThroughputCalculator } from "@/components/dashboard/ThroughputCalculator";
import { InfrastructureSimulator } from "@/components/dashboard/InfrastructureSimulator";
import { VisualTrackEditor } from "@/components/dashboard/VisualTrackEditor";

const Infrastructure = () => {
  return (
    <DashboardLayout title="Infrastructure Management">
      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" />
            Throughput Calculator
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Infrastructure Simulator
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Pencil className="h-4 w-4" />
            Track Editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator">
          <ThroughputCalculator />
        </TabsContent>

        <TabsContent value="simulator">
          <InfrastructureSimulator />
        </TabsContent>

        <TabsContent value="editor">
          <VisualTrackEditor />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Infrastructure;
