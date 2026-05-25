import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/role-context";
import { useLocation } from "wouter";
import {
  Settings, Users, Shield, Database, Activity, CheckCircle2, AlertCircle,
  UserPlus, UserX, UserCheck, Cpu, Server, Zap, TrendingUp, Plus, Trash2,
  BrainCircuit, Clock, BarChart2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

interface SystemHealth {
  services: Record<string, { status: string; latency: number }>;
  stats: Record<string, number>;
  distributionStatusCounts: Record<string, number>;
  topDistributedItems: { stockCode: string; stockName: string; distributed: number }[];
  anomalySummary: Record<string, number>;
  recentActivity: { id: number; type: string; description: string; timestamp: string; actor?: string }[];
  config: Record<string, unknown>;
  approvalBottlenecks: { id: number; recipient: string; submittedAt: string; hoursElapsed: number }[];
}

interface User { id: number; name: string; email: string; role: string; department: string; location: string; status: string; lastLogin: string }

const SERVICE_ICONS: Record<string, React.ElementType> = {
  api: Server, database: Database, aiEngine: BrainCircuit, storage: Cpu,
};

export default function AdminPanel() {
  const { canAdmin } = useRole();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [uom, setUom] = useState<string[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "executive", department: "", location: "" });
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newUom, setNewUom] = useState("");

  useEffect(() => {
    if (!canAdmin) { setLocation("/"); return; }
    Promise.all([
      fetch("/api/admin/system-health").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/uom").then((r) => r.json()),
      fetch("/api/admin/config").then((r) => r.json()),
    ]).then(([h, u, c, um, cfg]) => {
      setHealth(h); setUsers(u); setCategories(c); setUom(um); setConfig(cfg);
    }).finally(() => setLoading(false));
  }, [canAdmin]);

  const saveConfig = async (updates: Record<string, unknown>) => {
    const res = await fetch("/api/admin/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    const updated = await res.json();
    setConfig(updated);
    toast({ title: "Configuration saved" });
  };

  const toggleUserStatus = async (user: User) => {
    const endpoint = user.status === "active" ? "deactivate" : "activate";
    const res = await fetch(`/api/admin/users/${user.id}/${endpoint}`, { method: "PATCH" });
    const updated = await res.json();
    setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
    toast({ title: `User ${endpoint}d` });
  };

  const addUser = async () => {
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
    if (res.ok) {
      const u = await res.json();
      setUsers((prev) => [...prev, u]);
      setAddUserOpen(false);
      setNewUser({ name: "", email: "", role: "executive", department: "", location: "" });
      toast({ title: "User created", description: "Password reset email will be sent." });
    }
  };

  const addCategory = async () => {
    if (!newCategory) return;
    const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory }) });
    setCategories(await res.json());
    setNewCategory("");
  };

  const addUom = async () => {
    if (!newUom) return;
    const res = await fetch("/api/admin/uom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newUom }) });
    setUom(await res.json());
    setNewUom("");
  };

  const statusDistData = health ? Object.entries(health.distributionStatusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value,
    color: name === "approved" ? "#22c55e" : name === "submitted" ? "#3b82f6" : name === "rejected" ? "#ef4444" : "#94a3b8",
  })) : [];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading admin data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            System Administration
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, configure workflows, and monitor system health.</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5 text-sm font-semibold">Admin Only</Badge>
      </div>

      <Tabs defaultValue="health">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="health"><Activity className="w-3.5 h-3.5 mr-1.5" />Health</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="config"><Settings className="w-3.5 h-3.5 mr-1.5" />Config</TabsTrigger>
          <TabsTrigger value="master"><Database className="w-3.5 h-3.5 mr-1.5" />Master Data</TabsTrigger>
        </TabsList>

        {/* ── System Health ── */}
        <TabsContent value="health" className="mt-6 space-y-6">
          {/* Service status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {health && Object.entries(health.services).map(([name, svc]) => {
              const Icon = SERVICE_ICONS[name] ?? Server;
              const ok = svc.status === "healthy";
              return (
                <Card key={name} className={`border ${ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${ok ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"}`}>
                      <Icon className={`w-4 h-4 ${ok ? "text-emerald-600" : "text-red-600"}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground capitalize">{name.replace(/([A-Z])/g, " $1")}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-sm font-semibold capitalize">{svc.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{svc.latency}ms</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Stats + charts */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {health && Object.entries(health.stats).map(([key, val]) => (
              <div key={key} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                <p className="text-2xl font-bold mt-1">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Distributions by Status</CardTitle></CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusDistData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusDistData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Distributed Items</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {health?.topDistributedItems.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.stockName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.stockCode}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">{item.distributed}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Approval Bottlenecks */}
          {health && health.approvalBottlenecks.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <Clock className="w-4 h-4" /> Approval Bottlenecks ({health.approvalBottlenecks.length})
                </CardTitle>
                <CardDescription>Requests pending beyond {config?.slaHours ?? 48}h SLA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {health.approvalBottlenecks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div>
                        <p className="text-sm font-medium">Dist #{b.id} — {b.recipient}</p>
                        <p className="text-xs text-muted-foreground">Submitted: {new Date(b.submittedAt).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
                        {b.hoursElapsed}h elapsed
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anomaly Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Critical", key: "critical", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" },
              { label: "High", key: "high", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" },
              { label: "Medium", key: "medium", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" },
              { label: "Low", key: "low", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" },
            ].map(({ label, key, color, bg }) => (
              <div key={key} className={`border rounded-xl p-4 ${bg}`}>
                <p className="text-xs text-muted-foreground">{label} Anomalies</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{health?.anomalySummary[key] ?? 0}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── User Management ── */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.filter((u) => u.status === "active").length} active users</p>
            <Button size="sm" onClick={() => setAddUserOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Last Login</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.role === "admin" ? "bg-violet-500" : user.role === "manager" ? "bg-emerald-500" : "bg-sky-500"}`}>
                          {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={
                        user.role === "admin" ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400" :
                        user.role === "manager" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400" :
                        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400"
                      }>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.department || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.location || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(user.lastLogin).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${user.status === "active" ? "text-emerald-600" : "text-muted-foreground"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        {user.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost" size="sm"
                        className={`h-7 text-xs ${user.status === "active" ? "text-destructive hover:bg-destructive/10" : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"}`}
                        onClick={() => toggleUserStatus(user)}
                        disabled={user.id === 1}
                      >
                        {user.status === "active" ? <><UserX className="w-3 h-3 mr-1" />Deactivate</> : <><UserCheck className="w-3 h-3 mr-1" />Activate</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-sm font-medium">Name</label><Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium">Email</label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive (Maker)</SelectItem>
                      <SelectItem value="manager">Manager (Checker)</SelectItem>
                      <SelectItem value="admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-sm font-medium">Department</label><Input value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium">Location</label><Input value={newUser.location} onChange={(e) => setNewUser({ ...newUser, location: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
                <Button onClick={addUser} disabled={!newUser.name || !newUser.email}>Create User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── System Config ── */}
        <TabsContent value="config" className="mt-6">
          {config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Workflow & Approval Rules</CardTitle><CardDescription>Configure thresholds and SLA policies</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium">L2 Escalation Threshold (units)</label>
                    <p className="text-xs text-muted-foreground mb-3">Requests above this quantity require 2nd-level approval</p>
                    <div className="flex items-center gap-4">
                      <Slider min={10} max={200} step={5} value={[config.l2EscalationThreshold]} onValueChange={([v]) => setConfig({ ...config, l2EscalationThreshold: v })} className="flex-1" />
                      <span className="text-sm font-bold w-12 text-right">{config.l2EscalationThreshold}</span>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => saveConfig({ l2EscalationThreshold: config.l2EscalationThreshold })}>Save</Button>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Approval SLA (hours)</label>
                    <p className="text-xs text-muted-foreground mb-3">Flag bottlenecks after this many hours</p>
                    <div className="flex items-center gap-4">
                      <Slider min={4} max={168} step={4} value={[config.slaHours]} onValueChange={([v]) => setConfig({ ...config, slaHours: v })} className="flex-1" />
                      <span className="text-sm font-bold w-12 text-right">{config.slaHours}h</span>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => saveConfig({ slaHours: config.slaHours })}>Save</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">AI & Automation Settings</CardTitle><CardDescription>Control AI agent behavior and sensitivity</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">AI Risk Engine</p>
                      <p className="text-xs text-muted-foreground">Auto-generate risk scores on submission</p>
                    </div>
                    <Switch checked={config.aiEnabled} onCheckedChange={(v) => { setConfig({ ...config, aiEnabled: v }); saveConfig({ aiEnabled: v }); }} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Anomaly Detection Sensitivity</label>
                    <p className="text-xs text-muted-foreground mb-2">Higher sensitivity = more alerts</p>
                    <Select value={config.anomalySensitivity} onValueChange={(v) => { setConfig({ ...config, anomalySensitivity: v }); saveConfig({ anomalySensitivity: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low — Major deviations only</SelectItem>
                        <SelectItem value="medium">Medium — Balanced</SelectItem>
                        <SelectItem value="high">High — Catch all anomalies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Send email alerts on approvals/rejections</p>
                    </div>
                    <Switch checked={config.emailNotifications} onCheckedChange={(v) => { setConfig({ ...config, emailNotifications: v }); saveConfig({ emailNotifications: v }); }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Master Data ── */}
        <TabsContent value="master" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Stock Categories</CardTitle><CardDescription>{categories.length} categories configured</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Badge key={c} variant="secondary" className="gap-1.5 pr-1">
                      {c}
                      <button onClick={async () => { await fetch(`/api/admin/categories/${encodeURIComponent(c)}`, { method: "DELETE" }); setCategories((prev) => prev.filter((x) => x !== c)); }} className="hover:text-destructive transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="New category..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} className="bg-secondary/30" />
                  <Button size="icon" onClick={addCategory}><Plus className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Units of Measure</CardTitle><CardDescription>{uom.length} units configured</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {uom.map((u) => (
                    <Badge key={u} variant="secondary" className="gap-1.5 pr-1">
                      {u}
                      <button onClick={async () => { const res = await fetch(`/api/admin/uom/${encodeURIComponent(u)}`, { method: "DELETE" }); if (res.ok) setUom((prev) => prev.filter((x) => x !== u)); }} className="hover:text-destructive transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="New unit..." value={newUom} onChange={(e) => setNewUom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUom()} className="bg-secondary/30" />
                  <Button size="icon" onClick={addUom}><Plus className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
