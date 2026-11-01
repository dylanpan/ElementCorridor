/**
 * ============================================================
 * 自动合成引擎（AutoPlaySystem）
 * 自动点击发射器产出元素、自动合成相邻同类型元素、自动提交匹配订单
 * 让玩家从繁琐的重复操作中解放出来，专注于策略决策
 *
 * 注意：自动合成为局外成长天赋，需通过升级点数解锁。
 * ============================================================
 */
class AutoPlaySystem {
  /**
   * @param {GameEngine} engine - 游戏引擎实例
   */
  constructor(engine) {
    this.engine = engine;
    this._intervalId = null;
    this._processing = false;
    this._paused = false;       // 手动暂停
    this._enabled = false;      // 天赋是否已解锁
    this._hungryCounter = 0;    // 连续只合成不产元素的次数
    this._stats = {
      submits: 0,
      merges: 0,
      spawns: 0,
      totalDecisions: 0,
    };
  }

  /**
   * 检查自动合成天赋是否已解锁
   * @returns {boolean}
   */
  _checkEnabled() {
    if (this.engine && this.engine.upgradeSystem) {
      const effects = this.engine.upgradeSystem.getActiveEffects();
      return !!effects.autoMerge;
    }
    return false;
  }

  /**
   * 启动自动合成
   */
  start() {
    this._enabled = this._checkEnabled();
    if (!this._enabled) return; // 天赋未解锁，不启动
    if (this._intervalId) return;
    this._intervalId = setInterval(() => this._decisionLoop(), 360);
  }

  /**
   * 停止自动合成
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * 重启自动合成（用于天赋解锁后重新启动）
   */
  restart() {
    this.stop();
    this._paused = false;
    this.start();
  }

  /**
   * 暂停自动合成
   */
  pause() {
    this._paused = true;
  }

  /**
   * 恢复自动合成
   */
  resume() {
    this._paused = false;
  }

  /**
   * 是否已暂停
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  }

  /**
   * 自动合成是否已解锁并运行中
   * @returns {boolean}
   */
  isRunning() {
    return this._enabled && this._intervalId !== null;
  }

  /**
   * 获取统计数据
   * @returns {object}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * 主决策循环
   * 优先级：提交 > 合成 > 产元素
   */
  _decisionLoop() {
    if (!this.engine.state.isPlaying || this.engine.state.isPaused) return;
    if (this._paused) return; // 手动暂停
    if (this._processing) return; // 防止重入

    this._processing = true;
    this._stats.totalDecisions++;

    try {
      // 游戏结束保护：每次操作前重新检查，防止失败弹窗后仍在合成
      if (!this.engine.state.isPlaying) return;

      // 元素风暴：风暴期间优先点击发射器（快速产元素），压制合成
      const isStormActive = this.engine.itemSystem &&
        this.engine.itemSystem._stormEndTime > Date.now();
      if (isStormActive) {
        // 风暴期间：发射器一直产出，同时尽可能多地合成和提交
        this._tryAutoSpawn(true);
        // 多次尝试合成和提交，直到棋盘稳定
        for (var _i = 0; _i < 5; _i++) {
          if (!this._tryAutoSubmit()) break;
        }
        for (var _i = 0; _i < 5; _i++) {
          if (!this._tryAutoMerge()) break;
        }
        this._hungryCounter = 0;
        return;
      }

      // 优先级 1：自动提交匹配订单
      if (this._tryAutoSubmit()) {
        this._hungryCounter = 0;
        return;
      }

      // 优先级 2：自动合成相邻元素
      if (this._tryAutoMerge()) {
        this._hungryCounter++;
        return;
      }

      // 饥饿保护：连续 3 次只合成不产元素时强制产一次
      if (this._hungryCounter >= 3) {
        if (this._tryAutoSpawn()) {
          this._hungryCounter = 0;
          return;
        }
        // 仍无法产元素则继续合成
      }

      // 优先级 3：自动点击发射器
      if (this._tryAutoSpawn()) {
        this._hungryCounter = 0;
        return;
      }

      this._hungryCounter = 0;
    } finally {
      this._processing = false;
    }
  }

