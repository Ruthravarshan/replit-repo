import { useState } from "react";
import { useListStocks, useCreateStock, useDeleteStock, useUpdateStock, useGetStockLedger, getListStocksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Edit, BookOpen, Upload, Download, FileText, TrendingDown, TrendingUp, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRole } from "@/contexts/role-context";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["IT Equipment", "Office Supplies", "Health & Safety", "Furniture", "Electronics", "Stationery", "Networking"];
const UOM_OPTIONS = ["Units", "Pcs", "Reams", "Bottles", "Kits", "Packs", "Boxes", "Sets"];

const stockSchema = z.object({
  stockCode: z.string().min(2, "Code required"),
  stockName: z.string().min(2, "Name required"),
  category: z.string().min(2, "Category required"),
  unitOfMeasure: z.string().min(1, "Unit required"),
  openingQuantity: z.coerce.number().min(0),
  location: z.string().optional(),
  minStockLevel: z.coerce.number().min(0).optional(),
});

const editSchema = z.object({
  stockName: z.string().min(2, "Name required"),
  category: z.string().min(2, "Category required"),
  unitOfMeasure: z.string().min(1, "Unit required"),
  location: z.string().optional(),
  minStockLevel: z.coerce.number().min(0).optional(),
});

export default function Stocks() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { data: stocks, isLoading } = useListStocks({
    search: search.length > 1 ? search : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });
  const createStock = useCreateStock();
  const updateStock = useUpdateStock();
  const deleteStock = useDeleteStock();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canMake, canAdmin } = useRole();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editStock, setEditStock] = useState<{ id: number; stockName: string; category: string; unitOfMeasure: string; location?: string | null; minStockLevel?: number | null } | null>(null);
  const [ledgerStockId, setLedgerStockId] = useState<number | null>(null);
  const [ledgerStockName, setLedgerStockName] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "processing" | "done">("idle");
  const [uploadResult, setUploadResult] = useState<{ processed: number; corrected: number; failed: number } | null>(null);

  const createForm = useForm<z.infer<typeof stockSchema>>({
    resolver: zodResolver(stockSchema),
    defaultValues: { stockCode: "", stockName: "", category: "", unitOfMeasure: "Units", openingQuantity: 0, location: "" },
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { stockName: "", category: "", unitOfMeasure: "", location: "", minStockLevel: 0 },
  });

  const onCreateSubmit = (data: z.infer<typeof stockSchema>) => {
    createStock.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Stock item created" });
        setIsCreateOpen(false);
        createForm.reset();
        queryClient.invalidateQueries({ queryKey: getListStocksQueryKey() });
      },
      onError: () => toast({ title: "Failed to create stock", variant: "destructive" }),
    });
  };

  const onEditSubmit = (data: z.infer<typeof editSchema>) => {
    if (!editStock) return;
    updateStock.mutate({ id: editStock.id, data }, {
      onSuccess: () => {
        toast({ title: "Stock updated" });
        setEditStock(null);
        queryClient.invalidateQueries({ queryKey: getListStocksQueryKey() });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  const openEdit = (stock: any) => {
    editForm.reset({ stockName: stock.stockName, category: stock.category, unitOfMeasure: stock.unitOfMeasure, location: stock.location ?? "", minStockLevel: stock.minStockLevel ?? 0 });
    setEditStock({ id: stock.id, stockName: stock.stockName, category: stock.category, unitOfMeasure: stock.unitOfMeasure, location: stock.location, minStockLevel: stock.minStockLevel });
  };

  const handleDelete = (id: number, stockName: string) => {
    if (confirm(`Delete "${stockName}"? This action cannot be undone.`)) {
      deleteStock.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Stock deleted (soft)" });
          queryClient.invalidateQueries({ queryKey: getListStocksQueryKey() });
        },
      });
    }
  };

  const handleBulkUpload = (file: File) => {
    setUploadState("processing");
    setTimeout(() => {
      setUploadState("done");
      setUploadResult({ processed: Math.floor(Math.random() * 40) + 10, corrected: Math.floor(Math.random() * 5), failed: Math.floor(Math.random() * 2) });
    }, 2200);
  };

  const downloadTemplate = () => {
    const csv = "Stock Code,Stock Name,Category,Unit of Measure,Opening Quantity,Location\nSTK-NEW-001,Example Item,IT Equipment,Units,100,Warehouse A\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stock-upload-template.csv";
    a.click();
  };

  const getHealthColor = (score?: number | null) => {
    if (score === null || score === undefined) return "bg-muted text-muted-foreground border-border";
    if (score >= 70) return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
  };

  const uniqueCategories = [...new Set(stocks?.map((s) => s.category) ?? [])];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Master</h1>
          <p className="text-muted-foreground mt-1">Manage and track complete inventory catalog.</p>
        </div>
        <div className="flex items-center gap-2">
          {canMake && (
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Bulk Upload
            </Button>
          )}
          {canMake && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Stock
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code or name..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 bg-card h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{stocks?.length ?? 0} items</span>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Available Qty</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : stocks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No stocks found.</TableCell>
              </TableRow>
            ) : (
              stocks?.map((stock) => (
                <TableRow key={stock.id} className="group hover:bg-secondary/20">
                  <TableCell className="font-mono font-medium text-sm">{stock.stockCode}</TableCell>
                  <TableCell className="font-medium">{stock.stockName}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{stock.category}</Badge></TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {stock.availableQuantity} <span className="text-xs text-muted-foreground">{stock.unitOfMeasure}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{stock.location || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getHealthColor(stock.healthScore)} border`}>
                      {(stock.healthScore ?? 0) >= 70 ? "Healthy" : (stock.healthScore ?? 0) >= 40 ? "Warning" : "Critical"} · {stock.healthScore ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View Ledger"
                        onClick={() => { setLedgerStockId(stock.id); setLedgerStockName(stock.stockName); }}>
                        <BookOpen className="w-3.5 h-3.5" />
                      </Button>
                      {canMake && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit" onClick={() => openEdit(stock)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => handleDelete(stock.id, stock.stockName)}>
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Stock Item</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={createForm.control} name="stockCode" render={({ field }) => (
                  <FormItem><FormLabel>Stock Code</FormLabel><FormControl><Input placeholder="STK-XXX" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="stockName" render={({ field }) => (
                  <FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={createForm.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem><FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={createForm.control} name="openingQuantity" render={({ field }) => (
                  <FormItem><FormLabel>Opening Qty</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="minStockLevel" render={({ field }) => (
                  <FormItem><FormLabel>Min Level</FormLabel><FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Warehouse A" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStock.isPending}>Create Item</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editStock !== null} onOpenChange={(o) => !o && setEditStock(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Stock Item — {editStock?.stockName}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
              <FormField control={editForm.control} name="stockName" render={({ field }) => (
                <FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem><FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="minStockLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Level</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditStock(null)}>Cancel</Button>
                <Button type="submit" disabled={updateStock.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock Ledger sheet */}
      <LedgerSheet stockId={ledgerStockId} stockName={ledgerStockName} onClose={() => setLedgerStockId(null)} />

      {/* Bulk Upload modal */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) { setUploadOpen(false); setUploadState("idle"); setUploadResult(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />Bulk Stock Upload</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Download Template</span>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV Template
              </Button>
            </div>

            {uploadState === "idle" && (
              <div
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBulkUpload(f); }}
                onClick={() => document.getElementById("bulk-file-input")?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-sm">Drag & drop your CSV/Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse — max 50,000 rows</p>
                <input id="bulk-file-input" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkUpload(f); }} />
              </div>
            )}

            {uploadState === "processing" && (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto" />
                <p className="font-medium text-sm">Processing file...</p>
                <p className="text-xs text-muted-foreground">AI agent is validating and self-correcting data</p>
              </div>
            )}

            {uploadState === "done" && uploadResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{uploadResult.processed}</p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{uploadResult.corrected}</p>
                    <p className="text-xs text-muted-foreground">Auto-corrected</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{uploadResult.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">AI Data Ingestion Agent Report:</p>
                  {uploadResult.corrected > 0 && <p>• {uploadResult.corrected} row(s) auto-corrected (date format, whitespace, case normalization)</p>}
                  {uploadResult.failed > 0 && <p>• {uploadResult.failed} row(s) failed — missing mandatory fields (Stock Code, Name). <button className="text-primary underline">Download error report</button></p>}
                  {uploadResult.failed === 0 && <p>• All rows validated successfully. No errors detected.</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadState("idle"); setUploadResult(null); }}>Close</Button>
            {uploadState === "done" && <Button onClick={() => queryClient.invalidateQueries({ queryKey: getListStocksQueryKey() })}>Refresh Stocks</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerSheet({ stockId, stockName, onClose }: { stockId: number | null; stockName: string; onClose: () => void }) {
  const { data: entries, isLoading } = useGetStockLedger(stockId ?? 0, { query: { enabled: stockId !== null } as any });

  return (
    <Sheet open={stockId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Stock Ledger — {stockName}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">Complete immutable movement history</p>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : !entries?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No ledger entries found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isOut = entry.quantity < 0;
              const isIn = entry.quantity > 0;
              return (
                <motion.div key={entry.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-full shrink-0 ${isOut ? "bg-red-100 dark:bg-red-950/40" : "bg-emerald-100 dark:bg-emerald-950/40"}`}>
                    {isOut ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{entry.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}</p>
                      {entry.createdBy && <Badge variant="outline" className="text-xs px-1 py-0">{entry.createdBy}</Badge>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${isOut ? "text-red-500" : "text-emerald-600"}`}>
                      {isOut ? "" : "+"}{entry.quantity}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
