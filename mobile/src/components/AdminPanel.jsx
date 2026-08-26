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
 * Coordina la navegación entre pestañas (Importación SAP, EANs, Métricas de Uso, Calidad de Datos y Marcas).
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto border border-gray-100 flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
          <div>
            <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <span>⚙️ Panel Administrativo</span>
            </h3>
            <p className="text-xs text-gray-400 font-medium">Gestión integral de catálogos SAP, marcas y analítica de datos</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div className="px-6 bg-gray-50/70 border-b border-gray-100 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-easy-red text-easy-red bg-white/80 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Catálogo SAP
          </button>

          <button
            onClick={() => setActiveTab('ean')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ean'
                ? 'border-easy-red text-easy-red bg-white/80 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Mapeo de EANs
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'border-easy-red text-easy-red bg-white/80 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Métricas de Uso
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-easy-red text-easy-red bg-white/80 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Calidad de Datos
          </button>

          <button
            onClick={() => setActiveTab('brands')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'brands'
                ? 'border-easy-red text-easy-red bg-white/80 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Marcas Dinámicas
          </button>
        </div>

        {/* Mensajes Globales de Error / Éxito */}
        <div className="px-6 pt-4 space-y-2">
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
        <div className="p-6 overflow-y-auto flex-1">
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
