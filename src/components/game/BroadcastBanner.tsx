import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

const BroadcastBanner: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Fetch latest active broadcast
    const fetchBroadcast = async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setMessage(data.message);
        setDismissed(false);
      }
    };
    fetchBroadcast();

    // Subscribe to new broadcasts
    const channel = supabase
      .channel("broadcasts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, (payload) => {
        if (payload.new && (payload.new as any).active) {
          setMessage((payload.new as any).message);
          setDismissed(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!message || dismissed) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
      <p className="text-sm text-primary font-mono flex-1">📢 {message}</p>
      <button onClick={() => setDismissed(true)} className="text-primary/60 hover:text-primary">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default BroadcastBanner;
