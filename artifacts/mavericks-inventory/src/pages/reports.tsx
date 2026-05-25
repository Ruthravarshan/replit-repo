import { useState } from "react";
import {
  useListStocks, useListDistributions, useListApprovals, useListAnomalies, useListActivity,
  useGetStockLedger,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart2, Download, Search, CheckCircle2, XCircle,
  Clock, Package, Truck, AlertTriangle, FileText, Users, BookOpen,
  BrainCircuit, Send, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { format, subDays, isAfter, differenceInHours } from "date-fns";
import { useRole } from "@/contexts/role-context";

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function HealthBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (score >= 70) return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-xs">Healthy</Badge>;
  if (score >= 40) return <Badge className="bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 text-xs">Warning</Badge>;
  return <Badge className="bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 text-xs">Critical</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    submitted: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    draft: "bg-secondary text-muted-foreground border-border",
    pending: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    active: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    acknowledged: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
    resolved: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  };
  return <Badge className={`border text-xs ${map[status.toLowerCase()] ?? ""}`}>{status}</Badge>;
}

const REPORTS = [
  { id: "stock-availability", label: "Current Stock Availability", icon: Package },
  { id: "distribution-history", label: "Stock Distribution History", icon: Truck },
  { id: "pending-approvals", label: "Pending Approvals", icon: Clock },
  { id: "approval-history", label: "Approval History", icon: CheckCircle2 },
  { id: "stock-ledger", label: "Stock Movement Ledger", icon: BookOpen },
  { id: "anomaly-history", label: "Anomaly History", icon: AlertTriangle },
  { id: "rejection-analysis", label: "Rejection Analysis", icon: XCircle },
  { id: "audit-activity", label: "User Activity Log", icon: Users },
] as const;

type ReportId = typeof REPORTS[number]["id"];

type AiMessage = { role: "user" | "assistant"; content: string; table?: { headers: string[]; rows: string[][] } };

