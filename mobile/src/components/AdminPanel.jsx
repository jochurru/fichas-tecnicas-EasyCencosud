import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, FileSpreadsheet, KeyRound, BarChart2, Layers, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '../config';
import CatalogImportTab from './admin/CatalogImportTab';
import EanImportTab from './admin/EanImportTab';
import QualityMetricsTab from './admin/QualityMetricsTab';
import UsageMetricsTab from './admin/UsageMetricsTab';
import DynamicBrandsTab from './admin/DynamicBrandsTab';

/**
 * @fileoverview Modal contenedor principal del Panel de Administración.
 * Layout First Mobile, responsivo y sin barra de desplazamiento nativa visible en pestañas.
 */

export default function AdminPanel({ token, onClose, onTokenExpired }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'ean' | 'metrics' | 'analytics' | 'brands'
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto border border-gray-150 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
          <div>
            <h3 className="font-black text-gray-800 text-base sm:text-xl flex items-center gap-2">
              <span>⚙️ Panel Administrativo</span>
            </h3>
            <p className="text-xs text-gray-500 font-medium">Gestión integral de catálogos SAP, marcas y analítica de datos</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-all active:scale-95 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación Responsivas (Sin barra de scroll nativa fea) */}
        <div className="px-3 sm:px-6 py-2.5 bg-gray-50/80 border-b border-gray-100 flex gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'catalog', name: 'Catálogo SAP', icon: FileSpreadsheet },
            { id: 'ean', name: 'Mapeo EANs', icon: KeyRound },
            { id: 'metrics', name: 'Métricas de Uso', icon: TrendingUp },
            { id: 'analytics', name: 'Calidad de Datos', icon: BarChart2 },
            { id: 'brands', name: 'Marcas Dinámicas', icon: Layers }
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 sm:px-4 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-easy-red text-white shadow-md shadow-red-900/10 scale-[1.02]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Mensajes Globales de Error / Éxito */}
        <div className="px-4 sm:px-6 pt-3 space-y-2">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 border border-red-150 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 text-green-700 border border-green-150 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Contenido Dinámico de la Pestaña Activa */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
            />
          )}
        </div>

      </div>
    </div>
  );
}
