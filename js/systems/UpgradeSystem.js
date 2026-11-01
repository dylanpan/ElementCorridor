/**
 * ============================================================
 * 升级系统（局外成长）
 * 每次游戏结束后根据表现获得升级点数，用于永久提升基础属性。
 * 融合了数值成长（原升级系统）与功能天赋（原星尘天赋树）。
 * 存储方式：localStorage 持久化保存
 * ============================================================
 */
class UpgradeSystem {
  static STORAGE_KEY = 'lingSu_upgrades';

  /**
   * 升级项定义
   * type: 'stat' - 数值成长（多级），'talent' - 功能天赋（通常1级解锁）
   */
  static UPGRADE_DEFS = {
    // ===== 数值成长（原升级系统） =====
    initial_score: {
      id: 'initial_score', name: '初始积分', icon: '❤',
      description: '每级 +2 初始积分',
      maxLevel: 5, costPerLevel: 3, type: 'stat',
      effect: (level) => ({ initialScore: level * 2 }),
    },
    order_time: {
      id: 'order_time', name: '订单时间', icon: '⏱',
      description: '每级 +10% 订单倒计时',
      maxLevel: 5, costPerLevel: 2, type: 'stat',
      effect: (level) => ({ orderTimeMultiplier: 1 + level * 0.1 }),
    },
    emitter_speed: {
      id: 'emitter_speed', name: '发射器速度', icon: '⚡',
      description: '每级 -8% 发射器冷却',
      maxLevel: 5, costPerLevel: 3, type: 'stat',
      effect: (level) => ({ emitterCooldownReduction: level * 0.08 }),
    },
    score_bonus: {
      id: 'score_bonus', name: '积分加成', icon: '🌟',
      description: '每级 +5% 订单积分',
      maxLevel: 5, costPerLevel: 3, type: 'stat',
      effect: (level) => ({ scoreMultiplier: 1 + level * 0.05 }),
    },
    item_capacity: {
      id: 'item_capacity', name: '道具上限', icon: '🎒',
      description: '每级道具堆叠上限 +1',
      maxLevel: 3, costPerLevel: 4, type: 'stat',
      effect: (level) => ({ extraItemCapacity: level }),
    },

    // ===== 功能天赋（原星尘天赋树） =====
    extra_boon_slots: {
      id: 'extra_boon_slots', name: '祝福扩容', icon: '🔮',
      description: '每级可同时持有的祝福数量 +1',
      maxLevel: 3, costPerLevel: 5, type: 'talent',
      effect: (level) => ({ extraBoonSlots: level }),
    },
    start_gold: {
      id: 'start_gold', name: '初始金币', icon: '🪙',
      description: '每级开局额外获得 50/100/200 金币',
      maxLevel: 3, costPerLevel: 3, type: 'talent',
      effect: (level) => ({ startGold: level === 1 ? 50 : level === 2 ? 100 : 200 }),
    },
    extra_board: {
      id: 'extra_board', name: '棋盘扩张', icon: '📐',
      description: '棋盘默认增加 2 个格子',
      maxLevel: 1, costPerLevel: 6, type: 'talent',
      effect: (level) => ({ extraBoardCells: 2 }),
    },
    permanent_cooldown: {
      id: 'permanent_cooldown', name: '永久加速', icon: '⚡',
      description: '每级所有发射器冷却永久减少 5%/10%/20%',
      maxLevel: 3, costPerLevel: 4, type: 'talent',
      effect: (level) => ({ permanentCooldown: level === 1 ? 0.05 : level === 2 ? 0.10 : 0.20 }),
    },
    choose_from_4: {
      id: 'choose_from_4', name: '更多选择', icon: '🃏',
      description: '开局祝福可选数量从 3 增加到 4',
      maxLevel: 1, costPerLevel: 8, type: 'talent',
      effect: (level) => ({ initialBoonChoices: 4 }),
    },
    free_first_refresh: {
      id: 'free_first_refresh', name: '首次免费', icon: '🎁',
      description: '每层第一次刷新订单不消耗积分',
      maxLevel: 1, costPerLevel: 5, type: 'talent',
      effect: (level) => ({ freeFirstRefresh: true }),
    },
    carry_boon: {
      id: 'carry_boon', name: '传承祝福', icon: '🏅',
      description: '允许携带 1 个祝福到下一局',
      maxLevel: 1, costPerLevel: 10, type: 'talent',
      effect: (level) => ({ canCarryBoon: true }),
    },
    unlock_hidden_element: {
      id: 'unlock_hidden_element', name: '隐藏元素', icon: '👻',
      description: '解锁隐藏元素类型「暗影」',
      maxLevel: 1, costPerLevel: 15, type: 'talent',
      effect: (level) => ({ hiddenElement: true }),
    },
  };

