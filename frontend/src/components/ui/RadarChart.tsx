import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

interface RadarData {
  subject: string;
  score: number;
  fullMark: number;
}

interface Props {
  data: RadarData[];
  size?: number;
}

export function ScoreRadarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#6b7280', fontSize: 12 }}
        />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}

export type { RadarData };
