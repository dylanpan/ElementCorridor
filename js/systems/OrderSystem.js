/**
 * ============================================================
 * 订单系统 —— 管理需求订单的生成、刷新和提交
 * 纯逻辑层，通过事件通知UI更新。
 * ============================================================
 */
class OrderSystem {
    static QUALITY_CONFIG = {
    common: {
      label: '普通',
      color: '#9e9e9e',
      timeMultiplier: 0.8,
      rewardMultiplier: 1.0,
      weight: 450,
      icon: '⬜',
    },
    rare: {
      label: '稀有',
      color: '#42a5f5',
      timeMultiplier: 1.2,
      rewardMultiplier: 1.5,
      weight: 320,
      icon: '🔵',
    },
    epic: {
      label: '史诗',
      color: '#ab47bc',
      timeMultiplier: 1.6,
      rewardMultiplier: 2.5,
      weight: 172,
      icon: '🟣',
    },
    legendary: {
      label: '传说',
      color: '#ffd700',
      timeMultiplier: 2.4,
      rewardMultiplier: 5.0,
      weight: 58,
      icon: '👑',
    },
  };

  constructor() {
    this.orders = [];
    this.maxOrders = 3;
    this.difficultyWeights = { easy: 70, medium: 30, hard: 0, rare: 0 };
    this.completedOrders = 0;
    this.timeMultiplier = 1;
    this._usedTemplates = [];
    // 单一发射器模式：发射器产出类型状态
    this._emitterTypes = [];
    this._hasAffinity = false;
  }

  /**
   * 初始化订单系统
   * @param {number} maxOrders - 最大同时订单数
   * @param {object} difficultyWeights - 难度权重配置
   */
  init(maxOrders, difficultyWeights) {
    this.maxOrders = maxOrders;
    this.difficultyWeights = difficultyWeights;
    this.orders = [];
    this.completedOrders = 0;
    this.timeMultiplier = 1;
    this._usedTemplates = [];
    this._emitterTypes = [];
    this._hasAffinity = false;
  }

