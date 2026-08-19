import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { safeFetch } from '../utils/safeFetch';
import { Activity } from 'lucide-react';

export default function CerebrasUsageChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const res = await safeFetch("/api/usage/cerebras");
        if (res.ok) {
           const result = await res.json();
           if (result.success && Array.isArray(result.data) && result.data.length > 0) {
              // Sort data by date
              const sorted = result.data.sort((a, b) => a.date.localeCompare(b.date));
              if (isMounted) setData(sorted);
           }
        }
      } catch (e) {
        console.warn("Failed to fetch Cerebras usage", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();
    return () => { isMounted = false; };
  }, []);

  if (loading) return null;

  return (
    <div className="w-full glass p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-orange-500" />
        <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Thống kê sử dụng AI (Cerebras)</h4>
      </div>
      
      {data.length === 0 ? (
        <div className="h-48 w-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
          <Activity className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Chưa có dữ liệu sử dụng AI</p>
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCerebras" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => val.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelFormatter={(label) => `Ngày: ${label}`}
                formatter={(value) => [`${value} calls`, 'API Requests']}
              />
              <Area type="monotone" dataKey="calls" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorCerebras)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