const SUGGESTED_QUERIES = [
  "Top 5 most distributed items this month",
  "Which items are below minimum stock level?",
  "Show all pending approvals older than 48 hours",
  "What is the stock health overview?",
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportId>("stock-availability");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [selectedLedgerStockId, setSelectedLedgerStockId] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { data: stocks, isLoading: loadingStocks } = useListStocks();
  const { data: distributions, isLoading: loadingDists } = useListDistributions();
  const { data: approvals, isLoading: loadingApprovals } = useListApprovals({ status: "all" } as any);
  const { data: anomalies, isLoading: loadingAnomalies } = useListAnomalies({ all: "true" });
  const { data: activity, isLoading: loadingActivity } = useListActivity({ limit: 500 });
  const { data: ledgerEntries, isLoading: loadingLedger } = useGetStockLedger(
    selectedLedgerStockId ?? 0,
    { query: { enabled: !!selectedLedgerStockId } as any }
  );
  const { canAdmin } = useRole();

  const cutoff = subDays(new Date(), Number(dateRange));

  const isLoading = loadingStocks || loadingDists || loadingApprovals || loadingAnomalies || loadingActivity;

  // ── Report 1: Stock Availability ──────────────────────────────────────────
  const stockRows = (stocks ?? []).filter((s) =>
    !search || s.stockName.toLowerCase().includes(search.toLowerCase()) || s.stockCode.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100));

  // ── Report 2: Distribution History ───────────────────────────────────────
  const distRows = (distributions ?? []).filter((d) => {
    const inRange = isAfter(new Date(d.createdAt), cutoff);
    const statusOk = statusFilter === "all" || d.status === statusFilter;
    const searchOk = !search || d.stockName.toLowerCase().includes(search.toLowerCase()) || d.recipient.toLowerCase().includes(search.toLowerCase());
    return inRange && statusOk && searchOk;
  });

  // ── Report 3: Pending Approvals ───────────────────────────────────────────
  const pendingRows = (approvals ?? []).filter((a) => a.status === "pending");

  // ── Report 4: Approval History ────────────────────────────────────────────
  const approvalHistoryRows = (approvals ?? []).filter((a) => {
    const inRange = isAfter(new Date(a.createdAt), cutoff);
    const searchOk = !search || (a.distribution?.stockName ?? "").toLowerCase().includes(search.toLowerCase());
    const statusOk = statusFilter === "all" || a.status === statusFilter;
    return inRange && searchOk && statusOk;
  });

  // ── Report 5: Stock Movement Ledger ───────────────────────────────────────
  const ledgerRows = (() => {
    const entries = [...(ledgerEntries ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let runningBalance = 0;
    return entries.map((e) => {
      const isOut = e.type === "out" || e.type === "approved";
      if (e.type === "opening") runningBalance = e.quantity;
      else if (isOut) runningBalance -= e.quantity;
      else runningBalance += e.quantity;
      return { ...e, runningBalance, movementType: e.type === "opening" ? "OPENING" : isOut ? "OUT" : "IN" };
    }).filter((e) => isAfter(new Date(e.createdAt), cutoff));
  })();

  // ── Report 6: Anomaly History ─────────────────────────────────────────────
  const anomalyRows = (anomalies ?? []).filter((a) => {
    const inRange = isAfter(new Date(a.detectedAt), cutoff);
    const statusOk = statusFilter === "all" || a.status === statusFilter;
    const searchOk = !search || a.stockName.toLowerCase().includes(search.toLowerCase()) || a.type.toLowerCase().includes(search.toLowerCase());
    return inRange && statusOk && searchOk;
  }).sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  // ── Report 7: Rejection Analysis ─────────────────────────────────────────
  const rejectedRows = (approvals ?? []).filter((a) => {
    const inRange = isAfter(new Date(a.createdAt), cutoff);
    const searchOk = !search || (a.distribution?.stockName ?? "").toLowerCase().includes(search.toLowerCase());
    return inRange && searchOk && (a.distribution?.status === "rejected" || a.status === "rejected");
  });

  // ── Report 8: User Activity Log ───────────────────────────────────────────
  const activityRows = (activity ?? []).filter((a) => {
    const inRange = isAfter(new Date(a.timestamp), cutoff);
    const searchOk = !search || a.description.toLowerCase().includes(search.toLowerCase()) || (a.actor ?? "").toLowerCase().includes(search.toLowerCase());
    return inRange && searchOk;
  });

  const handleExport = () => {
    const ts = format(new Date(), "yyyyMMdd_HHmm");
    switch (activeReport) {
      case "stock-availability":
        downloadCSV(`stock-availability_${ts}.csv`, stockRows.map((s) => [
          s.stockCode, s.stockName, s.category, String(s.openingQuantity), String(s.availableQuantity),
          String(s.minStockLevel ?? ""), s.unitOfMeasure, s.location ?? "", s.status,
        ]), ["Stock Code", "Name", "Category", "Opening Qty", "Available Qty", "Min Level", "Unit", "Location", "Status"]);
        break;
      case "distribution-history":
        downloadCSV(`distribution-history_${ts}.csv`, distRows.map((d) => [
          String(d.id), d.stockCode ?? "", d.stockName, String(d.quantityDistributed),
          d.distributionDate, d.recipient, d.purpose ?? "", d.status, d.submittedAt ?? "", d.approvedAt ?? "",
        ]), ["ID", "Stock Code", "Item", "Qty", "Date", "Recipient", "Purpose", "Status", "Submitted", "Approved"]);
        break;
      case "pending-approvals":
        downloadCSV(`pending-approvals_${ts}.csv`, pendingRows.map((a) => [
          String(a.distributionId), a.distribution?.stockCode ?? "", a.distribution?.stockName ?? "",
          String(a.distribution?.quantityDistributed ?? ""), a.distribution?.recipient ?? "", a.createdAt,
          a.aiRecommendation?.riskLevel ?? "",
        ]), ["Dist ID", "Stock Code", "Item", "Qty", "Recipient", "Submitted At", "AI Risk"]);
        break;
      case "stock-ledger":
        downloadCSV(`stock-ledger_${ts}.csv`, ledgerRows.map((e) => [
          format(new Date(e.createdAt), "dd MMM yyyy HH:mm"), e.movementType,
          String(e.quantity), String(e.runningBalance), e.type, e.description, e.createdBy ?? "",
        ]), ["Date/Time", "Movement", "Qty", "Running Balance", "Source", "Description", "Performed By"]);
        break;
      case "anomaly-history":
        downloadCSV(`anomaly-history_${ts}.csv`, anomalyRows.map((a) => [
          String(a.id), a.detectedAt, a.stockCode, a.stockName, a.type, a.severity,
          a.status, a.acknowledgedBy ?? "", a.resolvedAt ?? "", a.resolutionNotes ?? "",
        ]), ["ID", "Detected", "Stock Code", "Item", "Type", "Severity", "Status", "Ack By", "Resolved", "Notes"]);
        break;
      case "rejection-analysis":
        downloadCSV(`rejection-analysis_${ts}.csv`, rejectedRows.map((a) => [
          String(a.distributionId), a.distribution?.stockCode ?? "", String(a.distribution?.quantityDistributed ?? ""),
          a.distribution?.recipient ?? "", a.approvedBy ?? "", a.approvedAt ?? "", a.remarks ?? "",
        ]), ["Dist ID", "Stock Code", "Qty", "Recipient", "Rejected By", "Date", "Remarks"]);
        break;
      case "audit-activity":
        downloadCSV(`user-activity_${ts}.csv`, activityRows.map((a) => [
          a.timestamp, a.actor ?? "", a.type, a.description, a.stockCode ?? "",
        ]), ["Timestamp", "Actor", "Action Type", "Description", "Stock Code"]);
        break;
      default:
        break;
    }
  };

  const handleAiQuery = async (q: string) => {
    if (!q.trim()) return;
    const query = q.trim();
    setAiQuery("");
    setAiMessages((prev) => [...prev, { role: "user", content: query }]);
    setAiLoading(true);
    try {
      const res = await fetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiMessages((prev) => [...prev, {
          role: "assistant",
          content: data.response ?? data.message ?? "Query processed.",
          table: data.table,
        }]);
      } else {
        setAiMessages((prev) => [...prev, { role: "assistant", content: "AI query service temporarily unavailable. Use the standard reports above." }]);
      }
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", content: "AI query service temporarily unavailable. Use the standard reports above." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const activeConfig = REPORTS.find((r) => r.id === activeReport)!;

  const showDateFilter = ["distribution-history", "approval-history", "anomaly-history", "rejection-analysis", "audit-activity", "stock-ledger"].includes(activeReport);
  const showStatusFilter = ["distribution-history", "approval-history", "anomaly-history"].includes(activeReport);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left report selector */}
      <aside className="w-56 shrink-0 border-r border-border bg-card/50 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-2">Standard Reports</p>
        {REPORTS.map(({ id, label, icon: Icon }) => (
          (!canAdmin && id === "audit-activity") ? null : (
            <button
              key={id}
              onClick={() => { setActiveReport(id as ReportId); setSearch(""); setStatusFilter("all"); }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left ${
                activeReport === id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight">{label}</span>
            </button>
          )
        ))}

        <div className="pt-3 border-t border-border mt-3">
          <button
            onClick={() => setAiOpen(!aiOpen)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left ${
              aiOpen ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight">Ask AI</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4 max-w-5xl">
          {!aiOpen && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <activeConfig.icon className="w-5 h-5 text-primary" />
                    {activeConfig.label}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">Generated {format(new Date(), "dd MMM yyyy, HH:mm")}</p>
                </div>
                <Button variant="outline" onClick={handleExport} className="gap-2" disabled={activeReport === "stock-ledger" && !selectedLedgerStockId}>
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>

              {/* Stock Ledger item selector */}
              {activeReport === "stock-ledger" && (
                <div className="flex items-center gap-3 bg-secondary/30 border border-border rounded-lg p-3">
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Select stock item:</span>
                  <Select value={selectedLedgerStockId?.toString() ?? ""} onValueChange={(v) => setSelectedLedgerStockId(v ? Number(v) : null)}>
                    <SelectTrigger className="flex-1 max-w-80 h-9 bg-card">
                      <SelectValue placeholder="Choose a stock item to view ledger..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(stocks ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.stockCode} — {s.stockName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                {showDateFilter && (
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-36 h-9 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="365">Last 365 days</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {showStatusFilter && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-9 bg-card">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {activeReport === "distribution-history" && <>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </>}
                      {activeReport === "approval-history" && <>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </>}
                      {activeReport === "anomaly-history" && <>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </>}
                    </SelectContent>
                  </Select>
                )}
                {activeReport !== "stock-ledger" && (
                  <div className="relative flex-1 max-w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9 bg-card"
                    />
                  </div>
                )}
              </div>

              {/* ── Report Tables ── */}
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                  {/* Report 1: Stock Availability */}
                  {activeReport === "stock-availability" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>Stock Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Opening</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="text-right">Min Level</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Health</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockRows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow> :
                          stockRows.map((s) => (
                            <TableRow key={s.id} className="hover:bg-secondary/20">
                              <TableCell className="font-mono text-xs">{s.stockCode}</TableCell>
                              <TableCell className="font-medium">{s.stockName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.category}</TableCell>
                              <TableCell className="text-right font-mono">{s.openingQuantity}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{s.availableQuantity}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{s.minStockLevel ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.location ?? "—"}</TableCell>
                              <TableCell><HealthBadge score={s.healthScore} /></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 2: Distribution History */}
                  {activeReport === "distribution-history" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>TXN ID</TableHead>
                          <TableHead>Stock Code</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Purpose</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distRows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No data for selected filters</TableCell></TableRow> :
                          [...distRows].reverse().map((d) => (
                            <TableRow key={d.id} className="hover:bg-secondary/20">
                              <TableCell className="font-mono text-xs text-muted-foreground">#{d.id}</TableCell>
                              <TableCell className="font-mono text-xs">{d.stockCode ?? "—"}</TableCell>
                              <TableCell className="font-medium text-sm">{d.stockName}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{d.quantityDistributed}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{format(new Date(d.distributionDate), "dd MMM yyyy")}</TableCell>
                              <TableCell className="text-sm">{d.recipient}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-32 truncate">{d.purpose ?? "—"}</TableCell>
                              <TableCell><StatusBadge status={d.status} /></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 3: Pending Approvals */}
                  {activeReport === "pending-approvals" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>TXN ID</TableHead>
                          <TableHead>Stock Code</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Days Pending</TableHead>
                          <TableHead>AI Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No pending approvals</TableCell></TableRow> :
                          pendingRows.map((a) => {
                            const daysPending = Math.floor(differenceInHours(new Date(), new Date(a.createdAt)) / 24);
                            return (
                              <TableRow key={a.id} className="hover:bg-secondary/20">
                                <TableCell className="font-mono text-xs text-muted-foreground">#{a.distributionId}</TableCell>
                                <TableCell className="font-mono text-xs">{a.distribution?.stockCode ?? "—"}</TableCell>
                                <TableCell className="font-medium text-sm">{a.distribution?.stockName ?? "—"}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{a.distribution?.quantityDistributed ?? "—"}</TableCell>
                                <TableCell className="text-sm">{a.distribution?.recipient ?? "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.createdAt ? format(new Date(a.createdAt), "dd MMM, HH:mm") : "—"}</TableCell>
                                <TableCell>
                                  <Badge className={`text-xs border ${daysPending >= 2 ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" : "bg-secondary text-muted-foreground border-border"}`}>
                                    {daysPending}d
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {a.aiRecommendation ? (
                                    <Badge className={`border text-xs ${a.aiRecommendation.riskLevel === "high" ? "bg-red-100 text-red-700 border-red-200" : a.aiRecommendation.riskLevel === "medium" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                                      {a.aiRecommendation.riskLevel} — {a.aiRecommendation.riskScore}
                                    </Badge>
                                  ) : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 4: Approval History */}
                  {activeReport === "approval-history" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>TXN ID</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Reviewed By</TableHead>
                          <TableHead>Review Date</TableHead>
                          <TableHead>Decision</TableHead>
                          <TableHead>Turnaround</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvalHistoryRows.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow> :
                          [...approvalHistoryRows].reverse().map((a) => {
                            const turnaroundHours = a.approvedAt && a.createdAt
                              ? Math.round(differenceInHours(new Date(a.approvedAt), new Date(a.createdAt)))
                              : null;
                            return (
                              <TableRow key={a.id} className="hover:bg-secondary/20">
                                <TableCell className="font-mono text-xs text-muted-foreground">#{a.distributionId}</TableCell>
                                <TableCell className="font-medium text-sm">{a.distribution?.stockName ?? "—"}</TableCell>
                                <TableCell className="text-right font-mono">{a.distribution?.quantityDistributed ?? "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.createdAt ? format(new Date(a.createdAt), "dd MMM") : "—"}</TableCell>
                                <TableCell className="text-sm">{a.approvedBy ?? "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.approvedAt ? format(new Date(a.approvedAt), "dd MMM") : "—"}</TableCell>
                                <TableCell><StatusBadge status={a.status} /></TableCell>
                                <TableCell className="text-sm text-muted-foreground">{turnaroundHours != null ? `${turnaroundHours}h` : "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-32 truncate">{a.remarks ?? "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 5: Stock Movement Ledger */}
                  {activeReport === "stock-ledger" && (
                    !selectedLedgerStockId ? (
                      <div className="p-12 text-center text-muted-foreground">
                        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">Select a stock item above to view its movement ledger</p>
                        <p className="text-xs mt-1 opacity-70">The ledger shows every IN/OUT movement and running balance for the selected item</p>
                      </div>
                    ) : loadingLedger ? (
                      <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-secondary/50">
                          <TableRow>
                            <TableHead>Date / Time</TableHead>
                            <TableHead>Movement</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Running Balance</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Performed By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerRows.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No ledger entries in this period</TableCell></TableRow>
                          ) : (
                            [...ledgerRows].reverse().map((e) => (
                              <TableRow key={e.id} className="hover:bg-secondary/20">
                                <TableCell className="text-sm text-muted-foreground">{format(new Date(e.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                                <TableCell>
                                  <Badge className={`text-xs border ${e.movementType === "OUT" ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" : e.movementType === "OPENING" ? "bg-secondary text-muted-foreground border-border" : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"}`}>
                                    {e.movementType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">{e.quantity}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-primary">{e.runningBalance}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs font-mono">{e.type}</Badge></TableCell>
                                <TableCell className="text-sm">{e.description}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{e.createdBy ?? "System"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )
                  )}

                  {/* Report 6: Anomaly History */}
                  {activeReport === "anomaly-history" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Detected</TableHead>
                          <TableHead>Stock Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>AI Explanation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ack By</TableHead>
                          <TableHead>Resolution Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anomalyRows.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No anomalies found</TableCell></TableRow> :
                          anomalyRows.map((a) => (
                            <TableRow key={a.id} className="hover:bg-secondary/20">
                              <TableCell className="font-mono text-xs text-muted-foreground">#{a.id}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{format(new Date(a.detectedAt), "dd MMM yyyy")}</TableCell>
                              <TableCell className="font-mono text-xs">{a.stockCode}</TableCell>
                              <TableCell className="text-sm">{a.type}</TableCell>
                              <TableCell>
                                <Badge className={`border text-xs ${a.severity === "critical" ? "bg-red-100 text-red-700 border-red-200" : a.severity === "high" ? "bg-orange-100 text-orange-700 border-orange-200" : a.severity === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                                  {a.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-40 truncate">{(a as any).explanation ?? "—"}</TableCell>
                              <TableCell><StatusBadge status={a.status} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground">{a.acknowledgedBy ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-36 truncate">{a.resolutionNotes ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 7: Rejection Analysis */}
                  {activeReport === "rejection-analysis" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>TXN ID</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Rejected By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Rejection Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rejectedRows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No rejections found</TableCell></TableRow> :
                          rejectedRows.map((a) => (
                            <TableRow key={a.id} className="hover:bg-secondary/20">
                              <TableCell className="font-mono text-xs text-muted-foreground">#{a.distributionId}</TableCell>
                              <TableCell className="font-medium text-sm">{a.distribution?.stockName ?? "—"}</TableCell>
                              <TableCell className="text-right font-mono">{a.distribution?.quantityDistributed ?? "—"}</TableCell>
                              <TableCell className="text-sm">{a.distribution?.recipient ?? "—"}</TableCell>
                              <TableCell className="text-sm">{a.approvedBy ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{a.approvedAt ? format(new Date(a.approvedAt), "dd MMM yyyy") : "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-40">{a.remarks ?? "No remarks"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Report 8: User Activity Log */}
                  {activeReport === "audit-activity" && (
                    <Table>
                      <TableHeader className="bg-secondary/50">
                        <TableRow>
                          <TableHead>Date / Time</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Action Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Stock Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityRows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No activity in range</TableCell></TableRow> :
                          activityRows.map((a) => (
                            <TableRow key={a.id} className="hover:bg-secondary/20">
                              <TableCell className="text-sm text-muted-foreground">{format(new Date(a.timestamp), "dd MMM yyyy, HH:mm")}</TableCell>
                              <TableCell className="text-sm font-medium">{a.actor ?? "System"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{(a as any).role ?? "—"}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs font-mono">{a.type}</Badge></TableCell>
                              <TableCell className="text-sm">{a.description}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{a.stockCode ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Conversational AI Query Section ── */}
          {aiOpen && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Ask Inventory AI</h1>
                  <p className="text-sm text-muted-foreground">Natural language queries — powered by AI Agent 4</p>
                </div>
              </div>

              {/* Suggested queries */}
              {aiMessages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Queries</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUERIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleAiQuery(q)}
                        className="px-3 py-1.5 text-sm bg-secondary/60 border border-border rounded-full hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message history */}
              {aiMessages.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                      }`}>
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-primary">
                            <BrainCircuit className="w-3.5 h-3.5" />
                            AI Agent
                          </div>
                        )}
                        <p className="leading-relaxed">{msg.content}</p>
                        {msg.table && (
                          <div className="mt-3 border border-border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader className="bg-secondary/50">
                                <TableRow>
                                  {msg.table.headers.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {msg.table.rows.map((row, ri) => (
                                  <TableRow key={ri}>
                                    {row.map((cell, ci) => <TableCell key={ci} className="text-xs">{cell}</TableCell>)}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        Analyzing inventory data...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 items-end">
                <Textarea
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder='Ask anything about your inventory — e.g. "Which items are critically low?" or "Top 5 distributed items this month"'
                  rows={2}
                  className="resize-none bg-card"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiQuery(aiQuery); }
                  }}
                />
                <Button onClick={() => handleAiQuery(aiQuery)} disabled={!aiQuery.trim() || aiLoading} className="shrink-0 h-[72px] px-4">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Read-only queries only. Results are based on live inventory data.</p>

              {aiMessages.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAiMessages([])}>Clear Chat</Button>
                  <Button variant="outline" size="sm" onClick={() => setAiOpen(false)}>
                    <ArrowRight className="w-3.5 h-3.5 mr-1.5" /> Back to Reports
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
