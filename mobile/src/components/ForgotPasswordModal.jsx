import React, { useState } from 'react';
import { Mail, ShieldCheck, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud.');
      }

      setMessage(data.message || 'Si el correo está registrado en la base institucional, recibirás las instrucciones para restablecer tu contraseña.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden font-sans animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 text-center relative">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-sm">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-black tracking-tight">Recuperación de Contraseña</h3>
          <p className="text-xs text-red-100 mt-1">
            Portal Institucional de Fichas Técnicas Easy
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {message ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-700 font-bold leading-relaxed">{message}</p>
              <p className="text-[11px] text-slate-400">
                Revisá tu casilla de correo o contactá a tu Jefe de Sector si estás en salón.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold transition"
              >
                Entendido / Volver al Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                Ingresá tu correo institucional. Te enviaremos un enlace seguro para crear una nueva contraseña privada.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="ej: usuario@easy.com.ar"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Enviando...' : 'Enviar Enlace'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
