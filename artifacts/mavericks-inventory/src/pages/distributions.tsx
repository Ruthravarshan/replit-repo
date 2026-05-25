import { useState } from "react";
import {
  useListDistributions, useGetDistribution, useListApprovals,
  useDeleteDistribution, useSubmitDistribution,
  getListDistributionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import {
  Plus, Clock, CheckCircle2, XCircle, FileBox, Send, Trash2, Filter,
  RefreshCw, Search, ExternalLink, ChevronRight, ShieldCheck, BrainCircuit,
  AlertTriangle, Calendar, User, Package, FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/contexts/role-context";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="bg-secondary text-muted-foreground border-border"><FileBox className="w-3 h-3 mr-1" />Draft</Badge>;
    case "submitted":
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"><Clock className="w-3 h-3 mr-1" />Submitted</Badge>;
    case "approved":
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
    case "rejected":
      return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RiskBadge({ level }: { level?: string | null }) {
  if (!level) return null;
  switch (level.toLowerCase()) {
    case "high":
      return <Badge className="bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 text-xs">High Risk</Badge>;
    case "medium":
      return <Badge className="bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800 text-xs">Med Risk</Badge>;
    case "low":
      return <Badge className="bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 text-xs">Low Risk</Badge>;
    default:
      return null;
  }
}

function TransactionDetailSheet({ distId, open, onClose }: { distId: number | null; open: boolean; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dist, isLoading } = useGetDistribution(distId ?? 0, { query: { enabled: distId !== null && open } as any });
  const { data: approvals } = useListApprovals(undefined, { query: { enabled: open } as any });

  const relatedApproval = approvals?.find((a) => a.distributionId === distId);

  const timeline: Array<{ label: string; time: string | null; actor?: string; note?: string; color: string }> = [];
  if (dist) {
    timeline.push({ label: "Draft Created", time: dist.createdAt, color: "bg-secondary border-border" });
    if (dist.submittedAt) timeline.push({ label: "Submitted for Approval", time: dist.submittedAt, color: "bg-blue-100 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800" });
    if (dist.status === "approved" && dist.approvedAt) timeline.push({ label: "Approved", time: dist.approvedAt, actor: relatedApproval?.approvedBy ?? undefined, note: relatedApproval?.remarks ?? undefined, color: "bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" });
    if (dist.status === "rejected") timeline.push({ label: "Rejected", time: relatedApproval?.approvedAt ?? null, actor: relatedApproval?.approvedBy ?? undefined, note: relatedApproval?.remarks ?? "No remarks provided", color: "bg-red-100 border-red-200 dark:bg-red-950/40 dark:border-red-800" });
  }

  const ai = relatedApproval?.aiRecommendation;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[580px] sm:max-w-[580px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ExternalLink className="w-5 h-5 text-primary" />
            Transaction Detail
          </SheetTitle>
        </SheetHeader>

        {isLoading || !dist ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <StatusBadge status={dist.status} />
              {ai && <RiskBadge level={ai.riskLevel} />}
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Package, label: "Stock Item", value: `${dist.stockName} (${dist.stockCode ?? "—"})` },
                { icon: Calendar, label: "Distribution Date", value: format(new Date(dist.distributionDate), "dd MMM yyyy") },
                { icon: User, label: "Recipient", value: dist.recipient },
                { icon: ChevronRight, label: "Quantity", value: String(dist.quantityDistributed) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Icon className="w-3 h-3" />{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>

            {dist.purpose && (
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><FileText className="w-3 h-3" />Purpose</p>
                <p className="text-sm">{dist.purpose}</p>
              </div>
            )}

            {/* AI Recommendation */}
            {ai && (
              <div className="border border-primary/20 rounded-xl p-4 space-y-3 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Risk Assessment</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{ai.riskScore}</p>
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                  </div>
                  <div className="flex-1 text-sm">
                    <span className={`font-semibold ${ai.recommendation === "approve" ? "text-emerald-600" : ai.recommendation === "reject" ? "text-red-600" : "text-amber-600"}`}>
                      Recommendation: {ai.recommendation?.toUpperCase()}
                    </span>
                    {ai.confidence != null && (
                      <span className="text-muted-foreground ml-2 text-xs">({Math.round((ai.confidence ?? 0) * 100)}% confidence)</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{ai.reasoning}</p>
              </div>
            )}

            {/* Approval rejection note */}
            {dist.status === "rejected" && relatedApproval?.remarks && (
              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Rejection Remarks</span>
                </div>
                <p className="text-sm text-red-800 dark:text-red-300">{relatedApproval.remarks}</p>
                {relatedApproval.approvedBy && (
                  <p className="text-xs text-muted-foreground mt-2">Rejected by {relatedApproval.approvedBy}</p>
                )}
              </div>
            )}

            {/* State timeline */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Audit Trail
              </h3>
              <div className="space-y-2">
                {timeline.map((step, idx) => (
                  <div key={idx} className={`border rounded-lg p-3 ${step.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{step.label}</span>
                      {step.time && <span className="text-xs text-muted-foreground">{format(new Date(step.time), "dd MMM yyyy, HH:mm")}</span>}
                    </div>
                    {step.actor && <p className="text-xs text-muted-foreground mt-0.5">by {step.actor}</p>}
                    {step.note && <p className="text-xs mt-1 italic">{step.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Distributions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: distributions, isLoading } = useListDistributions(
    statusFilter !== "all" ? { status: statusFilter } : {},
  );
  const deleteDistribution = useDeleteDistribution();
  const submitDistribution = useSubmitDistribution();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canMake, canCheck } = useRole();

  const handleSubmit = (id: number) => {
    setSubmittingId(id);
    submitDistribution.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Distribution submitted for approval", description: "AI recommendation will be generated automatically." });
        queryClient.invalidateQueries({ queryKey: getListDistributionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      },
      onError: (err: any) => {
        toast({ title: "Submit failed", description: err?.message ?? "Unable to submit", variant: "destructive" });
      },
      onSettled: () => setSubmittingId(null),
    });
  };

  const handleDelete = (id: number) => {
    deleteDistribution.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Draft deleted" });
        queryClient.invalidateQueries({ queryKey: getListDistributionsQueryKey() });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
    setDeleteId(null);
  };

  const q = search.toLowerCase();
  const filtered = (distributions ?? []).filter((d) =>
    !q || d.stockName.toLowerCase().includes(q) || (d.stockCode ?? "").toLowerCase().includes(q) || d.recipient.toLowerCase().includes(q),
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distributions</h1>
          <p className="text-muted-foreground mt-1">Track outgoing stock movements and manage request lifecycle.</p>
        </div>
        {canMake && (
          <Link href="/distributions/new">
            <Button><Plus className="w-4 h-4 mr-2" /> New Request</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-card h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, code, recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No distributions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dist) => (
                <TableRow
                  key={dist.id}
                  className="hover:bg-secondary/20 cursor-pointer"
                  onClick={() => setDetailId(dist.id)}
                >
                  <TableCell className="font-medium text-sm">
                    {format(new Date(dist.distributionDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{dist.stockName}</span>
                      <span className="text-xs text-muted-foreground font-mono">{dist.stockCode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {dist.quantityDistributed}
                  </TableCell>
                  <TableCell className="text-sm">{dist.recipient}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                    {dist.purpose ?? "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={dist.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dist.submittedAt ? format(new Date(dist.submittedAt), "MMM d, HH:mm") : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setDetailId(dist.id); }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />Detail
                      </Button>
                      {canMake && (dist.status === "draft" || dist.status === "rejected") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                          onClick={(e) => { e.stopPropagation(); handleSubmit(dist.id); }}
                          disabled={submittingId === dist.id}
                        >
                          {submittingId === dist.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Submit</>}
                        </Button>
                      )}
                      {canMake && dist.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(dist.id); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Constraint legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground border border-border/60 rounded-lg px-4 py-3 bg-secondary/20">
        <span className="font-semibold text-foreground/70">State Rules:</span>
        <span><span className="text-blue-600 font-medium">Draft / Rejected</span> — can Submit or Delete</span>
        <span><span className="text-amber-600 font-medium">Submitted</span> — awaiting Checker approval</span>
        <span><span className="text-emerald-600 font-medium">Approved</span> — stock deducted, immutable</span>
        <span className="ml-auto flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Click any row for full audit trail</span>
      </div>

      {/* Transaction Detail Sheet */}
      <TransactionDetailSheet
        distId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Distribution</AlertDialogTitle>
            <AlertDialogDescription>
              This draft will be permanently removed. Only draft distributions can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
