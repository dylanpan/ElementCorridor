/**
 * ============================================================
 * 道具系统 —— 管理可消耗道具的获取、存储与使用
 * ============================================================
 */
class ItemSystem {
  static ITEM_DEFS = {
    time_freeze: {
      id: 'time_freeze',
      name: '时间停滞',
      icon: '⏸',
      description: '冻结所有订单倒计时 10 秒',
      maxStack: 3,
    },
    instant_complete: {
      id: 'instant_complete',
      name: '立即完成',
      icon: '✅',
      description: '直接完成一个指定订单（不消耗棋盘元素）',
      maxStack: 2,
    },
    skip_order: {
      id: 'skip_order',
      name: '跳过订单',
      icon: '➡',
      description: '移除当前一个订单，不扣分',
      maxStack: 3,
    },
    element_storm: {
      id: 'element_storm',
      name: '元素风暴',
      icon: '🌪',
      description: '10 秒内发射器无冷却',
      maxStack: 2,
    },
    double_score: {
      id: 'double_score',
      name: '双倍积分',
      icon: '✖2',
      description: '下次提交订单积分 x2',
      maxStack: 1,
    },
  };

  constructor(gameEngine) {
    this.engine = gameEngine;
    this.items = {};
    this._timers = {};
    this._onOrderSubmitted = null;
    this._initialized = false;
    this._freezeEndTime = 0;
    this._stormEndTime = 0;
    this._enabled = false;
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    const itemBar = document.getElementById('item-bar');
    if (itemBar) {
      itemBar.style.display = enabled ? 'flex' : 'none';
    }
  }

  /**
   * 初始化道具系统
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.items = {};
    // 初始赠送：2 个跳过订单、1 个元素风暴
    this.addItem('skip_order', 2);
    this.addItem('element_storm', 1);
    // 启动自动获取定时器
    this._startAutoGrant();
  }

  /**
   * 启动自动获取定时器
   */
  _startAutoGrant() {
    // 每 90 秒获得 1 个时间停滞
    this._timers.survival = setInterval(() => {
      this.addItem('time_freeze', 1);
      window.eventBus.emit('item:granted', {
        itemId: 'time_freeze',
        count: 1,
        reason: 'survival',
        items: this.getItemsAsArray(),
      });
    }, 90000);

    // 每 120 秒获得 1 个元素风暴
    this._timers.storm = setInterval(() => {
      this.addItem('element_storm', 1);
      window.eventBus.emit('item:granted', {
        itemId: 'element_storm',
        count: 1,
        reason: 'storm_timer',
        items: this.getItemsAsArray(),
      });
    }, 120000);

    // 监听订单提交事件：每提交 5 个订单获得 1 个立即完成
    this._onOrderSubmitted = (data) => {
      if (this.engine.systems.order.completedOrders > 0 &&
          this.engine.systems.order.completedOrders % 5 === 0) {
        this.addItem('instant_complete', 1);
        window.eventBus.emit('item:granted', {
          itemId: 'instant_complete',
          count: 1,
          reason: 'order_milestone',
          items: this.getItemsAsArray(),
        });
      }
    };
    window.eventBus.on('order:submitted', this._onOrderSubmitted);

    // 监听 Boss 胜利事件：30% 概率掉落双倍积分
    this._onBossVictoryDrop = () => {
      if (Math.random() < 0.3) {
        this.addItem('double_score', 1);
        window.eventBus.emit('notification', {
          message: '✖2 击败 Boss，获得双倍积分道具！',
          type: 'reward',
        });
      }
    };
    window.eventBus.on('boss:victory', this._onBossVictoryDrop);
  }

  /**
   * 添加道具
   * @param {string} itemId - 道具 ID
   * @param {number} count - 数量
   */
  addItem(itemId, count = 1) {
    const def = ItemSystem.ITEM_DEFS[itemId];
    if (!def) return;
    const current = this.items[itemId] || 0;
    const extraCap = this.engine && this.engine._upgradeEffects ? (this.engine._upgradeEffects.extraItemCapacity || 0) : 0;
    this.items[itemId] = Math.min(current + count, def.maxStack + extraCap);
    window.eventBus.emit('items:updated', { items: this.getItemsAsArray() });
  }

  /**
   * 使用道具
   * @param {string} itemId - 道具 ID
   * @param {*} [target] - 使用目标（订单 ID 等）
   * @returns {boolean} 是否使用成功
   */
  useItem(itemId, target) {
    if (!this.items[itemId] || this.items[itemId] <= 0) return false;

    let success = false;
    switch (itemId) {
      case 'time_freeze':
        success = this._useTimeFreeze();
        break;
      case 'instant_complete':
        success = this._useInstantComplete(target);
        break;
      case 'skip_order':
        success = this._useSkipOrder(target);
        break;
      case 'element_storm':
        success = this._useElementStorm();
        break;
      case 'double_score':
        success = this._useDoubleScore();
        break;
    }

    if (success) {
      this.items[itemId]--;
      if (this.items[itemId] <= 0) {
        delete this.items[itemId];
      }
      window.eventBus.emit('item:used', { itemId, target });
      window.eventBus.emit('items:updated', { items: this.getItemsAsArray() });
    }
    return success;
  }

