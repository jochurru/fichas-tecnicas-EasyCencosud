import crypto from 'crypto';

class TaskManager {
  constructor() {
    this.tasks = {};
  }

  createTask(total) {
    const id = crypto.randomUUID();
    this.tasks[id] = {
      id,
      status: 'processing',
      processed: 0,
      total,
      percentage: 0,
      error: null,
      estadisticas: {
        totalProcesados: 0,
        nuevosCargados: 0,
        actualizados: 0,
        eansCargados: 0
      },
      createdAt: new Date()
    };
    return id;
  }

  updateProgress(id, processed, stats = {}) {
    const task = this.tasks[id];
    if (task) {
      task.processed = processed;
      task.percentage = Math.min(Math.round((processed / task.total) * 100), 100);
      task.estadisticas = { ...task.estadisticas, ...stats };
      if (task.percentage === 100) {
        task.status = 'completed';
      }
    }
  }

  failTask(id, errorMessage) {
    const task = this.tasks[id];
    if (task) {
      task.status = 'failed';
      task.error = errorMessage;
    }
  }

  getTask(id) {
    return this.tasks[id] || null;
  }
}

export const taskManager = new TaskManager();
