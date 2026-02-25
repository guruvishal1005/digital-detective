import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Send, Upload, RefreshCw } from "lucide-react";

const AdminPage = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) navigate("/login");
  }, [loading, user, role]);

  if (loading || role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono">Verifying clearance...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <h1 className="font-mono font-bold text-primary text-lg">ADMIN CONTROL CENTER</h1>
        <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); navigate("/login"); }}>
          Sign Out
        </Button>
      </header>

      <div className="flex-1 p-4">
        <Tabs defaultValue="monitor" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="monitor">Live Monitor</TabsTrigger>
            <TabsTrigger value="levels">Level Management</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor"><LiveMonitor /></TabsContent>
          <TabsContent value="levels"><LevelManager /></TabsContent>
          <TabsContent value="broadcast"><BroadcastManager /></TabsContent>
          <TabsContent value="export"><ExportPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Live Monitor Component
const LiveMonitor = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: t } = await supabase.from("teams").select("*").order("created_at");
    const { data: p } = await supabase.from("game_progress").select("*");
    if (t) setTeams(t);
    if (p) setProgress(p);
  };

  useEffect(() => {
    fetchData();

    const ch1 = supabase.channel("admin-teams").on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchData).subscribe();
    const ch2 = supabase.channel("admin-progress").on("postgres_changes", { event: "*", schema: "public", table: "game_progress" }, fetchData).subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const getTeamStatus = (team: any) => {
    if (team.finish_time) return "Completed";
    if (team.highest_unlocked_level === 5) return "Final Stage";
    if (team.start_time) return "Investigating";
    return "Not Started";
  };

  const getElapsed = (team: any) => {
    if (!team.start_time) return "—";
    const start = new Date(team.start_time).getTime();
    const end = team.finish_time ? new Date(team.finish_time).getTime() : Date.now();
    const diff = Math.max(0, end - start);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getTeamAttempts = (teamId: string) => {
    return progress.filter((p: any) => p.team_id === teamId).reduce((sum: number, p: any) => sum + (p.attempts || 0), 0);
  };

  const getTeamHints = (teamId: string) => {
    return progress.filter((p: any) => p.team_id === teamId && p.hint_taken).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-primary text-sm tracking-wider">LIVE TEAM STATUS ({teams.length} teams)</h2>
        <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Team</th>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Level</th>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Elapsed</th>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Attempts</th>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Hints</th>
              <th className="text-left px-3 py-2 font-mono text-xs text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team: any) => (
              <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{team.team_name}</td>
                <td className="px-3 py-2 font-mono">{team.highest_unlocked_level}</td>
                <td className="px-3 py-2 font-mono text-xs">{getElapsed(team)}</td>
                <td className="px-3 py-2 font-mono">{getTeamAttempts(team.id)}</td>
                <td className="px-3 py-2 font-mono">{getTeamHints(team.id)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                    getTeamStatus(team) === "Completed" ? "bg-primary/10 text-primary" :
                    getTeamStatus(team) === "Final Stage" ? "bg-accent/10 text-accent" :
                    getTeamStatus(team) === "Investigating" ? "bg-secondary text-secondary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {getTeamStatus(team)}
                  </span>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No teams registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Level Manager Component
const LevelManager = () => {
  const [levels, setLevels] = useState<any[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ story_text: "", answer_key: "", hint_text: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchLevels = async () => {
      const { data } = await supabase.from("levels").select("*").order("level_number");
      if (data) setLevels(data);
    };
    fetchLevels();
  }, []);

  const startEdit = (level: any) => {
    setEditing(level.level_number);
    setForm({
      story_text: level.story_text ?? "",
      answer_key: level.answer_key ?? "",
      hint_text: level.hint_text ?? ""
    });
  };

  const saveEdit = async (levelId: string) => {
    await supabase.from("levels").update({
      story_text: form.story_text,
      answer_key: form.answer_key.toLowerCase().trim(),
      hint_text: form.hint_text,
    }).eq("id", levelId);

    setEditing(null);
    const { data } = await supabase.from("levels").select("*").order("level_number");
    if (data) setLevels(data);
  };

  const uploadFile = async (levelNumber: number, type: "zip" | "audio", file: File) => {
    setUploading(true);
    const bucket = type === "zip" ? "evidence" : "narration";
    const ext = type === "zip" ? "zip" : "wav";
    const path = `level-${levelNumber}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const field = type === "zip" ? "zip_file_url" : "story_audio_url";

    // Since buckets are private, create signed URL
    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

    await supabase.from("levels").update({ [field]: signedData?.signedUrl || urlData.publicUrl }).eq("level_number", levelNumber);

    const { data } = await supabase.from("levels").select("*").order("level_number");
    if (data) setLevels(data);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-primary text-sm tracking-wider">LEVEL CONFIGURATION</h2>

      {levels.map((level: any) => (
        <div key={level.id} className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold text-primary">Level {level.level_number}</h3>
            {editing === level.level_number ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(level.id)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit(level)}>Edit</Button>
            )}
          </div>

          {editing === level.level_number ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Story Text</Label>
                <Textarea value={form.story_text} onChange={(e) => setForm({ ...form, story_text: e.target.value })} rows={3} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Answer Key (will be lowercased)</Label>
                <Input value={form.answer_key} onChange={(e) => setForm({ ...form, answer_key: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hint Text</Label>
                <Textarea value={form.hint_text} onChange={(e) => setForm({ ...form, hint_text: e.target.value })} rows={2} />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground/60">Story:</span>{" "}
                {(level.story_text ?? "No story configured").slice(0, 100)}
                {level.story_text && level.story_text.length > 100 ? "..." : ""}
              </p>

              <p>
                <span className="text-foreground/60">Answer:</span>{" "}
                {level.answer_key ?? "—"}
              </p>

              <p>
                <span className="text-foreground/60">Hint:</span>{" "}
                {(level.hint_text ?? "No hint").slice(0, 80)}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
              <Upload className="w-3 h-3" />
              Upload ZIP
              <input type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(level.level_number, "zip", e.target.files[0])} disabled={uploading} />
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
              <Upload className="w-3 h-3" />
              Upload WAV
              <input type="file" accept=".wav,.mp3" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(level.level_number, "audio", e.target.files[0])} disabled={uploading} />
            </label>
            {level.zip_file_url && <span className="text-xs text-primary">✓ ZIP</span>}
            {level.story_audio_url && <span className="text-xs text-primary">✓ Audio</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// Broadcast Manager
const BroadcastManager = () => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
      if (data) setHistory(data);
    };
    fetch();
  }, []);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabase.from("broadcasts").insert({ message: message.trim() });
    setMessage("");
    setSending(false);
    const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setHistory(data);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="font-mono text-primary text-sm tracking-wider">BROADCAST MESSAGE</h2>
      <div className="flex gap-2">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message for all teams..." maxLength={500} />
        <Button onClick={send} disabled={sending || !message.trim()}>
          <Send className="w-4 h-4 mr-1" /> Send
        </Button>
      </div>
      <div className="space-y-2">
        {history.map((b: any) => (
          <div key={b.id} className="text-sm text-muted-foreground border-l-2 border-border pl-3 py-1">
            <p>{b.message}</p>
            <p className="text-xs">{new Date(b.created_at).toLocaleTimeString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Export Panel
const ExportPanel = () => {
  const exportCSV = async () => {
    const { data: teams } = await supabase.from("teams").select("*");
    const { data: progress } = await supabase.from("game_progress").select("*");
    if (!teams) return;

    const rows = teams.map((t: any) => {
      const teamProgress = progress?.filter((p: any) => p.team_id === t.id) || [];
      const totalAttempts = teamProgress.reduce((s: number, p: any) => s + (p.attempts || 0), 0);
      const hintsUsed = teamProgress.filter((p: any) => p.hint_taken).length;
      const elapsed = t.start_time && t.finish_time
        ? Math.round((new Date(t.finish_time).getTime() - new Date(t.start_time).getTime()) / 1000)
        : null;
      return {
        team_name: t.team_name,
        college: t.college_name,
        level: t.highest_unlocked_level,
        completed: !!t.finish_time,
        elapsed_seconds: elapsed,
        total_attempts: totalAttempts,
        hints_used: hintsUsed,
      };
    });

    // Sort: completed first, then by time, then by attempts
    rows.sort((a: any, b: any) => {
      if (a.completed && !b.completed) return -1;
      if (!a.completed && b.completed) return 1;
      if (a.completed && b.completed) {
        if ((a.elapsed_seconds || Infinity) !== (b.elapsed_seconds || Infinity))
          return (a.elapsed_seconds || Infinity) - (b.elapsed_seconds || Infinity);
        return a.total_attempts - b.total_attempts;
      }
      return b.level - a.level;
    });

    const header = "Rank,Team,College,Level,Completed,Time(s),Attempts,Hints\n";
    const csv = header + rows.map((r: any, i: number) =>
      `${i + 1},"${r.team_name}","${r.college}",${r.level},${r.completed},${r.elapsed_seconds ?? ""},${r.total_attempts},${r.hints_used}`
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-primary text-sm tracking-wider">LEADERBOARD EXPORT</h2>
      <p className="text-sm text-muted-foreground">Export sorted leaderboard as CSV. Completed teams first, sorted by time and attempts.</p>
      <Button onClick={exportCSV}>
        <Download className="w-4 h-4 mr-2" /> Export CSV
      </Button>
    </div>
  );
};

export default AdminPage;
