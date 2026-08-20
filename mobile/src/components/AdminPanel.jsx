import React, { useState, useEffect } from 'react';
import { 
  X, Lock, User, UploadCloud, AlertCircle, CheckCircle, 
  LogOut, RefreshCw, FileSpreadsheet, KeyRound, ArrowRight,
  Database, QrCode
} from 'lucide-react';

export default function AdminPanel({ onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('admin@easy.com.ar');
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'ean'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [stats, setStats] = useState(null);
  const [newSkus, setNewSkus] = useState([]);

  useEffect(() => {
    // Verificar si ya hay un token guardado en el navegador
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Manejo del Login de Administrador
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al iniciar sesión.');
      }

      localStorage.setItem('adminToken', data.token);
      setIsAuthenticated(true);
      setPassword('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cierre de Sesión
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setStats(null);
    setNewSkus([]);
    setSuccessMsg('');
    setErrorMsg('');
  };

  // Drag and Drop Helpers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAndUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processAndUploadFile(e.target.files[0]);
    }
  };

  // Convertir XLSX a Base64 y subir a la API protegida correspondiente
  const processAndUploadFile = (file) => {
    setErrorMsg('');
    setSuccessMsg('');
    setStats(null);
    setNewSkus([]);

    // Validar tipo de archivo
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      setErrorMsg('Formato de archivo inválido. Por favor, suba un archivo Excel (.xlsx o .xls)');
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64String = event.target.result.split(',')[1];
        const token = localStorage.getItem('adminToken');

        // Seleccionar endpoint basado en la pestaña activa
        const endpoint = activeTab === 'catalog' 
          ? '/api/catalogos/importar' 
          : '/api/catalogos/importar-eans';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ fileBase64: base64String })
        });

        const data = await res.json();
        
        if (res.status === 401) {
          handleLogout();
          throw new Error('Sesión expirada o no autorizada. Por favor, vuelva a ingresar.');
        }

        if (!res.ok) {
          throw new Error(data.message || 'Error en la importación.');
        }

        setStats(data.estadisticas);
        if (activeTab === 'catalog') {
          setNewSkus(data.nuevosSkus || []);
          setSuccessMsg('¡Catálogo SAP importado y sincronizado correctamente!');
        } else {
          setSuccessMsg('¡Mapeo de códigos de barras EAN cargado con éxito!');
        }
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo Excel.');
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-easy-dark/60 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header del Modal */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-easy-red" />
            <h2 className="text-sm font-bold uppercase text-easy-dark tracking-wide">
              Panel Administrativo SAP
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Pantalla de Login si no está autenticado */}
          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-800">Iniciar Sesión</h3>
                <p className="text-xs text-gray-400">
                  Ingresá tus credenciales de operador para actualizar la base logística de SAP o EANs.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl flex gap-2">
                  <AlertCircle className="w-4 h-4 text-easy-red shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Email del Operador</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-easy-red hover:bg-red-700 active:scale-95 text-white font-bold py-3 rounded-xl text-sm transition-all flex justify-center items-center gap-1.5 shadow-md shadow-easy-red/10"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Autenticar'}
              </button>
            </form>
          ) : (
            
            // Pantalla de Carga de Excel si ya está autenticado
            <div className="space-y-5">
              
              {/* Info de sesión */}
              <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-gray-600">Sesión activa como Operador</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-easy-red font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Salir
                </button>
              </div>

              {/* Selector de Pestañas (Modo de Carga) */}
              {!loading && !stats && (
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('catalog')}
                    className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                      activeTab === 'catalog'
                        ? 'bg-white text-easy-dark shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" /> Catálogo SAP
                  </button>
                  <button
                    onClick={() => setActiveTab('ean')}
                    className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                      activeTab === 'ean'
                        ? 'bg-white text-easy-dark shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" /> Mapeo EAN
                  </button>
                </div>
              )}

              {/* Zona de Drop para Archivos */}
              {!loading && !stats && (
                <div 
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col justify-center items-center text-center transition-all ${
                    dragActive 
                      ? 'border-easy-red bg-red-50 text-easy-red' 
                      : 'border-gray-200 hover:border-easy-red bg-gray-50 hover:bg-red-50/20 text-gray-500'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-xs font-bold text-gray-700 mb-1">
                    {activeTab === 'catalog' ? 'Cargar Catálogo de Productos' : 'Cargar Base de EANs'}
                  </p>
                  <p className="text-[10px] text-gray-400 mb-4 max-w-[280px]">
                    {activeTab === 'catalog' 
                      ? 'Arrastrá la planilla de logística SAP (.xlsx) aquí, filtraremos el Grupo de compras 45.' 
                      : 'Arrastrá la planilla de relación de códigos de barra (.xlsx) con columnas SKU/Material y EAN.'}
                  </p>
                  
                  <label className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-sm active:scale-95 transition-all">
                    Buscar archivo
                    <input 
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Loader de Procesamiento */}
              {loading && (
                <div className="py-8 flex flex-col justify-center items-center text-center space-y-3">
                  <RefreshCw className="w-10 h-10 text-easy-red animate-spin" />
                  <div>
                    <p className="text-xs font-bold text-gray-700">
                      {activeTab === 'catalog' ? 'Procesando catálogo maestro...' : 'Registrando mapeos de EAN...'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Leyendo celdas y ejecutando escrituras masivas en lotes en Supabase. No cierres la ventana.
                    </p>
                  </div>
                </div>
              )}

              {/* Errores */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl flex gap-2">
                  <AlertCircle className="w-4 h-4 text-easy-red shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Resultados de la importación (Estadísticas) */}
              {stats && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-3 rounded-xl flex gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{successMsg}</p>
                      <p className="text-[10px] text-green-700/80 mt-0.5">La sincronización con la base de datos Supabase finalizó con éxito.</p>
                    </div>
                  </div>

                  {/* Tarjetas de Estadísticas */}
                  {activeTab === 'catalog' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-center">
                        <span className="text-[10px] text-gray-400 font-medium block">Total Procesados (GC 45)</span>
                        <span className="text-lg font-bold text-easy-dark">{stats.totalProcesados}</span>
                      </div>
                      <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-center">
                        <span className="text-[10px] text-easy-red font-bold block">Nuevos Agregados</span>
                        <span className="text-lg font-bold text-easy-red">{stats.nuevosCargados}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-center">
                      <span className="text-xs text-gray-400 font-bold block mb-1">Mapeos EAN Registrados y Sincronizados</span>
                      <span className="text-2xl font-black text-easy-dark">{stats.eansCargados}</span>
                    </div>
                  )}

                  {/* Listado de SKUs Nuevos (Solo en pestaña de Catálogo) */}
                  {activeTab === 'catalog' && newSkus.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                        Productos Nuevos Incorporados ({newSkus.length}):
                      </h4>
                      <div className="max-h-28 overflow-y-auto bg-gray-50 border border-gray-100 rounded-xl p-2.5 divide-y divide-gray-100">
                        {newSkus.map((sku, index) => (
                          <div key={index} className="py-1 flex items-center gap-1.5 text-xs text-gray-600 font-mono">
                            <ArrowRight className="w-3 h-3 text-easy-red shrink-0" />
                            <span>SKU {sku}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'catalog' && newSkus.length === 0 && (
                    <p className="text-center text-[10px] text-gray-400 py-3 bg-gray-50 rounded-xl border border-dashed">
                      No se encontraron nuevos SKUs para agregar. Todos los productos ya existían y fueron actualizados.
                    </p>
                  )}

                  {/* Botón para cargar otro */}
                  <button 
                    onClick={() => {
                      setStats(null);
                      setSuccessMsg('');
                    }}
                    className="w-full border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-600 font-bold py-2.5 rounded-xl text-xs transition-all flex justify-center items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Subir otra planilla
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
