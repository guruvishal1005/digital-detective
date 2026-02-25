import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-mono font-bold text-primary tracking-tight">
            DIGITAL<br />DETECTIVE
          </h1>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto" />
          <p className="text-muted-foreground text-sm font-mono">
            Forensic Investigation Challenge
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/register")}
            className="w-full h-12 text-base font-mono"
            size="lg"
          >
            <Users className="w-4 h-4 mr-2" />
            Register Your Team
          </Button>

          <Button
            onClick={() => navigate("/login")}
            variant="outline"
            className="w-full h-12 text-base font-mono"
            size="lg"
          >
            Sign In
          </Button>

          <Button
            onClick={() => navigate("/admin")}
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs font-mono"
          >
            <Shield className="w-3 h-3 mr-1" />
            Admin Access
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/60 font-mono">
          5 levels · Timed investigation · Team-based
        </p>
      </div>
    </div>
  );
};

export default Index;
