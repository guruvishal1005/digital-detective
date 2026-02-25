import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { team_id, level_number, answer, user_id } = await req.json();

    // Validate input
    if (!team_id || !level_number || !answer || typeof answer !== "string" || !user_id) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (level_number < 1 || level_number > 5) {
      return new Response(JSON.stringify({ error: "Invalid level" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify team ownership using user_id from request
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", team_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (teamError || !team) {
      return new Response(JSON.stringify({ error: "Team not found or unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if level is unlocked
    if (level_number > team.highest_unlocked_level) {
      return new Response(JSON.stringify({ error: "Level locked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get progress for this level
    let { data: progress } = await supabase
      .from("game_progress")
      .select("*")
      .eq("team_id", team_id)
      .eq("level_number", level_number)
      .maybeSingle();

    // Check if already solved
    if (progress?.solved_at) {
      return new Response(JSON.stringify({ error: "Already solved", correct: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (progress?.locked_until) {
      const lockedUntil = new Date(progress.locked_until);
      if (lockedUntil > new Date()) {
        return new Response(
          JSON.stringify({
            correct: false,
            locked_until: progress.locked_until,
            message: "Too many attempts. Please wait.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get level data
    const { data: level } = await supabase
      .from("levels")
      .select("answer_key")
      .eq("level_number", level_number)
      .single();

    if (!level) {
      return new Response(JSON.stringify({ error: "Level not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize and compare
    const normalized = answer.trim().toLowerCase();
    const correct = normalized === level.answer_key.trim().toLowerCase();

    const newAttempts = (progress?.attempts || 0) + 1;
    const now = new Date().toISOString();

    if (correct) {
      // Update progress
      await supabase
        .from("game_progress")
        .update({ attempts: newAttempts, solved_at: now })
        .eq("team_id", team_id)
        .eq("level_number", level_number);

      // Unlock next level or finish
      if (level_number < 5) {
        await supabase
          .from("teams")
          .update({ highest_unlocked_level: level_number + 1 })
          .eq("id", team_id);
      } else {
        // Level 5 solved — stop timer
        await supabase
          .from("teams")
          .update({ highest_unlocked_level: 6, finish_time: now })
          .eq("id", team_id);
      }

      return new Response(
        JSON.stringify({ correct: true, message: "Correct!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Wrong answer
      const updateData: any = { attempts: newAttempts };

      // Lock after 5 wrong attempts (reset counter)
      if (newAttempts % 5 === 0) {
        updateData.locked_until = new Date(Date.now() + 30 * 1000).toISOString();
      }

      await supabase
        .from("game_progress")
        .update(updateData)
        .eq("team_id", team_id)
        .eq("level_number", level_number);

      return new Response(
        JSON.stringify({
          correct: false,
          attempts: newAttempts,
          locked_until: updateData.locked_until || null,
          message: "Incorrect answer.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
