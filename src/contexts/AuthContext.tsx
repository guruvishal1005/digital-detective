import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Hardcoded to ensure correct URL
const SUPABASE_URL = "https://shaodicjyuiqgnjgezdi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoYW9kaWNqeXVpcWduamdlemRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzAzNzUsImV4cCI6MjA4NzYwNjM3NX0.Mkx9RujnYykKHgxV-q1atlKyGVL-U-VRMjtCKt3CaD4";

interface UserData {
  id: string;
  email: string;
  role: "admin" | "team";
}

interface TeamData {
  id: string;
  team_name: string;
  email: string;
  college_name: string;
  phone_number: string;
  member_names: string[];
  highest_unlocked_level: number;
  start_time: string | null;
  finish_time: string | null;
}

interface AuthContextType {
  user: UserData | null;
  team: TeamData | null;
  role: "admin" | "team" | null;
  loading: boolean;
  signUp: (data: {
    email: string;
    password: string;
    team_name: string;
    college_name: string;
    phone_number: string;
    member_names: string[];
  }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshTeam: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "dcf_auth";

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [role, setRole] = useState<"admin" | "team" | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log("Stored auth data:", stored);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        console.log("Parsed auth data:", data);
        setUser(data.user);
        setTeam(data.team);
        setRole(data.user?.role || null);
      } catch (e) {
        console.error("Error parsing stored auth:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const refreshTeam = async () => {
    if (!user) return;
    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (teamData) {
      setTeam(teamData as unknown as TeamData);
      // Update localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        data.team = teamData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    }
  };

  const signUp = async (data: {
    email: string;
    password: string;
    team_name: string;
    college_name: string;
    phone_number: string;
    member_names: string[];
  }) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          p_email: data.email,
          p_password: data.password,
          p_team_name: data.team_name,
          p_college_name: data.college_name,
          p_phone_number: data.phone_number,
          p_member_names: data.member_names,
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        return { error: result.error || "Registration failed" };
      }

      // Auto login after registration
      return signIn(data.email, data.password);
    } catch (err: any) {
      return { error: err.message || "Registration failed" };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/login_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          p_email: email,
          p_password: password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Login API error:", response.status, errorText);
        return { error: `API error: ${response.status}` };
      }

      const result = await response.json();
      console.log("Login response:", result);
      
      // Handle case where result might be null or undefined
      if (!result) {
        return { error: "Empty response from server" };
      }

      if (!result.success) {
        return { error: result.error || "Login failed" };
      }

      // Store in state
      setUser(result.user || null);
      setRole(result.user?.role || null);
      
      // If team not in login response, fetch it separately
      let teamData = result.team;
      if (!teamData && result.user && result.user.role === 'team') {
        console.log("Team not in login response, fetching separately...");
        const { data: fetchedTeam } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", result.user.id)
          .maybeSingle();
        console.log("Fetched team:", fetchedTeam);
        teamData = fetchedTeam;
      }
      
      setTeam(teamData || null);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: result.user,
        team: teamData,
      }));

      return { error: null };
    } catch (err: any) {
      console.error("Login exception:", err);
      return { error: err.message || "Login failed" };
    }
  };

  const signOut = async () => {
    setUser(null);
    setTeam(null);
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, team, role, loading, signUp, signIn, signOut, refreshTeam }}>
      {children}
    </AuthContext.Provider>
  );
};
