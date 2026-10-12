/**
 * ============================================================
 * 游戏引擎 —— 核心控制器
 * 负责游戏状态管理、各系统协调、生命周期控制。
 * 这是整个游戏的"后端"逻辑层，不直接操作DOM。
 * 迁移至Godot时，此模块的逻辑可直接复用为 Godot 的 Autoload/Singleton。
 * ============================================================
 */
class GameEngine {
  constructor() {
    this.state = {
      level: 1,
      score: 0,
      targetScore: 100,
      isPlaying: false,
      isPaused: false,
      board: [],       // 二维数组 [row][col] -> Element | null
      emitters: [],    // Emitter 实例列表
      levelConfig: null,
    };

    this.systems = {
      merge: new MergeSystem(),
      spawn: null,     // SpawnSystem 实例（依赖棋盘尺寸）
      order: new OrderSystem(),
    };

    this.uiManager = null;
    this.boardRenderer = null;
    this._gameLoopId = null;
    this._autoSaveId = null;
    this._autoSortTimerId = null;
    this._lastFrameTime = 0;

    // 肉鸽模式引用
    this.rogueSystem = null;
    this.boonSystem = null;
    this.isRogueMode = false;
    this.currentRogueNode = null;

    // 三合一候选（boon_triple_merge）
    this._tripleMergeCandidates = [];

    // 连击超时定时器
    this._comboTimeoutId = null;

    // 已触发的连击里程碑（用于首次完整效果）
    this._triggeredMilestones = new Set();

    // ==================== 波次系统状态 ====================
    /** @type {Array<{type:string,target:number,label:string,reward:number}>} */
    this._waves = [];
    /** @type {number} 当前波次索引（0起始） */
    this._currentWaveIndex = 0;
    /** @type {number} 本关累计完成订单数 */
    this._totalOrdersCompleted = 0;
    /** @type {number} 本关累计合成次数 */
    this._totalMergesCount = 0;

    // ==================== 紧急事件系统状态 ====================
    /** @type {object|null} 当前活跃的紧急事件 */
    this._activeEvent = null;
    /** @type {number|null} 当前事件结束定时器ID */
    this._eventTimerId = null;
    /** @type {Object<string, number>} 各事件ID → 下次可触发时间戳 */
    this._eventCooldowns = {};
    /** @type {object} 事件运行时上下文（供 apply/cleanup 读写） */
    this._eventCtx = {
      scoreMultiplier: 1,
      emitterSpeedMultiplier: 1,
      freezeEmitters: false,
      comboMultiplier: 1,
      floodActive: false,
      floodInterval: 0,
      spawnRushOrder: false,
      removeRushOrder: null,
      triggerMysteryReward: false,
    };
    /** @type {number|null} 元素洪流定时器ID */
    this._floodTimerId = null;
    /** @type {number} 上次检查事件的时间戳 */
    this._lastEventCheckTime = 0;
    /** @type {number} 上次发射事件tick的时间戳 */
    this._lastTickTime = 0;

    // ==================== 评分评级数据 ====================
    /** @type {number} 关卡开始时间戳 */
    this._levelStartTime = 0;
    /** @type {number} 总操作次数（合成+移动+提交订单） */
    this._operationCount = 0;
    /** @type {number} 本关最高连击数 */
    this._highestCombo = 0;
    /** @type {number} 本关最高合成等级 */
    this._maxMergeLevel = 0;
    /** @type {number} 本关完成订单数 */
    this._ratingOrdersCompleted = 0;
    /** @type {number} 本关合成次数 */
    this._ratingMergesCount = 0;

    // 绑定事件
    window.eventBus.on('ui:order-clicked', (orderId) => this._onOrderClicked(orderId));
  }

  /**
   * 初始化引擎
   */
  init(uiManager, boardRenderer) {
    this.uiManager = uiManager;
    this.boardRenderer = boardRenderer;
    this.boardRenderer.onCellClick = (row, col) => this._onCellClick(row, col);
  }

