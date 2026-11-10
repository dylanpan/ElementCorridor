/**
 * ============================================================
 * 危机事件系统 —— 无尽模式专属负面事件
 * 在无尽模式中随机触发负面事件，增加挑战性与不可预测性
 * ============================================================
 */
class CrisisSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this._activeEvent = null;
    this._immuneUntil = 0;
    this._nextCheckTime = 0;
    this._originalState = {};
    this._enabled = false;
    this._warningTimerId = null;
  }

  /** 危机事件定义 */
  static EVENTS = [
    {
      id: 'order_flood',
      name: '订单洪流',
      icon: '📦',
      description: '同时出现 2 个额外订单',
      duration: 10000,
      apply: (ctx) => {
        for (let i = 0; i < 2; i++) {
          const order = ctx.engine.systems.order.generateOrder();
          if (order) {
            order.isRush = true;
            order.rushId = `flood_${Date.now()}_${i}`;
            ctx.engine.systems.order.addRushOrder(order);
          }
        }
      },
      revert: (ctx) => {
        const orders = ctx.engine.systems.order.orders;
        const toRemove = orders.filter(o => o.isRush && o.rushId && o.rushId.startsWith('flood_'));
        for (const o of toRemove) {
          ctx.engine.systems.order.removeRushOrder(o.id);
        }
      },
    },
    {
      id: 'cooldown_double',
      name: '冷却加倍',
      icon: '🐢',
      description: '所有发射器冷却时间 x2',
      duration: 12000,
      apply: (ctx) => {
        ctx._originalState.cooldownMultiplier = ctx.engine._eventCtx.emitterSpeedMultiplier;
        ctx.engine._eventCtx.emitterSpeedMultiplier *= 0.5;
        for (const emitter of ctx.engine.state.emitters) {
          emitter.modifiers.cooldownMultiplier *= 2;
        }
      },
      revert: (ctx) => {
        ctx.engine._eventCtx.emitterSpeedMultiplier = ctx._originalState.cooldownMultiplier || 1;
        for (const emitter of ctx.engine.state.emitters) {
          emitter.modifiers.cooldownMultiplier /= 2;
        }
      },
    },
    {
      id: 'time_crunch',
      name: '时间紧缩',
      icon: '⏳',
      description: '所有订单倒计时减半',
      duration: 10000,
      apply: (ctx) => {
        for (const order of ctx.engine.systems.order.orders) {
          if (!order.expired) {
            const remaining = order.expiresAt - Date.now();
            order.expiresAt = Date.now() + Math.max(3000, remaining / 2);
          }
        }
      },
      revert: () => {},
    },
    {
      id: 'element_chaos',
      name: '元素混乱',
      icon: '🌪',
      description: '棋盘上随机 3 个元素互换位置',
      duration: 8000,
      apply: (ctx) => {
        const board = ctx.engine.state.board;
        const cells = [];
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] && !board[r][c]._blocked) {
              cells.push({ row: r, col: c, el: board[r][c] });
            }
          }
        }
        if (cells.length >= 3) {
          const shuffled = [...cells].sort(() => Math.random() - 0.5).slice(0, 3);
          const temp = shuffled[0].el;
          shuffled[0].el = shuffled[1].el;
          shuffled[1].el = shuffled[2].el;
          shuffled[2].el = temp;
          for (const cell of shuffled) {
            board[cell.row][cell.col] = cell.el;
          }
          ctx.engine.boardRenderer.renderAll(board);
        }
      },
      revert: () => {},
    },
    {
      id: 'score_decay',
      name: '积分衰减',
      icon: '💔',
      description: '提交订单积分减半',
      duration: 10000,
      apply: (ctx) => {
        ctx._originalState.scoreMultiplier = ctx.engine._eventCtx.scoreMultiplier;
        ctx.engine._eventCtx.scoreMultiplier *= 0.5;
      },
      revert: (ctx) => {
        ctx.engine._eventCtx.scoreMultiplier = ctx._originalState.scoreMultiplier || 1;
      },
    },
  ];

  /**
   * 设置启用状态
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this._forceEnd();
    }
  }

  /**
   * 每帧检查是否触发事件
   * @param {number} now - 当前时间戳
   */
  tick(now) {
    if (!this._enabled) return;
    if (now < this._nextCheckTime) return;
    if (now < this._immuneUntil) return;
    if (this._activeEvent) return;

    // 随机触发：约 15% 概率
    if (Math.random() < 0.08) {
      this._triggerEvent();
    }
    this._nextCheckTime = now + 5000; // 每 5 秒检查一次
  }

  /**
   * 每帧更新事件状态
   * @param {number} now - 当前时间戳
   */
  update(now) {
    if (!this._enabled) return;
    if (!this._activeEvent) return;

    if (now >= this._activeEvent.endTime) {
      this._endEvent();
    }
  }

  /**
   * 触发随机事件
   */
  _triggerEvent() {
    const eventDef = CrisisSystem.EVENTS[
      Math.floor(Math.random() * CrisisSystem.EVENTS.length)
    ];

    this._activeEvent = {
      def: eventDef,
      endTime: Date.now() + eventDef.duration,
    };

    // 应用事件效果
    eventDef.apply(this);

    // 发出事件开始信号
    window.eventBus.emit('crisis:started', {
      id: eventDef.id,
      name: eventDef.name,
      icon: eventDef.icon,
      description: eventDef.description,
      duration: eventDef.duration,
    });
  }

  /**
   * 结束当前事件
   */
  _endEvent() {
    if (!this._activeEvent) return;
    const eventDef = this._activeEvent.def;

    // 还原事件效果
    eventDef.revert(this);

    // 危机事件结束后有概率奖励祝福或道具
    this._tryGrantReward(eventDef);

    this._activeEvent = null;
    this._immuneUntil = Date.now() + 13000; // 13 秒免疫

    window.eventBus.emit('crisis:ended', {
      id: eventDef.id,
    });
  }

  /**
   * 危机事件结束后尝试发放奖励
   * 20% 概率获得一个随机普通祝福，20% 概率获得一个随机道具
   */
  _tryGrantReward(eventDef) {
    const roll = Math.random();
    if (roll < 0.20) {
      // 20%: 获得一个随机普通祝福
      if (this.engine.boonSystem && typeof this.engine.boonSystem.pickRandomBoons === 'function') {
        const boons = this.engine.boonSystem.pickRandomBoons(1, 'common');
        if (boons && boons.length > 0) {
          const added = this.engine.boonSystem.addBoon(boons[0]);
          if (added) {
            window.eventBus.emit('crisis:reward', {
              type: 'boon',
              boon: boons[0],
              eventName: eventDef.name,
            });
            window.eventBus.emit('notification', {
              message: '✨ 危机过后获得祝福！' + (boons[0].icon || '') + ' ' + boons[0].name,
              type: 'reward',
            });
          }
        }
      }
    } else if (roll < 0.40) {
      // 20%: 获得一个随机道具（跳过订单/时间停滞/元素风暴）
      if (this.engine.itemSystem) {
        const pool = ['skip_order', 'time_freeze', 'element_storm'];
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        this.engine.itemSystem.addItem(itemId, 1);
        const def = ItemSystem.ITEM_DEFS[itemId];
        window.eventBus.emit('crisis:reward', {
          type: 'item',
          itemId: itemId,
          eventName: eventDef.name,
        });
        window.eventBus.emit('notification', {
          message: '🎁 危机过后获得道具！' + (def ? def.icon + ' ' + def.name : itemId),
          type: 'reward',
        });
      }
    }
  }

  /**
   * 强制结束所有事件（禁用时调用）
   */
  _forceEnd() {
    if (this._activeEvent) {
      this._activeEvent.def.revert(this);
      this._activeEvent = null;
    }
    this._immuneUntil = 0;
    this._nextCheckTime = 0;
  }

  /**
   * 重置系统（关卡开始时调用）
   */
  reset() {
    this._forceEnd();
    this._nextCheckTime = Date.now() + 15000; // 开局 15 秒后才触发
  }

  /**
   * 获取当前活跃事件
   * @returns {object|null}
   */
  getActiveEvent() {
    return this._activeEvent ? this._activeEvent.def : null;
  }
}
