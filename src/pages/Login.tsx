import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Utensils } from 'lucide-react';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'An error occurred sending the code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;
      // App.tsx auth listener handles redirect
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-slate-50 flex flex-col justify-center px-6 py-12">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-auto border border-slate-100 mt-auto mb-auto relative">
        <div className="flex flex-col items-center justify-center mb-10 text-emerald-600">
          <Utensils className="w-12 h-12 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Fitwiser</h1>
          <p className="text-slate-500 mt-2 text-sm">Simplifying weight loss</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-sm"
                placeholder="+1234567890"
              />
              <p className="text-slate-400 text-xs mt-2">Include country code (e.g., +1)</p>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 text-sm rounded-lg transition-colors shadow-sm shadow-emerald-500/30 flex items-center justify-center mt-2 disabled:opacity-70"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              ) : (
                'Send Code'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-sm text-center tracking-widest text-lg font-bold"
                placeholder="123456"
              />
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-emerald-600 text-xs mt-2 font-medium hover:underline focus:outline-none"
              >
                Change phone number
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !otp}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 text-sm rounded-lg transition-colors shadow-sm shadow-emerald-500/30 flex items-center justify-center mt-2 disabled:opacity-70"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              ) : (
                'Verify & Sign In'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