  /**
   * 开始肉鸽模式的关卡
   * @param {number} targetScore - 本关目标分数
   * @param {object} node - 当前节点信息
   */
  startRogueLevel(targetScore, node) {
    this.isRogueMode = true;
    this.currentRogueNode = node;

    const levelConfig = LEVEL_CONFIGS[0]; // 使用第一关的配置作为基础
    this.state.level = 1;
    this.state.targetScore = targetScore;
    this.state.score = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.levelConfig = levelConfig;

    // 重置紧急事件系统
    this._resetEventSystem();

    // 重置评分数据
    this._resetRatingData();

    // 清除连击超时
    if (this._comboTimeoutId) {
      clearTimeout(this._comboTimeoutId);
      this._comboTimeoutId = null;
    }

    // 根据节点类型调整难度
    let boardCols = levelConfig.boardCols;
    let boardRows = levelConfig.boardRows;

    if (node.type === 'elite') {
      boardCols = Math.max(4, boardCols - 1);
    }

    // 应用祝福/诅咒对棋盘大小的调整
    if (this.boonSystem) {
      // boon_expand_bag：棋盘增加一行格子
      if (this.boonSystem.hasBoon('boon_expand_bag')) {
        boardRows += 1;
      }
      // curse_fragile_board：棋盘缩小 4 格
      if (this.boonSystem.hasCurse('curse_fragile_board')) {
        boardCols = Math.max(4, boardCols - 2);
        boardRows = Math.max(3, boardRows - 1);
      }
      // curse_element_confusion 补偿：棋盘扩大 2 格
      if (this.boonSystem.hasCurse('curse_element_confusion')) {
        boardCols += 2;
      }
    }

    // 初始化棋盘
    this.state.board = Array.from({ length: boardRows }, () =>
      Array.from({ length: boardCols }, () => null)
    );

    // 初始化产出系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);

    // 初始化棋盘渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 初始化发射器（使用所有可用发射器）
    this.state.emitters = EMITTER_CONFIGS.map((config) => new Emitter(config));

    // 应用祝福到发射器
    if (this.boonSystem) {
      this.boonSystem.applyToEmitters(this.state.emitters);
    }

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 初始化订单系统（根据层数调整难度）
    const floor = this.rogueSystem ? this.rogueSystem.getCurrentFloor() : 1;
    const diffShift = Math.min(floor * ROGUE_DIFFICULTY.orderDifficultyShift, 0.5);
    const weights = {
      ...levelConfig.orderDifficultyWeights,
    };
    // 向高难度偏移
    if (diffShift > 0) {
      for (const key of Object.keys(weights)) {
        weights[key] = Math.max(0, (weights[key] || 0) - diffShift / 3);
      }
    }
    this.systems.order.init(levelConfig.maxOrders + (this.boonSystem ? this.boonSystem.getExtraOrderSlots() : 0), weights);
    this.systems.order.fillOrders();

    // 重置合成系统连击
    this.systems.merge.resetCombo();
    if (this.boonSystem) {
      this.systems.merge.comboWindow = this.boonSystem.getComboWindow();
    }

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });
    window.eventBus.emit('level:loaded', levelConfig);

    // 启动游戏循环
    this._startGameLoop();

    // 启动自动存档
    this._startAutoSave();

    // 初始化波次系统
    this._initWaves(level);

    // 隐藏弹窗
    this.uiManager.hideModal();

    // 启动自动整理（如果拥有自动整理祝福）
    this._startAutoSort();
  }

  // ==================== 波次系统 ====================

  /**
   * 根据关卡编号初始化波次列表
   * @param {number} level - 关卡编号
   */
  _initWaves(level) {
    // 确定难度层级：1→early, 2→mid, 3+→late
    let tier = 'early';
    if (level >= 3) {
      tier = 'late';
    } else if (level === 2) {
      tier = 'mid';
    }

    const templates = WAVE_CONFIGS[tier];
    if (!templates || templates.length === 0) {
      this._waves = [];
      this._currentWaveIndex = -1;
      return;
    }

    // 深拷贝模板，每个波次独立
    this._waves = templates.map(t => ({ ...t }));
    this._currentWaveIndex = 0;
    this._totalOrdersCompleted = 0;
    this._totalMergesCount = 0;

    // 发射第一波事件
    window.eventBus.emit('wave:started', {
      waveIndex: 0,
      totalWaves: this._waves.length,
      wave: this._waves[0],
    });
  }

  /**
   * 独立检查分数是否达标，达标则直接通关（不受波次进度限制）
   */
  _checkScoreComplete() {
    if (!this.state.isPlaying) return;
    if (this.state.score >= this.state.targetScore) {
      this._onLevelComplete();
    }
  }

  /**
   * 检查当前波次目标是否达成，若达成则推进到下一波
   */
  _checkWaveProgress() {
    if (!this.state.isPlaying) return;
    if (this._currentWaveIndex < 0 || this._currentWaveIndex >= this._waves.length) return;

    const currentWave = this._waves[this._currentWaveIndex];
    let isMet = false;

    switch (currentWave.type) {
      case 'score':
        isMet = this.state.score >= currentWave.target;
        break;
      case 'orders':
        isMet = this._totalOrdersCompleted >= currentWave.target;
        break;
      case 'combo': {
        const comboCount = this.systems.merge ? this.systems.merge.comboCount : 0;
        isMet = comboCount >= currentWave.target;
        break;
      }
      case 'merge':
        isMet = this._totalMergesCount >= currentWave.target;
        break;
      default:
        isMet = false;
    }

    if (isMet) {
      this._advanceToNextWave();
    }
  }

  /**
   * 推进到下一波次
   */
  _advanceToNextWave() {
    const completedWave = this._waves[this._currentWaveIndex];

    // 应用波次奖励
    const reward = completedWave.reward || 0;
    if (reward > 0) {
      this.state.score += reward;
      window.eventBus.emit('score:updated', {
        score: this.state.score,
        targetScore: this.state.targetScore,
      });
    }

    // 发射波次完成事件
    window.eventBus.emit('wave:completed', {
      waveIndex: this._currentWaveIndex,
      totalWaves: this._waves.length,
      wave: completedWave,
      reward: reward,
    });

    // 推进到下一波
    this._currentWaveIndex++;

    // 检查是否所有波次已完成
    if (this._currentWaveIndex >= this._waves.length) {
      // 所有波次完成 → 检查是否达到通关分数
      if (this.state.score >= this.state.targetScore) {
        this._onLevelComplete();
      }
      return;
    }

    // 发射新一波事件
    window.eventBus.emit('wave:started', {
      waveIndex: this._currentWaveIndex,
      totalWaves: this._waves.length,
      wave: this._waves[this._currentWaveIndex],
    });
  }

  /**
   * 获取当前波次进度信息（供UI查询）
   * @returns {{ currentWave: number, totalWaves: number, waveLabel: string, progressPercent: number, allDone: boolean }}
   */
  _getWaveProgress() {
    if (!this._waves || this._waves.length === 0) {
      return { currentWave: 0, totalWaves: 0, waveLabel: '', progressPercent: 100, allDone: true };
    }

    const total = this._waves.length;
    const idx = Math.min(this._currentWaveIndex, total);
    const allDone = idx >= total;

    if (allDone) {
      return { currentWave: total, totalWaves: total, waveLabel: '全部完成', progressPercent: 100, allDone: true };
    }

    const wave = this._waves[idx];
    const progressPercent = Math.round((idx / total) * 100);

    return {
      currentWave: idx + 1,
      totalWaves: total,
      waveLabel: wave.label,
      progressPercent,
      allDone: false,
    };
  }

  // ==================== 紧急事件系统 ====================

  /**
   * 重置事件系统状态（关卡开始时调用）
   */
  _resetEventSystem() {
    if (this._eventTimerId) {
      clearTimeout(this._eventTimerId);
      this._eventTimerId = null;
    }
    if (this._floodTimerId) {
      clearInterval(this._floodTimerId);
      this._floodTimerId = null;
    }
    this._activeEvent = null;
    this._eventCooldowns = {};
    this._lastEventCheckTime = 0;
    // 重置事件上下文到默认值
    Object.assign(this._eventCtx, {
      scoreMultiplier: 1,
      emitterSpeedMultiplier: 1,
      freezeEmitters: false,
      comboMultiplier: 1,
      floodActive: false,
      floodInterval: 0,
      spawnRushOrder: false,
      removeRushOrder: null,
      triggerMysteryReward: false,
    });
  }

  /**
   * 统一检查是否可触发紧急事件
   * 在订单提交、连击中断等关键时机调用
   */
  _checkEmergencyEvents() {
    // 已有活跃事件或未开始游戏则不触发
    if (this._activeEvent || !this.state.isPlaying) return;

    const now = Date.now();

    // 防止过于频繁检查（至少间隔5秒）
    if (now - this._lastEventCheckTime < 5000) return;
    this._lastEventCheckTime = now;

    // 收集所有不在冷却中的事件
    const available = EMERGENCY_EVENTS.filter(e => {
      const cooldownEnd = this._eventCooldowns[e.id] || 0;
      return now >= cooldownEnd;
    });

    if (available.length === 0) return;

    // 肉鸽模式：祝福/诅咒影响触发概率
    let probabilityModifier = 1;
    if (this.isRogueMode && this.boonSystem) {
      // 诅咒「混乱元素」增加事件概率
      if (this.boonSystem.hasCurse('curse_element_confusion')) {
        probabilityModifier *= 1.4;
      }
      // 祝福「平静之心」降低负面事件概率
      if (this.boonSystem.hasBoon('boon_calm_mind')) {
        probabilityModifier *= 0.6;
      }
    }

    // 按权重随机选取一个事件
    const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight * (1 / probabilityModifier);

    // 如果概率修正后 roll 超出总权重，则不触发
    if (roll > totalWeight) return;

    let selected = null;
    for (const e of available) {
      roll -= e.weight;
      if (roll <= 0) {
        selected = e;
        break;
      }
    }

    if (!selected) return;

    // 额外概率判定：基础触发率 35%，受修正影响
    const baseChance = 0.35 * probabilityModifier;
    if (Math.random() > baseChance) return;

    this._startEvent(selected);
  }

  /**
   * 启动一个紧急事件
   * @param {object} event - EMERGENCY_EVENTS 中的事件定义
   */
  _startEvent(event) {
    if (this._activeEvent) return;

    this._activeEvent = event;

    // 记录冷却时间
    this._eventCooldowns[event.id] = Date.now() + event.cooldownMs;
    this._eventStartTime = Date.now();

    // 应用事件效果
    event.apply(this._eventCtx);

    // 特殊处理：冻结发射器
    if (event.id === 'freeze') {
      this._freezeEmitters();
    }

    // 特殊处理：加速生产 → 发射器视觉特效由 UIManager 通过 event:started 处理
    // （无需额外逻辑）

    // 特殊处理：元素洪流启动定时填充
    if (event.id === 'element_flood' && this._eventCtx.floodActive) {
      this._startFloodTimer();
    }

    // 特殊处理：加急订单
    if (event.id === 'order_rush' && this._eventCtx.spawnRushOrder) {
      this._spawnRushOrder();
    }

    // 特殊处理：神秘宝箱
    if (event.id === 'mystery_box' && this._eventCtx.triggerMysteryReward) {
      this._applyMysteryReward();
    }

    // 发射事件开始信号
    window.eventBus.emit('event:started', {
      id: event.id,
      name: event.name,
      icon: event.icon,
      description: event.description,
      durationMs: event.durationMs,
      category: event.category,
    });

    // 设置事件结束定时器
    this._eventTimerId = setTimeout(() => {
      this._endActiveEvent();
    }, event.durationMs);
  }

  /**
   * 结束当前活跃事件
   */
  _endActiveEvent() {
    if (!this._activeEvent) return;

    const event = this._activeEvent;

    // 清理事件效果
    event.cleanup(this._eventCtx);

    // 移除加急订单（如果有）
    if (this._eventCtx.removeRushOrder) {
      this._eventCtx.removeRushOrder();
      this._eventCtx.removeRushOrder = null;
    }

    // 解冻发射器（如果是冻结事件）
    if (event.id === 'freeze') {
      this._unfreezeEmitters();
    }

    // 停止洪流定时器
    if (this._floodTimerId) {
      clearInterval(this._floodTimerId);
      this._floodTimerId = null;
    }

    // 发射事件结束信号
    window.eventBus.emit('event:ended', {
      id: event.id,
      name: event.name,
      icon: event.icon,
      category: event.category,
    });

    this._activeEvent = null;
    this._eventTimerId = null;
  }

  /** 冻结所有发射器：暂停冷却计时 */
  _freezeEmitters() {
    const now = Date.now();
    for (const emitter of this.state.emitters) {
      emitter.startFreeze(now);
    }
  }

  /** 解冻所有发射器：恢复冷却计时 */
  _unfreezeEmitters() {
    const now = Date.now();
    for (const emitter of this.state.emitters) {
      emitter.endFreeze(now);
    }
  }

  /**
   * 启动元素洪流定时器：每 interval 毫秒在棋盘空位生成一个低级元素
   */
  _startFloodTimer() {
    if (this._floodTimerId) {
      clearInterval(this._floodTimerId);
    }

    const interval = this._eventCtx.floodInterval || 800;

    this._floodTimerId = setInterval(() => {
      if (!this.state.isPlaying || this.state.isPaused || !this._eventCtx.floodActive) {
        return;
      }

      const board = this.state.board;
      if (this.systems.spawn.isBoardFull(board)) return;

      // 随机选择一个基础元素类型
      const typeKeys = Object.keys(ELEMENT_TYPES);
      const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];

      const element = new Element(randomType, 1);
      const emptyCell = this.systems.spawn.findEmptyCell(board);
      if (!emptyCell) return;

      this.systems.spawn.placeElement(board, element, emptyCell.row, emptyCell.col);
      this.boardRenderer.updateCell(board, emptyCell.row, emptyCell.col);
      this.boardRenderer.playSpawnAnimation(emptyCell.row, emptyCell.col);
      // 元素洪流专属特效（水波纹+水花）
      this.boardRenderer.playFloodEffect(emptyCell.row, emptyCell.col);
    }, interval);
  }

  /**
   * 生成加急订单：一个高额奖励的限时订单
   */
  _spawnRushOrder() {
    // 从高级/稀有订单模板中选一个
    const rushTemplates = ORDER_TEMPLATES.filter(t => t.difficulty === 'hard' || t.difficulty === 'rare');
    if (rushTemplates.length === 0) return;

    const template = rushTemplates[Math.floor(Math.random() * rushTemplates.length)];
    const rushOrder = {
      ...template,
      id: `rush_${Date.now()}`,
      reward: Math.floor(template.reward * 1.5), // 1.5倍奖励
      isRush: true,
    };

    // 通过订单系统添加临时订单
    if (this.systems.order.addRushOrder) {
      this.systems.order.addRushOrder(rushOrder);
    }

    // 设置清理函数：事件结束时移除未完成的加急订单
    this._eventCtx.removeRushOrder = () => {
      if (this.systems.order.removeRushOrder) {
        this.systems.order.removeRushOrder(rushOrder.id);
      }
    };

    window.eventBus.emit('notification', {
      message: `📋 加急订单！${rushOrder.reward}分限时任务`,
      type: 'challenge',
    });
  }

  /**
   * 应用神秘宝箱奖励：随机从加分/消除一行/升级随机元素中选一种
   */
  _applyMysteryReward() {
    const rewards = [
      // 奖励1：直接加分
      () => {
        const bonus = 30 + Math.floor(Math.random() * 40); // 30~70分
        this.state.score += bonus;
        window.eventBus.emit('score:updated', {
          score: this.state.score,
          targetScore: this.state.targetScore,
        });
        window.eventBus.emit('notification', {
          message: `🎁 神秘宝箱：获得 ${bonus} 额外积分！`,
          type: 'reward',
        });
      },
      // 奖励2：消除棋盘上最低级的一行
      () => {
        const board = this.state.board;
        let clearedCount = 0;
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            const el = board[r][c];
            if (el && el.level === 1) {
              this.systems.spawn.removeElement(board, el);
              this.boardRenderer.updateCell(board, r, c);
              clearedCount++;
            }
          }
        }
        if (clearedCount > 0) {
          window.eventBus.emit('notification', {
            message: `🎁 神秘宝箱：清除了 ${clearedCount} 个初级元素！`,
            type: 'reward',
          });
        } else {
          // 没有初级元素则改为加分
          this.state.score += 20;
          window.eventBus.emit('score:updated', {
            score: this.state.score,
            targetScore: this.state.targetScore,
          });
          window.eventBus.emit('notification', {
            message: '🎁 神秘宝箱：获得 20 积分！',
            type: 'reward',
          });
        }
      },
      // 奖励3：升级一个随机元素
      () => {
        const board = this.state.board;
        const occupiedCells = [];
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] && board[r][c].level < ELEMENT_LEVELS.length) {
              occupiedCells.push({ row: r, col: c, el: board[r][c] });
            }
          }
        }
        if (occupiedCells.length > 0) {
          const target = occupiedCells[Math.floor(Math.random() * occupiedCells.length)];
          target.el.level += 1;
          this.boardRenderer.updateCell(board, target.row, target.col);
          window.eventBus.emit('notification', {
            message: `🎁 神秘宝箱：${target.el.icon} 升级至 Lv.${target.el.level}！`,
            type: 'reward',
          });
        } else {
          this.state.score += 15;
          window.eventBus.emit('score:updated', {
            score: this.state.score,
            targetScore: this.state.targetScore,
          });
          window.eventBus.emit('notification', {
            message: '🎁 神秘宝箱：获得 15 积分！',
            type: 'reward',
          });
        }
      },
    ];

    // 随机选择一种奖励
    const selected = rewards[Math.floor(Math.random() * rewards.length)];
    selected();
  }

  // ==================== 评分评级系统 ====================

  /**
   * 重置评分数据（关卡开始时调用）
   */
  _resetRatingData() {
    this._levelStartTime = Date.now();
    this._operationCount = 0;
    this._highestCombo = 0;
    this._maxMergeLevel = 0;
    this._ratingOrdersCompleted = 0;
    this._ratingMergesCount = 0;
  }

  /**
   * 更新评分数据
   * @param {string} action - 'merge' | 'order' | 'move' | 'combo'
   * @param {object} [detail] - 附加信息
   */
  _updateRatingData(action, detail) {
    switch (action) {
      case 'merge':
        this._operationCount++;
        this._ratingMergesCount++;
        if (detail && detail.level > this._maxMergeLevel) {
          this._maxMergeLevel = detail.level;
        }
        break;
      case 'order':
        this._operationCount++;
        this._ratingOrdersCompleted++;
        break;
      case 'move':
        this._operationCount++;
        break;
      case 'combo':
        if (detail && detail.count > this._highestCombo) {
          this._highestCombo = detail.count;
        }
        break;
    }
  }

  /**
   * 计算本关评级
   * @returns {object} 完整评级数据
   */
  _calculateRating() {
    const elapsedMs = Date.now() - this._levelStartTime;
    const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));

    // === 维度一：速度评级（基于用时） ===
    // 预期时间：每100分约60秒
    const expectedTime = Math.max(30, (this.state.targetScore / 100) * 120);
    const timeRatio = elapsedSec / expectedTime;
    let speedGrade, speedLabel;
    if (timeRatio <= 0.5) { speedGrade = 'S'; speedLabel = '闪电速度'; }
    else if (timeRatio <= 0.8) { speedGrade = 'A'; speedLabel = '快速'; }
    else if (timeRatio <= 1.2) { speedGrade = 'B'; speedLabel = '正常'; }
    else if (timeRatio <= 1.8) { speedGrade = 'C'; speedLabel = '缓慢'; }
    else { speedGrade = 'D'; speedLabel = '超时'; }

    // === 维度二：连击评级 ===
    let comboGrade, comboLabel;
    if (this._highestCombo >= 10) { comboGrade = 'S'; comboLabel = '传说连击'; }
    else if (this._highestCombo >= 6) { comboGrade = 'A'; comboLabel = '优秀连击'; }
    else if (this._highestCombo >= 4) { comboGrade = 'B'; comboLabel = '良好连击'; }
    else if (this._highestCombo >= 2) { comboGrade = 'C'; comboLabel = '基础连击'; }
    else { comboGrade = 'D'; comboLabel = '无连击'; }

    // === 维度三：效率评级（每操作得分） ===
    const scorePerOp = this._operationCount > 0 ? this.state.score / this._operationCount : 0;
    let efficiencyGrade, efficiencyLabel;
    if (scorePerOp >= 15) { efficiencyGrade = 'S'; efficiencyLabel = '极致效率'; }
    else if (scorePerOp >= 10) { efficiencyGrade = 'A'; efficiencyLabel = '高效'; }
    else if (scorePerOp >= 6) { efficiencyGrade = 'B'; efficiencyLabel = '标准'; }
    else if (scorePerOp >= 3) { efficiencyGrade = 'C'; efficiencyLabel = '低效'; }
    else { efficiencyGrade = 'D'; efficiencyLabel = '混乱'; }

    // === 维度四：合成评级 ===
    let mergeGrade, mergeLabel;
    if (this._maxMergeLevel >= 6) { mergeGrade = 'S'; mergeLabel = '传说合成'; }
    else if (this._maxMergeLevel >= 5) { mergeGrade = 'A'; mergeLabel = '史诗合成'; }
    else if (this._maxMergeLevel >= 4) { mergeGrade = 'B'; mergeLabel = '稀有合成'; }
    else if (this._maxMergeLevel >= 3) { mergeGrade = 'C'; mergeLabel = '高级合成'; }
    else { mergeGrade = 'D'; mergeLabel = '初级合成'; }

    // === 综合评级 ===
    // 将字母等级映射为分数：S=5, A=4, B=3, C=2, D=1
    const gradeScore = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const totalScore = gradeScore[speedGrade] + gradeScore[comboGrade]
                     + gradeScore[efficiencyGrade] + gradeScore[mergeGrade];
    const avgScore = totalScore / 4;

    let overallGrade, overallTitle;
    if (avgScore >= 4.75) { overallGrade = 'S'; overallTitle = '🌟 完美通关'; }
    else if (avgScore >= 3.75) { overallGrade = 'A'; overallTitle = '🏆 优秀'; }
    else if (avgScore >= 2.75) { overallGrade = 'B'; overallTitle = '👍 良好'; }
    else if (avgScore >= 1.75) { overallGrade = 'C'; overallTitle = '👌 合格'; }
    else { overallGrade = 'D'; overallTitle = '💪 继续努力'; }

    // === 星尘奖励倍率 ===
    const stardustMultiplier = gradeScore[overallGrade] / 3;

    return {
      dimensions: {
        speed: { grade: speedGrade, label: speedLabel, value: timeRatio },
        combo: { grade: comboGrade, label: comboLabel, value: this._highestCombo },
        efficiency: { grade: efficiencyGrade, label: efficiencyLabel, value: scorePerOp },
        merge: { grade: mergeGrade, label: mergeLabel, value: this._maxMergeLevel },
      },
      overall: {
        grade: overallGrade,
        title: overallTitle,
        score: avgScore,
      },
      stats: {
        elapsedSec,
        operationCount: this._operationCount,
        highestCombo: this._highestCombo,
        maxMergeLevel: this._maxMergeLevel,
        ordersCompleted: this._ratingOrdersCompleted,
        mergesCount: this._ratingMergesCount,
        scorePerOp: Math.round(scorePerOp * 10) / 10,
      },
      stardustMultiplier,
    };
  }

  /** 清空棋盘（休息关、商店购买） */
  clearBoard() {
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        this.state.board[r][c] = null;
      }
    }
    this.boardRenderer.renderAll(this.state.board);
  }
  startLevel(level) {
    const levelConfig = LEVEL_CONFIGS.find((c) => c.level === level);
    if (!levelConfig) {
      console.error(`关卡 ${level} 不存在`);
      return;
    }

    // 重置为经典模式（防止之前肉鸽模式的 isRogueMode 污染）
    this.isRogueMode = false;
    this.currentRogueNode = null;

    this.state.level = level;
    this.state.targetScore = levelConfig.targetScore;
    this.state.score = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.levelConfig = levelConfig;

    // 重置紧急事件系统
    this._resetEventSystem();

    // 重置评分数据
    this._resetRatingData();

    // 清除连击超时
    if (this._comboTimeoutId) {
      clearTimeout(this._comboTimeoutId);
      this._comboTimeoutId = null;
    }

    // 初始化棋盘
    const { boardCols, boardRows } = levelConfig;
    this.state.board = Array.from({ length: boardRows }, () =>
      Array.from({ length: boardCols }, () => null)
    );

    // 初始化产出系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);

    // 初始化棋盘渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 初始化发射器
    this.state.emitters = levelConfig.availableEmitters.map((id) => {
      const config = EMITTER_CONFIGS.find((c) => c.id === id);
      return config ? new Emitter(config) : null;
    }).filter(Boolean);

    // 应用祝福到发射器（如果有肉鸽祝福系统）
    if (this.boonSystem) {
      this.boonSystem.applyToEmitters(this.state.emitters);
    }

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 初始化订单系统
    this.systems.order.init(levelConfig.maxOrders, levelConfig.orderDifficultyWeights);
    this.systems.order.fillOrders();

    // 重置合成系统连击
    this.systems.merge.resetCombo();

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });
    window.eventBus.emit('level:loaded', levelConfig);

    // 启动游戏循环
    this._startGameLoop();

    // 启动自动存档
    this._startAutoSave();

    // 初始化波次系统（肉鸽模式使用当前层数）
    const floor = this.rogueSystem ? this.rogueSystem.getCurrentFloor() : 1;
    this._initWaves(floor);

    // 隐藏弹窗
    this.uiManager.hideModal();
  }

  /** 启动游戏循环（用于更新发射器冷却等） */
  _startGameLoop() {
    if (this._gameLoopId) cancelAnimationFrame(this._gameLoopId);
    this._lastFrameTime = performance.now();

    const loop = (timestamp) => {
      if (!this.state.isPlaying || this.state.isPaused) {
        this._gameLoopId = requestAnimationFrame(loop);
        return;
      }

      // 更新发射器状态（约每秒更新4次，减少性能开销）
      if (timestamp - this._lastFrameTime > 200) {
        window.eventBus.emit('emitters:updated', this.state.emitters);
        this._lastFrameTime = timestamp;
      }

      // === 紧急事件系统：定期检查触发（约每3秒） ===
      if (!this._activeEvent && timestamp - this._lastEventCheckTime > 3000) {
        this._checkEmergencyEvents();
      }

      // === 活跃事件 tick（用于倒计时更新） ===
      if (this._activeEvent && timestamp - this._lastTickTime > 100) {
        const now = Date.now();
        const elapsed = now - this._eventStartTime;
        const remainingMs = Math.max(0, this._activeEvent.durationMs - elapsed);
        window.eventBus.emit('event:tick', {
          remainingMs: remainingMs,
          totalDurationMs: this._activeEvent.durationMs,
        });
        // 加急订单专属 tick
        if (this._activeEvent.id === 'order_rush') {
          window.eventBus.emit('rush-order:tick', {
            remainingMs: remainingMs,
            totalDurationMs: this._activeEvent.durationMs,
          });
        }
        this._lastTickTime = timestamp;
      }

      this._gameLoopId = requestAnimationFrame(loop);
    };

    this._gameLoopId = requestAnimationFrame(loop);
  }

  /** 停止游戏循环 */
  _stopGameLoop() {
    if (this._gameLoopId) {
      cancelAnimationFrame(this._gameLoopId);
      this._gameLoopId = null;
    }
  }

  /** 启动自动存档 */
  _startAutoSave() {
    this._stopAutoSave();
    this._autoSaveId = setInterval(() => {
      if (this.state.isPlaying) {
        StorageManager.save(this.serialize());
      }
    }, GAME_SETTINGS.autoSaveInterval);
  }

  /** 停止自动存档 */
  _stopAutoSave() {
    if (this._autoSaveId) {
      clearInterval(this._autoSaveId);
      this._autoSaveId = null;
    }
  }

  // ==================== 自动整理（祝福效果） ====================

  /** 启动自动整理定时器（每10秒执行一次） */
  _startAutoSort() {
    this._stopAutoSort();
    if (!this.isRogueMode || !this.boonSystem) return;
    if (!this.boonSystem.hasBoon('boon_auto_sort')) return;

    this._autoSortTimerId = setInterval(() => this._doAutoSort(), 10000);
  }

  /** 停止自动整理定时器 */
  _stopAutoSort() {
    if (this._autoSortTimerId) {
      clearInterval(this._autoSortTimerId);
      this._autoSortTimerId = null;
    }
  }

  /** 执行自动整理：将同类型同等级的元素移到相邻位置 */
  _doAutoSort() {
    if (!this.state.isPlaying || !this.state.board) return;

    const board = this.state.board;
    const rows = board.length;
    const cols = board[0].length;

    // 按 (typeId, level) 分组收集所有元素位置
    const groups = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = board[r][c];
        if (el) {
          const key = `${el.typeId}_${el.level}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push({ row: r, col: c, element: el });
        }
      }
    }

    let totalMoved = 0;

    // 对每组 >= 2 个的元素，检查是否已有相邻对，没有则尝试聚拢
    for (const key of Object.keys(groups)) {
      const positions = groups[key];
      if (positions.length < 2) continue;

      // 检查是否已经有相邻的可合成对
      let hasAdjacent = false;
      for (let i = 0; i < positions.length && !hasAdjacent; i++) {
        for (let j = i + 1; j < positions.length && !hasAdjacent; j++) {
          const dr = Math.abs(positions[i].row - positions[j].row);
          const dc = Math.abs(positions[i].col - positions[j].col);
          if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            hasAdjacent = true;
          }
        }
      }

      if (!hasAdjacent && positions.length >= 2) {
        // 尝试将第二个元素移到第一个元素旁边的空位
        const first = positions[0];
        const second = positions[1];

        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let foundSpot = false;
        for (const [dr, dc] of dirs) {
          const nr = first.row + dr;
          const nc = first.col + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc]) {
            if (this.systems.spawn.moveElement(board, second.element, nr, nc)) {
              this.boardRenderer.updateCell(board, second.row, second.col);
              this.boardRenderer.updateCell(board, nr, nc);
              totalMoved++;
              foundSpot = true;
            }
            break;
          }
        }

        // 如果第一个元素周围没有空位，尝试反过来：把第一个元素移到第二个元素旁边
        if (!foundSpot) {
          for (const [dr, dc] of dirs) {
            const nr = second.row + dr;
            const nc = second.col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc]) {
              if (this.systems.spawn.moveElement(board, first.element, nr, nc)) {
                this.boardRenderer.updateCell(board, first.row, first.col);
                this.boardRenderer.updateCell(board, nr, nc);
                totalMoved++;
              }
              break;
            }
          }
        }
      }
    }

    if (totalMoved > 0) {
      this.boardRenderer.renderAll(board);
      // 通知用户自动整理结果
      window.eventBus.emit('notification', {
        message: `🧹 自动整理了 ${totalMoved} 个元素`,
        type: 'info',
      });
    }
  }

  // ==================== 交互处理 ====================

  /** 点击发射器 */
  _onEmitterClick(emitterId) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    // 紧急事件：冻结状态禁止发射器工作
    if (this._eventCtx.freezeEmitters) {
      window.eventBus.emit('notification', {
        message: '❄ 发射器被冻结，暂时无法使用',
        type: 'warning',
      });
      return;
    }

    const emitter = this.state.emitters.find((e) => e.id === emitterId);
    if (!emitter) return;

    const now = Date.now();
    if (!emitter.isReadyToSpawn(now)) return;

    // 检查棋盘是否已满
    if (this.systems.spawn.isBoardFull(this.state.board)) {
      // 肉鸽模式：检查守护结界祝福
      if (this.boonSystem && this.boonSystem.hasBoon('boon_guardian_shield')) {
        if (!this._guardianShieldUses) this._guardianShieldUses = 3;
        if (this._guardianShieldUses > 0) {
          this._guardianShieldUses--;
          // 销毁最低级元素
          let lowest = null, lowestPos = null;
          for (let r = 0; r < this.state.board.length; r++) {
            for (let c = 0; c < this.state.board[r].length; c++) {
              const el = this.state.board[r][c];
              if (el && (!lowest || el.level < lowest.level)) {
                lowest = el;
                lowestPos = { row: r, col: c };
              }
            }
          }
          if (lowestPos) {
            this.systems.spawn.removeElement(this.state.board, lowest);
            this.boardRenderer.updateCell(this.state.board, lowestPos.row, lowestPos.col);
            window.eventBus.emit('notification', {
              message: `🛡 守护结界触发！剩余 ${this._guardianShieldUses} 次`,
              type: 'info',
            });
          }
        } else {
          window.eventBus.emit('game:failed', { isRogue: this.isRogueMode });
          return;
        }
      } else {
        window.eventBus.emit('game:failed', { isRogue: this.isRogueMode });
        return;
      }
    }

    // 产出元素
    const element = emitter.spawn(now);
    if (!element) return;

    // 如果是数组（双重产出），逐个放置
    const elements = Array.isArray(element) ? element : [element];

    for (const el of elements) {
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (!emptyCell) break;
      this.systems.spawn.placeElement(this.state.board, el, emptyCell.row, emptyCell.col);
      this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
      this.boardRenderer.playSpawnAnimation(emptyCell.row, emptyCell.col);
    }

    // 更新发射器UI
    window.eventBus.emit('emitters:updated', this.state.emitters);
    // 发射器点击反馈
    window.eventBus.emit('emitter:clicked', { emitterId: emitterId });
  }

  /** 点击棋盘格子 */
  _onCellClick(row, col) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    const clickedElement = this.state.board[row][col];

    // === 三合一模式检测 ===
    if (this._tripleMergeCandidates.length > 0) {
      const firstCandidate = this._tripleMergeCandidates[0].element;
      // 点击空位 / 不同元素 / 已在候选中的格子：退出三合一模式
      if (!clickedElement ||
          clickedElement.typeId !== firstCandidate.typeId ||
          clickedElement.level !== firstCandidate.level ||
          this._tripleMergeCandidates.some(c => c.row === row && c.col === col)) {
        this.boardRenderer.clearTripleCandidates();
        this._tripleMergeCandidates = [];
        if (clickedElement) {
          this.boardRenderer.selectCell(row, col, this.state.board);
        }
        return;
      }
      // 点击了第三个同类型同等级的元素：执行三合一
      this._executeTripleMerge(row, col);
      return;
    }

    const selected = this.boardRenderer.selectedCell;

    if (!selected) {
      // 没有选中任何元素：选中点击的元素
      if (clickedElement) {
        this.boardRenderer.selectCell(row, col, this.state.board);
      }
      return;
    }

    // 已有选中的元素
    const selectedEl = this.state.board[selected.row][selected.col];

    if (!selectedEl) {
      // 选中的格子空了（可能被移走了），取消选中
      this.boardRenderer.deselectCell();
      return;
    }

    if (selected.row === row && selected.col === col) {
      // 点击同一个格子：取消选中
      this.boardRenderer.deselectCell();
      return;
    }

    if (!clickedElement) {
      // 点击空位：移动元素
      const success = this.systems.spawn.moveElement(
        this.state.board, selectedEl, row, col
      );
      if (success) {
        this.boardRenderer.updateCell(this.state.board, selected.row, selected.col);
        this.boardRenderer.updateCell(this.state.board, row, col);
        this.boardRenderer.deselectCell();
        // 更新评分数据：移动操作
        this._updateRatingData('move');
      }
      return;
    }

    // 点击了另一个元素：尝试合成
    // 检查是否拥有 boon_triple_merge 祝福（严格三合一模式）
    if (this.boonSystem && this.boonSystem.hasBoon('boon_triple_merge')) {
      if (Element.canMerge(selectedEl, clickedElement)) {
        // 严格三合一：不执行二合一，直接进入三合一模式等待第三个元素
        this._tripleMergeCandidates = [
          { row: selected.row, col: selected.col, element: selectedEl },
          { row, col, element: clickedElement },
        ];
        this.boardRenderer.deselectCell();
        this.boardRenderer.setTripleCandidates([
          { row: selected.row, col: selected.col },
          { row, col },
        ]);
        window.eventBus.emit('notification', {
          message: '🎵 三重奏激活！再点击一个同类型同等级元素完成三合一',
          type: 'info',
        });
        return;
      }
      // 有三重奏但不能合成：切换选中到新元素
      this.boardRenderer.selectCell(row, col, this.state.board);
    } else {
      const result = this.systems.merge.tryMerge(selectedEl, clickedElement, Date.now());
      if (result) {
        this._executeMerge(result, selected, { row, col });
      } else {
        // 不能合成：切换选中到新元素
        this.boardRenderer.selectCell(row, col, this.state.board);
      }
    }
  }

  /** 执行三合一合成（三个同类型同等级元素合成高一级元素） */
  _executeTripleMerge(thirdRow, thirdCol) {
    const candidates = this._tripleMergeCandidates;
    const thirdElement = this.state.board[thirdRow][thirdCol];
    if (!thirdElement) {
      this._tripleMergeCandidates = [];
      return;
    }

    const consumed = [
      candidates[0].element,
      candidates[1].element,
      thirdElement,
    ];

    const newLevel = consumed[0].level + 2;
    if (newLevel > ELEMENT_LEVELS.length) {
      // 已达到最高等级，无法继续合成
      this.boardRenderer.clearTripleCandidates();
      this._tripleMergeCandidates = [];
      window.eventBus.emit('notification', {
        message: '已达到最高等级，无法继续合成',
        type: 'warning',
      });
      return;
    }

    // 创建合成后的新元素
    const merged = new Element(consumed[0].typeId, newLevel);
    merged.gridRow = thirdRow;
    merged.gridCol = thirdCol;

    // 从棋盘移除三个被消耗的元素
    for (const el of consumed) {
      this.systems.spawn.removeElement(this.state.board, el);
    }

    // 放置合成后的新元素
    this.systems.spawn.placeElement(this.state.board, merged, thirdRow, thirdCol);

    // 更新UI
    this.boardRenderer.clearTripleCandidates();
    for (const c of candidates) {
      this.boardRenderer.updateCell(this.state.board, c.row, c.col);
    }
    this.boardRenderer.updateCell(this.state.board, thirdRow, thirdCol);
    this.boardRenderer.playMergeAnimation(candidates[0].row, candidates[0].col, thirdRow, thirdCol);
    // 播放合成特效（粒子爆散 + 等级触发特效）
    this.boardRenderer.playMergeEffect(thirdRow, thirdCol, merged.level, merged.typeId || merged.elementType);

    // 清除三合一状态
    this._tripleMergeCandidates = [];

    // 计算积分（应用紧急事件倍率）
    const scoreGain = Math.floor(merged.scoreValue * this._eventCtx.scoreMultiplier);
    this.state.score += scoreGain;

    // 应用额外积分加成
    if (this.boonSystem) {
      const bonus = this.boonSystem.getMergeBonus(newLevel);
      if (bonus > 0) {
        this.state.score += bonus;
      }
    }

    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });

    // 每次三合一后独立检查是否达标
    this._checkScoreComplete();

    window.eventBus.emit('notification', {
      message: `🎵 三重奏！${consumed[0].icon} ×3 → ${merged.icon} Lv.${merged.level} ${merged.name}`,
      type: 'merge',
    });

    // === 肉鸽祝福：连锁反应 ===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_chain_reaction') && Math.random() < 0.25) {
      const lowerLevel = Math.max(1, newLevel - 1);
      const chainEl = new Element(merged.elementType || merged.typeId, lowerLevel);
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (emptyCell) {
        this.systems.spawn.placeElement(this.state.board, chainEl, emptyCell.row, emptyCell.col);
        this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
        window.eventBus.emit('notification', {
          message: `⛓ 连锁反应！生成了 ${chainEl.icon} Lv.${chainEl.level}`,
          type: 'merge',
        });
      }
    }

    // 更新评分数据：三合一合成
    this._updateRatingData('merge', { level: newLevel });

    // 记录合成次数并检查波次进度
    this._totalMergesCount++;
    this._checkWaveProgress();
    // 合成后有机会触发紧急事件
    this._checkEmergencyEvents();
  }

  /** 执行合成操作 */
  _executeMerge(result, fromPos, toPos) {
    const { merged, consumed, comboCount, comboMultiplier } = result;

    // 从棋盘移除被消耗的两个元素
    for (const el of consumed) {
      this.systems.spawn.removeElement(this.state.board, el);
    }

    // 放置合成后的新元素（放在目标位置）
    this.systems.spawn.placeElement(this.state.board, merged, toPos.row, toPos.col);

    // 更新UI
    this.boardRenderer.updateCell(this.state.board, fromPos.row, fromPos.col);
    this.boardRenderer.updateCell(this.state.board, toPos.row, toPos.col);
    this.boardRenderer.playMergeAnimation(fromPos.row, fromPos.col, toPos.row, toPos.col);
    // 播放合成特效（粒子爆散 + 等级触发特效）
    this.boardRenderer.playMergeEffect(toPos.row, toPos.col, merged.level, merged.typeId || merged.elementType);
    this.boardRenderer.deselectCell();

    // 更新连击显示
    window.eventBus.emit('combo:updated', {
      count: comboCount,
      multiplier: comboMultiplier,
    });

    // 检查连击里程碑（5/10/20连击）
    this._checkComboMilestone(comboCount);
    // 更新评分数据：连击
    this._updateRatingData('combo', { count: comboCount });

    // 设置连击超时：若 COMBO_WINDOW_MS 内无新合成，触发 Combo Break
    if (this._comboTimeoutId) {
      clearTimeout(this._comboTimeoutId);
    }
    this._comboTimeoutId = setTimeout(() => {
      this._comboTimeoutId = null;
      this.systems.merge.resetCombo();
      window.eventBus.emit('combo:break', {});
      // 连击中断是触发紧急事件的好时机
      this._checkEmergencyEvents();
    }, this.systems.merge.COMBO_WINDOW_MS);

    // 通知合成事件
    window.eventBus.emit('notification', {
      message: `合成 ${merged.icon} Lv.${merged.level} ${merged.name}`,
      type: 'merge',
    });

    // === 肉鸽祝福：连锁反应 ===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_chain_reaction') && Math.random() < 0.25) {
      const lowerLevel = Math.max(1, merged.level - 1);
      const chainEl = new Element(merged.elementType, lowerLevel);
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (emptyCell) {
        this.systems.spawn.placeElement(this.state.board, chainEl, emptyCell.row, emptyCell.col);
        this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
        window.eventBus.emit('notification', {
          message: `⛓ 连锁反应！生成了 ${chainEl.icon} Lv.${chainEl.level}`,
          type: 'merge',
        });
      }
    }

    // === 肉鸽祝福：融合增效 / 经验累积 ===
    if (this.boonSystem) {
      const bonus = this.boonSystem.getMergeBonus(merged.level);
      if (bonus > 0) {
        this.state.score += bonus;
        window.eventBus.emit('score:updated', {
          score: this.state.score,
          targetScore: this.state.targetScore,
        });
      }
    }

    // 每次合成后独立检查是否达标（不受祝福/波次进度限制）
    this._checkScoreComplete();

    // === 连击狂热：合成积分增长补充特效 ===
    if (this._activeEvent && this._activeEvent.id === 'combo_fever') {
      window.eventBus.emit('combo-fever:score-bonus', {
        row: toPos.row,
        col: toPos.col,
        score: merged.scoreValue,
        multiplier: comboMultiplier,
      });
    }

    // === 肉鸽祝福：元素共鸣（传说级）===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_element_resonance')) {
      this._triggerElementResonance(merged);
    }

    // 更新评分数据：普通合成
    this._updateRatingData('merge', { level: merged.level });

    // 记录合成次数并检查波次进度
    this._totalMergesCount++;
    this._checkWaveProgress();
    // 合成后有机会触发紧急事件
    this._checkEmergencyEvents();
  }

  /** 检查连击里程碑：5/10/20连击 */
  _checkComboMilestone(comboCount) {
    const milestones = [5, 10, 20];
    for (const ms of milestones) {
      if (comboCount === ms) {
        const isFirstTime = !this._triggeredMilestones.has(ms);
        if (isFirstTime) {
          this._triggeredMilestones.add(ms);
        }
        window.eventBus.emit('combo:milestone', { milestone: ms, isFirstTime });
        break;
      }
    }
  }

  /** 触发元素共鸣：临时提升棋盘上所有同类型元素的视觉等级 */
  _triggerElementResonance(merged) {
    const typeId = merged.typeId || merged.elementType;
    const resonatingCells = [];

    // 清除之前的共鸣定时器（连续合成时重置计时）
    if (this._resonanceTimer) {
      clearTimeout(this._resonanceTimer);
      this._resonanceTimer = null;
    }

    // 扫描棋盘上所有同类型元素
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        const el = this.state.board[r][c];
        if (el && (el.typeId === typeId || el.elementType === typeId)) {
          resonatingCells.push({ row: r, col: c });
          // 标记临时等级加成
          el._resonanceBoost = true;
        }
      }
    }

    if (resonatingCells.length === 0) return;

    // 刷新所有受影响格子，显示升级后的外观
    for (const { row, col } of resonatingCells) {
      this.boardRenderer.updateCell(this.state.board, row, col);
    }

    window.eventBus.emit('notification', {
      message: `🌈 元素共鸣！${merged.icon} ${merged.name} 的力量在棋盘上回荡`,
      type: 'merge',
    });

    // 5秒后清除共鸣效果（每次重新计时）
    this._resonanceTimer = setTimeout(() => {
      this._resonanceTimer = null;
      for (let r = 0; r < this.state.board.length; r++) {
        for (let c = 0; c < this.state.board[r].length; c++) {
          const el = this.state.board[r][c];
          if (el && el._resonanceBoost) {
            delete el._resonanceBoost;
            this.boardRenderer.updateCell(this.state.board, r, c);
          }
        }
      }
    }, 5000);
  }

  /** 消耗棋盘上一个随机元素（贪婪代价诅咒） */
  _consumeRandomElement() {
    const occupiedCells = [];
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        if (this.state.board[r][c]) {
          occupiedCells.push({ row: r, col: c });
        }
      }
    }

    if (occupiedCells.length === 0) return;

    const target = occupiedCells[Math.floor(Math.random() * occupiedCells.length)];
    const consumedEl = this.state.board[target.row][target.col];
    this.systems.spawn.removeElement(this.state.board, consumedEl);
    this.boardRenderer.updateCell(this.state.board, target.row, target.col);

    window.eventBus.emit('notification', {
      message: `👹 贪婪代价！消耗了 ${consumedEl.icon} Lv.${consumedEl.level} ${consumedEl.name || ''}`,
      type: 'warning',
    });
  }

  /** 点击订单 */
  _onOrderClicked(orderId) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    // 提交前记录所有非空格子位置（用于后续飞入动画定位）
    const beforeSnapshot = [];
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        if (this.state.board[r][c]) {
          beforeSnapshot.push({ row: r, col: c });
        }
      }
    }

    const result = this.systems.order.submitOrder(
      orderId, this.state.board, this.systems.spawn
    );

    if (!result) {
      window.eventBus.emit('notification', {
        message: '棋盘上没有匹配的元素',
        type: 'warning',
      });
      return;
    }

    // 计算积分奖励（考虑祝福修正）
    let reward = result.reward;
    if (this.boonSystem) {
      reward *= this.boonSystem.getOrderRewardMultiplier();
      this.boonSystem.markFirstOrderSubmitted();

      // 无尽之泉：完成订单后重置所有发射器冷却
      if (this.boonSystem.hasBoon('boon_endless_spring')) {
        this.state.emitters.forEach(e => e.resetCooldown());
        window.eventBus.emit('notification', {
          message: '♾ 无尽之泉！所有发射器已冷却完毕',
          type: 'info',
        });
      }
    }
    reward = Math.floor(reward);
    // 应用紧急事件积分倍率
    reward = Math.floor(reward * this._eventCtx.scoreMultiplier);
    this.state.score += reward;

    // === 肉鸽诅咒：贪婪代价 ===
    if (this.boonSystem && this.boonSystem.hasCurse('curse_greed_price')) {
      this._consumeRandomElement();
    }

    // 找出被消耗元素的位置（对比快照中哪些格子变空了）
    const consumedPositions = [];
    const elementIcon = result.element ? (result.element.icon || '✦') : '✦';
    for (const { row, col } of beforeSnapshot) {
      if (!this.state.board[row][col]) {
        consumedPositions.push({ row, col });
      }
    }

    // 触发元素飞入动画
    if (consumedPositions.length > 0) {
      window.eventBus.emit('elements:fly-to-order', {
        orderId: orderId,
        positions: consumedPositions,
        elementIcon: elementIcon,
      });
    }

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });

    this._checkScoreComplete();

    // 刷新棋盘
    this.boardRenderer.renderAll(this.state.board);

    // 更新评分数据：订单完成
    this._updateRatingData('order');

    // 记录订单完成数并检查波次进度
    this._totalOrdersCompleted++;
    this._checkWaveProgress();
    // 订单提交后有机会触发紧急事件
    this._checkEmergencyEvents();
  }

  /** 通关处理 */
  _onLevelComplete() {
    this.state.isPlaying = false;
    this._stopGameLoop();
    this._stopAutoSave();
    this._stopAutoSort();

    // 清理紧急事件
    if (this._activeEvent) {
      this._endActiveEvent();
    }
    this._resetEventSystem();

    // 清除连击超时，防止通关后 combo break 触发紧急事件
    if (this._comboTimeoutId) {
      clearTimeout(this._comboTimeoutId);
      this._comboTimeoutId = null;
    }

    // 计算本关评级
    const rating = this._calculateRating();

    // 计算下一关信息
    const nextLevel = this.state.level + 1;
    const hasNextLevel = LEVEL_CONFIGS.some((c) => c.level === nextLevel);

    // 发射评级事件（携带完整数据供UI展示、按钮回调、MetaProgress记录）
    window.eventBus.emit('rating:calculated', {
      level: this.state.level,
      score: this.state.score,
      targetScore: this.state.targetScore,
      rating,
      isRogue: this.isRogueMode,
      nextLevel: hasNextLevel ? nextLevel : null,
      isLastLevel: !hasNextLevel,
    });

    // 肉鸽模式：通过事件系统通知主流程
    if (this.isRogueMode) {
      window.eventBus.emit('game:over', {
        level: this.state.level,
        score: this.state.score,
        targetScore: this.state.targetScore,
        isRogue: true,
        rating,
      });
      return;
    }
  }

  // ==================== 存档管理 ====================

  /** 序列化完整游戏状态 */
  serialize() {
    return {
      version: 1,
      timestamp: Date.now(),
      level: this.state.level,
      score: this.state.score,
      targetScore: this.state.targetScore,
      board: this.state.board.map((row) =>
        row.map((el) => (el ? el.serialize() : null))
      ),
      emitters: this.state.emitters.map((e) => e.serialize()),
      mergeSystem: this.systems.merge.serialize(),
      orderSystem: this.systems.order.serialize(),
      levelConfig: this.state.levelConfig,
    };
  }

  /** 从存档恢复 */
  loadFromSave(saveData) {
    if (!saveData || !saveData.version) return false;

    const levelConfig = saveData.levelConfig || LEVEL_CONFIGS[0];
    const { boardCols, boardRows } = levelConfig;

    this.state.level = saveData.level;
    this.state.score = saveData.score;
    this.state.targetScore = saveData.targetScore;
    this.state.isPlaying = true;
    this.state.levelConfig = levelConfig;

    // 恢复棋盘
    this.state.board = saveData.board.map((row) =>
      row.map((data) => (data ? Element.deserialize(data) : null))
    );

    // 初始化系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);
    this.systems.merge = MergeSystem.deserialize(saveData.mergeSystem);
    this.systems.order = OrderSystem.deserialize(saveData.orderSystem);

    // 恢复发射器
    this.state.emitters = saveData.emitters.map((data) => Emitter.deserialize(data)).filter(Boolean);

    // 渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });
    window.eventBus.emit('level:loaded', levelConfig);
    window.eventBus.emit('orders:updated', this.systems.order.getOrders());

    // 启动循环和存档
    this._startGameLoop();
    this._startAutoSave();
    this.uiManager.hideModal();

    return true;
  }

  /** 手动保存 */
  save() {
    const success = StorageManager.save(this.serialize());
    if (success) {
      window.eventBus.emit('notification', {
        message: '游戏已保存',
        type: 'info',
      });
    }
    return success;
  }

  /** 手动读取存档 */
  load() {
    const data = StorageManager.load();
    if (!data) {
      window.eventBus.emit('notification', {
        message: '没有找到存档',
        type: 'warning',
      });
      return false;
    }
    return this.loadFromSave(data);
  }

  /** 检查是否有存档 */
  hasSave() {
    return StorageManager.hasSave();
  }

  /** 销毁引擎 */
  destroy() {
    this._stopGameLoop();
    this._stopAutoSave();
    this._stopAutoSort();
    // 清理紧急事件定时器
    if (this._eventTimerId) {
      clearTimeout(this._eventTimerId);
      this._eventTimerId = null;
    }
    if (this._floodTimerId) {
      clearInterval(this._floodTimerId);
      this._floodTimerId = null;
    }
    this._activeEvent = null;
    // 清除连击超时
    if (this._comboTimeoutId) {
      clearTimeout(this._comboTimeoutId);
      this._comboTimeoutId = null;
    }
    this.state.isPlaying = false;
  }
}