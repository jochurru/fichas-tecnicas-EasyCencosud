import React, { useState, useEffect } from 'react';
import { Database, Search, Download, RefreshCw, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function DatabaseViewerTab({ token }) {
  const [selectedTable, setSelectedTable] = useState('productos');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  const tables = [
    { id: 'productos', name: 'Productos SAP' },
    { id: 'catalogos_sap', name: 'Historial Catálogos SAP' },
    { id: 'codigos_ean', name: 'Mapeo EAN' },
    { id: 'usuarios_roles', name: 'Roles de Usuarios' },
    { id: 'audit_logs', name: 'Logs de Auditoría' }
  ];

  const fetchData = async (currentPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const offset = currentPage * limit;
      const res = await fetch(`${API_BASE_URL}/admin/database-viewer?tableName=${selectedTable}&limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Acceso denegado: Se requiere rol de superadmin.');
        throw new Error('Error al cargar datos de la base de datos.');
      }
      const json = await res.json();
      setData(json.data || []);
      setTotalCount(json.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchData(0);
  }, [selectedTable]);

  const handleNextPage = () => {
    if ((page + 1) * limit < totalCount) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (page > 0) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchData(prevPage);
    }
  };

  const renderTableCell = (val) => {
    if (val === null || val === undefined) return <span className="text-gray-400 italic">null</span>;
    if (typeof val === 'object') return <pre className="text-[9px] text-gray-500 whitespace-pre-wrap max-h-24 overflow-y-auto">{JSON.stringify(val, null, 2)}</pre>;
    if (typeof val === 'boolean') return val ? <span className="text-green-600 font-bold">Sí</span> : <span className="text-red-600 font-bold">No</span>;
    return String(val);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Visor de Base de Datos
          </h4>
          <p className="text-xs text-gray-500">Solo Lectura (Superadmin)</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            disabled={loading}
            className="flex-1 sm:w-48 bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button 
            onClick={() => fetchData(page)} 
            disabled={loading} 
            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabla HTML Responsiva */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                {data.length > 0 ? (
                  Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-3 py-2 whitespace-nowrap">{key}</th>
                  ))
                ) : (
                  <th className="px-3 py-2 text-center text-gray-400">Sin columnas</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan="100%" className="px-3 py-8 text-center text-gray-400 font-semibold">Cargando datos...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="100%" className="px-3 py-8 text-center text-gray-400 font-semibold">No se encontraron registros en la tabla {selectedTable}</td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                    {Object.values(row).map((val, colIndex) => (
                      <td key={colIndex} className="px-3 py-2 align-top text-gray-700 font-mono">
                        {renderTableCell(val)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginador */}
      {!error && (
        <div className="flex justify-between items-center text-xs font-bold text-gray-500">
          <div>
            Mostrando {data.length > 0 ? page * limit + 1 : 0} a {Math.min((page + 1) * limit, totalCount)} de {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevPage} 
              disabled={page === 0 || loading}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Pág {page + 1}</span>
            <button 
              onClick={handleNextPage} 
              disabled={(page + 1) * limit >= totalCount || loading}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
