'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/lib/api';

function ToggleSwitch({ active, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onChange}
      className={`toggle-switch ${active ? 'active' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className="toggle-dot" />
    </button>
  );
}

function StatusBadge({ approved }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
        approved
          ? 'bg-green-900/50 text-green-400 border-green-800'
          : 'bg-yellow-900/50 text-yellow-400 border-yellow-800'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          approved ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
        }`}
      />
      {approved ? 'Approved' : 'Pending'}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [usersData, docsData] = await Promise.all([
        api.getUsers(),
        api.getDocs(),
      ]);
      setUsers(usersData);
      setDocs(docsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (user, approved) => {
    try {
      const updated = await api.setUserApproved(user.telegramId, approved);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === updated.telegramId ? updated : u))
      );
      if (selected?.telegramId === updated.telegramId) {
        setSelected(updated);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAccessToggle = async (filename) => {
    if (!selected) return;
    setSaving(true);

    const current = selected.access || [];
    const next = current.includes(filename)
      ? current.filter((f) => f !== filename)
      : [...current, filename];

    try {
      const updated = await api.setUserAccess(selected.telegramId, next);
      setSelected(updated);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === updated.telegramId ? updated : u))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = async () => {
    if (!selected) return;
    setSaving(true);
    const allFiles = docs.map((d) => d.filename);

    try {
      const updated = await api.setUserAccess(selected.telegramId, allFiles);
      setSelected(updated);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === updated.telegramId ? updated : u))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeselectAll = async () => {
    if (!selected) return;
    setSaving(true);

    try {
      const updated = await api.setUserAccess(selected.telegramId, []);
      setSelected(updated);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === updated.telegramId ? updated : u))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const accessCount = selected?.access?.length || 0;

  return (
    <AdminLayout>
      <div className="flex gap-6 h-full">
        {/* Users list */}
        <div className="flex-1 min-w-0 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Bot Users</h2>

          {users.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <p>No users yet</p>
                <p className="text-sm mt-1">Users appear here when they message the bot</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-auto">
              {users.map((user) => (
                <div
                  key={user.telegramId}
                  onClick={() => setSelected(user)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selected?.telegramId === user.telegramId
                      ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {user.firstName || user.username || 'Unknown'}
                        </span>
                        {user.username && (
                          <span className="text-sm text-gray-500">@{user.username}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {user.telegramId} &middot;{' '}
                        {new Date(user.createdAt).toLocaleDateString()} &middot;{' '}
                        {(user.access?.length || 0)} docs
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge approved={user.isApproved} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(user, !user.isApproved);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          user.isApproved
                            ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-800/50'
                            : 'bg-green-600 text-white hover:bg-green-500'
                        }`}
                      >
                        {user.isApproved ? 'Revoke' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Access panel */}
        {selected && (
          <div className="w-[380px] shrink-0 overflow-auto bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg">Document Access</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selected.firstName || selected.username} (ID: {selected.telegramId})
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!selected.isApproved && (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-400">
                  User is not approved yet. Approve first to grant access.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500">
                {accessCount} of {docs.length} docs enabled
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  disabled={saving || !selected.isApproved}
                  className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  All on
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={saving || !selected.isApproved}
                  className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  All off
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {docs.map((doc) => {
                const allowed = selected.access?.includes(doc.filename);
                return (
                  <div
                    key={doc.filename}
                    className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                      allowed
                        ? 'bg-blue-600/10 border border-blue-800/40'
                        : 'bg-gray-800/40 border border-transparent hover:bg-gray-800/70'
                    } ${!selected.isApproved ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{doc.filename}</div>
                      <div className="text-xs text-gray-500">
                        {(doc.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center justify-center">
                      <ToggleSwitch
                        active={allowed}
                        onChange={() => handleAccessToggle(doc.filename)}
                        disabled={saving || !selected.isApproved}
                      />
                    </div>
                  </div>
                );
              })}

              {docs.length === 0 && (
                <p className="text-sm text-gray-500 py-2">
                  No documents in the system yet
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
