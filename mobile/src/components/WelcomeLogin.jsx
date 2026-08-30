import React, { useState } from 'react';
import { Mail, Lock, ShieldAlert, LogIn, Activity, ExternalLink, Eye, EyeOff, KeyRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function WelcomeLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ssoSimulated, setSsoSimulated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Credenciales inválidas o error de conexión.');
      }
      
      // Persistir token y datos de usuario en localStorage
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userEmail', data.user.email);
      if (data.user.nombre) {
        localStorage.setItem('userNombre', data.user.nombre);
      }
      if (data.user.role) {
        localStorage.setItem('userRole', data.user.role);
      }
      localStorage.setItem('userMustChangePassword', data.user.must_change_password ? 'true' : 'false');

      // Disparar callback
      onLoginSuccess(data.token, data.user);

    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = () => {
    setErrorMsg('El inicio de sesión único (SSO Corporativo Cencosud) mediante Azure Active Directory requiere la vinculación de DNS corporativos e infraestructura de red interna. Para la demostración técnica, por favor ingrese utilizando el formulario de Correo Institucional.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 py-8">
      {/* Tarjeta de Contenedor Principal */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300">
        
        {/* Cabecera Roja Corporativa Easy */}
        <div className="bg-easy-red p-8 text-center flex flex-col items-center gap-3">
          <div className="bg-white p-2.5 rounded-full shadow-md w-16 h-16 flex items-center justify-center border-2 border-yellow-400 overflow-hidden">
            <img src="/easy-logo.png" alt="Easy Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-xl tracking-tight">Fichas Técnicas</h1>
            <p className="text-red-100 text-xs mt-0.5 font-medium">Portal de Operaciones - Punto de Venta</p>
          </div>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-6">
          
          {ssoSimulated ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 border-4 border-easy-red border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="font-bold text-gray-700">Conectando con Cencosud SSO...</p>
                <p className="text-xs text-gray-500 mt-1">Redireccionando al Portal Único de Azure Active Directory</p>
              </div>
            </div>
          ) : (
            <>
              {/* Opción A: Botón de SSO Corporativo */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleSsoClick}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-blue-500/10 hover:shadow-lg transition-all flex justify-center items-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Iniciar Sesión Única (SSO Cencosud)
                </button>
                <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">o ingresar con</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>
              </div>

              {/* Opción B: Credenciales Locales / Contingencia */}
              <form onSubmit={handleStandardSubmit} className="space-y-4">
                
                {/* Campo: Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Correo Institucional</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="ej: usuario@easy.com.ar"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      spellCheck="false"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:bg-white focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Campo: Contraseña */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Contraseña</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      spellCheck="false"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:bg-white focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>

                {/* Mensaje de Error */}
                {errorMsg && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 flex gap-2 text-xs items-start">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-easy-red mt-0.5" />
                    <p className="font-semibold">{errorMsg}</p>
                  </div>
                )}

                {/* Botón Ingresar */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-easy-red hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3 rounded-xl shadow-md shadow-easy-red/10 hover:shadow-lg transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Validando...' : 'Iniciar Sesión'}
                </button>

              </form>
            </>
          )}

          {/* Modal de Recuperación de Contraseña */}
          <ForgotPasswordModal 
            isOpen={showForgotModal} 
            onClose={() => setShowForgotModal(false)} 
          />

          {/* Información de Contingencia */}
          <div className="mt-8 text-center text-[10px] text-gray-400">
            <p>Acceso restringido a personal de Easy S.A. e IT Cencosud.</p>
            <p className="mt-0.5">En caso de problemas de SSO, utilice sus credenciales locales de contingencia.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
