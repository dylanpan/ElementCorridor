/**
 * ============================================================
 * 事件总线 —— 模块间解耦通信的核心
 * 采用发布-订阅模式，各模块通过事件通信而非直接调用。
 * 迁移至 Godot 时可直接对应为 Godot 的 Signal 系统。
 * ============================================================
 */
class EventBus {
  constructor() {
    this._listeners = {};
    this._idCounter = 0;
  }

  /**
   * 注册事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {object} context - 回调函数的 this 上下文
   * @returns {number} 监听器ID，用于取消注册
   */
  on(event, callback, context = null) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    const id = ++this._idCounter;
    this._listeners[event].push({ id, callback, context });
    return id;
  }

  /**
   * 一次性监听
   */
  once(event, callback, context = null) {
    const id = this.on(event, (...args) => {
      this.off(event, id);
      callback.apply(context, args);
    }, context);
    return id;
  }

  /**
   * 取消注册
   * @param {string} event - 事件名称
   * @param {number} listenerId - 监听器ID
   */
  off(event, listenerId) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(
      (l) => l.id !== listenerId
    );
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给回调的参数
   */
  emit(event, ...args) {
    if (!this._listeners[event]) return;
    // 复制一份再遍历，防止遍历过程中 listeners 被修改
    const listeners = [...this._listeners[event]];
    for (const listener of listeners) {
      try {
        listener.callback.apply(listener.context, args);
      } catch (err) {
        console.error(`[EventBus] 事件 "${event}" 的监听器出错:`, err);
      }
    }
  }

  /**
   * 移除某事件的所有监听器
   */
  removeAll(event) {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
  }
}

// 导出单例
window.eventBus = new EventBus();