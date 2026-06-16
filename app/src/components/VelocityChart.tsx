import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VELOCITY_DATA } from '../data/mock';
import { GlassCard } from './GlassCard';

export function VelocityChart() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">
          Velocity
        </h3>
        <span className="font-label text-label-caps text-on-surface-variant">tasks/wk by month</span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={VELOCITY_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb7e9" stopOpacity={1} />
                <stop offset="100%" stopColor="#94f1fb" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d3c2cb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#4f434b', fontSize: 11, fontFamily: 'Space Grotesk' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#4f434b', fontSize: 11, fontFamily: 'Space Grotesk' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,183,233,0.1)' }}
              contentStyle={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.8)',
                borderRadius: '8px',
                fontFamily: 'Plus Jakarta Sans',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="tasks" fill="url(#bar-grad)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
