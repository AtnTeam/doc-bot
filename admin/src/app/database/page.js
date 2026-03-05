'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/lib/api';

export default function DatabasePage() {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [flash, setFlash] = useState(false);
  const esRef = useRef(null);
  const activeTableRef = useRef(activeTable);
  const pageRef = useRef(page);
  const PAGE_SIZE = 50;

  useEffect(() => { activeTableRef.current = activeTable; }, [activeTable]);
  useEffect(() => { pageRef.current = page; }, [page]);

  const loadTables = useCallback(async () => {
    try {
      const data = await api.getDbTables();
      setTables(data);
      setActiveTable((prev) => prev || (data.length > 0 ? data[0].name : null));
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  }, []);

  const loadTableData = useCallback(async (tableName, pageNum = 0) => {
    if (!tableName) return;
    try {
      const data = await api.getDbTable(tableName, PAGE_SIZE, pageNum * PAGE_SIZE);
      setTableData(data);
    } catch (err) {
      console.error('Failed to load table data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (activeTable) {
      setLoading(true);
      setPage(0);
      loadTableData(activeTable, 0);
    }
  }, [activeTable, loadTableData]);

  useEffect(() => {
    const es = api.createDbStream();
    esRef.current = es;

    es.addEventListener('db-change', () => {
      loadTables();
      if (activeTableRef.current) {
        loadTableData(activeTableRef.current, pageRef.current);
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    });

    return () => es.close();
  }, [loadTables, loadTableData]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadTableData(activeTable, newPage);
  };

  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Database</h2>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
              flash
                ? 'bg-green-900/50 text-green-400 border-green-700'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${flash ? 'bg-green-400' : 'bg-green-500'} animate-pulse`} />
              Live
            </div>
          </div>

          {tableData && (
            <span className="text-xs text-gray-500">
              {tableData.total} row{tableData.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800 pb-px">
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTable(t.name)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTable === t.name
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {t.name}
              <span className="ml-2 text-xs text-gray-600">({t.rowCount})</span>
            </button>
          ))}
        </div>

        {/* Table content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : !tableData || tableData.rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
              </svg>
              <p>Table is empty</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 sticky top-0 z-10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 w-10">
                      #
                    </th>
                    {tableData.columns.map((col) => (
                      <th
                        key={col.name}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800"
                      >
                        <div className="flex items-center gap-1.5">
                          {col.name}
                          {col.pk > 0 && (
                            <span className="px-1 py-0.5 text-[10px] bg-yellow-900/40 text-yellow-500 rounded border border-yellow-800/50">
                              PK
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600 font-normal lowercase">
                            {col.type || 'any'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {tableData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">
                        {page * PAGE_SIZE + idx + 1}
                      </td>
                      {tableData.columns.map((col) => (
                        <td key={col.name} className="px-4 py-2.5 max-w-xs">
                          <CellValue value={row[col.name]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function CellValue({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 italic text-xs">NULL</span>;
  }

  const str = String(value);

  if (str.length > 120) {
    return (
      <span className="text-xs text-gray-300 font-mono break-all" title={str}>
        {str.slice(0, 120)}
        <span className="text-gray-600">...</span>
      </span>
    );
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return (
      <span className="text-xs text-gray-300 font-mono whitespace-nowrap">
        {new Date(str).toLocaleString()}
      </span>
    );
  }

  if (str === '0' || str === '1') {
    const bool = str === '1';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono ${bool ? 'text-green-400' : 'text-gray-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${bool ? 'bg-green-400' : 'bg-gray-600'}`} />
        {str}
      </span>
    );
  }

  return <span className="text-xs text-gray-300 font-mono break-all">{str}</span>;
}
