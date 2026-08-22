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

    // 1. Limpieza preventiva de tareas con más de 48 horas de antigüedad
    try {
      const boundary = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await supabaseDb
        .from('tareas_importacion')
        .delete()
        .lt('created_at', boundary);
    } catch (cleanErr) {
      console.warn('[TaskManager] Error limpiando tareas obsoletas:', cleanErr.message);
    }

    // 2. Crear nueva tarea en base de datos
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
      const prevPercentage = task.percentage;
      task.processed = processed;
      task.percentage = Math.min(Math.round((processed / task.total) * 100), 100);
      task.estadisticas = { ...task.estadisticas, ...stats };
      if (task.percentage === 100) {
        task.status = 'completed';
      }

      if (isDbTask) {
        // Reducir escrituras a DB: escribir solo si completó, en múltiplos de 200, o si el porcentaje avanzó en al menos 5%
        const percentDiff = task.percentage - prevPercentage;
        const shouldWriteDb = task.status === 'completed' || 
                             processed % 200 === 0 || 
                             percentDiff >= 5;

        if (shouldWriteDb) {
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
    } catch (err) {}
    return this.memoryTasks[id] || null;
  }
}

export const taskManager = new TaskManager();