  /**
   * 自动提交：遍历订单，优先提交即将超时的
   * @returns {boolean} 是否成功提交
   */
  _tryAutoSubmit() {
    const orders = this.engine.systems.order.getOrders()
      .filter(o => !o.expired);

    if (orders.length === 0) return false;

    // 按剩余时间升序排序（即将超时的优先提交）
    orders.sort((a, b) => a.expiresAt - b.expiresAt);

    for (const order of orders) {
      // 检查精确匹配（同类型同等级）
      const matches = this.engine.systems.spawn.findElementsByTypeAndLevel(
        this.engine.state.board,
        order.elementType,
        order.level
      );

      let canSubmit = matches.length > 0;

      // 无精确匹配时，检查是否可用无属性元素提交（高 1 级）
      if (!canSubmit && this.engine.boonSystem) {
        const basicMatches = this.engine.systems.spawn.findElementsByTypeAndLevel(
          this.engine.state.board,
          'basic',
          order.level + 1
        );
        canSubmit = basicMatches.length > 0;
      }

      if (canSubmit) {
        this.engine._onOrderClicked(order.id);
        this._stats.submits++;
        return true;
      }
    }
    return false;
  }

  /**
   * 自动合成：扫描棋盘，找到可合成的相邻元素
   * 优先合成低等级元素
   * @returns {boolean} 是否成功合成
   */
  _tryAutoMerge() {
    const board = this.engine.state.board;
    const candidates = [];

    // 按类型+等级分组，扫描全棋盘任意位置的可合成元素对
    const groups = {};
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const el = board[r][c];
        if (!el || el._blocked) continue;
        const key = `${el.typeId}_${el.level}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ row: r, col: c, level: el.level });
      }
    }

    // 判断是否拥有三重奏祝福
    const hasTripleMerge = this.engine.boonSystem &&
      this.engine.boonSystem.hasBoon('boon_triple_merge');

    if (hasTripleMerge) {
      // 三重奏模式：需要找 3 个同类型同等级元素
      for (const key in groups) {
        const cells = groups[key];
        if (cells.length >= 3) {
          candidates.push({
            from: cells[0],
            to: cells[1],
            third: cells[2],
            level: cells[0].level,
          });
        }
      }
      if (candidates.length === 0) return false;

      // 优先合成最低等级的
      candidates.sort((a, b) => a.level - b.level);
      const best = candidates[0];

      // 第一步：选中第一个元素
      this.engine.boardRenderer.selectCell(best.from.row, best.from.col, board);
      // 第二步：点击第二个元素，触发三合一模式（存储候选、取消选中）
      this.engine._onCellClick(best.to.row, best.to.col);
      // 第三步：点击第三个元素，触发 _executeTripleMerge
      this.engine._onCellClick(best.third.row, best.third.col);
      this._stats.merges++;
      return true;
    }

    // 普通模式：找 2 个同类型同等级元素
    for (const key in groups) {
      const cells = groups[key];
      if (cells.length >= 2) {
        candidates.push({
          from: cells[0],
          to: cells[1],
          level: cells[0].level,
        });
      }
    }

    if (candidates.length === 0) return false;

    // 优先合成最低等级的（为高级元素腾空间）
    candidates.sort((a, b) => a.level - b.level);
    const best = candidates[0];

    // 模拟点击：先选中第一个，再点击第二个触发合成
    this.engine.boardRenderer.selectCell(best.from.row, best.from.col, board);
    this.engine._onCellClick(best.to.row, best.to.col);
    this._stats.merges++;
    return true;
  }

  /**
   * 自动点击发射器：优先点击订单所需元素类型的发射器
   * @returns {boolean} 是否成功点击发射器
   */
  _tryAutoSpawn(force) {
    const orders = this.engine.systems.order.getOrders()
      .filter(o => !o.expired);
    if (!force && orders.length === 0) return false;

    // 统计订单中各元素类型的需求量
    const demandMap = {};
    for (const order of orders) {
      demandMap[order.elementType] = (demandMap[order.elementType] || 0) + 1;
    }

    // 按需求量降序排列元素类型
    const sortedTypes = Object.entries(demandMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    // 优先点击需求量最大的元素类型对应的发射器
    const now = Date.now();
    const isStormActive = this.engine.itemSystem && this.engine.itemSystem._stormEndTime > now;
    for (const type of sortedTypes) {
      const emitter = this.engine.state.emitters.find(
        e => e.elementType === type && (isStormActive || e.isReadyToSpawn(now))
      );
      if (emitter) {
        this.engine._onEmitterClick(emitter.id);
        this._stats.spawns++;
        return true;
      }
    }

    // 没有匹配的发射器，点击任意就绪的发射器
    const anyEmitter = this.engine.state.emitters.find(
      e => isStormActive || e.isReadyToSpawn(now)
    );
    if (anyEmitter) {
      this.engine._onEmitterClick(anyEmitter.id);
      this._stats.spawns++;
      return true;
    }

    return false;
  }
}
