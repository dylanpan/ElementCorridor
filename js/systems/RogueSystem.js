/**
 * ============================================================
 * 爬塔状态机 —— 肉鸽模式的核心控制器
 * 管理整局冒险的流程：层数生成、节点推进、结算。
 * 纯逻辑层，不依赖 DOM，迁移 Godot 时可直接复用。
 * ============================================================
 */
class RogueSystem {
  constructor() {
    this.reset();
    this.boonSystem = null;
    this.eventSystem = null;
    this.gameEngine = null;
    this.metaProgress = null;
    this.nextDifficultyBoost = 1.0;
    this.orderPenalty = 1.0;
  }

  /** 初始化关联系统引用 */
  init(boonSystem, eventSystem, metaProgress) {
    this.boonSystem = boonSystem;
    this.eventSystem = eventSystem;
    this.metaProgress = metaProgress;
  }

  /** 重置为新的一局 */
  reset() {
    this.state = {
      currentFloor: 0,
      currentNodeIndex: 0,
      nodes: [],
      runState: 'preparing', // preparing | playing | won | lost
      gold: 0,
      scoreAtStartOfFloor: 0,
      targetScoreForFloor: 80,
      bossDefeated: false,
      floorHistory: [],
      floorNodeHistory: [], // 每层完整节点列表 [{floor, nodes, targetScore}]
    };
    this.nextDifficultyBoost = 1.0;
    this.orderPenalty = 1.0;
  }

  /**
   * 开始新冒险
   * @param {number} maxFloor - 总层数
   */
  startRun(maxFloor = FLOOR_GENERATOR.maxFloor) {
    this.reset();
    this.state.runState = 'playing';
    this.state.currentFloor = 1;

    // 应用局外成长效果
    const effects = this.metaProgress ? this.metaProgress.getActiveEffects() : {};
    if (effects.startGold) this.state.gold += effects.startGold;

    // 生成第一层
    this._generateFloor(1);
    
    window.eventBus.emit('rogue:run-started', {
      maxFloor,
      gold: this.state.gold,
    });
  }

  /** 生成指定层的节点 */
  _generateFloor(floorNumber) {
    this.state.nodes = FLOOR_GENERATOR.generateFloor(floorNumber);
    this.state.currentNodeIndex = 0;
    this.state.bossDefeated = false;

    // 计算本关目标分数
    let multiplier = Math.pow(ROGUE_DIFFICULTY.scoreMultiplierPerFloor, floorNumber - 1);
    if (this.nextDifficultyBoost > 1.0) {
      multiplier *= this.nextDifficultyBoost;
      this.nextDifficultyBoost = 1.0;
    }
    this.state.targetScoreForFloor = Math.floor(ROGUE_DIFFICULTY.baseScore * multiplier);

    window.eventBus.emit('rogue:floor-generated', {
      floor: floorNumber,
      nodes: this.state.nodes.map(n => ({ ...n })),
      targetScore: this.state.targetScoreForFloor,
    });
  }

  /** 获取当前节点 */
  getCurrentNode() {
    if (this.state.currentNodeIndex >= this.state.nodes.length) return null;
    return this.state.nodes[this.state.currentNodeIndex];
  }

  /** 进入下一个节点 */
  advanceToNextNode() {
    this.state.currentNodeIndex++;
    if (this.state.currentNodeIndex >= this.state.nodes.length) {
      return false; // 本层所有节点已走完
    }
    const node = this.getCurrentNode();
    window.eventBus.emit('rogue:node-entered', { node: { ...node }, index: this.state.currentNodeIndex });
    return true;
  }

  /** 完成当前节点 */
  completeNode(result) {
    const node = this.getCurrentNode();
    if (!node) return;

    this.state.floorHistory.push({
      floor: this.state.currentFloor,
      nodeType: node.type,
      result: result,
    });

    if (result.rewards) {
      if (result.rewards.gold) this.state.gold += result.rewards.gold;
    }
  }

  /** 进入下一层 */
  nextFloor() {
    // 保存当前层节点到历史（在递增层数之前）
    if (this.state.nodes.length > 0) {
      this.state.floorNodeHistory.push({
        floor: this.state.currentFloor,
        nodes: JSON.parse(JSON.stringify(this.state.nodes)),
        targetScore: this.state.targetScoreForFloor,
      });
    }

    this.state.currentFloor++;
    if (this.state.currentFloor > FLOOR_GENERATOR.maxFloor) {
      this.winRun();
      return;
    }
    this._generateFloor(this.state.currentFloor);
    if (this.boonSystem) this.boonSystem.resetFirstOrderFlag();
  }

  /** 跳过当前层（事件效果） */
  skipToNextFloor() {
    this.nextFloor();
  }

  /** 通关 */
  winRun() {
    this.state.runState = 'won';
    this.state.bossDefeated = true;
    window.eventBus.emit('rogue:run-ended', { won: true, state: this.getSummary() });
  }

  /** 失败 */
  loseRun() {
    this.state.runState = 'lost';
    window.eventBus.emit('rogue:run-ended', { won: false, state: this.getSummary() });
  }

  /** 获取本关目标分数 */
  getTargetScore() {
    return this.state.targetScoreForFloor;
  }

  /** 获取当前层数 */
  getCurrentFloor() {
    return this.state.currentFloor;
  }

  /** 获取历史层路线图数据（已通关的层） */
  getFloorHistory() {
    return this.state.floorNodeHistory;
  }

  /** 获取最大层数 */
  getMaxFloor() {
    return FLOOR_GENERATOR.maxFloor;
  }

  /** 获取金币 */
  getGold() {
    return this.state.gold;
  }

  /** 消耗金币 */
  spendGold(amount) {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    window.eventBus.emit('rogue:gold-updated', this.state.gold);
    return true;
  }

  /** 添加金币 */
  addGold(amount) {
    this.state.gold += amount;
    window.eventBus.emit('rogue:gold-updated', this.state.gold);
  }

  /** 获取运行状态摘要 */
  getSummary() {
    return {
      currentFloor: this.state.currentFloor,
      currentNodeIndex: this.state.currentNodeIndex,
      totalNodes: this.state.nodes.length,
      runState: this.state.runState,
      gold: this.state.gold,
      targetScore: this.state.targetScoreForFloor,
      bossDefeated: this.state.bossDefeated,
      boons: this.boonSystem ? this.boonSystem.getBoonSummary() : [],
      curses: this.boonSystem ? this.boonSystem.getCurseSummary() : [],
    };
  }

  /** 序列化 */
  serialize() {
    return {
      state: this.state,
      nextDifficultyBoost: this.nextDifficultyBoost,
      orderPenalty: this.orderPenalty,
    };
  }

  /** 反序列化 */
  deserialize(data) {
    this.state = data.state;
    this.nextDifficultyBoost = data.nextDifficultyBoost || 1.0;
    this.orderPenalty = data.orderPenalty || 1.0;
  }
}