import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateDistribution, useListStocks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Loader2, Package, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const distSchema = z.object({
  stockId: z.coerce.number().min(1, "Stock selection required"),
  quantityDistributed: z.coerce.number().min(1, "Quantity must be at least 1"),
  distributionDate: z.string().min(1, "Date is required"),
  recipient: z.string().min(2, "Recipient is required"),
  purpose: z.string().min(5, "Purpose is required (min 5 characters)"),
});

function HealthIndicator({ available, min, requested }: { available: number; min?: number | null; requested: number }) {
  const pct = available > 0 ? Math.round((available / Math.max(available, 1)) * 100) : 0;
  const afterRequest = available - requested;
  const minLevel = min ?? 0;

  const getStatus = (qty: number) => {
    if (qty <= 0) return { label: "Out of Stock", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" };
    if (minLevel > 0 && qty < minLevel) return { label: "Below Min Level", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" };
    if (minLevel > 0 && qty === minLevel) return { label: "At Min Level", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" };
    return { label: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" };
  };

  const currentStatus = getStatus(available);
  const afterStatus = getStatus(afterRequest);

  return (
    <div className="space-y-2">
      <div className={`border rounded-lg p-3 ${currentStatus.bg}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Current Availability</span>
          <span className={`text-xs font-medium ${currentStatus.color}`}>{currentStatus.label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${currentStatus.color}`}>{available}</span>
          <span className="text-sm text-muted-foreground">units available</span>
        </div>
        {minLevel > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Min stock level: {minLevel} units</p>
        )}
      </div>

      {requested > 0 && (
        <div className={`border rounded-lg p-3 ${afterRequest < 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : afterStatus.bg}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">After This Request</span>
            {afterRequest < 0 ? (
              <span className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Insufficient stock</span>
            ) : (
              <span className={`text-xs font-medium ${afterStatus.color}`}>{afterStatus.label}</span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-bold ${afterRequest < 0 ? "text-red-600" : afterStatus.color}`}>
              {afterRequest < 0 ? 0 : afterRequest}
            </span>
            <span className="text-sm text-muted-foreground">units remaining</span>
            {afterRequest < 0 && <span className="text-xs text-red-600">({Math.abs(afterRequest)} over limit)</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewDistribution() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: stocks, isLoading: isLoadingStocks } = useListStocks();
  const createDist = useCreateDistribution();

  const form = useForm<z.infer<typeof distSchema>>({
    resolver: zodResolver(distSchema),
    defaultValues: {
      stockId: 0,
      quantityDistributed: 1,
      distributionDate: new Date().toISOString().split("T")[0],
      recipient: "",
      purpose: "",
    },
  });

  const selectedStockId = form.watch("stockId");
  const requestedQty = form.watch("quantityDistributed");
  const selectedStock = stocks?.find((s) => s.id === Number(selectedStockId));

  const onSubmit = (data: z.infer<typeof distSchema>) => {
    if (selectedStock && data.quantityDistributed > selectedStock.availableQuantity) {
      toast({ title: "Insufficient Stock", description: `Only ${selectedStock.availableQuantity} units available.`, variant: "destructive" });
      return;
    }
    createDist.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Distribution Request Created", description: "Draft saved. Submit it when ready for approval." });
        setLocation("/distributions");
      },
      onError: () => {
        toast({ title: "Submission Failed", description: "There was an error creating your request.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/distributions">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Distribution Request</h1>
          <p className="text-muted-foreground mt-1">Submit a stock request. AI will evaluate risk when submitted for approval.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>All requests require Manager approval before stock is deducted.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="stockId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Item <span className="text-red-500">*</span></FormLabel>
                        <Select
                          disabled={isLoadingStocks}
                          onValueChange={field.onChange}
                          defaultValue={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-secondary/20">
                              <SelectValue placeholder="Select a stock item..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stocks?.filter((s) => s.status !== "inactive").map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                <span className="font-medium">{s.stockName}</span>
                                <span className="text-muted-foreground ml-2 text-xs font-mono">({s.stockCode})</span>
                                <span className="text-muted-foreground ml-2 text-xs">— {s.availableQuantity} {s.unitOfMeasure}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="quantityDistributed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Quantity <span className="text-red-500">*</span>
                            {selectedStock && (
                              <span className="text-xs text-muted-foreground ml-2 font-normal">max {selectedStock.availableQuantity}</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max={selectedStock?.availableQuantity ?? undefined}
                              {...field}
                              className="bg-secondary/20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="distributionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="bg-secondary/20" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="recipient"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient / Department <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Engineering Dept, John Doe — EMP-001" {...field} className="bg-secondary/20" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Purpose <span className="text-red-500">*</span>
                          <span className="text-xs text-muted-foreground ml-2 font-normal">Required for approval</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain why this distribution is needed — used by the AI risk engine to evaluate the request..."
                            className="resize-none bg-secondary/20 min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-3 border-t border-border gap-3">
                    <Link href="/distributions">
                      <Button variant="outline" type="button">Cancel</Button>
                    </Link>
                    <Button
                      type="submit"
                      disabled={createDist.isPending || isLoadingStocks}
                      className="px-8"
                    >
                      {createDist.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save as Draft
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Stock availability panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Stock Availability
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedStock ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a stock item to see availability</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-sm">{selectedStock.stockName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedStock.stockCode}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{selectedStock.category}</Badge>
                      <Badge variant="outline" className="text-xs">{selectedStock.unitOfMeasure}</Badge>
                    </div>
                  </div>
                  <HealthIndicator
                    available={selectedStock.availableQuantity}
                    min={selectedStock.minStockLevel}
                    requested={Number(requestedQty) || 0}
                  />
                  {selectedStock.location && (
                    <p className="text-xs text-muted-foreground">Location: {selectedStock.location}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-secondary/20">
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-foreground/70 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                How it works
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-1.5"><span className="text-primary mt-0.5">1.</span>Save as draft and review</li>
                <li className="flex items-start gap-1.5"><span className="text-primary mt-0.5">2.</span>Submit for Manager approval</li>
                <li className="flex items-start gap-1.5"><span className="text-primary mt-0.5">3.</span>AI evaluates risk automatically</li>
                <li className="flex items-start gap-1.5"><span className="text-primary mt-0.5">4.</span>Stock deducted only after approval</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
