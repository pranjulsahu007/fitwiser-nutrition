import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { AlertCircle, FileStack } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  followed: { label: 'Followed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  partially_followed: { label: 'Partially Followed', bg: 'bg-amber-100', text: 'text-amber-700' },
  skipped: { label: 'Skipped', bg: 'bg-rose-100', text: 'text-rose-700' },
  replaced: { label: 'Replaced', bg: 'bg-orange-100', text: 'text-orange-700' },
  custom: { label: 'Custom', bg: 'bg-blue-100', text: 'text-blue-700' },
};

export function History({ session }: { session: Session }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', session.user.id)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code === '42P01') {
            setErrorMsg("Table not provisioned yet.");
          } else {
             setErrorMsg(error.message);
          }
          return;
        }

        setLogs(data || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [session.user.id]);

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = log.log_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">History</h1>
        <p className="text-slate-500 text-sm mt-1">Your past meal adherence logs</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
           <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin"></div>
        </div>
      ) : errorMsg ? (
        <div className="bg-slate-100 p-8 rounded-2xl flex flex-col items-center justify-center text-center border border-slate-200 border-dashed">
          <AlertCircle className="w-10 h-10 text-slate-400 mb-3" />
          <p className="text-slate-600 font-medium">{errorMsg}</p>
        </div>
      ) : Object.keys(groupedLogs).length === 0 ? (
        <div className="bg-slate-50 p-8 rounded-2xl flex flex-col items-center justify-center text-center border border-slate-200 border-dashed mt-10">
          <FileStack className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No logs yet</h3>
          <p className="text-slate-500 text-sm mt-1 mb-4">You haven't logged any meals yet. Head to "Today" to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([dateStr, dayLogs]) => (
            <div key={dateStr} className="space-y-3">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50 py-1 z-10">
                {format(parseISO(dateStr), 'EEEE, MMM d, yyyy')}
              </h2>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {dayLogs.map((log) => {
                  const statusInfo = STATUS_MAP[log.adherence_status] || { label: log.adherence_status, bg: 'bg-slate-100', text: 'text-slate-700' };
                  
                  return (
                    <div key={log.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-800">{log.meal_type || 'Unknown Meal'}</span>
                        <span className={cn("text-[9px] font-bold uppercase tracking-tight px-2 py-1 rounded-full", statusInfo.bg, statusInfo.text)}>
                          {statusInfo.label}
                        </span>
                      </div>
                      
                      {log.notes_for_coach ? (
                        <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-xs font-semibold text-slate-400 mb-1">Notes:</span>
                          "{log.notes_for_coach}"
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1 italic">No notes provided</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
