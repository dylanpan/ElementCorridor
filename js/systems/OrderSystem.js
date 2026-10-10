/**
 * ============================================================
 * 订单系统 —— 管理需求订单的生成、刷新和提交
 * 纯逻辑层，通过事件通知UI更新。
 * ============================================================
 */
class OrderSystem {
  constructor() {
    this.orders = [];
    this.maxOrders = 3;
    this.difficultyWeights = { easy: 70, medium: 30, hard: 0, rare: 0 };
    this.completedOrders = 0;
    this._usedTemplates = [];
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
    this._usedTemplates = [];
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
   * 从模板中随机选取一个符合条件的订单
   */
  _pickOrderTemplate(excludeIds = []) {
    const difficulty = this._pickDifficulty();
    const candidates = ORDER_TEMPLATES.filter(
      (t) =>
        t.difficulty === difficulty &&
        !excludeIds.includes(`${t.elementType}_${t.level}`)
    );
    if (candidates.length === 0) {
      // 如果该难度没有可用模板，回退到所有非排除的
      const fallback = ORDER_TEMPLATES.filter(
        (t) => !excludeIds.includes(`${t.elementType}_${t.level}`)
      );
      if (fallback.length === 0) return null;
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
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

    const order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      elementType: template.elementType,
      level: template.level,
      reward: template.reward,
      difficulty: template.difficulty,
      completed: false,
      createdAt: Date.now(),
    };

    return order;
  }

  /**
   * 填充订单列表到最大数量
   */
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
   * @returns {object|null} - { cost, newOrders } 或 null（积分不足）
   */
  refreshOrders(score) {
    const cost = GAME_SETTINGS.orderRefreshCost;
    if (score < cost) return null;

    this.orders = [];
    const newOrders = this.fillOrders();

    const result = { cost, newOrders };
    window.eventBus.emit('orders:refreshed', result);
    return result;
  }

  /**
   * 获取当前订单列表
   */
  getOrders() {
    return [...this.orders];
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