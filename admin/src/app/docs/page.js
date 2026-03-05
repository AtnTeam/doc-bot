'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/lib/api';

export default function DocsPage() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('view');
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const data = await api.getDocs();
      setDocs(data);
    } catch (err) {
      console.error('Failed to load docs:', err);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleSelect = async (doc) => {
    setLoading(true);
    setMode('view');
    setCreating(false);
    try {
      const data = await api.getDoc(doc.filename);
      setSelected(doc);
      setContent(data.content);
    } catch (err) {
      console.error('Failed to load doc:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.updateDoc(selected.filename, content);
      setMode('view');
      await loadDocs();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.createDoc(newName.trim(), newContent);
      setCreating(false);
      setNewName('');
      setNewContent('');
      await loadDocs();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await api.deleteDoc(filename);
      if (selected?.filename === filename) {
        setSelected(null);
        setContent('');
      }
      await loadDocs();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="flex gap-6 h-full">
        {/* File list */}
        <div className="w-[300px] shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Documents</h2>
            <button
              onClick={() => {
                setCreating(true);
                setSelected(null);
                setContent('');
                setNewName('');
                setNewContent('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No documents yet</p>
                <p className="text-sm mt-1">Click &quot;New&quot; to create one</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-auto">
              {docs.map((doc) => (
                <div
                  key={doc.filename}
                  onClick={() => handleSelect(doc)}
                  className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selected?.filename === doc.filename
                      ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{doc.filename}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {(doc.size / 1024).toFixed(1)} KB &middot;{' '}
                      {new Date(doc.modified).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.filename);
                    }}
                    className="shrink-0 p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
          {creating ? (
            <div className="flex flex-col h-full p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">New Document</h3>
                <button
                  onClick={() => setCreating(false)}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="filename.md"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write markdown content..."
                className="flex-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleCreate}
                  disabled={loading || !newName.trim()}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-5 border-b border-gray-800">
                <div>
                  <h3 className="font-bold text-lg">{selected.filename}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(selected.size / 1024).toFixed(1)} KB &middot;{' '}
                    {new Date(selected.modified).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {mode === 'view' ? (
                    <button
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setMode('view');
                          handleSelect(selected);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-5">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : mode === 'edit' ? (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <pre className="text-sm whitespace-pre-wrap leading-relaxed text-gray-300">
                    {content}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p>Select a document to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
