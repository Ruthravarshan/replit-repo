import { useState } from "react";
import { useListActivity } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { Search, ShieldCheck, Clock, CheckCircle2, XCircle, Plus, Send, AlertTriangle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EVENT_TYPES = [
  { value: "all", label: "All Events" },
  { value: "distribution_created", label: "Distribution Created" },
  { value: "distribution_submitted", label: "Distribution Submitted" },
  { value: "distribution_approved", label: "Distribution Approved" },
  { value: "distribution_rejected", label: "Distribution Rejected" },
  { value: "stock_created", label: "Stock Created" },
  { value: "anomaly_detected", label: "Anomaly Detected" },
];

const ACTOR_FILTER = [
  { value: "all", label: "All Actors" },
  { value: "executive", label: "Executive (Maker)" },
  { value: "Manager", label: "Manager (Checker)" },
  { value: "system", label: "System" },
];

function eventIcon(type: string) {
  if (type.includes("approved")) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (type.includes("rejected")) return <XCircle className="w-4 h-4 text-red-500" />;
  if (type.includes("submitted")) return <Send className="w-4 h-4 text-blue-500" />;
  if (type.includes("created")) return <Plus className="w-4 h-4 text-primary" />;
  if (type.includes("anomaly")) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  if (type.includes("deleted")) return <Trash2 className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function eventBadgeClass(type: string) {
  if (type.includes("approved")) return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
  if (type.includes("rejected")) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
  if (type.includes("submitted")) return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
  if (type.includes("created")) return "bg-primary/10 text-primary border-primary/20";
  if (type.includes("anomaly")) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
  return "bg-secondary text-muted-foreground border-border";
}

function actorBadge(actor: string | null) {
  if (!actor) return null;
  const cls =
    actor === "Manager"
      ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400"
      : actor === "executive"
      ? "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400"
      : "bg-secondary text-muted-foreground border-border";
  const label = actor === "executive" ? "Executive" : actor === "Manager" ? "Manager" : actor;
  return <Badge variant="outline" className={`text-xs ${cls}`}>{label}</Badge>;
}

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");

  const { data: activity, isLoading } = useListActivity({
    limit: 200,
    type: typeFilter !== "all" ? typeFilter : undefined,
    actor: actorFilter !== "all" ? actorFilter : undefined,
  });

  const filtered = activity?.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.description.toLowerCase().includes(s) ||
      (a.stockCode?.toLowerCase().includes(s) ?? false) ||
      (a.actor?.toLowerCase().includes(s) ?? false) ||
      a.type.toLowerCase().includes(s)
    );
  }) ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Immutable event trail — every action, actor, and timestamp recorded for compliance.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 text-sm font-medium">
          <ShieldCheck className="w-4 h-4" />
          ISO 27001 Compliant
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: activity?.length ?? 0, color: "text-foreground" },
          { label: "Approvals", value: activity?.filter((a) => a.type.includes("approved")).length ?? 0, color: "text-emerald-600" },
          { label: "Rejections", value: activity?.filter((a) => a.type.includes("rejected")).length ?? 0, color: "text-red-500" },
          { label: "System Events", value: activity?.filter((a) => a.actor === "system").length ?? 0, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events, stock codes, actors..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52 bg-card">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_FILTER.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Event Timeline</span>
          <span className="text-xs text-muted-foreground">{filtered.length} events</span>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No events match your filters</p>
              <p className="text-sm mt-1">Try adjusting the search or filter criteria</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                  className="px-6 py-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    {eventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{event.description}</span>
                      {event.stockCode && (
                        <Badge variant="outline" className="text-xs font-mono">{event.stockCode}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs border ${eventBadgeClass(event.type)}`}>
                        {event.type.replace(/_/g, " ")}
                      </Badge>
                      {actorBadge(event.actor ?? null)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(event.timestamp), "MMM d, HH:mm:ss")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
