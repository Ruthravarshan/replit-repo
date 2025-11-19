import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats, ExtractionResult } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your PDF extractions</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Extractions",
      value: stats?.totalExtractions || 0,
      icon: FileText,
      color: "text-primary",
    },
    {
      title: "Successful",
      value: stats?.successfulExtractions || 0,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Failed",
      value: stats?.failedExtractions || 0,
      icon: XCircle,
      color: "text-destructive",
    },
    {
      title: "Processing",
      value: stats?.processingExtractions || 0,
      icon: Loader2,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your PDF extractions</p>
        </div>
        <Link href="/upload">
          <Button data-testid="button-new-extraction">New Extraction</Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} data-testid={`card-${kpi.title.toLowerCase().replace(' ', '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Success Rate */}
      {stats && stats.totalExtractions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Percentage of successful extractions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className="font-semibold">{stats.successRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Extractions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Extractions</CardTitle>
          <CardDescription>Your latest PDF processing activity</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats?.recentExtractions || stats.recentExtractions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No extractions yet</p>
              <p className="text-sm">Upload a PDF to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentExtractions.map((extraction: ExtractionResult) => (
                <div
                  key={extraction.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`extraction-${extraction.id}`}
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{extraction.filename}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(extraction.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      extraction.status === "completed"
                        ? "default"
                        : extraction.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                    data-testid={`badge-status-${extraction.id}`}
                  >
                    {extraction.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
