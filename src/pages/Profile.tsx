import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LogOut, User } from 'lucide-react';

export function Profile({ session }: { session: Session }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Profile</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
          <User className="w-10 h-10" />
        </div>
        
        <h2 className="text-lg font-semibold text-slate-800 break-all">{session.user.phone || session.user.email || 'Unknown User'}</h2>
        <p className="text-sm text-slate-500 mt-1 mb-8">Client Account</p>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium py-3 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        <p>Fitwiser Emergency Recovery</p>
        <p>Connected to Safe Backend</p>
      </div>
    </div>
  );
}
