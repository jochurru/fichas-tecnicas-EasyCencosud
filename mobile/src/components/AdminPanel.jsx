import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, FileSpreadsheet, KeyRound, BarChart2, Layers, TrendingUp, Activity, Database, Inbox, Users, Crown } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { STORE_BLOCKS, ALL_SECTORS } from '../config/storeBlocks';
import ExecutiveDashboardTab from './admin/ExecutiveDashboardTab';
import CatalogImportTab from './admin/CatalogImportTab';
import EanImportTab from './admin/EanImportTab';
import QualityMetricsTab from './admin/QualityMetricsTab';
import UsageMetricsTab from './admin/UsageMetricsTab';
import DynamicBrandsTab from './admin/DynamicBrandsTab';
import SystemHealthTab from './admin/SystemHealthTab';
import DatabaseViewerTab from './admin/DatabaseViewerTab';
import PendingApprovalsInbox from './admin/PendingApprovalsInbox';
import UserManagementTab from './admin/UserManagementTab';

/**
 * @fileoverview Modal contenedor principal del Panel de Administración.
 * Layout First Mobile, responsivo y sin barra de desplazamiento nativa visible en pestañas.
 */

export default function AdminPanel({ token, userRole, currentUser, onClose, onTokenExpired }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (userRole === 'gerente') {
      return 'executive';
    }
    if (['coordinador', 'jefe_sector'].includes(userRole)) {
      return 'inbox';
    }
    return 'catalog';
  });

  const allTabs = [
    { id: 'executive', name: '👑 Mando Gerencial', icon: Crown, roles: ['gerente', 'superadmin'] },
    { id: 'inbox', name: 'Bandeja Pendientes', icon: Inbox, roles: ['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'admin', 'superadmin'] },
    { id: 'users', name: 'Gestión Usuarios', icon: Users, roles: ['gerente', 'subadmin', 'jefe_sector', 'admin', 'superadmin'] },
    { id: 'brands', name: 'Marcas Dinámicas', icon: Layers, roles: ['gerente', 'subadmin', 'jefe_sector', 'admin', 'superadmin'] },
    { id: 'catalog', name: 'Catálogo SAP', icon: FileSpreadsheet, roles: ['gerente', 'subadmin', 'admin', 'superadmin'] },
    { id: 'ean', name: 'Mapeo EANs', icon: KeyRound, roles: ['gerente', 'subadmin', 'admin', 'superadmin'] },
    { id: 'metrics', name: 'Métricas de Uso', icon: TrendingUp, roles: ['gerente', 'subadmin', 'admin', 'superadmin'] },
    { id: 'analytics', name: 'Calidad de Datos', icon: BarChart2, roles: ['gerente', 'subadmin', 'admin', 'superadmin'] },
    { id: 'health', name: 'Estado del Sistema', icon: Activity, roles: ['gerente', 'subadmin', 'admin', 'superadmin'] },
    { id: 'dbviewer', name: 'Base de Datos', icon: Database, roles: ['gerente', 'superadmin'] }
  ];

  const visibleTabs = allTabs.filter(t => t.roles.includes(userRole));
  const isGlobalAdmin = ['gerente', 'subadmin', 'admin', 'superadmin'].includes(userRole);

  // Resolver bloque del usuario actual
  const userBlock = userRole === 'jefe_sector'
    ? (STORE_BLOCKS.find(b => b.jefe_email.toLowerCase() === (currentUser?.email || '').toLowerCase()) || STORE_BLOCKS[0])
    : (STORE_BLOCKS.find(b => b.id === Number(currentUser?.bloque_id)) || STORE_BLOCKS[0]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [stats, setStats] = useState(null);
  const [newSkus, setNewSkus] = useState([]);
  const [taskProgress, setTaskProgress] = useState(null);

  // Estados de Métricas y Analítica
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  // Estados de Marcas Dinámicas
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandNombre, setNewBrandNombre] = useState('');

  const fetchStats = async () => {
    if (!isGlobalAdmin) return;
    try {
      const res = await fetch(`${API_BASE_URL}/catalogos/metricas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error al obtener estadísticas:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
  }, [activeTab]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-1 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[98vw] lg:max-w-6xl w-full shadow-2xl overflow-hidden my-auto border border-gray-150 flex flex-col max-h-[98vh] sm:max-h-[90vh]">
        
        {/* Header Modal con Nombre de Usuario y Secciones Asignadas */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <div className="min-w-0 flex-1 mr-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="font-black text-gray-800 text-sm sm:text-xl flex items-center gap-1.5">
                <span>⚙️ Panel Administrativo</span>
              </h3>
              <span className="bg-red-50 text-easy-red border border-red-200 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-black truncate max-w-[150px] sm:max-w-none">
                {currentUser?.nombre || (userRole === 'jefe_sector' ? userBlock.jefe_nombre : 'Administración')}
              </span>
              <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                {userRole === 'jefe_sector' ? 'Jefe de Sector' : userRole}
              </span>
            </div>
            
            {userRole === 'jefe_sector' ? (
              <p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5 sm:mt-1 flex items-center gap-1.5 flex-wrap">
                <span>📍 <strong>{userBlock.nombre}:</strong></span>
                <span className="text-slate-700 font-bold">{userBlock.sectores.map(s => s.nombre).join(' • ')}</span>
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5 sm:mt-1">
                Supervisión Global de Tienda (Todos los 20 Sectores y 4 Bloques Habilitados)
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-all active:scale-95 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación Responsivas (Wrap en desktop, scroll horizontal fluido en mobile) */}
        <div className="px-2 sm:px-6 py-1.5 sm:py-2.5 bg-gray-50/80 border-b border-gray-100 flex flex-nowrap sm:flex-wrap gap-1 sm:gap-2 overflow-x-auto sm:overflow-x-visible shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 px-2.5 sm:py-2 sm:px-4 text-[11px] sm:text-sm font-extrabold rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-easy-red text-white shadow-md shadow-red-900/10 scale-[1.01]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Mensajes Globales de Error / Éxito */}
        <div className="px-3 sm:px-6 pt-2 space-y-2">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 border border-red-150 p-2.5 sm:p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 text-green-700 border border-green-150 p-2.5 sm:p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Contenido Dinámico de la Pestaña Activa con Scroll Táctil Fluido */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 overscroll-contain">
          {activeTab === 'executive' && (
            <ExecutiveDashboardTab token={token} />
          )}

          {activeTab === 'inbox' && (
            <PendingApprovalsInbox user={currentUser || { role: userRole }} />
          )}

          {activeTab === 'users' && (
            <UserManagementTab currentUser={currentUser || { role: userRole }} />
          )}

          {activeTab === 'catalog' && (
            <CatalogImportTab
              loading={loading}
              setLoading={setLoading}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
              dragActive={dragActive}
              setDragActive={setDragActive}
              taskProgress={taskProgress}
              setTaskProgress={setTaskProgress}
              newSkus={newSkus}
              token={token}
              onTokenExpired={onTokenExpired}
            />
          )}

          {activeTab === 'ean' && (
            <EanImportTab
              loading={loading}
              setLoading={setLoading}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
              dragActive={dragActive}
              setDragActive={setDragActive}
              token={token}
              onTokenExpired={onTokenExpired}
            />
          )}

          {activeTab === 'metrics' && (
            <UsageMetricsTab stats={stats} />
          )}

          {activeTab === 'health' && (
            <SystemHealthTab />
          )}

          {activeTab === 'dbviewer' && (
            <DatabaseViewerTab token={token} />
          )}

          {activeTab === 'analytics' && (
            <QualityMetricsTab
              metrics={metrics}
              setMetrics={setMetrics}
              metricsLoading={metricsLoading}
              setMetricsLoading={setMetricsLoading}
              metricsError={metricsError}
              setMetricsError={setMetricsError}
              token={token}
            />
          )}

          {activeTab === 'brands' && (
            <DynamicBrandsTab
              brands={brands}
              setBrands={setBrands}
              brandsLoading={brandsLoading}
              setBrandsLoading={setBrandsLoading}
              newBrandSlug={newBrandSlug}
              setNewBrandSlug={setNewBrandSlug}
              newBrandNombre={newBrandNombre}
              setNewBrandNombre={setNewBrandNombre}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
              token={token}
              currentUser={currentUser || { role: userRole }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
