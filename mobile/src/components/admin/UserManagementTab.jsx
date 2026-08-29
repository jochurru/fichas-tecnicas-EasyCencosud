import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Key, Lock, Trash2, Power, CheckCircle, AlertTriangle, Copy, Shield } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function UserManagementTab({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [emailInput, setEmailInput] = useState('');
  const [nombreInput, setNombreInput] = useState('');
  const [rolInput, setRolInput] = useState('operador');
  const [emailCheckMsg, setEmailCheckMsg] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);

  const canManage = ['gerente', 'subadmin', 'jefe_sector'].includes(currentUser?.role);
  const canDelete = ['gerente', 'subadmin'].includes(currentUser?.role);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Error al cargar la lista de usuarios.');
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEmailBlur = async () => {
    if (!emailInput || !emailInput.includes('@')) return;
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios/validar-email?email=${encodeURIComponent(emailInput)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.exists) {
        setEmailCheckMsg({
          type: 'error',
          text: `El usuario ya existe. Sugerencia: ${data.suggestedEmail}`
        });
      } else {
        setEmailCheckMsg({ type: 'success', text: 'Email disponible' });
      }
    } catch (err) {
      console.warn('Error al validar email:', err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          email: emailInput,
          nombre: nombreInput,
          rol: rolInput,
          sector_id: currentUser?.sector_id || 1
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario.');

      setCreatedResult(data);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResetTempPassword = async (userId) => {
    if (!window.confirm('¿Regenerar la clave temporal para este usuario?')) return;
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios/${userId}/reset-temp-password`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al resetear la clave.');
      alert(`✅ Nueva Clave Temporal: ${data.tempPassword}`);
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ activo: !currentStatus })
      });
      if (!res.ok) throw new Error('Error al cambiar el estado del usuario.');
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`⚠️ ¿Eliminar PERMANENTEMENTE la cuenta de ${userEmail}?`)) return;
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/usuarios/${userId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Error al eliminar usuario.');
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-bold text-slate-700">Acceso Restringido</h4>
        <p className="text-xs text-slate-400 mt-1">La gestión de usuarios está reservada para la Gerencia y Jefaturas de Sector.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Cabecera */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            <span>Usuarios de la Tienda</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Alta de personal, asignación de roles y control de credenciales temporales.
          </p>
        </div>
        <button
          onClick={() => { setIsModalOpen(true); setCreatedResult(null); setEmailInput(''); setNombreInput(''); }}
          className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/20 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Nuevo Usuario</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Usuarios */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs font-medium">Cargando usuarios...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">Usuario / Email</th>
                <th className="p-3.5">Rol</th>
                <th className="p-3.5">Estado Clave</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800">{u.nombre}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                      {u.rol}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {u.must_change_password ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <Key className="w-3 h-3" /> Pendiente Primer Login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Lock className="w-3 h-3" /> Clave Privada Personal
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-1">
                    {u.must_change_password && (
                      <button
                        onClick={() => handleResetTempPassword(u.id)}
                        title="Ver / Regenerar Clave Temporal"
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <>
                        <button
                          onClick={() => handleToggleStatus(u.id, u.activo)}
                          title={u.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
                          className={`p-1.5 rounded-lg text-xs font-bold transition ${
                            u.activo ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          title="Eliminar Permanente"
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Creación de Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden font-sans">
            <div className="bg-red-600 text-white p-5 flex justify-between items-center">
              <h4 className="font-black text-sm flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <span>Crear Nuevo Usuario de Tienda</span>
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white font-bold">✕</button>
            </div>

            {createdResult ? (
              <div className="p-6 text-center space-y-4">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-slate-800 text-base">¡Usuario Creado Exitosamente!</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                  <div><strong>Email:</strong> {createdResult.user.email}</div>
                  <div><strong>Nombre:</strong> {createdResult.user.nombre}</div>
                  <div><strong>Rol:</strong> {createdResult.user.rol.toUpperCase()}</div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-900 font-mono font-bold">
                    <span>Clave Temp: {createdResult.tempPassword}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(createdResult.tempPassword); alert('¡Clave copiada!'); }}
                      className="p-1 hover:bg-amber-100 rounded text-amber-800"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{error}</div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre y Apellido</label>
                  <input
                    type="text"
                    value={nombreInput}
                    onChange={(e) => setNombreInput(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Institucional</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="juan.perez@easy.com.ar"
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                  />
                  {emailCheckMsg && (
                    <span className={`text-[11px] font-bold block mt-1 ${emailCheckMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {emailCheckMsg.text}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rol Asignado</label>
                  <select
                    value={rolInput}
                    onChange={(e) => setRolInput(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white font-bold text-slate-700"
                  >
                    <option value="operador">Operador / Vendedor de Salón</option>
                    <option value="coordinador">Coordinador de Sector</option>
                    {['gerente', 'subadmin'].includes(currentUser?.role) && (
                      <>
                        <option value="jefe_sector">Jefe de Sector</option>
                        <option value="subadmin">Subadministrador</option>
                        <option value="gerente">Gerente de Tienda</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
                  >
                    {creating ? 'Creando Usuario...' : 'Crear Usuario y Generar Clave Temp'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
