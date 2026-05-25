import { useState } from "react";
import { useListAnomalies, useAcknowledgeAnomaly, useResolveAnomaly, useDismissAnomaly, getListAnomaliesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/contexts/role-context";
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Info, Filter, CheckCircle2,
  RefreshCw, FileText, Eye, XCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AnomalyStatus = "all" | "active" | "acknowledged" | "resolved";

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity.toLowerCase()) {
    case "critical":
      return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 border"><ShieldAlert className="w-3 h-3 mr-1" />Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800 border"><AlertTriangle className="w-3 h-3 mr-1" />High</Badge>;
    case "medium":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 border"><AlertTriangle className="w-3 h-3 mr-1" />Medium</Badge>;
    default:
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 border"><Info className="w-3 h-3 mr-1" />Low</Badge>;
  }
}

function StatusChip({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Active</span>;
    case "acknowledged":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Acknowledged</span>;
    case "resolved":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Resolved</span>;
    default:
      return <span className="text-xs text-muted-foreground">{status}</span>;
  }
}

export default function AnomaliesPage() {
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus>("active");
  const [acknowledgeId, setAcknowledgeId] = useState<number | null>(null);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [working, setWorking] = useState<number | null>(null);

  const params = statusFilter === "all" ? { all: "true" } : { status: statusFilter };
  const { data: anomalies, isLoading } = useListAnomalies(params);
  const acknowledgeAnomaly = useAcknowledgeAnomaly();
  const resolveAnomaly = useResolveAnomaly();
  const dismissAnomaly = useDismissAnomaly();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, canCheck } = useRole();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
  };

  const handleAcknowledge = (id: number) => {
    setWorking(id);
    acknowledgeAnomaly.mutate({ id, data: { acknowledgedBy: currentUser.name } }, {
      onSuccess: () => {
        toast({ title: "Anomaly acknowledged", description: "You have acknowledged this alert. Please resolve it with notes when addressed." });
        invalidate();
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
      onSettled: () => { setWorking(null); setAcknowledgeId(null); },
    });
  };

  const handleResolve = (id: number) => {
    if (resolveNotes.trim().length < 10) {
      toast({ title: "Notes required", description: "Resolution notes must be at least 10 characters.", variant: "destructive" });
      return;
    }
    setWorking(id);
    resolveAnomaly.mutate({ id, data: { notes: resolveNotes, resolvedBy: currentUser.name } }, {
      onSuccess: () => {
        toast({ title: "Anomaly resolved", description: "Resolution recorded in the audit trail." });
        setResolveNotes("");
        invalidate();
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
      onSettled: () => { setWorking(null); setResolveId(null); },
    });
  };

  const sorted = [...(anomalies ?? [])].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity.toLowerCase()] ?? 4) - (order[b.severity.toLowerCase()] ?? 4);
  });

  const counts = {
    active: anomalies?.filter((a) => a.status === "active").length ?? 0,
    acknowledged: anomalies?.filter((a) => a.status === "acknowledged").length ?? 0,
    resolved: anomalies?.filter((a) => a.status === "resolved").length ?? 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Anomaly Detection</h1>
          <p className="text-muted-foreground mt-1">AI-monitored stock anomalies — acknowledge and resolve alerts to maintain audit compliance.</p>
        </div>
      </div>

      {/* Summary strips */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setStatusFilter("active")}
          className={`p-4 rounded-xl border text-left transition-all ${statusFilter === "active" ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : "border-border bg-card hover:bg-secondary/30"}`}
        >
          <p className="text-2xl font-bold text-red-600">{counts.active}</p>
          <p className="text-sm text-muted-foreground">Active Alerts</p>
        </button>
        <button
          onClick={() => setStatusFilter("acknowledged")}
          className={`p-4 rounded-xl border text-left transition-all ${statusFilter === "acknowledged" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" : "border-border bg-card hover:bg-secondary/30"}`}
        >
          <p className="text-2xl font-bold text-amber-600">{counts.acknowledged}</p>
          <p className="text-sm text-muted-foreground">Acknowledged</p>
        </button>
        <button
          onClick={() => setStatusFilter("resolved")}
          className={`p-4 rounded-xl border text-left transition-all ${statusFilter === "resolved" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-border bg-card hover:bg-secondary/30"}`}
        >
          <p className="text-2xl font-bold text-emerald-600">{counts.resolved}</p>
          <p className="text-sm text-muted-foreground">Resolved</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AnomalyStatus)}>
          <SelectTrigger className="w-40 bg-card h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{sorted.length} anomal{sorted.length !== 1 ? "ies" : "y"}</span>
      </div>

      {/* Anomaly cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-5 bg-card">
              <Skeleton className="h-4 w-1/3 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className="border border-border rounded-xl p-12 bg-card text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold">No anomalies found</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter === "active" ? "All stock movements are within expected parameters." : `No ${statusFilter} anomalies to display.`}
            </p>
          </div>
        ) : (
          sorted.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`border rounded-xl p-5 bg-card space-y-3 transition-all ${
                anomaly.status === "active" && anomaly.severity.toLowerCase() === "critical"
                  ? "border-red-300 dark:border-red-800 shadow-sm"
                  : anomaly.status === "acknowledged"
                  ? "border-amber-200 dark:border-amber-800"
                  : anomaly.status === "resolved"
                  ? "border-border opacity-70"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <SeverityBadge severity={anomaly.severity} />
                  <StatusChip status={anomaly.status} />
                  <span className="text-xs text-muted-foreground font-mono">{anomaly.type}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  Detected {format(new Date(anomaly.detectedAt), "dd MMM yyyy, HH:mm")}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{anomaly.stockName}</span>
                  <span className="text-xs font-mono text-muted-foreground">{anomaly.stockCode}</span>
                </div>
                <p className="text-sm text-foreground">{anomaly.description}</p>
              </div>

              {anomaly.explanation && (
                <div className="bg-secondary/30 border border-border/60 rounded-lg p-3 text-sm text-muted-foreground">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Explanation</span>
                  <p className="mt-1">{anomaly.explanation}</p>
                </div>
              )}

              {/* Acknowledgement info */}
              {anomaly.acknowledgedBy && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  Acknowledged by <span className="font-medium">{anomaly.acknowledgedBy}</span>
                  {anomaly.acknowledgedAt && <> on {format(new Date(anomaly.acknowledgedAt), "dd MMM yyyy, HH:mm")}</>}
                </div>
              )}

              {/* Resolution info */}
              {anomaly.resolutionNotes && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium text-xs mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    Resolution Notes
                    {anomaly.resolvedBy && <span className="text-muted-foreground font-normal">— by {anomaly.resolvedBy}</span>}
                    {anomaly.resolvedAt && <span className="text-muted-foreground font-normal">{format(new Date(anomaly.resolvedAt), "dd MMM yyyy")}</span>}
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300">{anomaly.resolutionNotes}</p>
                </div>
              )}

              {/* Actions */}
              {canCheck && anomaly.status !== "resolved" && (
                <div className="flex items-center gap-2 pt-1">
                  {anomaly.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={() => setAcknowledgeId(anomaly.id)}
                      disabled={working === anomaly.id}
                    >
                      {working === anomaly.id ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                      Acknowledge
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => { setResolveId(anomaly.id); setResolveNotes(""); }}
                    disabled={working === anomaly.id}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Resolve with Notes
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Acknowledge confirm dialog */}
      <Dialog open={acknowledgeId !== null} onOpenChange={(o) => !o && setAcknowledgeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Anomaly</DialogTitle>
            <DialogDescription>
              Acknowledging this alert confirms you are aware of it and are investigating. You must resolve it with notes when the issue is addressed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeId(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => acknowledgeId && handleAcknowledge(acknowledgeId)}
              disabled={acknowledgeAnomaly.isPending}
            >
              {acknowledgeAnomaly.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Acknowledge Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={resolveId !== null} onOpenChange={(o) => { if (!o) { setResolveId(null); setResolveNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Anomaly</DialogTitle>
            <DialogDescription>
              Provide mandatory resolution notes explaining how this anomaly was addressed. This will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Describe the corrective action taken, root cause identified, and how the issue was resolved (min 10 characters)..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className="min-h-[100px] resize-none bg-secondary/20"
            />
            <p className={`text-xs ${resolveNotes.trim().length < 10 ? "text-muted-foreground" : "text-emerald-600"}`}>
              {resolveNotes.trim().length} / 10 characters minimum
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveId(null); setResolveNotes(""); }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => resolveId && handleResolve(resolveId)}
              disabled={resolveAnomaly.isPending || resolveNotes.trim().length < 10}
            >
              {resolveAnomaly.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Resolve Anomaly
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
