import { Outlet } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';

export function Layout({ session }: { session: Session }) {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#fafafa] relative max-w-md mx-auto shadow-xl overflow-hidden border-x border-slate-100">
      <main className="flex-1 overflow-y-auto w-full pb-8 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
