import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TypewriterText from "@/components/game/TypewriterText";
import GameTimer from "@/components/game/GameTimer";
import BroadcastBanner from "@/components/game/BroadcastBanner";
import { Download, Lock, Unlock, Volume2, VolumeX, AlertTriangle, CheckCircle } from "lucide-react";

const GamePage = () => {
  const { user, team, role, loading, refreshTeam, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelData, setLevelData] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "locked"; message: string } | null>(null);
  const [narrationDone, setNarrationDone] = useState(false);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [hasSeenNarration, setHasSeenNarration] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [hintAvailable, setHintAvailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && role === "admin") navigate("/admin");
  }, [loading, user, role]);

  // Start timer on first level entry
  useEffect(() => {
    if (!team || team.start_time) return;
    if (currentLevel === 1) {
      supabase.from("teams").update({ start_time: new Date().toISOString() }).eq("id", team.id).then(() => refreshTeam());
    }
  }, [team, currentLevel]);

  // Fetch level data
  useEffect(() => {
    const fetchLevel = async () => {
      const { data } = await supabase
        .from("levels")
        .select("*")
        .eq("level_number", currentLevel)
        .maybeSingle();
      setLevelData(data);
    };
    fetchLevel();
  }, [currentLevel]);

  // Fetch/create progress for this level
  useEffect(() => {
    if (!team) return;
    const fetchProgress = async () => {
      let { data } = await supabase
        .from("game_progress")
        .select("*")
        .eq("team_id", team.id)
        .eq("level_number", currentLevel)
        .maybeSingle();

      if (!data) {
        const now = new Date();
        const hintAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
        const { data: newData } = await supabase
          .from("game_progress")
          .insert({
            team_id: team.id,
            level_number: currentLevel,
            first_entered_at: now.toISOString(),
            hint_available_at: hintAt,
          })
          .select()
          .single();
        data = newData;
      }

      setProgress(data);
      setHasSeenNarration(!!data?.solved_at);
      setHintRevealed(!!data?.hint_taken);

      // Check hint availability
      if (data?.hint_available_at) {
        const available = new Date(data.hint_available_at) <= new Date();
        setHintAvailable(available);
        if (!available) {
          const timeout = setTimeout(() => setHintAvailable(true), new Date(data.hint_available_at).getTime() - Date.now());
          return () => clearTimeout(timeout);
        }
      }
    };
    fetchProgress();
  }, [team, currentLevel]);

  // Audio handling
  const playAudio = useCallback(() => {
    if (!levelData?.story_audio_url) {
      setNarrationDone(true);
      return;
    }
    const audio = new Audio(levelData.story_audio_url);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.play().catch(() => {
      setNarrationDone(true);
      setIsPlaying(false);
    });
    audio.onended = () => {
      setNarrationDone(true);
      setIsPlaying(false);
    };
    audio.onerror = () => {
      setNarrationDone(true);
      setIsPlaying(false);
    };
  }, [levelData]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Start narration when level loads (first time)
  useEffect(() => {
    if (levelData && !hasSeenNarration) {
      playAudio();
    }
    return () => stopAudio();
  }, [levelData, hasSeenNarration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || !team || submitting || !user) return;

    // Check cooldown
    if (progress?.locked_until && new Date(progress.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(progress.locked_until).getTime() - Date.now()) / 1000);
      setFeedback({ type: "locked", message: `Too many attempts. Try again in ${remaining}s.` });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.functions.invoke("validate-answer", {
        body: { team_id: team.id, level_number: currentLevel, answer: answer.trim(), user_id: user.id },
      });

      if (error) throw error;

      if (data.correct) {
        setFeedback({ type: "success", message: "Correct! Evidence unlocked." });
        await refreshTeam();
        // Refresh progress
        const { data: updatedProgress } = await supabase
          .from("game_progress")
          .select("*")
          .eq("team_id", team.id)
          .eq("level_number", currentLevel)
          .maybeSingle();
        setProgress(updatedProgress);

        if (currentLevel < 5) {
          setTimeout(() => {
            setCurrentLevel(currentLevel + 1);
            setFeedback(null);
            setAnswer("");
            setNarrationDone(false);
            setTypewriterDone(false);
            setHasSeenNarration(false);
            setHintRevealed(false);
            setHintAvailable(false);
          }, 2000);
        }
      } else {
        if (data.locked_until) {
          setFeedback({ type: "locked", message: `Too many wrong attempts. Locked for 30 seconds.` });
        } else {
          setFeedback({ type: "error", message: `Incorrect. ${5 - (data.attempts || 0)} attempts remaining.` });
        }
        // Refresh progress
        const { data: updatedProgress } = await supabase
          .from("game_progress")
          .select("*")
          .eq("team_id", team.id)
          .eq("level_number", currentLevel)
          .maybeSingle();
        setProgress(updatedProgress);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Submission failed." });
    }

    setSubmitting(false);
    setAnswer("");
  };

  const revealHint = async () => {
    if (!team) return;
    setHintRevealed(true);
    await supabase
      .from("game_progress")
      .update({ hint_taken: true })
      .eq("team_id", team.id)
      .eq("level_number", currentLevel);
  };

  const downloadEvidence = () => {
    if (levelData?.zip_file_url) {
      window.open(levelData.zip_file_url, "_blank");
    }
  };

  if (loading || !team) {
    console.log("GamePage loading state:", { loading, team, user, role });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground font-mono">Loading case files...</div>
      </div>
    );
  }

  const isCompleted = !!team.finish_time;
  const isSolved = !!progress?.solved_at;
  const canInteract = hasSeenNarration || typewriterDone || narrationDone;

  return (
    <div className="min-h-screen flex flex-col">
      <BroadcastBanner />

      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <h1 className="font-mono font-bold text-primary text-lg">DIGITAL DETECTIVE</h1>
          <span className="text-sm text-muted-foreground">Team: {team.team_name}</span>
        </div>
        <div className="flex items-center gap-4">
          <GameTimer startTime={team.start_time} finishTime={team.finish_time} />
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/login"); }}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Level selector */}
      <div className="flex gap-2 px-4 py-3 border-b border-border bg-card/50">
        {[1, 2, 3, 4, 5].map((lvl) => {
          const unlocked = lvl <= (team.highest_unlocked_level || 1);
          const active = lvl === currentLevel;
          return (
            <button
              key={lvl}
              onClick={() => unlocked && setCurrentLevel(lvl)}
              disabled={!unlocked}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono transition-all
                ${active ? "bg-primary text-primary-foreground" : ""}
                ${unlocked && !active ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer" : ""}
                ${!unlocked ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" : ""}
              `}
            >
              {unlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              Level {lvl}
            </button>
          );
        })}
      </div>

      {isCompleted && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 text-center">
          <p className="text-primary font-mono font-bold">🎉 CASE CLOSED — Investigation Complete!</p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-6 space-y-6">
        {levelData ? (
          <>
            {/* Story narration */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-primary text-sm tracking-wider">
                  CASE FILE — LEVEL {currentLevel}
                </h2>
                {canInteract && (
                  <Button variant="ghost" size="sm" onClick={isPlaying ? stopAudio : playAudio}>
                    {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                )}
              </div>

              <div className="min-h-[120px]">
                {!hasSeenNarration ? (
                  <TypewriterText
                    text={levelData.story_text}
                    speed={30}
                    onComplete={() => setTypewriterDone(true)}
                  />
                ) : (
                  <p className="text-foreground/90 leading-relaxed">{levelData.story_text}</p>
                )}
              </div>
            </div>

            {/* Actions — only visible after narration */}
            {canInteract && (
              <div className="space-y-4 animate-fade-in-up">
                {/* Download evidence */}
                {levelData.zip_file_url && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={downloadEvidence}
                  >
                    <Download className="w-4 h-4" /> Download Evidence Package
                  </Button>
                )}

                {/* Hint section */}
                {!isSolved && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    {hintAvailable ? (
                      hintRevealed ? (
                        <div className="space-y-2">
                          <p className="text-xs font-mono text-primary tracking-wider">INVESTIGATIVE LEAD</p>
                          <p className="text-sm text-foreground/80">{levelData.hint_text}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-primary font-mono">🔍 Investigative Lead Available</span>
                          <Button variant="outline" size="sm" onClick={revealHint}>Reveal Hint</Button>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground font-mono">
                        Investigative lead will be available after 20 minutes...
                      </p>
                    )}
                  </div>
                )}

                {/* Answer submission */}
                {!isSolved ? (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter your answer key..."
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="font-mono"
                        maxLength={200}
                        disabled={submitting}
                      />
                      <Button type="submit" disabled={submitting || !answer.trim()}>
                        {submitting ? "..." : "Submit"}
                      </Button>
                    </div>
                    {progress && (
                      <p className="text-xs text-muted-foreground">
                        Attempts: {progress.attempts}/5 before cooldown
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center gap-2 text-primary font-mono text-sm">
                    <CheckCircle className="w-4 h-4" /> Level {currentLevel} — Solved
                  </div>
                )}

                {/* Feedback */}
                {feedback && (
                  <div className={`p-3 rounded text-sm flex items-center gap-2 ${
                    feedback.type === "success" ? "bg-primary/10 text-primary border border-primary/20" :
                    feedback.type === "locked" ? "bg-muted text-muted-foreground border border-border" :
                    "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}>
                    {feedback.type === "locked" && <AlertTriangle className="w-4 h-4" />}
                    {feedback.message}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground font-mono py-12">
            Loading level data...
          </div>
        )}
      </main>
    </div>
  );
};

export default GamePage;
