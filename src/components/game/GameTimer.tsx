import React, { useState, useEffect } from "react";

interface GameTimerProps {
  startTime: string | null;
  finishTime: string | null;
}

const GameTimer: React.FC<GameTimerProps> = ({ startTime, finishTime }) => {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!startTime) return;

    const update = () => {
      const start = new Date(startTime).getTime();
      const end = finishTime ? new Date(finishTime).getTime() : Date.now();
      const diff = Math.max(0, end - start);

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    update();
    if (!finishTime) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, finishTime]);

  if (!startTime) return null;

  return (
    <div className={`font-mono text-sm px-3 py-1 rounded border ${finishTime ? "border-primary/30 text-primary" : "border-border text-foreground"}`}>
      ⏱ {elapsed}
    </div>
  );
};

export default GameTimer;