  /**
   * 根据难度权重随机选取一个难度
   */
  _pickDifficulty() {
    const entries = Object.entries(this.difficultyWeights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (const [difficulty, weight] of entries) {
      rand -= weight;
      if (rand <= 0) return difficulty;
    }
    return 'easy';
  }

  /**
   * 根据权重随机抽取品质
   * @returns {string} 品质名称
   */
  _pickQuality() {
    const configs = OrderSystem.QUALITY_CONFIG;
    const entries = Object.entries(configs);
    const totalWeight = entries.reduce((sum, [, cfg]) => sum + cfg.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const [quality, cfg] of entries) {
      rand -= cfg.weight;
      if (rand <= 0) return quality;
    }
    return 'common';
  }

  /**
   * 从模板中随机选取一个符合条件的订单
   */
  _pickOrderTemplate(excludeIds = []) {
    if (!this._hasAffinity) {
      // ── 仅产出无属性元素时：从五种属性元素中随机生成 ──
      const candidates = ORDER_TEMPLATES.filter(
        (t) =>
          !excludeIds.includes(`${t.elementType}_${t.level}`)
      );
      if (candidates.length === 0) {
        const fallback = ORDER_TEMPLATES.filter(
          (t) => !excludeIds.includes(`${t.elementType}_${t.level}`)
        );
        return fallback.length > 0
          ? fallback[Math.floor(Math.random() * fallback.length)]
          : null;
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // ── 已产出属性元素时：按发射器产出类型加权 ──
    const allCandidates = ORDER_TEMPLATES.filter(
      (t) =>
        !excludeIds.includes(`${t.elementType}_${t.level}`)
    );
    if (allCandidates.length === 0) {
      const fallback = ORDER_TEMPLATES.filter(
        (t) => !excludeIds.includes(`${t.elementType}_${t.level}`)
      );
      return fallback.length > 0
        ? fallback[Math.floor(Math.random() * fallback.length)]
        : null;
    }

    // 分离：与发射器产出类型匹配的订单 vs 其他订单
    const matched = allCandidates.filter((t) =>
      this._emitterTypes.includes(t.elementType)
    );
    const unmatched = allCandidates.filter(
      (t) => !this._emitterTypes.includes(t.elementType)
    );

    // 权重分配：matched 占 70%，unmatched 占 30%
    const weightedPool = [];
    for (const m of matched) {
      for (let i = 0; i < 7; i++) weightedPool.push(m);
    }
    for (const u of unmatched) {
      for (let i = 0; i < 3; i++) weightedPool.push(u);
    }

    return weightedPool[Math.floor(Math.random() * weightedPool.length)];
  }

  /**
   * 生成一个新订单
   * @returns {object|null} 生成的订单对象
   */
  generateOrder() {
    const excludeIds = this.orders.map(
      (o) => `${o.elementType}_${o.level}`
    );
    const template = this._pickOrderTemplate(excludeIds);
    if (!template) return null;

    // 抽取品质
    const quality = this._pickQuality();
    const qualityCfg = OrderSystem.QUALITY_CONFIG[quality];

    // 品质决定元素等级和基础奖励
    const qualityLevelMap = { common: 2, rare: 3, epic: 4, legendary: 5 };
    const qualityRewardMap = { common: 15, rare: 40, epic: 90, legendary: 200 };
    const targetLevel = qualityLevelMap[quality] || 2;
    const baseReward = qualityRewardMap[quality] || 15;

    // 基础时间（基于品质等级）
    const baseTime = this._getTimeLimit(targetLevel);
    // 品质修正后的时间
    const adjustedTime = Math.floor(baseTime * qualityCfg.timeMultiplier);
    // 按生成顺序添加偏移量，确保同一批次订单 expiresAt 有先后
    const orderOffset = this.orders.length * 380;
    const order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      elementType: template.elementType,
      level: targetLevel,
      reward: Math.floor(baseReward * qualityCfg.rewardMultiplier),
      difficulty: template.difficulty,
      quality: quality,
      completed: false,
      createdAt: Date.now(),
      timeLimit: Math.floor(adjustedTime * this.timeMultiplier),
      expiresAt: Date.now() + Math.floor(adjustedTime * this.timeMultiplier) + orderOffset,
      expired: false,
    };

    return order;
  }

  /**
   * 根据难度获取倒计时时长
   * @param {string} difficulty - 订单难度
   * @returns {number} 倒计时毫秒数
   */
  _getTimeLimit(level) {
    const limits = {
      2: 20000,     // 普通
      3: 27500,     // 稀有
      4: 37000,     // 史诗
      5: 43000,     // 传说
    };
    return limits[level] || 25000;
  }

  /**
   * 填充订单列表到最大数量
   */
  /**
   * 设置当前发射器可产出的元素类型状态
   * @param {string[]} emitterTypes - 发射器当前可产出的元素类型列表
   * @param {boolean} hasAffinity - 是否已获得亲和祝福
   */
  setEmitterState(emitterTypes, hasAffinity) {
    this._emitterTypes = emitterTypes || [];
    this._hasAffinity = hasAffinity;
  }

  fillOrders() {
    const added = [];
    while (this.orders.length < this.maxOrders) {
      const order = this.generateOrder();
      if (!order) break;
      this.orders.push(order);
      added.push(order);
    }
    if (added.length > 0) {
      window.eventBus.emit('orders:updated', [...this.orders]);
    }
    return added;
  }

  /**
   * 尝试提交订单
   * @param {string} orderId - 订单ID
   * @param {Array<Array<Element|null>>} grid - 当前棋盘状态
   * @param {SpawnSystem} spawnSystem - 产出系统实例
   * @returns {object|null} - 提交结果 { reward, element, comboMultiplier } 或 null
   */
  submitOrder(orderId, grid, spawnSystem) {
    const orderIndex = this.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return null;

    const order = this.orders[orderIndex];

    // 查找棋盘上匹配的元素
    const matches = spawnSystem.findElementsByTypeAndLevel(
      grid,
      order.elementType,
      order.level
    );

    if (matches.length === 0) return null;

    // 取第一个匹配的元素提交
    const match = matches[0];
    spawnSystem.removeElement(grid, match.element);

    // 标记订单完成并移除
    this.orders.splice(orderIndex, 1);
    this.completedOrders++;

    // 补充新订单
    this.fillOrders();

    const result = {
      reward: order.reward,
      element: match.element,
      order: order,
    };

    window.eventBus.emit('order:submitted', result);
    return result;
  }

  /**
   * 刷新所有订单（消耗积分）
   * @param {number} score - 当前积分
   * @param {boolean} free - 是否免费刷新
   * @returns {object|null} - { cost, newOrders } 或 null（积分不足）
   */
  refreshOrders(score, free = false) {
    if (!free) {
      const cost = GAME_SETTINGS.orderRefreshCost;
      if (score < cost) return null;
      this.orders = [];
      const newOrders = this.fillOrders();
      return { cost, newOrders };
    } else {
      this.orders = [];
      const newOrders = this.fillOrders();
      return { cost: 0, newOrders };
    }
  }

  /**
   * 获取当前订单列表
   */
  getOrders() {
    return [...this.orders];
  }

  /**
   * 根据订单 ID 获取订单对象
   * @param {string} orderId
   * @returns {object|null}
   */
  getOrderById(orderId) {
    return this.orders.find((o) => o.id === orderId) || null;
  }

  /**
   * 移除超时订单并补充新订单
   * @param {string} orderId - 超时订单 ID
   */
  removeExpiredOrder(orderId) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    this.orders.splice(idx, 1);
    this.fillOrders();
  }

  /**
   * 添加一个加急订单（临时额外订单）
   */
  addRushOrder(order) {
    this.orders.push(order);
    window.eventBus.emit('orders:updated', [...this.orders]);
  }

  /**
   * 移除加急订单（事件结束时调用）
   */
  removeRushOrder(orderId) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      this.orders.splice(idx, 1);
      // 移除后补充到 maxOrders
      this.fillOrders();
    }
  }

  /**
   * 直接完成订单（不消耗棋盘元素，由道具系统调用）
   * @param {string} orderId - 订单 ID
   */
  completeOrderDirect(orderId) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    this.orders.splice(idx, 1);
    this.completedOrders++;
    this.fillOrders();
  }

  /**
   * 静默移除订单（不扣分，由道具系统调用）
   * @param {string} orderId - 订单 ID
   */
  removeOrderSilently(orderId) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    this.orders.splice(idx, 1);
    this.fillOrders();
  }

  /** 序列化 */
  serialize() {
    return {
      orders: this.orders,
      maxOrders: this.maxOrders,
      difficultyWeights: { ...this.difficultyWeights },
      completedOrders: this.completedOrders,
    };
  }

  /** 反序列化 */
  static deserialize(data) {
    const system = new OrderSystem();
    system.orders = data.orders || [];
    system.maxOrders = data.maxOrders || 3;
    system.difficultyWeights = data.difficultyWeights || { easy: 100, medium: 0, hard: 0, rare: 0 };
    system.completedOrders = data.completedOrders || 0;
    return system;
  }
}