  /** 时间停滞：冻结所有订单倒计时 10 秒（计时器真正暂停） */
  _useTimeFreeze() {
    const freezeDuration = 10000;
    const now = Date.now();
    for (const order of this.engine.systems.order.orders) {
      if (!order.expired) {
        order._savedRemaining = order.expiresAt - now;
      }
    }
    this._freezeEndTime = now + freezeDuration;
    window.eventBus.emit('notification', {
      message: '⏸ 时间停滞！所有订单倒计时冻结 10 秒',
      type: 'info',
    });
    window.eventBus.emit('freeze:activated', { until: this._freezeEndTime });
    return true;
  }

  /** 立即完成：直接完成指定订单并增加积分 */
  _useInstantComplete(orderId) {
    const now = Date.now();
    const orders = this.engine.systems.order.orders.filter(o => !o.expired);
    if (orders.length === 0) return false;

    if (!orderId) {
      // 智能选择：优先选提交后可通关的订单（取其中分数最高的），否则选剩余时间最小的
      const currentScore = this.engine.state.score;
      const targetScore = this.engine.state.targetScore;

      // 找提交后可通关的订单
      const winningOrders = orders.filter(o => currentScore + o.reward >= targetScore);
      if (winningOrders.length > 0) {
        winningOrders.sort((a, b) => b.reward - a.reward);
        orderId = winningOrders[0].id;
      } else {
        // 否则选剩余时间最小的
        orders.sort((a, b) => (a.expiresAt - now) - (b.expiresAt - now));
        orderId = orders[0].id;
      }
    }

    const order = this.engine.systems.order.getOrderById(orderId);
    if (!order || order.expired) return false;

    // 先移除订单
    this.engine.systems.order.completeOrderDirect(orderId);
    // 增加积分
    this.engine.state.score += order.reward;
    window.eventBus.emit('score:updated', {
      score: this.engine.state.score,
      targetScore: this.engine.state.targetScore,
    });

    window.eventBus.emit('notification', {
      message: '✅ 立即完成！订单已清除，+' + order.reward + '分',
      type: 'reward',
    });
    return true;
  }

  /** 跳过订单：移除订单不扣分（无 target 时自动选剩余时间最小的订单） */
  _useSkipOrder(orderId) {
    if (!orderId) {
      const now = Date.now();
      const available = this.engine.systems.order.orders
        .filter(o => !o.expired)
        .sort((a, b) => (a.expiresAt - now) - (b.expiresAt - now));
      if (available.length === 0) return false;
      orderId = available[0].id;
    }
    const order = this.engine.systems.order.getOrderById(orderId);
    if (!order || order.expired) return false;

    this.engine.systems.order.removeOrderSilently(orderId);
    window.eventBus.emit('notification', {
      message: '➡ 已跳过订单',
      type: 'info',
    });
    return true;
  }

  /** 元素风暴：10 秒内发射器无冷却 */
  _useElementStorm() {
    if (!this.engine.state.emitters) return false;
    this._stormEndTime = Date.now() + 10000;
    window.eventBus.emit('notification', {
      message: '🌪 元素风暴！10 秒内发射器无冷却',
      type: 'reward',
    });
    window.eventBus.emit('storm:activated', { until: this._stormEndTime });
    return true;
  }

  /** 双倍积分：下次提交积分 x2 */
  _useDoubleScore() {
    this.engine._nextOrderMultiplier = 2;
    window.eventBus.emit('notification', {
      message: '✖2 下次提交订单积分翻倍！',
      type: 'info',
    });
    return true;
  }

  /**
   * 获取道具列表
   * @returns {object} { itemId: count }
   */
  getItems() {
    return { ...this.items };
  }

  /**
   * 获取道具数量
   * @param {string} itemId
   * @returns {number}
   */
  getItemCount(itemId) {
    return this.items[itemId] || 0;
  }

  /**
   * 获取道具列表（数组格式，供 UI 渲染）
   * @returns {Array} [{ id, count, def }]
   */
  getItemsAsArray() {
    return Object.entries(this.items)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        count,
        def: ItemSystem.ITEM_DEFS[id],
      }));
  }

  /** 解冻所有订单倒计时（由游戏循环在冻结到期时调用） */
  _unfreezeOrders() {
    const now = Date.now();
    for (const order of this.engine.systems.order.orders) {
      if (!order.expired && order._savedRemaining !== undefined) {
        order.expiresAt = now + order._savedRemaining;
        delete order._savedRemaining;
      }
    }
    this._freezeEndTime = 0;
    window.eventBus.emit('freeze:deactivated');
  }

  /** 清理定时器 */
  destroy() {
    for (const key of Object.keys(this._timers)) {
      clearInterval(this._timers[key]);
    }
    this._timers = {};
    if (this._onOrderSubmitted) {
      window.eventBus.off('order:submitted', this._onOrderSubmitted);
      this._onOrderSubmitted = null;
    }
    if (this._onBossVictoryDrop) {
      window.eventBus.off('boss:victory', this._onBossVictoryDrop);
      this._onBossVictoryDrop = null;
    }
    this._initialized = false;
    this._freezeEndTime = 0;
    this._stormEndTime = 0;
  }
}
