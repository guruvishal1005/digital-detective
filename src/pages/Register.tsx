import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    team_name: "",
    email: "",
    password: "",
    college_name: "",
    phone_number: "",
    member1: "",
    member2: "",
    member3: "",
    member4: "",
    member5: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const members = [form.member1, form.member2, form.member3, form.member4, form.member5].filter(Boolean);
    if (members.length < 2) {
      setError("At least 2 team members required.");
      return;
    }

    setLoading(true);
    const { error: err } = await signUp({
      email: form.email,
      password: form.password,
      team_name: form.team_name,
      college_name: form.college_name,
      phone_number: form.phone_number,
      member_names: members,
    });
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      navigate("/game");
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-mono font-bold text-primary">DIGITAL DETECTIVE</h1>
          <p className="text-muted-foreground text-sm">Register your investigation team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-lg border border-border bg-card">
          {error && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="team_name">Team Name</Label>
            <Input id="team_name" value={form.team_name} onChange={(e) => updateField("team_name", e.target.value)} required maxLength={50} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Team Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required maxLength={255} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required minLength={6} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="college_name">College Name</Label>
            <Input id="college_name" value={form.college_name} onChange={(e) => updateField("college_name", e.target.value)} required maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input id="phone_number" value={form.phone_number} onChange={(e) => updateField("phone_number", e.target.value)} required maxLength={15} />
          </div>

          <div className="space-y-2">
            <Label>Team Members (2-5 required)</Label>
            {[1, 2, 3, 4, 5].map((i) => (
              <Input
                key={i}
                placeholder={`Member ${i}${i <= 2 ? " (required)" : " (optional)"}`}
                value={form[`member${i}` as keyof typeof form]}
                onChange={(e) => updateField(`member${i}`, e.target.value)}
                required={i <= 2}
                maxLength={100}
              />
            ))}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registering..." : "Register Team"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
