// SafetyTrendChart.tsx
// Location: @/components/charts/SafetyTrendChart.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import { ShieldCheck } from "lucide-react";

type Props = {
  overall: number;
  acceleration: number;
  gyroscope: number;
  events: number;
  potholes: number;
  speedConsistency: number;
};

function clamp(v: any, a: number, b: number) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return a;
  return Math.max(a, Math.min(b, n));
}

// Get color based on score
function getScoreColor(score: number) {
  if (score >= 8) return "#22c55e"; // Green
  if (score >= 6) return "#eab308"; // Yellow
  if (score >= 4) return "#f97316"; // Orange
  return "#ef4444"; // Red
}

export default function SafetyTrendChart({
  overall,
  acceleration,
  gyroscope,
  events,
  potholes,
  speedConsistency,
}: Props) {
  const overallClamped = clamp(overall, 0, 10);
  const percentage = (overallClamped / 10) * 100;
  const scoreColor = getScoreColor(overallClamped);

  const metricList = [
    { name: "Acceleration", value: clamp(acceleration, 0, 10) },
    { name: "Gyroscope", value: clamp(gyroscope, 0, 10) },
    { name: "Events", value: clamp(events, 0, 10) },
    { name: "Potholes", value: clamp(potholes, 0, 10) },
    { name: "Speed", value: clamp(speedConsistency, 0, 10) },
  ];

  const COLORS = ["#34d399", "#60a5fa", "#f87171", "#fbbf24", "#8b5cf6"];

  return (
    <Card className="bg-card shadow-card border-0 mb-8">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Safety Index
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ========== OVERALL SCORE METER (FIRST) ========== */}
        <div className="flex flex-col items-center py-4">
          {/* Circular Gauge */}
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 4.4} 440`}
                className="transition-all duration-500"
              />
            </svg>
            {/* Score text in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                {overallClamped.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
          </div>
          
          {/* Label */}
          <div className="mt-3 text-center">
            <div className="font-semibold text-lg">Overall Safety Score</div>
            <div className="text-sm text-muted-foreground">
              {overallClamped >= 8 ? "Excellent" : 
               overallClamped >= 6 ? "Good" : 
               overallClamped >= 4 ? "Needs Improvement" : "Poor"}
            </div>
          </div>
        </div>

        {/* ========== BAR CHART ========== */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metricList}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} />
              <Tooltip formatter={(value: any) => `${value}/10`} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {metricList.map((item, idx) => (
                  <Cell key={item.name} fill={COLORS[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ========== RADAR CHART ========== */}
        <div className="h-44 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={metricList}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.35}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* ========== INDIVIDUAL METRICS ========== */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {metricList.map((item, idx) => (
            <div key={item.name} className="text-center p-2 bg-muted/30 rounded-lg">
              <div className="text-lg font-bold" style={{ color: COLORS[idx] }}>
                {item.value.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">{item.name}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}