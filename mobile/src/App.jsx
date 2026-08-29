import React, { useState, useEffect } from 'react';
import { Search, Camera, Cloud, CloudOff, Info, HelpCircle, Settings, LogOut } from 'lucide-react';
import Scanner from './components/Scanner';
import FichaEditor from './components/FichaEditor';
import AdminPanel from './components/AdminPanel';
import WelcomeLogin from './components/WelcomeLogin';
import PrintQueueDrawer from './components/PrintQueueDrawer';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';
import { API_BASE_URL } from './config';
import { saveProduct, getProduct } from './lib/indexedDb';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('userToken') || null);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'operator');
  const [currentUser, setCurrentUser] = useState(() => {
    const email = localStorage.getItem('userEmail');
    const role = localStorage.getItem('userRole');
    const nombre = localStorage.getItem('userNombre');
    const mustChange = localStorage.getItem('userMustChangePassword') === 'true';
    return email ? { email, role, nombre, must_change_password: mustChange } : null;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeScanner, setActiveScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productData, setProductData] = useState(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Conexión activa real (basada en el estado del navegador)
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userNombre');
    localStorage.removeItem('userMustChangePassword');
    setToken(null);
    setUserEmail('');
    setUserRole('operator');
    setCurrentUser(null);
    setProductData(null);
    setSearchTerm('');
    setIsAdminOpen(false);
  };

  const handleTokenExpiration = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userNombre');
    localStorage.removeItem('userMustChangePassword');
    setToken(null);
    setUserEmail('');
    setUserRole('operator');
    setCurrentUser(null);
    setProductData(null);
    setSearchTerm('');
    setIsAdminOpen(false);
    alert('Tu sesión ha expirado por motivos de seguridad. Por favor, inicia sesión nuevamente.');
  };

  // Buscar producto por SKU o EAN
  const handleSearch = async (identificador) => {
    if (!identificador.trim()) return;
    
    setLoading(true);
    setError('');
    setProductData(null);

    // 1. Si no hay conexión a internet, intentar buscar localmente en IndexedDB
    if (!isOnline) {
      console.log('[App] Buscando en caché local (Offline)...');
      try {
        const localData = await getProduct(identificador.trim());
        if (localData) {
          setProductData({
            ...localData,
            origen: 'local_offline' // Marcamos procedencia local offline
          });
          setSearchTerm(localData.producto.sku);
        } else {
          setError('Estás sin conexión y este producto no está en la caché local. Conéctate a internet para buscarlo.');
        }
      } catch (err) {
        setError('Error al leer de la caché local offline.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Si hay conexión, buscar en el backend
    try {
      const response = await fetch(`${API_BASE_URL}/producto/${encodeURIComponent(identificador.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.status === 401 || response.status === 403) {
        handleTokenExpiration();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'No se pudo obtener el producto.');
      }

      setProductData(data);
      setSearchTerm(data.producto.sku); // Actualizar el input con el SKU final limpio

      // Guardar copia local asíncronamente en IndexedDB para uso offline
      saveProduct(data);

    } catch (err) {
      console.error('[App] Error de red:', err);
      
      // Fallback: Si el backend está caído o la red falló en el medio, intentar buscar en caché local
      try {
        console.log('[App] Fallback a caché local por fallo de red...');
        const localData = await getProduct(identificador.trim());
        if (localData) {
          setProductData({
            ...localData,
            origen: 'local_offline'
          });
          setSearchTerm(localData.producto.sku);
          setError(''); // Limpiar el error de red
          return;
        }
      } catch (dbErr) {
        console.error('[App] Error en fallback de IndexedDB:', dbErr);
      }

      setError(err.message || 'Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = (barcode) => {
    setActiveScanner(false);
    handleSearch(barcode);
  };

  if (!token) {
    return (
      <WelcomeLogin 
        onLoginSuccess={(newToken, user) => {
          setToken(newToken);
          setUserEmail(user.email);
          setCurrentUser(user);
          if (user.role) {
            setUserRole(user.role);
          }
        }} 
      />
    );
  }

  // Guard de Cambio Obligatorio de Contraseña
  if (currentUser && (currentUser.must_change_password === true || currentUser.must_change_password === 'true')) {
    return (
      <ForcePasswordChangeModal
        user={currentUser}
        onPasswordChanged={() => {
          localStorage.setItem('userMustChangePassword', 'false');
          setCurrentUser(prev => prev ? { ...prev, must_change_password: false } : null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Contenedor móvil restringido a ancho máximo típico de smartphone */}
      <div className="w-full max-w-md bg-gray-50 flex flex-col min-h-screen shadow-2xl relative border-x border-gray-200">
        
        {/* Header */}
        <header className="bg-easy-red text-white px-4 py-3.5 shadow-md flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {/* Logo de Easy oficial */}
            <img src="/easy-logo.png" alt="Easy Logo" className="w-8 h-8 rounded-full bg-white object-contain shadow-md border border-white/20" />
            <div>
              <h1 className="font-extrabold text-sm tracking-wide">Fichas Técnicas</h1>
              <p className="text-[10px] text-red-100 font-medium">Easy Cencosud - Punto de Venta</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Estado de Red */}
            <div className="flex items-center gap-1.5 bg-red-800/40 px-2.5 py-1 rounded-full text-xs font-semibold">
              {isOnline ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-easy-yellow animate-pulse" />
                  <span className="text-red-100 text-[10px]">Cloud Conectado</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-gray-300 text-[10px]">Offline</span>
                </>
              )}
            </div>

            {/* Botón de Administración - Solo para administradores y superadmins */}
            {(userRole === 'admin' || userRole === 'superadmin') && (
              <button 
                onClick={() => setIsAdminOpen(true)}
                className="p-1.5 hover:bg-red-800/45 rounded-xl text-white transition-all active:scale-90"
                title="Administración SAP"
              >
                <Settings className="w-4.5 h-4.5 text-red-100 hover:text-white" />
              </button>
            )}

            {/* Botón de Cerrar Sesión */}
            <button 
              onClick={handleLogout}
              className="p-1.5 hover:bg-red-800/45 rounded-xl text-white transition-all active:scale-90"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4.5 h-4.5 text-red-100 hover:text-white" />
            </button>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1 p-4 space-y-4 pb-20">
          
          {/* Formulario de Búsqueda */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
              Buscar por SKU o Código de Barras EAN
            </label>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                  placeholder="Ej: 148135 o EAN-13"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-10 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-easy-red focus:bg-white focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    limpiar
                  </button>
                )}
              </div>

              {/* Botón de búsqueda */}
              <button
                onClick={() => handleSearch(searchTerm)}
                disabled={loading}
                className="bg-easy-red hover:bg-red-700 active:scale-95 text-white p-3 rounded-xl shadow-md shadow-easy-red/10 transition-all disabled:opacity-50"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Botón de cámara */}
              <button
                onClick={() => setActiveScanner(true)}
                className="bg-easy-yellow hover:bg-yellow-400 active:scale-95 text-easy-dark p-3 rounded-xl shadow-md shadow-yellow-400/20 transition-all font-bold"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Loader Inteligente de Inferencia / Consulta */}
          {loading && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              {/* Animación radial de carga */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-easy-red border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">Consultando Catálogo SAP...</p>
                <p className="text-xs text-gray-400 mt-1 animate-pulse-slow">
                  Buscando ficha técnica en base de datos. Si no existe, Gemini extraerá los atributos automáticamente...
                </p>
              </div>
            </div>
          )}

          {/* Alert de Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex gap-3 text-sm items-start shadow-sm">
              <Info className="w-5 h-5 text-easy-red shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">No se pudo resolver el producto</strong>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Vista del Editor Ficha Técnica */}
          {productData && !loading && (
            <div className="space-y-3">
              {/* Banner informativo de procedencia de datos */}
              {productData.origen === 'creado_por_ia' && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl p-3.5 shadow-sm text-xs flex items-start gap-2.5">
                  <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                    💡
                  </div>
                  <div>
                    <strong className="font-bold block text-sm">Enriquecido por Gemini AI</strong>
                    <p className="text-blue-100 mt-0.5">
                      Este producto no tenía ficha en la base de datos. El modelo extrajo y estructuró las especificaciones técnicas en tiempo real.
                    </p>
                  </div>
                </div>
              )}

              {productData.origen === 'local_offline' && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl p-3.5 shadow-sm text-xs flex items-start gap-2.5">
                  <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                    📶
                  </div>
                  <div>
                    <strong className="font-bold block text-sm">Modo Offline (Caché Local)</strong>
                    <p className="text-amber-100 mt-0.5">
                      Estás visualizando una copia de caché guardada localmente en este dispositivo debido a fallas de red. Las funciones de guardado o regeneración del PDF se deshabilitarán hasta volver a tener señal.
                    </p>
                  </div>
                </div>
              )}

              <FichaEditor 
                data={productData} 
                token={token}
                userEmail={userEmail}
                userRole={userRole}
                onTokenExpired={handleTokenExpiration}
                onSaveSuccess={(updatedFicha, updatedEans) => {
                  // Actualizar estado local con la nueva ficha aprobada e EAN
                  setProductData({
                    ...productData,
                    producto: {
                      ...productData.producto,
                      eans: Array.isArray(updatedEans) ? updatedEans : productData.producto.eans
                    },
                    ficha_tecnica: updatedFicha,
                    origen: 'base_datos' // Cambiar origen a base de datos tras guardado
                  });
                }} 
              />
            </div>
          )}

          {/* Estado vacío / Bienvenida */}
          {!productData && !loading && !error && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                <HelpCircle className="w-8 h-8" />
              </div>
              <div className="max-w-xs">
                <h3 className="font-bold text-gray-700 text-sm">Asistente de Fichas Técnicas</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Escaneá el código de barras con la cámara o ingresá el código SKU de SAP para validar y aprobar la ficha técnica del producto.
                </p>
              </div>
            </div>
          )}

        </main>

        {/* Modal del Escáner de Cámara */}
        {activeScanner && (
          <Scanner 
            token={token}
            onScanSuccess={handleScanSuccess} 
            onClose={() => setActiveScanner(false)} 
          />
        )}

        {/* Modal de Administración SAP */}
        {isAdminOpen && (
          <AdminPanel token={token} userRole={userRole} onTokenExpired={handleTokenExpiration} onClose={() => setIsAdminOpen(false)} />
        )}

        {/* Footer simple de marca */}
        <footer className="text-center text-[10px] text-gray-400 py-3.5 border-t border-gray-100 bg-white absolute bottom-0 w-full leading-relaxed select-none">
          <div className="font-bold text-gray-500">Easy Cencosud © 2026 - Fichas Técnicas</div>
          <div className="text-[9px] text-gray-400">Desarrollado por Jonatan Churruarin • Soluciones Digitales Retail</div>
        </footer>

        {/* Modal de Cambio Obligatorio de Contraseña */}
        {currentUser && (currentUser.must_change_password === true || currentUser.must_change_password === 'true') && (
          <ForcePasswordChangeModal
            user={currentUser}
            onPasswordChanged={() => {
              localStorage.setItem('userMustChangePassword', 'false');
              setCurrentUser(prev => prev ? { ...prev, must_change_password: false } : null);
            }}
          />
        )}

        {/* Cola de Impresión Flotante (FAB) P1.21 */}
        {token && (
          <PrintQueueDrawer token={token} />
        )}
      </div>
    </div>
  );
}
