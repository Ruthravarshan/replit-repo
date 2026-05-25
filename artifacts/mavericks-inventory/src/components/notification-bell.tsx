import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, ArrowRight, Info, AlertTriangle, CheckCircle2, XCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: number;
  type: string;
  title: string;
  description: string;
  actor: string | null;
  stockCode: string | null;
  timestamp: string;
  link: string;
}

const SEEN_KEY = "mavericks_last_seen_notif";

function getIcon(type: string) {
  if (type.includes("approved")) return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (type.includes("rejected")) return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (type.includes("anomaly")) return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  if (type.includes("created")) return <Plus className="w-4 h-4 text-primary shrink-0" />;
  return <Info className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) ?? 0));
  const ref = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) setNotifications(await res.json());
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => n.id > lastSeen).length;

  const markAllRead = () => {
    const maxId = notifications[0]?.id ?? 0;
    localStorage.setItem(SEEN_KEY, String(maxId));
    setLastSeen(maxId);
    fetch("/api/notifications/read-all", { method: "POST" });
  };

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const handleClick = (notif: Notification) => {
    setOpen(false);
    setLocation(notif.link);
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" onClick={handleOpen}>
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[1.1rem] min-h-[1.1rem] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge className="text-xs px-1.5">{unreadCount} new</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={markAllRead}>
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-96">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n) => {
                    const isUnread = n.id > lastSeen;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors flex items-start gap-3 ${isUnread ? "bg-primary/5" : ""}`}
                      >
                        <div className="mt-0.5">{getIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{n.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}</span>
                            {n.stockCode && <Badge variant="outline" className="text-xs font-mono px-1 py-0">{n.stockCode}</Badge>}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
