"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { signInWithEmail } from '../../../services/authService';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signInWithEmail(email, password);
      if (res.error) throw res.error;
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Iniciar sesión</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Correo electrónico</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Contraseña</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full border rounded p-2" required />
          </div>
          <div className="flex items-center justify-between">
            <Link href="/recuperar-contrasena" className="text-sm text-slate-500">Recuperar contraseña</Link>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">{loading ? 'Entrando...' : 'Entrar'}</button>
          </div>
        </form>
        <div className="mt-4 text-sm text-slate-500">¿No tienes cuenta? <Link href="/registro" className="text-blue-600">Regístrate</Link></div>
      </div>
    </main>
  );
}
