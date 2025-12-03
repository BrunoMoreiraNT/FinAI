
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { Lock, Mail, Loader2 } from 'lucide-react';

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('Falha no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
           <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4">
             <Lock className="text-white" size={24}/>
           </div>
           <h1 className="text-2xl font-bold text-slate-800">Bem-vindo ao FinAI</h1>
           <p className="text-slate-500 text-sm mt-2">Seu assessor financeiro pessoal</p>
        </div>

        {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 border border-rose-100">
                {error}
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase">E-mail</label>
             <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18}/>
                <input 
                  type="email" 
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
             </div>
           </div>
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
             <input 
                type="password" 
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
           </div>

           <button 
             type="submit" 
             disabled={loading}
             className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70"
           >
             {loading ? <Loader2 className="animate-spin" size={20}/> : 'Entrar'}
           </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-6">Acesso restrito a usuários autorizados.</p>
      </div>
    </div>
  );
};

export default AuthScreen;