  constructor() {
    this.data = this._load();
  }

  /**
   * 获取升级点数
   */
  getPoints() {
    return this.data.points || 0;
  }

  /**
   * 添加升级点数
   * @param {number} amount - 添加的点数
   */
  addPoints(amount) {
    this.data.points = (this.data.points || 0) + amount;
    this._save();
  }

  /**
   * 获取指定升级的等级
   * @param {string} upgradeId - 升级项 ID
   * @returns {number}
   */
  getLevel(upgradeId) {
    return this.data.levels[upgradeId] || 0;
  }

  /**
   * 升级
   * @param {string} upgradeId - 升级项 ID
   * @returns {{ success: boolean, reason?: string }}
   */
  upgrade(upgradeId) {
    const def = UpgradeSystem.UPGRADE_DEFS[upgradeId];
    if (!def) return { success: false, reason: '未知升级项' };

    const currentLevel = this.getLevel(upgradeId);
    if (currentLevel >= def.maxLevel) return { success: false, reason: '已达最大等级' };

    const cost = def.costPerLevel;
    if ((this.data.points || 0) < cost) return { success: false, reason: '升级点数不足' };

    this.data.points -= cost;
    this.data.levels[upgradeId] = currentLevel + 1;
    this._save();
    return { success: true };
  }

  /**
   * 重置所有升级，返还所有已花费点数
   */
  reset() {
    const refund = this._calculateTotalSpent();
    this.data.levels = {};
    this.data.points = (this.data.points || 0) + refund;
    this._save();
  }

  /**
   * 获取所有已激活的效果
   * @returns {object}
   */
  getActiveEffects() {
    const effects = {
      initialScore: 0,
      orderTimeMultiplier: 1,
      emitterCooldownReduction: 0,
      scoreMultiplier: 1,
      extraItemCapacity: 0,
      extraBoonSlots: 0,
      startGold: 0,
      extraBoardCells: 0,
      permanentCooldown: 0,
      initialBoonChoices: 0,
      freeFirstRefresh: false,
      canCarryBoon: false,
      hiddenElement: false,
    };

    for (const [id, def] of Object.entries(UpgradeSystem.UPGRADE_DEFS)) {
      const level = this.getLevel(id);
      if (level > 0) {
        const partial = def.effect(level);
        Object.assign(effects, partial);
      }
    }
    return effects;
  }

  /**
   * 计算已花费的总点数
   * @returns {number}
   */
  _calculateTotalSpent() {
    let total = 0;
    for (const [id, level] of Object.entries(this.data.levels)) {
      const def = UpgradeSystem.UPGRADE_DEFS[id];
      if (def) total += level * def.costPerLevel;
    }
    return total;
  }

  /**
   * 从 localStorage 加载数据
   */
  _load() {
    try {
      const raw = localStorage.getItem(UpgradeSystem.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { points: 0, levels: {} };
  }

  /**
   * 保存到 localStorage
   */
  _save() {
    localStorage.setItem(UpgradeSystem.STORAGE_KEY, JSON.stringify(this.data));
  }
}
