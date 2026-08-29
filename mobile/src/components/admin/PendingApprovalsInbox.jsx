import React, { useState, useEffect } from 'react';
import { Inbox, CheckCircle, XCircle, Upload, AlertTriangle, FileText, Image as ImageIcon, Eye } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function PendingApprovalsInbox({ user }) {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFicha, setSelectedFicha] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);

  const isBossOrAbove = ['gerente', 'subadmin', 'jefe_sector', 'coordinador'].includes(user?.role);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/aprobaciones/pendientes`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 401) {
        localStorage.removeItem('userToken');
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(`Error al cargar la bandeja de aprobaciones (HTTP ${res.status}).`);
      const data = await res.json();
      setFichas(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (fichaId) => {
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/aprobaciones/${fichaId}/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          foto_url: photoUrlInput || selectedFicha?.foto_url
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar ficha.');

      setActionSuccess('¡Ficha aprobada y publicada oficialmente!');
      setSelectedFicha(null);
      setPhotoUrlInput('');
      fetchPending();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (fichaId) => {
    if (!rejectReason.trim()) {
      setError('Debe especificar un motivo de rechazo.');
      return;
    }
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/aprobaciones/${fichaId}/rechazar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ observaciones: rejectReason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar ficha.');

      setActionSuccess('Ficha devuelta con observaciones.');
      setSelectedFicha(null);
      setRejectReason('');
      fetchPending();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('userToken');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/storage/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la foto.');

      setPhotoUrlInput(data.publicUrl);
    } catch (err) {
      alert('Error subiendo imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!isBossOrAbove) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-bold text-slate-700">Acceso Restringido</h4>
        <p className="text-xs text-slate-400 mt-1">La bandeja de aprobaciones está reservada para Coordinadores, Jefes de Sector y Gerencia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Banner Superior */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Inbox className="w-5 h-5 text-red-600" />
            <span>Bandeja de Pendientes por Sector</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Fichas creadas por IA o vendedores que requieren validación técnica y foto oficial antes de ser impresas.
          </p>
        </div>
        <button
          onClick={fetchPending}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          Actualizar
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Fichas Pendientes */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs font-medium">Cargando borradores pendientes...</div>
      ) : fichas.length === 0 ? (
        <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h5 className="font-bold text-sm text-slate-700">¡Bandeja al día!</h5>
          <p className="text-xs text-slate-400 mt-1">No hay fichas pendientes de revisión en tu sector.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fichas.map((f) => (
            <div key={f.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    f.estado === 'generada_ia' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {f.estado === 'generada_ia' ? '⚠️ Generada por IA' : '⌛ Pendiente Revisión'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">SAP {f.sku}</span>
                </div>

                <h5 className="font-bold text-sm text-slate-800 line-clamp-1">{f.tipo_herramienta || f.nombre || 'Herramienta'}</h5>
                <p className="text-xs text-red-600 font-bold uppercase">{f.marca}</p>

                <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Especificaciones del borrador:</span>
                  {Array.isArray(f.especificaciones) && f.especificaciones.slice(0, 3).map((spec, i) => (
                    <div key={i} className="truncate text-slate-700">
                      <strong>{spec.clave}:</strong> {spec.valor}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => { setSelectedFicha(f); setPhotoUrlInput(f.foto_url || ''); }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Revisar y Aprobar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Inspección y Aprobación */}
      {selectedFicha && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <h4 className="font-black text-sm">Revisión de Ficha: {selectedFicha.marca} - SAP {selectedFicha.sku}</h4>
              <button onClick={() => setSelectedFicha(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Carga de Foto Oficial */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-red-600" />
                  <span>Foto Oficial de Producto (Requerida para Publicar)</span>
                </label>

                {(photoUrlInput || selectedFicha.foto_url) ? (
                  <div className="flex items-center gap-3 mb-2">
                    <img src={photoUrlInput || selectedFicha.foto_url} alt="Foto Oficial" className="w-16 h-16 object-contain bg-white rounded-lg border border-slate-200 p-1" />
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Foto Asignada
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 font-medium mb-2">⚠️ Esta ficha no tiene foto oficial cargada.</div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                />
                {uploading && <span className="text-xs text-slate-400 block mt-1">Subiendo imagen oficial...</span>}
              </div>

              {/* Formulario de Rechazo Opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones / Motivo de Rechazo (Si se devuelve)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej: Corregir especificación de encastre antes de publicar..."
                  rows={2}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
              <button
                onClick={() => handleReject(selectedFicha.id)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                ✕ Devolver con Cambios
              </button>
              <button
                onClick={() => handleApprove(selectedFicha.id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition"
              >
                ✓ Aprobar y Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
