import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { dbInsert, dbUpdate, dbGetAll, dbGetById } from './database.js';

class RequestLogger extends EventEmitter {
  create(data) {
    const entry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'processing',
      userId: data.userId ?? null,
      username: data.username ?? null,
      question: data.question ?? '',
      ragResults: [],
      prompt: '',
      aiResponse: '',
      finalAnswer: '',
      timings: {},
      error: null,
    };

    dbInsert(entry);
    this.emit('new', { ...entry });
    return entry;
  }

  update(id, data) {
    const existing = dbGetById(id);
    if (!existing) return null;

    const updated = { ...existing, ...data };
    dbUpdate(updated);
    this.emit('update', { ...updated });
    return updated;
  }

  getAll(limit = 200) {
    return dbGetAll(limit);
  }

  getById(id) {
    return dbGetById(id);
  }
}

export const logger = new RequestLogger();
