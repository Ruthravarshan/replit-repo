import { useState, useRef, useEffect } from "react";
import { useQueryInsights } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Send, Loader2, User, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  queryType?: string;
  data?: object[];
  timestamp: Date;
}

const SAMPLE_QUERIES = [
  "Show rejected distribution requests",
  "List all critical stock items",
  "How many pending approvals are there?",
  "What is the current inventory health?",
  "Top 5 items by available quantity",
  "Show active anomalies",
];

export default function Insights() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I am the Mavericks AI Insights Agent. Ask me anything about your inventory — rejected requests, critical stock, approval queues, anomaly alerts, or overall health status.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/insights/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        queryType: data.queryType,
        data: data.data,
        timestamp: new Date(data.generatedAt),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Query processing failed. The system is operating in fallback mode. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-primary" />
              AI Insights Agent
            </h1>
            <p className="text-muted-foreground mt-1">
              Natural language queries over your live inventory data — no filters, no SQL, just ask.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Agent 4 — Active
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  msg.role === "assistant"
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-secondary text-foreground border border-border"
                }`}>
                  {msg.role === "assistant" ? <BrainCircuit className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-2xl space-y-3 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
                  <div className={`rounded-2xl px-5 py-4 ${
                    msg.role === "assistant"
                      ? "bg-card border border-border shadow-sm"
                      : "bg-primary text-primary-foreground"
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>

                  {/* Data table if present */}
                  {msg.data && msg.data.length > 0 && (
                    <div className="w-full bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-secondary/50 border-b border-border flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Query Results — {msg.data.length} records</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              {Object.keys(msg.data[0]).map((key) => (
                                <th key={key} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.data.slice(0, 8).map((row, i) => (
                              <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                                {Object.values(row as Record<string, unknown>).map((val, j) => (
                                  <td key={j} className="px-4 py-2 text-foreground/80">
                                    {val === null || val === undefined ? <span className="text-muted-foreground">—</span> : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {msg.data.length > 8 && (
                          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                            Showing 8 of {msg.data.length} records
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground px-1">
                    {format(msg.timestamp, "HH:mm:ss")}
                    {msg.queryType && msg.role === "assistant" && (
                      <span className="ml-2">
                        <Badge variant="outline" className="text-xs">{msg.queryType.replace(/_/g, " ")}</Badge>
                      </span>
                    )}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BrainCircuit className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Querying inventory data...</span>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Sample queries */}
      {messages.length <= 2 && (
        <div className="shrink-0 px-8 pb-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuery(q)}
                  className="text-xs bg-secondary hover:bg-secondary/80 text-foreground border border-border px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-8 pb-8 pt-4 border-t border-border bg-background">
        <form
          className="max-w-4xl mx-auto flex gap-3"
          onSubmit={(e) => { e.preventDefault(); handleQuery(input); }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory, distributions, approvals, or anomalies..."
            className="flex-1 bg-card h-11"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading} className="h-11 px-6">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
