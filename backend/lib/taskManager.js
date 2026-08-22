import crypto from 'crypto';
import { supabaseDb } from './supabase.js';

class TaskManager {
  constructor() {
    this.memoryTasks = {};
  }

  async createTask(total) {
    const id = crypto.randomUUID();
    const taskData = {
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
      }
    };

    try {
      const { error } = await supabaseDb
        .from('tareas_importacion')
        .insert([{
          id,
          status: taskData.status,
          processed: taskData.processed,
          total: taskData.total,
          percentage: taskData.percentage,
          error: taskData.error,
          estadisticas: taskData.estadisticas
        }]);
      if (error) throw error;
    } catch (err) {
      console.warn('[TaskManager] Fallback a memoria local al crear tarea:', err.message);
      this.memoryTasks[id] = { ...taskData, createdAt: new Date() };
    }

    return id;
  }

  async updateProgress(id, processed, stats = {}) {
    let task = null;
    let isDbTask = false;

    try {
      const { data, error } = await supabaseDb
        .from('tareas_importacion')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        task = data;
        isDbTask = true;
      }
    } catch (err) {
      // Fallback silencioso
    }

    if (!task) {
      task = this.memoryTasks[id];
    }

    if (task) {
      task.processed = processed;
      task.percentage = Math.min(Math.round((processed / task.total) * 100), 100);
      task.estadisticas = { ...task.estadisticas, ...stats };
      if (task.percentage === 100) {
        task.status = 'completed';
      }

      if (isDbTask) {
        try {
          const { error } = await supabaseDb
            .from('tareas_importacion')
            .update({
              processed: task.processed,
              percentage: task.percentage,
              estadisticas: task.estadisticas,
              status: task.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          console.error('[TaskManager] Error actualizando progreso en DB:', err.message);
        }
      } else {
        this.memoryTasks[id] = task;
      }
    }
  }

  async failTask(id, errorMessage) {
    let task = null;
    let isDbTask = false;

    try {
      const { data, error } = await supabaseDb
        .from('tareas_importacion')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        task = data;
        isDbTask = true;
      }
    } catch (err) {
      // Fallback silencioso
    }

    if (!task) {
      task = this.memoryTasks[id];
    }

    if (task) {
      task.status = 'failed';
      task.error = errorMessage;

      if (isDbTask) {
        try {
          const { error } = await supabaseDb
            .from('tareas_importacion')
            .update({
              status: task.status,
              error: task.error,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          console.error('[TaskManager] Error marcando tarea fallida en DB:', err.message);
        }
      } else {
        this.memoryTasks[id] = task;
      }
    }
  }

  async getTask(id) {
    try {
      const { data, error } = await supabaseDb
        .from('tareas_importacion')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        return data;
      }
    } catch (err) {
      // Fallback silencioso
    }
    return this.memoryTasks[id] || null;
  }
}

export const taskManager = new TaskManager();
