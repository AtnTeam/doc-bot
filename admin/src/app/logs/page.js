'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/lib/api';

function Checkbox({ checked, onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick?.();
      }}
      className={`checkbox-custom ${checked ? 'checked' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-blue-400'} ${className}`}
    />
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [filterUser, setFilterUser] = useState('');
  const esRef = useRef(null);

  useEffect(() => {
    api.getLogs().then(setLogs).catch(console.error);

    const es = api.createLogStream();
    esRef.current = es;

    es.addEventListener('new', (e) => {
      const entry = JSON.parse(e.data);
      setLogs((prev) => [entry, ...prev].slice(0, 200));
    });

    es.addEventListener('update', (e) => {
      const entry = JSON.parse(e.data);
      setLogs((prev) => prev.map((l) => (l.id === entry.id ? entry : l)));
      setSelected((prev) => (prev?.id === entry.id ? entry : prev));
    });

    return () => es.close();
  }, []);

  const uniqueUsers = useMemo(() => {
    const users = new Map();
    for (const log of logs) {
      const key = log.username || 'unknown';
      if (!users.has(key)) {
        users.set(key, { username: key, userId: log.userId });
      }
    }
    return Array.from(users.values());
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!filterUser) return logs;
    return logs.filter((l) => (l.username || 'unknown') === filterUser);
  }, [logs, filterUser]);

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const visibleIds = filteredLogs.map((l) => l.id);
    const allChecked = visibleIds.every((id) => checkedIds.has(id));
    if (allChecked) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setCheckedIds((prev) => new Set([...prev, ...visibleIds]));
    }
  };

  const handleDeleteSelected = async () => {
    if (checkedIds.size === 0) return;
    if (!confirm(`Delete ${checkedIds.size} selected log(s)?`)) return;

    try {
      await Promise.all([...checkedIds].map((id) => api.deleteLog(id)));
      setLogs((prev) => prev.filter((l) => !checkedIds.has(l.id)));
      if (selected && checkedIds.has(selected.id)) setSelected(null);
      setCheckedIds(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  const selectionMode = checkedIds.size > 0;
  const allVisibleChecked =
    filteredLogs.length > 0 &&
    filteredLogs.every((l) => checkedIds.has(l.id));

  return (
    <AdminLayout>
      <div className="flex gap-6 h-full relative">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Request Monitoring</h2>

            <div className="flex items-center gap-2">
              {uniqueUsers.length > 0 && (
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All users</option>
                  {uniqueUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      @{u.username}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <p>No requests yet</p>
                <p className="text-sm mt-1">Send a message to the Telegram bot to see logs here</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No logs for this user
            </div>
          ) : (
            <>
              {filteredLogs.length > 1 && (
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-3 px-4 py-2 mb-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 transition-colors select-none"
                >
                  <Checkbox checked={allVisibleChecked} onClick={toggleAll} />
                  <span>Select all ({filteredLogs.length})</span>
                </button>
              )}

              <div className="space-y-2 overflow-auto pb-20">
                {filteredLogs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    active={selected?.id === log.id}
                    checked={checkedIds.has(log.id)}
                    onCheck={() => toggleCheck(log.id)}
                    onClick={() => setSelected(log)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {selected && (
          <div className="w-[480px] shrink-0 overflow-auto bg-gray-900 rounded-xl border border-gray-800 p-5">
            <LogDetail entry={selected} onClose={() => setSelected(null)} />
          </div>
        )}

        {/* Floating action bar */}
        {selectionMode && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-6 z-20">
            <div className="flex items-center gap-4 bg-gray-900 border border-gray-700 rounded-2xl px-6 py-3.5 shadow-2xl shadow-black/50">
              <span className="text-sm text-gray-300 font-medium whitespace-nowrap">
                {checkedIds.size} selected
              </span>
              <div className="w-px h-6 bg-gray-700" />
              <button
                onClick={() => setCheckedIds(new Set())}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 rounded-xl transition-colors text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function LogRow({ log, active, checked, onCheck, onClick }) {
  let border = 'border-gray-800 bg-gray-900 hover:border-gray-700';
  if (checked) border = 'border-red-800/40 bg-red-500/5 hover:border-red-700/50';
  if (active) border = 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20';

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${border}`}
    >
      <div className={`shrink-0 flex items-center justify-center transition-opacity duration-150 ${
        checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <Checkbox checked={checked} onClick={onCheck} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-400">
            @{log.username || 'unknown'} &middot;{' '}
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <StatusBadge status={log.status} />
        </div>
        <p className="text-sm truncate">{log.question}</p>
        {log.timings?.total != null && (
          <p className="text-xs text-gray-500 mt-1.5">
            Total: {log.timings.total}ms
            {log.timings.rag != null && <span className="ml-3">RAG: {log.timings.rag}ms</span>}
            {log.timings.ai != null && <span className="ml-3">AI: {log.timings.ai}ms</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    processing: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    completed: 'bg-green-900/50 text-green-400 border-green-800',
    error: 'bg-red-900/50 text-red-400 border-red-800',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
        styles[status] || styles.processing
      }`}
    >
      {status === 'processing' && (
        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
      )}
      {status}
    </span>
  );
}

function LogDetail({ entry, onClose }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Request Details</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <Section title="User">
        <p className="text-sm">@{entry.username} (ID: {entry.userId})</p>
        <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
      </Section>

      <Section title="Question">
        <p className="text-sm bg-gray-800 rounded-lg p-3">{entry.question}</p>
      </Section>

      <Section title="RAG Results">
        {entry.ragResults?.length > 0 ? (
          <div className="space-y-2">
            {entry.ragResults.map((r, i) => (
              <div key={i} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span className="font-medium">{r.filename}</span>
                  <span className="font-mono">score: {r.score?.toFixed(4)}</span>
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Waiting for results...</p>
        )}
      </Section>

      <Section title="Prompt sent to AI">
        <pre className="text-xs bg-gray-800 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed text-gray-300">
          {entry.prompt || 'Not available yet'}
        </pre>
      </Section>

      <Section title="AI Response">
        <div className="text-sm bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">
          {entry.finalAnswer || (
            <span className="text-gray-500 italic">Waiting for response...</span>
          )}
        </div>
      </Section>

      <Section title="Timings">
        <div className="grid grid-cols-3 gap-2">
          <TimingBox label="RAG" ms={entry.timings?.rag} />
          <TimingBox label="AI" ms={entry.timings?.ai} />
          <TimingBox label="Total" ms={entry.timings?.total} />
        </div>
      </Section>

      {entry.error && (
        <Section title="Error">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-400">{entry.error}</p>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function TimingBox({ label, ms }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-base font-mono font-medium">
        {ms != null ? `${ms}ms` : '—'}
      </div>
    </div>
  );
}
