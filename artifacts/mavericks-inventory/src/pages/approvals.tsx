import { useState } from "react";
import { useListApprovals, useApproveRequest, useRejectRequest, getListApprovalsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BrainCircuit, Check, X, ArrowRight, FileText, ShieldCheck, ShieldAlert, ShieldX, Sparkles, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/contexts/role-context";

function getRiskGlow(riskLevel?: string, recommendation?: string) {
  if (recommendation?.toLowerCase() === "approve" || riskLevel?.toLowerCase() === "low") {
    return { boxShadow: "0 0 0 1.5px #22c55e, 0 0 24px 4px rgba(34,197,94,0.18), 0 0 60px 8px rgba(34,197,94,0.08)", borderColor: "#22c55e" };
  }
  if (recommendation?.toLowerCase() === "review" || riskLevel?.toLowerCase() === "medium") {
    return { boxShadow: "0 0 0 1.5px #f59e0b, 0 0 24px 4px rgba(245,158,11,0.18), 0 0 60px 8px rgba(245,158,11,0.08)", borderColor: "#f59e0b" };
  }
  return { boxShadow: "0 0 0 1.5px #ef4444, 0 0 24px 4px rgba(239,68,68,0.18), 0 0 60px 8px rgba(239,68,68,0.08)", borderColor: "#ef4444" };
}

function getRecommendationColor(rec?: string) {
  if (!rec) return { text: "text-muted-foreground", bg: "bg-muted/30", border: "border-muted", icon: ShieldCheck };
  const r = rec.toLowerCase();
  if (r === "approve") return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", icon: ShieldCheck };
  if (r === "review") return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", icon: ShieldAlert };
  return { text: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800", icon: ShieldX };
}

function getRiskBadgeClass(riskLevel?: string) {
  const r = riskLevel?.toLowerCase();
  if (r === "low") return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800";
  if (r === "medium") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800";
  return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800";
}

export default function Approvals() {
  const { data: approvals, isLoading } = useListApprovals(
    { status: "pending" },
    { query: { queryKey: getListApprovalsQueryKey({ status: "pending" }) } }
  );
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCheck } = useRole();

  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListApprovalsQueryKey({ status: "pending" }) });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
  };

  const handleApprove = (id: number) => {
    const remark = remarks[id] || "";
    approveMutation.mutate({ id, data: { remarks: remark } }, {
      onSuccess: () => {
        toast({ title: "Request Approved", description: "Distribution has been approved and stock deducted." });
        invalidate();
        setSelected(null);
      },
      onError: () => toast({ title: "Error", description: "Failed to approve.", variant: "destructive" }),
    });
  };

  const openReject = (id: number) => {
    setRejectId(id);
    setRejectRemarks("");
    setRejectOpen(true);
  };

  const handleReject = () => {
    if (!rejectId || rejectRemarks.trim().length < 20) return;
    rejectMutation.mutate({ id: rejectId, data: { remarks: rejectRemarks } }, {
      onSuccess: () => {
        toast({ title: "Request Rejected", description: "Remarks sent to requester." });
        setRejectOpen(false);
        setRejectId(null);
        invalidate();
        setSelected(null);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to reject.", variant: "destructive" });
      },
    });
  };

  const handleBulkApprove = async () => {
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/approvals/bulk-approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkSelected, remarks: "Bulk approved — low risk items" }),
      });
      const data = await res.json();
      toast({ title: `Bulk Approved ${data.processed} requests`, description: "All low-risk items processed." });
      invalidate();
      setBulkSelected([]);
      setBulkConfirmOpen(false);
      setSelected(null);
    } finally {
      setBulkProcessing(false);
    }
  };

  const pendingApprovals = approvals?.filter((a) => a.status === "pending") || [];
  const selectedApproval = selected !== null ? pendingApprovals.find((a) => a.id === selected) : pendingApprovals[0];
  const lowRiskApprovals = pendingApprovals.filter((a) => a.aiRecommendation?.riskLevel === "low" || a.aiRecommendation?.recommendation === "approve");

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[0, 1].map((i) => <Skeleton key={i} className="h-96 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Workspace</h1>
          <p className="text-muted-foreground mt-1">Review pending distributions augmented with AI risk analysis.</p>
        </div>
        {canCheck && lowRiskApprovals.length > 1 && (
          <Button
            variant="outline"
            className="border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
            onClick={() => { setBulkSelected(lowRiskApprovals.map((a) => a.id)); setBulkConfirmOpen(true); }}
          >
            <Zap className="w-4 h-4 mr-2" />
            Bulk Approve ({lowRiskApprovals.length} low-risk)
          </Button>
        )}
      </div>

      {pendingApprovals.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24 bg-card border border-border rounded-xl">
          <Check className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium">All caught up</h3>
          <p className="text-muted-foreground mt-2">There are no pending distribution requests to review.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left list */}
          <div className="xl:col-span-2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
              Requests ({pendingApprovals.length})
            </p>
            <AnimatePresence initial={false}>
              {pendingApprovals.map((approval, idx) => {
                const rec = approval.aiRecommendation;
                const isActive = (selected === null && idx === 0) || selected === approval.id;
                const { text } = getRecommendationColor(rec?.recommendation);
                return (
                  <motion.div key={approval.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, delay: idx * 0.04 }}
                    onClick={() => setSelected(approval.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{approval.distribution?.stockName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {approval.distribution?.recipient} &middot; {approval.distribution?.quantityDistributed} units
                        </p>
                      </div>
                      {rec && <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${text}`}>{rec.recommendation}</span>}
                    </div>
                    {rec && (
                      <div className="mt-2">
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${rec.recommendation?.toLowerCase() === "approve" ? "bg-emerald-500" : rec.recommendation?.toLowerCase() === "review" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${rec.riskScore}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Risk: {Math.round(rec.riskScore)}/100</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Right detail */}
          <div className="xl:col-span-3">
            <AnimatePresence mode="wait">
              {selectedApproval && (
                <motion.div key={selectedApproval.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
                  <Card className="border-border">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xl">{selectedApproval.distribution?.stockName}</h3>
                            <Badge variant="outline" className="font-mono text-xs">{selectedApproval.distribution?.stockCode}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Requested on {selectedApproval.distribution?.distributionDate ? format(new Date(selectedApproval.distribution.distributionDate), "MMM d, yyyy") : "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-primary">{selectedApproval.distribution?.quantityDistributed}</p>
                          <p className="text-xs text-muted-foreground">units requested</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-secondary/40 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><ArrowRight className="w-3 h-3" /> Recipient</p>
                          <p className="font-semibold text-sm">{selectedApproval.distribution?.recipient}</p>
                        </div>
                        <div className="bg-secondary/40 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><FileText className="w-3 h-3" /> Purpose</p>
                          <p className="font-semibold text-sm truncate">{selectedApproval.distribution?.purpose || "N/A"}</p>
                        </div>
                      </div>
                      {/* Timeline */}
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transaction Timeline</p>
                        <div className="space-y-1.5">
                          {[
                            { label: "Created", time: selectedApproval.distribution?.createdAt, icon: "•" },
                            { label: "Submitted for Approval", time: selectedApproval.distribution?.submittedAt, icon: "→" },
                          ].map((step, i) => step.time && (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-primary font-bold w-4">{step.icon}</span>
                              <span className="text-muted-foreground">{step.label}</span>
                              <span className="ml-auto text-foreground font-medium">{format(new Date(step.time), "MMM d, HH:mm")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedApproval.aiRecommendation && (() => {
                    const rec = selectedApproval.aiRecommendation;
                    const colors = getRecommendationColor(rec.recommendation);
                    const RecommIcon = colors.icon;
                    const glow = getRiskGlow(rec.riskLevel, rec.recommendation);
                    return (
                      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
                        className={`rounded-xl border p-5 relative overflow-hidden ${colors.bg} ${colors.border}`} style={glow}
                      >
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none opacity-20 blur-2xl" style={{ background: rec.recommendation?.toLowerCase() === "approve" ? "rgba(34,197,94,0.6)" : rec.recommendation?.toLowerCase() === "review" ? "rgba(245,158,11,0.6)" : "rgba(239,68,68,0.6)" }} />
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${colors.bg} border ${colors.border}`}><BrainCircuit className={`w-5 h-5 ${colors.text}`} /></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2"><span className="font-bold text-sm text-foreground">AI Recommendation</span><Sparkles className={`w-3.5 h-3.5 ${colors.text}`} /></div>
                            <p className="text-xs text-muted-foreground">Generated by Mavericks AI Engine</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskBadgeClass(rec.riskLevel)}`}>{rec.riskLevel?.toUpperCase()} RISK</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg mb-4 border ${colors.bg} ${colors.border}`}>
                          <RecommIcon className={`w-6 h-6 ${colors.text} shrink-0`} />
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Verdict</p>
                            <p className={`font-bold text-lg leading-tight ${colors.text}`}>{rec.recommendation?.toUpperCase()}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-xs text-muted-foreground">Risk Score</p>
                            <p className={`font-bold text-lg ${colors.text}`}>{Math.round(rec.riskScore)}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed mb-4">{rec.reasoning}</p>
                        {rec.confidence != null && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground font-medium">Model Confidence</span>
                              <span className={`font-bold ${colors.text}`}>{Math.round(rec.confidence * 100)}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                              <motion.div className={`h-full rounded-full ${rec.recommendation?.toLowerCase() === "approve" ? "bg-emerald-500" : rec.recommendation?.toLowerCase() === "review" ? "bg-amber-500" : "bg-red-500"}`} initial={{ width: 0 }} animate={{ width: `${rec.confidence * 100}%` }} transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }} />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}

                  {canCheck && (
                    <Card className="border-border">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900"
                            onClick={() => openReject(selectedApproval.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                            <X className="w-4 h-4 mr-2" /> Reject
                          </Button>
                          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => handleApprove(selectedApproval.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                            <Check className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        </div>
                        <p className="text-xs text-center text-muted-foreground">All decisions are immutably logged for audit and ISO compliance.</p>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Rejection modal with mandatory remarks */}
      <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Distribution Request</DialogTitle>
            <DialogDescription>Rejection remarks are mandatory and will be shared with the requester for resubmission.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} placeholder="Explain the reason for rejection in detail..." rows={4} className="resize-none" />
            <div className="flex justify-between items-center text-xs">
              <span className={rejectRemarks.trim().length < 20 ? "text-destructive font-medium" : "text-muted-foreground"}>
                {rejectRemarks.trim().length < 20 ? `${20 - rejectRemarks.trim().length} more characters required` : "Minimum length met"}
              </span>
              <span className="text-muted-foreground">{rejectRemarks.length} / 500</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectRemarks.trim().length < 20 || rejectMutation.isPending}>
              <X className="w-4 h-4 mr-2" /> Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk approve confirmation */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(o) => !o && setBulkConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-500" />
              Bulk Approve {bulkSelected.length} Low-Risk Requests
            </DialogTitle>
            <DialogDescription>AI has assessed these requests as low-risk. All will be approved simultaneously with the standard bulk approval remark.</DialogDescription>
          </DialogHeader>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 my-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-700 dark:text-emerald-400">
                <p className="font-medium">Bulk approval will:</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  <li>Approve all {bulkSelected.length} low-risk requests</li>
                  <li>Deduct stock quantities from inventory</li>
                  <li>Log all actions to the immutable audit trail</li>
                  <li>Notify requesters of approval</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleBulkApprove} disabled={bulkProcessing}>
              {bulkProcessing ? "Processing..." : `Approve All ${bulkSelected.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
