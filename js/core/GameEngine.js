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

    // ==================== 元素连锁反应状态 ====================

    /** @type {{ lastMergeTime: number, consecutiveCount: number, isStormActive: boolean }} */

    this._chainReactionState = {

      lastMergeTime: 0,       // 上次合成时间戳

      consecutiveCount: 0,    // 连续合成次数（2秒窗口内）

      isStormActive: false,   // 合成风暴是否激活

    };

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

    // ==================== 怒气/能量条系统 ====================

    /** @type {number} 当前怒气值（0-100） */

    this._rageValue = 0;

    /** @type {boolean} 大招面板是否打开 */

    this._isUltimatePanelOpen = false;

    // ==================== Boss 战机制 ====================

    /** @type {object|null} 当前 Boss 配置 */

    this._currentBossConfig = null;

    /** @type {object} Boss 运行时状态 */

    this._bossState = {

      // 通用

      isActive: false,

      bossId: null,

      lastTickTime: 0,

      // 熔岩巨像

      scorchedCells: [],       // [{row, col, elementBurnAt, fireExpireAt}]

      lastScorchTime: 0,

      lastSpreadTime: 0,

      isRageActive: false,

      // 冰霜女巫

      frozenRows: new Set(),   // 被冻结的行索引

      lastFreezeTime: 0,

      thawMergeCount: 0,       // 当前解冻进度

      isBlizzardActive: false,

      blizzardEndTime: 0,

      // 混沌之核

      chaosElements: [],       // [{row, col, level, icon}]

      lastWaveTime: 0,

      lastChaosSpawnTime: 0,

      lastRefreshTime: 0,

      // 时间吞噬者

      devourTimer: 0,          // 吞噬倒计时(ms)

      lastDevourTime: 0,

      timeLimit: 120000,

      levelStartTime: 0,

      // 创世之灵

      sealedBoons: [],         // 被封存的祝福ID列表

      mirrors: [],             // [{row, col, expireAt}]

      lastUnsealTime: 0,

      lastMirrorTime: 0,

      unsealOrder: [],         // 解封顺序

    };

    /**

     * 大招池定义

     * 基础3个 + 祝福解锁5个

     * @type {Array<{id:string, name:string, icon:string, desc:string, rageCost:number, cooldown:number, effect:function, unlockBoon?:string}>}

     */

    this._ultimates = [

      {

        id: 'rage_clear',

        name: '元素净化',

        icon: '💥',

        desc: '清除棋盘上所有 Lv.1 元素',

        rageCost: 40,

        cooldown: 8000,

        lastUsedTime: 0,

        effect: () => this._applyUltimateClear(),

      },

      {

        id: 'rage_boost',

        name: '能量爆发',

        icon: '⚡',

        desc: '立即重置所有发射器冷却',

        rageCost: 30,

        cooldown: 6000,

        lastUsedTime: 0,

        effect: () => this._applyUltimateBoost(),

      },

      {

        id: 'rage_score',

        name: '积分增幅',

        icon: '🌟',

        desc: '10秒内所有得分 x2',

        rageCost: 50,

        cooldown: 20000,

        lastUsedTime: 0,

        effect: () => this._applyUltimateScoreBoost(),

      },

      // === 以下5个由祝福解锁 ===

      {

        id: 'rage_merge_up',

        name: '全体升级',

        icon: '⬆️',

        desc: '棋盘上所有元素等级+1',

        rageCost: 60,

        cooldown: 25000,

        lastUsedTime: 0,

        unlockBoon: 'boon_rage_merge_up',

        effect: () => this._applyUltimateMergeUp(),

      },

      {

        id: 'rage_fill_board',

        name: '元素填充',

        icon: '🧩',

        desc: '在空位随机生成基础元素',

        rageCost: 35,

        cooldown: 12000,

        lastUsedTime: 0,

        unlockBoon: 'boon_rage_fill',

        effect: () => this._applyUltimateFillBoard(),

      },

      {

        id: 'rage_combo_x3',

        name: '连击风暴',

        icon: '🌀',

        desc: '15秒内连击倍率固定 x3',

        rageCost: 55,

        cooldown: 22000,

        lastUsedTime: 0,

        unlockBoon: 'boon_rage_combo',

        effect: () => this._applyUltimateComboX3(),

      },

      {

        id: 'rage_order_refresh',

        name: '订单重置',

        icon: '📋',

        desc: '刷新所有订单为高奖励订单',

        rageCost: 45,

        cooldown: 18000,

        lastUsedTime: 0,

        unlockBoon: 'boon_rage_order',

        effect: () => this._applyUltimateOrderRefresh(),

      },

      {

        id: 'rage_super_merge',

        name: '超级合成',

        icon: '🔮',

        desc: '随机将一对相邻同等级元素合成高两级',

        rageCost: 70,

        cooldown: 30000,

        lastUsedTime: 0,

        unlockBoon: 'boon_rage_super',

        effect: () => this._applyUltimateSuperMerge(),

      },

    ];

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

    // Boss 节点：扩大棋盘

    if (node.type === 'boss') {

      if (node.bossId === 'boss_creation_spirit') {

        // 创世之灵：棋盘扩大至最大（10x8）

        boardCols = Math.max(boardCols, 10);

        boardRows = Math.max(boardRows, 8);

      } else {

        boardCols += 2;

        boardRows += 1;

      }

    }

    // 应用祝福/诅咒对棋盘大小的调整

    if (this.boonSystem) {

      // boon_expand_bag：棋盘增加一行格子

      if (this.boonSystem.hasBoon('boon_expand_bag')) {

        boardRows += 1;

      }

      // curse_fragile_board：按阶段缩减棋盘

      if (this.boonSystem.hasCurse('curse_fragile_board')) {

        const reduction = this.boonSystem.getFragileBoardReduction();

        boardCols = Math.max(4, boardCols - reduction.colsReduce);

        boardRows = Math.max(3, boardRows - reduction.rowsReduce);

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

    // 检查诅咒升级（按当前层数）

    if (this.boonSystem) {

      const floor = this.rogueSystem ? this.rogueSystem.getCurrentFloor() : 1;

      const upgraded = this.boonSystem.checkCurseProgression(floor);

      if (upgraded.length > 0) {

        console.log('[诅咒升级]', upgraded);

      }

    }

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

    this._initWaves(this.state.level);

    // 隐藏弹窗

    this.uiManager.hideModal();

    // 启动自动整理（如果拥有自动整理祝福）

    this._startAutoSort();

    // === 诅咒阶段：关卡开始效果 ===

    if (this.boonSystem) {

      // 元素混淆阶段3：随机交换棋盘上3对元素位置

      if (this.boonSystem.shouldSwapElementsOnLevelStart()) {

        this._swapRandomElements(3);

        window.eventBus.emit('notification', {

          message: '🎲 元素混淆加剧！棋盘上 3 对元素被随机交换了位置',

          type: 'warning',

        });

      }

      // 脆弱棋盘阶段2/3：随机封锁格子

      const blockCount = this.boonSystem.getFragileBlockCount();

      if (blockCount > 0) {

        this._blockRandomCells(blockCount);

      }

    }

    // === Boss 战初始化 ===

    if (node.type === 'boss' && node.bossId) {

      this._initBossBattle(node.bossId, floor);

    } else {

      this._currentBossConfig = null;

      this._bossState.isActive = false;

      this._bossState.bossId = null;

    }

    // 创建怒气条

    if (this.uiManager.createRageBar) {

      this.uiManager.createRageBar(this._ultimates);

    }

    // 重置怒气

    this._rageValue = 0;

    // 重置所有大招冷却

      if (this._ultimates) {

        for (const u of this._ultimates) u.lastUsedTime = 0;

      }

    window.eventBus.emit('rage:updated', { value: 0, max: 100 });

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

      // 手动扫描棋盘，跳过被吞噬的格子
      let emptyCell = null;
      for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          if (!board[r][c]) {
            if (this._bossState.isActive && this._bossState.bossId === 'boss_time_devourer' &&
                this._bossState.devouredCells.has(r + ',' + c)) {
              continue;
            }
            emptyCell = { row: r, col: c };
            break;
          }
        }
        if (emptyCell) break;
      }

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

      // 更新发射器状态（约每秒30次，确保冷却动画流畅）

      if (timestamp - this._lastFrameTime > 33) {

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

      // === Boss 战 tick（约每秒检查4次） ===

      if (this._bossState.isActive && timestamp - this._bossState.lastTickTime > 200) {

        this._tickBossMechanics(Date.now());

        this._bossState.lastTickTime = timestamp;

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

  // ==================== Boss 战机制 ====================

  /**

   * 初始化 Boss 战

   * @param {string} bossId - Boss ID

   * @param {number} floor - 当前层数

   */

  _initBossBattle(bossId, floor) {

    const config = BOSS_CONFIGS.find(b => b.id === bossId);

    if (!config) return;

    this._currentBossConfig = config;

    this._bossState = {

      isActive: true,

      bossId: bossId,

      lastTickTime: 0,

      // 熔岩巨像

      scorchedCells: [],

      lastScorchTime: 0,

      lastSpreadTime: 0,

      isRageActive: false,

      // 冰霜女巫

      frozenRows: new Set(),

      _freezeRowTimeouts: {},

      lastFreezeTime: 0,

      thawMergeCount: 0,

      isBlizzardActive: false,

      blizzardEndTime: 0,

      // 混沌之核

      chaosElements: [],

      lastWaveTime: 0,

      lastChaosSpawnTime: 0,

      lastRefreshTime: 0,

      // 时间吞噬者

      devourTimer: config.mechanics.timeLimit || 120000,

      lastDevourTime: 0,

      lastDevourCellTime: 0,

      timeLimit: config.mechanics.timeLimit || 120000,

      levelStartTime: Date.now(),

      devouredCells: new Set(),

      // 创世之灵

      sealedBoons: [],

      mirrors: [],

      lastUnsealTime: 0,

      lastMirrorTime: 0,

      unsealOrder: [],

    };

    // === 创世之灵：封印所有祝福 + 发射器无冷却 + 棋盘扩大 ===

    if (bossId === 'boss_creation_spirit' && this.boonSystem) {

      const allBoons = this.boonSystem.getCurrentBoons ? this.boonSystem.getCurrentBoons() : [];

      this._bossState.sealedBoons = allBoons.map(b => b.id);

      this._bossState.unsealOrder = [...this._bossState.sealedBoons];

      // 通知 BoonSystem 哪些祝福被封印

      this.boonSystem.sealedBoons = this._bossState.sealedBoons;

      // 发射器无冷却

      if (this.state.emitters) {

        for (const emitter of this.state.emitters) {

          emitter.modifiers.cooldownMultiplier = 0;

        }

      }

    }

    // 通知 UI

    window.eventBus.emit('boss:init', {

      id: config.id,

      name: config.name,

      icon: config.icon,

      description: config.description,

      mechanics: config.mechanics,

    });

    window.eventBus.emit('notification', {

      message: `⚔ ${config.icon} ${config.name} 出现了！`,

      type: 'warning',

    });

  }

  /**

   * Boss 战 tick（每秒检查4次）

   * @param {number} now - 当前时间戳(ms)

   */

  _tickBossMechanics(now) {

    const config = this._currentBossConfig;

    if (!config) return;

    switch (config.id) {

      case 'boss_lava_giant':

        this._tickLavaGiant(now, config.mechanics);

        break;

      case 'boss_ice_witch':

        this._tickIceWitch(now, config.mechanics);

        break;

      case 'boss_chaos_core':

        this._tickChaosCore(now, config.mechanics);

        break;

      case 'boss_time_devourer':

        this._tickTimeDevourer(now, config.mechanics);

        break;

      case 'boss_creation_spirit':

        this._tickCreationSpirit(now, config.mechanics);

        break;

    }

  }

  // ---------- 熔岩巨像 ----------

  _tickLavaGiant(now, mech) {

    const state = this._bossState;

    const duration = mech.scorchDuration || 5000;

    // 1. 灼烧蔓延：每 scorchInterval ms 灼烧一个格子

    if (now - state.lastScorchTime > (mech.scorchInterval || 15000)) {

      state.lastScorchTime = now;

      this._applyScorch(duration);

    }

    // 2. 检查元素烧毁：格子有元素且到烧毁时间 → 移除元素

    for (const cell of state.scorchedCells) {

      const el = this.state.board[cell.row]?.[cell.col];

      if (el && cell.elementBurnAt && now >= cell.elementBurnAt) {

        this.systems.spawn.removeElement(this.state.board, el);

        this.boardRenderer.updateCell(this.state.board, cell.row, cell.col);

        cell.elementBurnAt = null;

      }

    }

    // 3. 清理已熄灭的火焰

    state.scorchedCells = state.scorchedCells.filter(cell => now < cell.fireExpireAt);

    // 4. 愤怒状态检测：同时灼烧格子数 >= rageThreshold

    const wasRageActive = state.isRageActive;

    state.isRageActive = state.scorchedCells.length >= (mech.rageThreshold || 3);

    if (state.isRageActive && !wasRageActive) {

      window.eventBus.emit('notification', {

        message: '🔥 熔岩巨像进入愤怒状态！发射器冷却增加 30%',

        type: 'warning',

      });

      window.eventBus.emit('boss:rage-activated', { bossId: 'boss_lava_giant' });

      // 应用冷却惩罚

      const penalty = mech.rageCooldownPenalty || 1.3;

      for (const emitter of this.state.emitters) {

        emitter.modifiers.cooldownMultiplier = penalty;

      }

    } else if (!state.isRageActive && wasRageActive) {

      window.eventBus.emit('notification', {

        message: '✅ 熔岩巨像愤怒状态已解除！发射器冷却恢复正常',

        type: 'info',

      });

      window.eventBus.emit('boss:rage-deactivated', { bossId: 'boss_lava_giant' });

      // 恢复冷却倍率

      for (const emitter of this.state.emitters) {

        emitter.modifiers.cooldownMultiplier = 1.0;

      }

    }

    // 5. 灼烧蔓延：每5秒有概率将灼烧扩散到相邻格子

    if (state.scorchedCells.length > 0 && now - state.lastSpreadTime > 3000 && Math.random() < (mech.spreadChance || 0.55)) {

      state.lastSpreadTime = now;

      this._spreadScorch(duration);

    }

    // 6. 刷新燃烧视觉效果

    this.boardRenderer.refreshScorchedCells(state.scorchedCells);

  }

  /** 灼烧一个随机格子 */

  _applyScorch(duration) {

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const state = this._bossState;

    const now = Date.now();

    // 找到未被灼烧的格子

    const scorchedSet = new Set(state.scorchedCells.map(c => `${c.row},${c.col}`));

    const available = [];

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        if (!scorchedSet.has(`${r},${c}`)) {

          available.push({ row: r, col: c });

        }

      }

    }

    if (available.length === 0) return;

    const target = available[Math.floor(Math.random() * available.length)];

    const el = board[target.row]?.[target.col];

    state.scorchedCells.push({

      row: target.row,

      col: target.col,

      // 如果格子有元素，记录烧毁时间（duration 后烧毁）；否则无元素可烧

      elementBurnAt: el && !el._blocked ? now + duration : null,

      // 火焰自行熄灭时间（比烧毁时间长，即使格子无元素也会熄灭）

      fireExpireAt: now + duration * 2,

    });

    window.eventBus.emit('boss:scorch-cell', { row: target.row, col: target.col, duration });

  }

  /** 灼烧蔓延到相邻格子 */

  _spreadScorch(duration) {

    const state = this._bossState;

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const now = Date.now();

    const scorchedSet = new Set(state.scorchedCells.map(c => `${c.row},${c.col}`));

    // 收集所有被灼烧格子的相邻格子

    const neighbors = [];

    for (const cell of state.scorchedCells) {

      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

      for (const [dr, dc] of dirs) {

        const nr = cell.row + dr;

        const nc = cell.col + dc;

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !scorchedSet.has(`${nr},${nc}`)) {

          neighbors.push({ row: nr, col: nc });

          scorchedSet.add(`${nr},${nc}`);

        }

      }

    }

    if (neighbors.length === 0) return;

    const target = neighbors[Math.floor(Math.random() * neighbors.length)];

    const el = board[target.row]?.[target.col];

    state.scorchedCells.push({

      row: target.row,

      col: target.col,

      elementBurnAt: el && !el._blocked ? now + duration : null,

      fireExpireAt: now + duration * 2,

    });

    window.eventBus.emit('boss:scorch-cell', { row: target.row, col: target.col, duration });

  }

  /** 合成灭火（由 _executeMerge 调用） */

  _extinguishOnMerge(row, col) {

    const state = this._bossState;

    const idx = state.scorchedCells.findIndex(c => c.row === row && c.col === col);

    if (idx !== -1) {

      state.scorchedCells.splice(idx, 1);

      window.eventBus.emit('boss:extinguish-cell', { row, col });

      return true;

    }

    return false;

  }

  /** 检查格子是否被灼烧 */

  _isCellScorched(row, col) {

    return this._bossState.scorchedCells.some(c => c.row === row && c.col === col);

  }

  /** 获取发射器冷却惩罚倍率（愤怒状态） */

  getEmitterCooldownMultiplier() {

    if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant' && this._bossState.isRageActive) {

      return this._currentBossConfig.mechanics.rageCooldownPenalty || 1.3;

    }

    return 1.0;

  }

  // ---------- 冰霜女巫 ----------

  _tickIceWitch(now, mech) {

    const state = this._bossState;

    const board = this.state.board;

    const rows = board.length;

    // 1. 暴风雪结束恢复

    if (state.isBlizzardActive && now > state.blizzardEndTime) {

      state.isBlizzardActive = false;

      this._unfreezeEmitters();

      // 清除所有冻结行，防止立即再次触发暴风雪

      for (const row of [...state.frozenRows]) {

        if (this.boardRenderer) {

          this.boardRenderer.frozenRows.delete(row);

        }

        window.eventBus.emit('boss:thaw-row', { row });

      }

      state.frozenRows.clear();

      // 清理所有自动解冻定时器

      for (const key in state._freezeRowTimeouts) {

        clearTimeout(state._freezeRowTimeouts[key]);

      }

      state._freezeRowTimeouts = {};

      window.eventBus.emit('boss:blizzard-ended', {});

      window.eventBus.emit('notification', {

        message: '❄ 暴风雪结束了！',

        type: 'info',

      });

    }

    // 2. 冻结行：每 freezeInterval ms 冻结一行

    if (now - state.lastFreezeTime > (mech.freezeInterval || 20000)) {

      state.lastFreezeTime = now;

      this._freezeRandomRow(mech.freezeDuration || 8000);

    }

    // 3. 暴风雪触发：同时冻结行数 >= blizzardThreshold

    if (state.frozenRows.size >= (mech.blizzardThreshold || 2) && !state.isBlizzardActive) {

      state.isBlizzardActive = true;

      state.blizzardEndTime = now + (mech.blizzardPauseDuration || 5000);

      this._freezeEmitters();

      window.eventBus.emit('boss:blizzard-started', { duration: mech.blizzardPauseDuration || 5000 });

      window.eventBus.emit('notification', {

        message: '❄ 冰霜女巫释放了暴风雪！所有发射器暂停 5 秒',

        type: 'warning',

      });

    }

  }

  /** 冻结一行 */

  _freezeRandomRow(duration) {

    const board = this.state.board;

    const rows = board.length;

    const state = this._bossState;

    // 找未被冻结的行

    const available = [];

    for (let r = 0; r < rows; r++) {

      if (!state.frozenRows.has(r)) {

        available.push(r);

      }

    }

    if (available.length === 0) return;

    const row = available[Math.floor(Math.random() * available.length)];

    state.frozenRows.add(row);

    // 通知 BoardRenderer 该行被冻结（使后续 updateCell 保留冻结样式）

    if (this.boardRenderer) {

      this.boardRenderer.frozenRows.add(row);

    }

    // 冻结该行的所有元素（视觉标记）

    for (let c = 0; c < board[row].length; c++) {

      if (board[row][c]) {

        this.boardRenderer.updateCell(board, row, c);

      }

    }

    window.eventBus.emit('boss:freeze-row', { row, duration });

    // 越界保护：确保 board[row] 存在

    if (!board[row]) {

      console.warn('[ICE_WITCH] board[' + row + '] is undefined, aborting freeze');

      state.frozenRows.delete(row);

      return;

    }

    // duration ms 后自动解冻

    const self = this;

    self._bossState._freezeRowTimeouts[row] = setTimeout(function() {

      const s = self._bossState;

      if (s.frozenRows.has(row)) {

        s.frozenRows.delete(row);

        if (self.boardRenderer) {

          self.boardRenderer.frozenRows.delete(row);

        }

        window.eventBus.emit('boss:thaw-row', { row });

      }

      delete s._freezeRowTimeouts[row];

    }, duration);

  }

  /** 解冻进度更新（由 _executeMerge 调用） */

  _updateThawProgress(row) {

    const state = this._bossState;

    if (!state.frozenRows.has(row)) return false;

    state.thawMergeCount++;

    const needed = this._currentBossConfig.mechanics.thawMergeCount || 2;

    if (state.thawMergeCount >= needed) {

      state.frozenRows.delete(row);

      state.thawMergeCount = 0;

      if (this.boardRenderer) {

        this.boardRenderer.frozenRows.delete(row);

      }

      window.eventBus.emit('boss:thaw-row', { row });

      return true;

    }

    return false;

  }

  /** 检查某行是否被冻结 */

  _isRowFrozen(row) {

    return this._bossState.frozenRows.has(row);

  }

  // ---------- 混沌之核 ----------

  _tickChaosCore(now, mech) {

    const state = this._bossState;

    // 1. 混沌波动：每 waveInterval ms 随机变化棋盘元素等级和类型

    if (now - state.lastWaveTime > (mech.waveInterval || 25000)) {

      state.lastWaveTime = now;

      this._triggerChaosWave(mech.waveLevelRange || 1);

    }

    // 2. 混沌元素生成：每 chaosSpawnInterval ms 在棋盘上生成混沌元素

    if (now - state.lastChaosSpawnTime > (mech.chaosSpawnInterval || 10000)) {

      state.lastChaosSpawnTime = now;

      this._spawnChaosElement();

    }

    // 3. 混沌刷新：每 20 秒清空并重新生成订单

    if (now - state.lastRefreshTime > 20000) {

      state.lastRefreshTime = now;

      this._triggerChaosRefresh();

    }

  }

  /** 混沌波动：随机变化棋盘上元素的等级和类型 */

  _triggerChaosWave(levelRange) {

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const typeKeys = Object.keys(ELEMENT_TYPES);

    let changedCount = 0;

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        const el = board[r][c];

        if (!el || el.isChaos || el.isBlocked) continue;

        // 随机改变等级

        const delta = Math.floor(Math.random() * (levelRange * 2 + 1)) - levelRange;

        el.level = Math.max(1, Math.min(8, el.level + delta));

        // 随机改变元素类型（包括当前类型）

        const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];

        el.typeId = randomType;

        el.icon = ELEMENT_TYPES[randomType].icon;

        // 更新棋盘格子显示

        this.boardRenderer.updateCell(board, r, c);

        changedCount++;

      }

    }

    if (changedCount > 0) {

      // 发送混沌波动事件，UI 层播放特效

      window.eventBus.emit('boss:chaos-wave', { levelRange, changedCount });

      window.eventBus.emit('notification', {

        message: '🌊 混沌波动！棋盘上 ' + changedCount + ' 个元素发生了变化',

        type: 'warning',

      });

    }

  }

  /** 生成混沌元素 */

  _spawnChaosElement() {

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const state = this._bossState;

    // 找空位

    const emptyCells = [];

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        if (!board[r][c]) {

          emptyCells.push({ row: r, col: c });

        }

      }

    }

    if (emptyCells.length === 0) return;

    const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    const randomLevel = Math.floor(Math.random() * 3) + 1;

    const chaosEl = {

      id: `chaos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,

      typeId: 'chaos',

      level: randomLevel,

      gridRow: target.row,

      gridCol: target.col,

      icon: '❓',

      isChaos: true,

      serialize: function() {

        return { typeId: this.typeId, level: this.level, gridRow: this.gridRow, gridCol: this.gridCol };

      },

    };

    board[target.row][target.col] = chaosEl;

    this.boardRenderer.updateCell(board, target.row, target.col);

    state.chaosElements.push({

      row: target.row,

      col: target.col,

      level: randomLevel,

      icon: '❓',

    });

    window.eventBus.emit('boss:chaos-spawn', { row: target.row, col: target.col, level: randomLevel });

  }

  /** 混沌刷新：清空所有订单并重新生成 */

  _triggerChaosRefresh() {

    const orderSystem = this.systems.order;

    const oldOrders = orderSystem.getOrders();

    if (oldOrders.length === 0) {

      orderSystem.fillOrders();

    } else {

      // 清空并重新生成

      orderSystem.orders = [];

      orderSystem.fillOrders();

    }

    window.eventBus.emit('boss:chaos-refresh', {});

    window.eventBus.emit('notification', {

      message: '🔄 混沌刷新！订单需求已全部刷新',

      type: 'warning',

    });

  }

  // ---------- 时间吞噬者 ----------

  _tickTimeDevourer(now, mech) {

    const state = this._bossState;

    // 1. 吞噬倒计时递减（限制单次最大递减量，防止页面闲置后瞬间超时）

    const rawElapsed = now - (state.lastDevourTime || state.levelStartTime);

    const elapsed = Math.min(rawElapsed, 2000); // 单次最多减2秒

    if (elapsed > 50) {

      state.devourTimer -= elapsed;

      state.lastDevourTime = now;

      // 通知 UI 更新时间

      window.eventBus.emit('boss:devour-timer', { remaining: state.devourTimer });

    }

    // 2. 时间耗尽 → 强制失败

    if (state.devourTimer <= 0) {

      this._onBossDefeat('时间耗尽！时间吞噬者吞噬了一切');

      return;

    }

    // 3. 格子吞噬：每 devourInterval ms 吞噬一个匹配订单需求的格子（使用独立计时）

    if (now - state.lastDevourCellTime > (mech.devourInterval || 9000)) {

      state.lastDevourCellTime = now;

      this._devourCell();

    }

  }

  /** 吞噬一个匹配订单需求的格子 */

  _devourCell() {

    const board = this.state.board;

    const state = this._bossState;

    // 获取当前活跃订单的元素类型集合

    const orders = this.systems.order.getOrders();

    const orderTypes = new Set(orders.map(o => o.elementType));

    if (orderTypes.size === 0) return;

    // 收集棋盘上所有匹配订单类型的元素格子（排除已被吞噬的）

    const candidates = [];

    for (let r = 0; r < board.length; r++) {

      for (let c = 0; c < board[r].length; c++) {

        const el = board[r][c];

        if (el && orderTypes.has(el.typeId) && !state.devouredCells.has(r + ',' + c)) {

          candidates.push({ row: r, col: c });

        }

      }

    }

    if (candidates.length === 0) {

      // 没有可吞噬的目标了
      // 先检查棋盘是否完全为空（开局时棋盘空是正常状态，不触发失败）
      let hasAnyElement = false;
      for (let r = 0; r < board.length && !hasAnyElement; r++) {
        for (let c = 0; c < board[r].length && !hasAnyElement; c++) {
          if (board[r][c]) hasAnyElement = true;
        }
      }
      if (!hasAnyElement) return;

      // 棋盘上有元素但没有匹配订单类型的了，且未达标 → 失败
      if (this.state.score < this.state.targetScore) {

        this._onBossDefeat('时间吞噬者吞噬了所有可用元素！');

      }

      return;

    }

    // 随机选择一个格子吞噬

    const target = candidates[Math.floor(Math.random() * candidates.length)];

    const el = board[target.row][target.col];

    this.systems.spawn.removeElement(board, el);

    board[target.row][target.col] = null;

    state.devouredCells.add(target.row + ',' + target.col);

    this.boardRenderer.updateCell(board, target.row, target.col);

    window.eventBus.emit('boss:devour-cell', { row: target.row, col: target.col });

    window.eventBus.emit('notification', {

      message: '⏳ 时间吞噬者吞噬了一个 ' + el.icon + ' 元素！',

      type: 'warning',

    });

  }

  /** 提交订单延缓吞噬（由 _onOrderClicked 调用） */

  _delayDevour() {

    const state = this._bossState;

    if (state.bossId !== 'boss_time_devourer') return;

    const delay = this._currentBossConfig.mechanics.orderDelay || 3000;

    state.devourTimer += delay;

    state.lastDevourCellTime = Date.now();

    window.eventBus.emit('boss:devour-delayed', { delay });

  }

  // ---------- 创世之灵 ----------

  _tickCreationSpirit(now, mech) {

    const state = this._bossState;

    // 1. 祝福解封：每 unsealInterval ms 解封一个祝福

    if (state.unsealOrder.length > 0 && now - state.lastUnsealTime > (mech.unsealInterval || 30000)) {

      state.lastUnsealTime = now;

      this._unsealNextBoon();

    }

    // 2. 镜像召唤：每 mirrorInterval ms 召唤一个镜像

    if (now - state.lastMirrorTime > (mech.mirrorInterval || 20000)) {

      state.lastMirrorTime = now;

      this._summonMirror(mech.mirrorDuration || 6000);

    }

    // 3. 清理过期镜像

    state.mirrors = state.mirrors.filter(m => m.expireAt > now);

  }

  /** 解封下一个祝福 */

  _unsealNextBoon() {

    const state = this._bossState;

    if (state.unsealOrder.length === 0) return;

    const boonId = state.unsealOrder.shift();

    state.sealedBoons = state.sealedBoons.filter(id => id !== boonId);

    window.eventBus.emit('boss:boon-unsealed', { boonId });

    window.eventBus.emit('notification', {

      message: `🌟 一个祝福被解封了！`,

      type: 'info',

    });

  }

  /** 召唤混沌镜像 */

  _summonMirror(duration) {

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const state = this._bossState;

    // 找空位

    const emptyCells = [];

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        if (!board[r][c]) {

          emptyCells.push({ row: r, col: c });

        }

      }

    }

    if (emptyCells.length === 0) return;

    const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    // 镜像会复制棋盘上最高等级的元素外观

    let maxLevel = 1;

    let maxIcon = '✨';

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        if (board[r][c] && board[r][c].level > maxLevel) {

          maxLevel = board[r][c].level;

          maxIcon = board[r][c].icon || '✨';

        }

      }

    }

    const mirrorEl = {

      id: `mirror_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,

      level: maxLevel,

      icon: maxIcon,

      isMirror: true,

      expireAt: Date.now() + duration,

    };

    board[target.row][target.col] = mirrorEl;

    this.boardRenderer.updateCell(board, target.row, target.col);

    state.mirrors.push({

      row: target.row,

      col: target.col,

      expireAt: Date.now() + duration,

    });

    window.eventBus.emit('boss:mirror-summoned', { row: target.row, col: target.col, level: maxLevel });

  }

  /** 检查元素是否为镜像 */

  _isMirrorElement(element) {

    return element && element.isMirror === true;

  }

  /** 检查祝福是否被封存 */

  _isBoonSealed(boonId) {

    return this._bossState.sealedBoons.includes(boonId);

  }

  /** Boss 战失败处理 */

  _onBossDefeat(reason) {

    this.state.isPlaying = false;

    this._bossState.isActive = false;

    this._currentBossConfig = null;

    window.eventBus.emit('boss:defeated', { reason });

    window.eventBus.emit('notification', {

      message: `💀 ${reason}`,

      type: 'error',

    });

    // 延迟后返回肉鸽地图

    setTimeout(() => {

      if (this.rogueSystem && typeof this.rogueSystem.onNodeFailed === 'function') {

        this.rogueSystem.onNodeFailed(this.currentRogueNode);

      }

    }, 2500);

  }

  /** Boss 战胜利处理 */

  _onBossVictory() {

    this._bossState.isActive = false;

    window.eventBus.emit('boss:victory', {

      bossId: this._currentBossConfig?.id,

      bossName: this._currentBossConfig?.name,

    });

    window.eventBus.emit('notification', {

      message: `🎉 ${this._currentBossConfig?.icon} ${this._currentBossConfig?.name} 被击败了！`,

      type: 'success',

    });

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

      let emptyCell = null;

      // 手动扫描棋盘，跳过被吞噬的格子
      for (let r = 0; r < this.state.board.length; r++) {

        for (let c = 0; c < this.state.board[r].length; c++) {

          if (!this.state.board[r][c]) {

            if (this._bossState.isActive && this._bossState.bossId === 'boss_time_devourer' &&

                this._bossState.devouredCells.has(r + ',' + c)) {

              continue;

            }

            emptyCell = { row: r, col: c };

            break;

          }

        }

        if (emptyCell) break;

      }

      if (!emptyCell) break;

      this.systems.spawn.placeElement(this.state.board, el, emptyCell.row, emptyCell.col);

      this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);

      this.boardRenderer.playSpawnAnimation(emptyCell.row, emptyCell.col);

      // 熔岩巨像：如果放到燃烧格子，标记元素烧毁倒计时

      if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant') {

        const scorchedCell = this._bossState.scorchedCells.find(

          c => c.row === emptyCell.row && c.col === emptyCell.col

        );

        if (scorchedCell) {

          scorchedCell.elementBurnAt = Date.now() + (this._currentBossConfig.mechanics.scorchDuration || 5000);

        }

      // 刷新燃烧视觉效果

      this.boardRenderer.refreshScorchedCells(this._bossState.scorchedCells);

      }

    }

    // 更新发射器UI

    window.eventBus.emit('emitters:updated', this.state.emitters);

    // 发射器点击反馈

    window.eventBus.emit('emitter:clicked', { emitterId: emitterId });

  }

  /** 检查某行是否被冰霜女巫冻结 */

  _isRowFrozen(row) {

    return this._bossState.isActive &&

      this._bossState.bossId === 'boss_ice_witch' &&

      this._bossState.frozenRows.has(row);

  }

  /** 点击棋盘格子 */

  _onCellClick(row, col) {

    if (!this.state.isPlaying || this.state.isPaused) return;

    // === 冰霜女巫冻结行交互 ===

    // 冻结行元素只能作为被合成的目标（被动方）

    // 下方已有「选中冻结行元素→取消选中」的逻辑，确保不能主动合成

    let selected = this.boardRenderer.selectedCell;

    if (selected) {

      if (this._isRowFrozen(selected.row)) {

        this.boardRenderer.deselectCell();

        return;

      }

    }

    const clickedElement = this.state.board[row][col];

    // === 熔岩巨像：灼烧格子交互规则 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant') {

      const scorchedCell = this._bossState.scorchedCells.find(c => c.row === row && c.col === col);

      if (scorchedCell) {

        // 燃烧空格 + 无选中 → 阻止后续交互

        if (!clickedElement && !selected) {

          return;

        }

        // 有元素或已有选中 → 允许选中/移动/合成，由下方通用逻辑处理

      }

    }

    // === 时间吞噬者：被吞噬的格子不可交互 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_time_devourer') {

      if (this._bossState.devouredCells.has(row + ',' + col)) {

        return;

      }

      if (selected && selected.element && this._bossState.devouredCells.has(selected.row + ',' + selected.col)) {

        this.boardRenderer.deselectCell();

        return;

      }

    }

    // === 创世之灵：镜像元素不可操作 ===

    if (clickedElement && this._isMirrorElement(clickedElement)) {

      return;

    }

    if (selected && selected.element && this._isMirrorElement(selected.element)) {

      this.boardRenderer.deselectCell();

      return;

    }

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

    selected = this.boardRenderer.selectedCell;

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

        // 熔岩巨像：燃烧状态跟随元素移动（规则3）

        if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant') {

          const oldScorch = this._bossState.scorchedCells.find(

            c => c.row === selected.row && c.col === selected.col

          );

          if (oldScorch) {

            // 源格子有燃烧状态 → 转移到新位置

            oldScorch.row = row;

            oldScorch.col = col;

            // 重置烧毁计时器（从移动到新位置开始重新计时）

            oldScorch.elementBurnAt = Date.now() + (this._currentBossConfig.mechanics.scorchDuration || 5000);

          } else {

            // 源格子没有燃烧，但目标格子可能正在燃烧

            const newScorch = this._bossState.scorchedCells.find(

              c => c.row === row && c.col === col

            );

            if (newScorch) {

              // 元素移入燃烧格子，记录烧毁时间

              newScorch.elementBurnAt = Date.now() + (this._currentBossConfig.mechanics.scorchDuration || 5000);

            }

          }

          // 刷新燃烧视觉效果

          this.boardRenderer.refreshScorchedCells(this._bossState.scorchedCells);

        }

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

      // 如果涉及混沌元素，先转化以便匹配

      if (selectedEl.isChaos || clickedElement.isChaos) {

        this._convertChaosElements(selectedEl, clickedElement);

      }

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

      // 处理混沌元素合成：可与任意同等级元素合成，产物随机（不含另一方类型）

      if (selectedEl.isChaos || clickedElement.isChaos) {

        // 混沌 + 混沌：不能合成
        if (selectedEl.isChaos && clickedElement.isChaos) {
          this.boardRenderer.selectCell(row, col, this.state.board);
          return;
        }

        if (selectedEl.level === clickedElement.level) {

          const typeKeys = Object.keys(ELEMENT_TYPES);

          let excludeTypes = [];

          if (!selectedEl.isChaos) excludeTypes.push(selectedEl.typeId);

          if (!clickedElement.isChaos) excludeTypes.push(clickedElement.typeId);

          const pool = excludeTypes.length > 0

            ? typeKeys.filter(function(t) { return excludeTypes.indexOf(t) === -1; })

            : typeKeys;

          const productType = pool[Math.floor(Math.random() * pool.length)];

          const mergedLevel = selectedEl.level + 1;

          const merged = new Element(productType, mergedLevel);

          const result = {

            merged: merged,

            consumed: [selectedEl, clickedElement],

            comboCount: 1,

            comboMultiplier: 1,

          };

          this._executeMerge(result, selected, { row: row, col: col });

        } else {

          this.boardRenderer.selectCell(row, col, this.state.board);

        }

      } else {

        this._convertChaosElements(selectedEl, clickedElement);

        const result = this.systems.merge.tryMerge(selectedEl, clickedElement, Date.now());

        if (result) {

          this._executeMerge(result, selected, { row: row, col: col });

        } else {

          // 不能合成：切换选中到新元素

          this.boardRenderer.selectCell(row, col, this.state.board);

        }

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

    // 检查第三个元素是否与候选同类同等级
    if (candidates.length === 2) {
      const firstEl = candidates[0].element;
      // 如果第三个是混沌元素，先转化为候选元素的类型
      if (thirdElement.isChaos) {
        this._convertChaosElements(firstEl, thirdElement);
      }
      if (!Element.canMerge(firstEl, thirdElement)) {
        this._tripleMergeCandidates = [];
        this.boardRenderer.clearTripleCandidates();
        return;
      }
    }

    const consumed = [

      candidates[0].element,

      candidates[1].element,

      thirdElement,

    ];

    // 如果消耗的元素中有混沌元素（❓），先转化为随机基础元素

    for (const el of consumed) {

      if (el && el.isChaos) {

        const typeKeys = Object.keys(ELEMENT_TYPES);

        const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];

        el.typeId = randomType;

        el.isChaos = false;

        el.icon = ELEMENT_TYPES[randomType].icon;

      }

    }

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

    // === Boss 机制：熔岩巨像 - 合成灭火 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant') {

      const e1 = this._extinguishOnMerge(thirdRow, thirdCol);

      const e2 = this._extinguishOnMerge(candidates[0].row, candidates[0].col);

      const e3 = this._extinguishOnMerge(candidates[1].row, candidates[1].col);

      if (e1 || e2 || e3) {

        this.boardRenderer.refreshScorchedCells(this._bossState.scorchedCells);

        window.eventBus.emit('notification', {

          message: '🔥 三重奏扑灭了灼烧！',

          type: 'merge',

        });

      }

    }

    // === Boss 机制：冰霜女巫 - 合成解冻 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_ice_witch') {

      if (this._isRowFrozen(thirdRow)) {

        const thawed = this._updateThawProgress(thirdRow);

        if (thawed) {

          window.eventBus.emit('notification', {

            message: '❄ 三重奏解冻了冻结的行！',

            type: 'merge',

          });

        }

      }

    }

    // ==================== 元素连锁反应检测（三合一） ====================

    if (this.isRogueMode) {

      const _now3 = Date.now();

      if (_now3 - this._chainReactionState.lastMergeTime < 2000) {

        this._chainReactionState.consecutiveCount++;

      } else {

        this._chainReactionState.consecutiveCount = 1;

        this._chainReactionState.isStormActive = false;

      }

      this._chainReactionState.lastMergeTime = _now3;

      const chainCount3 = this._chainReactionState.consecutiveCount;

      // 三合一的连锁特效阈值降低：第2次即触发全屏闪烁

      if (chainCount3 >= 5 && !this._chainReactionState.isStormActive) {

        this._triggerChainStorm();

      } else if (chainCount3 >= 2) {

        this.boardRenderer._createFlashOverlay('flash-white');

        this.boardRenderer._applyScreenShake(6, 0.15);

        window.eventBus.emit('notification', {

          message: `⛓ 三重连锁！x${chainCount3}`,

          type: 'milestone',

        });

      }

      window.eventBus.emit('chain-reaction:updated', {

        count: chainCount3,

        isStorm: this._chainReactionState.isStormActive,

      });

    }

    // ==================== 连锁检测结束 ====================

    // === 怒气获取：三合一 +15 ===

    if (this.isRogueMode) {

      this._addRage(15);

    }

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

    // 如果消耗的元素中有混沌元素（❓），先转化为随机基础元素

    for (const el of consumed) {

      if (el && el.isChaos) {

        const typeKeys = Object.keys(ELEMENT_TYPES);

        const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];

        el.typeId = randomType;

        el.isChaos = false;

        el.icon = ELEMENT_TYPES[randomType].icon;

      }

    }

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

      // 连锁反应中断时重置状态

      if (this.isRogueMode) {

        this._chainReactionState.consecutiveCount = 0;

        this._chainReactionState.isStormActive = false;

      }

      window.eventBus.emit('combo:break', {});

      // 连击中断是触发紧急事件的好时机

      this._checkEmergencyEvents();

    }, this.systems.merge.COMBO_WINDOW_MS);

    // ==================== 元素连锁反应检测 ====================

    if (this.isRogueMode) {

      const _now = Date.now();

      if (_now - this._chainReactionState.lastMergeTime < 2000) {

        this._chainReactionState.consecutiveCount++;

      } else {

        this._chainReactionState.consecutiveCount = 1;

        this._chainReactionState.isStormActive = false;

      }

      this._chainReactionState.lastMergeTime = _now;

      const chainCount = this._chainReactionState.consecutiveCount;

      // 根据连续次数触发不同级别的连锁特效

      if (chainCount >= 5 && !this._chainReactionState.isStormActive) {

        // 第五次及以上：合成风暴 —— 自动合成棋盘上所有可合成的相邻元素

        this._triggerChainStorm();

      } else if (chainCount >= 3) {

        // 第三次及以上：全屏闪烁 + 屏幕震动

        this.boardRenderer._createFlashOverlay('flash-white');

        this.boardRenderer._applyScreenShake(8, 0.25);

        window.eventBus.emit('notification', {

          message: `⛓ ${chainCount}连击连锁！`,

          type: 'milestone',

        });

      } else if (chainCount === 2) {

        // 第二次：增强特效（50%更多粒子）

        const typeCfg = ELEMENT_TYPES[merged.typeId || merged.elementType];

        this.boardRenderer._emitMergeParticles(

          toPos.row, toPos.col,

          typeCfg?.color || '#ffffff',

          18  // 比正常多50%

        );

        window.eventBus.emit('notification', {

          message: `⛓ 连锁！x${chainCount}`,

          type: 'merge',

        });

      }

      // 发射连锁反应事件（供 UI 层消费）

      window.eventBus.emit('chain-reaction:updated', {

        count: chainCount,

        isStorm: this._chainReactionState.isStormActive,

      });

    }

    // ==================== 连锁检测结束 ====================

    // === Boss 机制：熔岩巨像 - 合成灭火 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_lava_giant') {

      const e1 = this._extinguishOnMerge(toPos.row, toPos.col);

      const e2 = this._extinguishOnMerge(fromPos.row, fromPos.col);

      if (e1 || e2) {

        // 刷新燃烧视觉效果

        this.boardRenderer.refreshScorchedCells(this._bossState.scorchedCells);

        window.eventBus.emit('notification', {

          message: '🔥 合成扑灭了灼烧！',

          type: 'merge',

        });

      }

    }

    // === Boss 机制：冰霜女巫 - 合成解冻 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_ice_witch') {

      if (this._isRowFrozen(toPos.row)) {

        const thawed = this._updateThawProgress(toPos.row);

        if (thawed) {

          window.eventBus.emit('notification', {

            message: '❄ 冻结的行被合成解冻了！',

            type: 'merge',

          });

        }

      }

    }

    // === 怒气获取：合成 +8，Lv.4+ +15，连击加成 ===

    if (this.isRogueMode) {

      let rageGain = 8;

      if (merged.level >= 4) rageGain = 15;

      rageGain += Math.min(comboCount, 5) * 3; // 连击每层+3，上限+15

      this._addRage(rageGain);

    }

    // 通知合成事件

    window.eventBus.emit('notification', {

      message: `合成 ${merged.icon} Lv.${merged.level} ${merged.name}`,

      type: 'merge',

    });

    // === 肉鸽祝福：连锁反应 ===

    if (this.boonSystem && this.boonSystem.hasBoon('boon_chain_reaction') && Math.random() < 0.25) {

      const lowerLevel = Math.max(1, merged.level - 1);

      const chainEl = new Element(merged.typeId, lowerLevel);

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

          // 保存原始等级并实际提升一级
          if (!el._resonanceBoost) {
            el._originalLevel = el.level;
            el.level = Math.min(el.level + 1, ELEMENT_LEVELS.length);
            el._resonanceBoost = true;
          }

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

            // 恢复原始等级
            el.level = el._originalLevel;
            delete el._originalLevel;
            delete el._resonanceBoost;

            this.boardRenderer.updateCell(this.state.board, r, c);

          }

        }

      }

    }, 5000);

  }

  // ==================== 元素连锁反应：合成风暴 ====================

  /**

   * 触发合成风暴：自动扫描并合成棋盘上所有可合成的相邻元素对

   * 每次调用只执行一轮扫描，避免无限循环

   */

  _triggerChainStorm() {

    if (this._chainReactionState.isStormActive) return;

    this._chainReactionState.isStormActive = true;

    window.eventBus.emit('notification', {

      message: '🌀 合成风暴！自动合成所有可合并元素！',

      type: 'milestone',

    });

    // 全屏金色闪烁 + 强震

    this.boardRenderer._createFlashOverlay('flash-gold');

    this.boardRenderer._applyScreenShake(10, 0.35);

    // 执行一轮扫描合并（最多执行3轮，防止死循环）

    let totalMerges = 0;

    const maxRounds = 3;

    for (let round = 0; round < maxRounds; round++) {

      const pairs = this._findAllMergeablePairs();

      if (pairs.length === 0) break;

      let mergedThisRound = 0;

      for (const pair of pairs) {

        const { row1, col1, row2, col2 } = pair;

        const el1 = this.state.board[row1][col1];

        const el2 = this.state.board[row2][col2];

        if (!el1 || !el2) continue;

        // 再次确认可合成（防止上一轮已消耗）

        if (!Element.canMerge(el1, el2)) continue;

        const result = this.systems.merge.tryMerge(el1, el2, Date.now());

        if (!result) continue;

        const { merged, consumed } = result;

        // 从棋盘移除被消耗的两个元素

        for (const el of consumed) {

          this.systems.spawn.removeElement(this.state.board, el);

        }

        // 放置合成后的新元素（放在第二个位置）

        this.systems.spawn.placeElement(this.state.board, merged, row2, col2);

        // 更新UI

        this.boardRenderer.updateCell(this.state.board, row1, col1);

        this.boardRenderer.updateCell(this.state.board, row2, col2);

        this.boardRenderer.playMergeAnimation(row1, col1, row2, col2);

        this.boardRenderer.playMergeEffect(row2, col2, merged.level, merged.typeId || merged.elementType);

        // 计算积分

        const scoreGain = Math.floor(merged.scoreValue * this._eventCtx.scoreMultiplier);

        this.state.score += scoreGain;

        // 更新评分数据

        this._updateRatingData('merge', { level: merged.level });

        this._totalMergesCount++;

        mergedThisRound++;

        totalMerges++;

      }

      if (mergedThisRound === 0) break;

    }

    // 最终刷新棋盘

    this.boardRenderer.renderAll(this.state.board);

    window.eventBus.emit('score:updated', {

      score: this.state.score,

      targetScore: this.state.targetScore,

    });

    window.eventBus.emit('notification', {

      message: `🌀 合成风暴完成！共 ${totalMerges} 次自动合成`,

      type: 'milestone',

    });

    // 检查是否达标

    this._checkScoreComplete();

    this._checkWaveProgress();

    // 风暴结束后重置状态，允许再次触发

    setTimeout(() => {

      this._chainReactionState.isStormActive = false;

    }, 3000);

  }

  /**

   * 查找棋盘上所有可合成的相邻元素对

   * @returns {Array<{row1:number, col1:number, row2:number, col2:number}>}

   */

  _findAllMergeablePairs() {

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const pairs = [];

    const visited = new Set();

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        const el = board[r][c];

        if (!el) continue;

        // 检查右邻格

        if (c + 1 < cols) {

          const neighbor = board[r][c + 1];

          if (neighbor && Element.canMerge(el, neighbor)) {

            const key = `${Math.min(r * cols + c, r * cols + (c + 1))}_${Math.max(r * cols + c, r * cols + (c + 1))}`;

            if (!visited.has(key)) {

              visited.add(key);

              pairs.push({ row1: r, col1: c, row2: r, col2: c + 1 });

            }

          }

        }

        // 检查下邻格

        if (r + 1 < rows) {

          const neighbor = board[r + 1][c];

          if (neighbor && Element.canMerge(el, neighbor)) {

            const key = `${Math.min(r * cols + c, (r + 1) * cols + c)}_${Math.max(r * cols + c, (r + 1) * cols + c)}`;

            if (!visited.has(key)) {

              visited.add(key);

              pairs.push({ row1: r, col1: c, row2: r + 1, col2: c });

            }

          }

        }

      }

    }

    return pairs;

  }

  // ==================== 怒气/能量条系统 ====================

  /**

   * 将混沌元素（❓）转化为随机基础元素

   * 用于合成前处理，确保混沌元素参与合成时产物是正常元素

   * @param {...Element} elements - 待检查的元素

   */

  _convertChaosElements(...elements) {

    const typeKeys = Object.keys(ELEMENT_TYPES);

    // 找出非混沌的元素类型，作为随机范围的基础（包括另一方类型）

    const nonChaosTypes = elements.filter(el => el && !el.isChaos).map(el => el.typeId).filter(Boolean);

    const pool = nonChaosTypes.length > 0 ? nonChaosTypes : typeKeys;

    // 预先决定一个随机类型，所有混沌元素共享（确保两个混沌元素能合成到同一类型）

    const sharedType = pool[Math.floor(Math.random() * pool.length)];

    for (const el of elements) {

      if (el && el.isChaos) {

        el.typeId = sharedType;

        el.isChaos = false;

        el.icon = ELEMENT_TYPES[sharedType].icon;

      }

    }

  }

  /**

   * 增加怒气值（0-100范围，超100自动溢出）

   * @param {number} amount - 增加量

   */

  _addRage(amount) {

    if (!this.state.isPlaying) return;

    const oldValue = this._rageValue;

    this._rageValue = Math.min(100, this._rageValue + amount);

    // 怒气满时通知

    if (oldValue < 80 && this._rageValue >= 80) {

      window.eventBus.emit('notification', {

        message: '⚡ 怒气高涨！怒气已超过 80%',

        type: 'milestone',

      });

    }

    if (oldValue < 50 && this._rageValue >= 50) {

      window.eventBus.emit('notification', {

        message: '🔥 怒气过半！可以释放大招了',

        type: 'info',

      });

    }

    window.eventBus.emit('rage:updated', {

      value: this._rageValue,

      max: 100,

    });

  }

  /**

   * 使用大招

   * @param {string} ultimateId - 大招ID

   * @returns {boolean} 是否成功释放

   */

  useUltimate(ultimateId) {

    if (!this.state.isPlaying || this.state.isPaused) return false;

    const now = Date.now();

    // 查找大招定义

    const ult = this._ultimates.find(u => u.id === ultimateId);

    if (!ult) {

      window.eventBus.emit('notification', {

        message: '未知的大招',

        type: 'warning',

      });

      return false;

    }

    // 检查是否解锁（祝福限制）

    if (ult.unlockBoon && (!this.boonSystem || !this.boonSystem.hasBoon(ult.unlockBoon))) {

      window.eventBus.emit('notification', {

        message: `🔒 ${ult.name} 未解锁（需要对应祝福）`,

        type: 'warning',

      });

      return false;

    }

    // 检查怒气是否足够

    if (this._rageValue < ult.rageCost) {

      window.eventBus.emit('notification', {

        message: `⚠ 怒气不足！需要 ${ult.rageCost}，当前 ${this._rageValue}`,

        type: 'warning',

      });

      return false;

    }

    // 检查冷却（每个大招独立冷却）

    const elapsed = now - (ult.lastUsedTime || 0);

    if (elapsed < ult.cooldown) {

      const remaining = Math.ceil((ult.cooldown - elapsed) / 1000);

      window.eventBus.emit('notification', {

        message: `⏳ ${ult.name} 冷却中，还需 ${remaining}s`,

        type: 'warning',

      });

      return false;

    }

    // 扣除怒气

    this._rageValue = Math.max(0, this._rageValue - ult.rageCost);

    ult.lastUsedTime = now;

    // 发射大招释放事件

    window.eventBus.emit('ultimate:used', {

      id: ult.id,

      name: ult.name,

      icon: ult.icon,

    });

    // 全屏特效：金色闪光 + 震动

    this.boardRenderer._createFlashOverlay('flash-gold');

    this.boardRenderer._applyScreenShake(8, 0.3);

    // 执行大招效果

    ult.effect();

    // 更新怒气UI

    window.eventBus.emit('rage:updated', {

      value: this._rageValue,

      max: 100,

    });

    window.eventBus.emit('notification', {

      message: `✨ 释放大招：${ult.icon} ${ult.name}！`,

      type: 'milestone',

    });

    return true;

  }

  /** 大招效果1：清除所有 Lv.1 元素 */

  _applyUltimateClear() {

    let count = 0;

    for (let r = 0; r < this.state.board.length; r++) {

      for (let c = 0; c < this.state.board[r].length; c++) {

        const el = this.state.board[r][c];

        if (el && el.level === 1) {

          this.systems.spawn.removeElement(this.state.board, el);

          this.boardRenderer.updateCell(this.state.board, r, c);

          count++;

        }

      }

    }

    window.eventBus.emit('notification', {

      message: `💥 元素净化：清除了 ${count} 个 Lv.1 元素`,

      type: 'reward',

    });

  }

  /** 大招效果2：重置所有发射器冷却 */

  _applyUltimateBoost() {

    for (const emitter of this.state.emitters) {

      emitter.resetCooldown();

    }

    window.eventBus.emit('emitters:updated', this.state.emitters);

    window.eventBus.emit('notification', {

      message: '⚡ 能量爆发：所有发射器已就绪！',

      type: 'reward',

    });

  }

  /** 大招效果3：10秒内得分 x2 */

  _applyUltimateScoreBoost() {

    const originalMultiplier = this._eventCtx.scoreMultiplier;

    this._eventCtx.scoreMultiplier *= 2;

    // 创建视觉提示横幅

    const banner = document.createElement('div');

    banner.id = 'score-boost-banner';

    banner.className = 'score-boost-banner';

    banner.textContent = '🌟 积分 x2！';

    document.body.appendChild(banner);

    void banner.offsetWidth;

    banner.classList.add('show');

    setTimeout(() => {

      this._eventCtx.scoreMultiplier = originalMultiplier;

      banner.classList.remove('show');

      banner.classList.add('hide');

      setTimeout(() => {

        if (banner.parentNode) banner.parentNode.removeChild(banner);

      }, 500);

      window.eventBus.emit('notification', {

        message: '积分增幅结束',

        type: 'info',

      });

    }, 10000);

  }

  /** 大招效果4（祝福解锁）：棋盘上所有元素等级+1 */

  _applyUltimateMergeUp() {

    let count = 0;

    for (let r = 0; r < this.state.board.length; r++) {

      for (let c = 0; c < this.state.board[r].length; c++) {

        const el = this.state.board[r][c];

        if (el && el.level < ELEMENT_LEVELS.length) {

          el.level += 1;

          this.boardRenderer.updateCell(this.state.board, r, c);

          count++;

        }

      }

    }

    window.eventBus.emit('notification', {

      message: `⬆ 全体升级：${count} 个元素等级+1！`,

      type: 'reward',

    });

  }

  /** 大招效果5（祝福解锁）：在空位随机生成基础元素 */

  _applyUltimateFillBoard() {

    let count = 0;

    const typeKeys = Object.keys(ELEMENT_TYPES);

    for (let r = 0; r < this.state.board.length; r++) {

      for (let c = 0; c < this.state.board[r].length; c++) {

        if (!this.state.board[r][c]) {

          const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];

          const el = new Element(randomType, 1);

          this.systems.spawn.placeElement(this.state.board, el, r, c);

          this.boardRenderer.updateCell(this.state.board, r, c);

          this.boardRenderer.playSpawnAnimation(r, c);

          count++;

        }

      }

    }

    window.eventBus.emit('notification', {

      message: `🧩 元素填充：生成了 ${count} 个基础元素`,

      type: 'reward',

    });

  }

  /** 大招效果6（祝福解锁）：15秒内连击倍率固定 x3 */

  _applyUltimateComboX3() {

    const originalWindow = this.systems.merge.COMBO_WINDOW_MS;

    // 修改连击窗口为极大值，确保连击不中断

    this.systems.merge.COMBO_WINDOW_MS = 99999999;

    const banner = document.createElement('div');

    banner.id = 'combo-boost-banner';

    banner.className = 'score-boost-banner combo-boost';

    banner.textContent = '🌀 连击风暴！固定 x3 倍率';

    document.body.appendChild(banner);

    void banner.offsetWidth;

    banner.classList.add('show');

    setTimeout(() => {

      this.systems.merge.COMBO_WINDOW_MS = originalWindow;

      banner.classList.remove('show');

      banner.classList.add('hide');

      setTimeout(() => {

        if (banner.parentNode) banner.parentNode.removeChild(banner);

      }, 500);

      window.eventBus.emit('notification', {

        message: '连击风暴结束',

        type: 'info',

      });

    }, 15000);

  }

  /** 大招效果7（祝福解锁）：刷新所有订单为高奖励订单 */

  _applyUltimateOrderRefresh() {

    const orders = this.systems.order.getOrders();

    for (const order of orders) {

      // 提升奖励

      if (order.reward) {

        order.reward = Math.floor(order.reward * 1.5);

      }

    }

    window.eventBus.emit('orders:updated', orders);

    window.eventBus.emit('notification', {

      message: '📋 订单重置：所有订单奖励提升 50%！',

      type: 'reward',

    });

  }

  /** 大招效果8（祝福解锁）：随机将一对相邻同等级元素合成高两级 */

  _applyUltimateSuperMerge() {

    const pairs = this._findAllMergeablePairs();

    if (pairs.length === 0) {

      window.eventBus.emit('notification', {

        message: '没有可合成的相邻元素',

        type: 'warning',

      });

      return;

    }

    // 选择最高等级的一对进行超级合成

    pairs.sort((a, b) => {

      const elA = this.state.board[a.row1][a.col1];

      const elB = this.state.board[b.row1][b.col1];

      return (elB ? elB.level : 0) - (elA ? elA.level : 0);

    });

    const target = pairs[0];

    const el1 = this.state.board[target.row1][target.col1];

    const el2 = this.state.board[target.row2][target.col2];

    if (!el1 || !el2) return;

    // 移除两个元素

    this.systems.spawn.removeElement(this.state.board, el1);

    this.systems.spawn.removeElement(this.state.board, el2);

    // 创建高两级的元素

    const newLevel = Math.min(el1.level + 2, ELEMENT_LEVELS.length);

    const merged = new Element(el1.typeId || el1.elementType, newLevel);

    this.systems.spawn.placeElement(this.state.board, merged, target.row2, target.col2);

    // 更新UI

    this.boardRenderer.updateCell(this.state.board, target.row1, target.col1);

    this.boardRenderer.updateCell(this.state.board, target.row2, target.col2);

    this.boardRenderer.playMergeAnimation(target.row1, target.col1, target.row2, target.col2);

    this.boardRenderer.playMergeEffect(target.row2, target.col2, merged.level, merged.typeId || merged.elementType);

    // 积分

    const scoreGain = Math.floor(merged.scoreValue * 2);

    this.state.score += scoreGain;

    window.eventBus.emit('score:updated', {

      score: this.state.score,

      targetScore: this.state.targetScore,

    });

    window.eventBus.emit('notification', {

      message: `🔮 超级合成！${el1.icon} → ${merged.icon} Lv.${merged.level}`,

      type: 'milestone',

    });

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

    // 根据贪婪代价阶段，筛选满足最低等级要求的格子

    const minLevel = this.boonSystem ? this.boonSystem.getGreedMinLevel() : 1;

    let candidates = occupiedCells.filter(cell => {

      const el = this.state.board[cell.row][cell.col];

      return el && el.level >= minLevel;

    });

    if (candidates.length === 0) candidates = occupiedCells;

    const target = candidates[Math.floor(Math.random() * candidates.length)];

    const consumedEl = this.state.board[target.row][target.col];

    this.systems.spawn.removeElement(this.state.board, consumedEl);

    this.boardRenderer.updateCell(this.state.board, target.row, target.col);

    window.eventBus.emit('notification', {

      message: `👹 贪婪代价！消耗了 ${consumedEl.icon} Lv.${consumedEl.level} ${consumedEl.name || ''}`,

      type: 'warning',

    });

  }

  /** 随机交换棋盘上 N 对元素位置（元素混淆阶段3） */

  _swapRandomElements(pairs) {

    const occupiedCells = [];

    for (let r = 0; r < this.state.board.length; r++) {

      for (let c = 0; c < this.state.board[r].length; c++) {

        if (this.state.board[r][c]) {

          occupiedCells.push({ row: r, col: c });

        }

      }

    }

    if (occupiedCells.length < 2) return;

    for (let i = 0; i < pairs && occupiedCells.length >= 2; i++) {

      const idx1 = Math.floor(Math.random() * occupiedCells.length);

      const cell1 = occupiedCells.splice(idx1, 1)[0];

      const idx2 = Math.floor(Math.random() * occupiedCells.length);

      const cell2 = occupiedCells.splice(idx2, 1)[0];

      // 交换两个格子的元素

      const temp = this.state.board[cell1.row][cell1.col];

      this.state.board[cell1.row][cell1.col] = this.state.board[cell2.row][cell2.col];

      this.state.board[cell2.row][cell2.col] = temp;

      // 更新渲染

      this.boardRenderer.updateCell(this.state.board, cell1.row, cell1.col);

      this.boardRenderer.updateCell(this.state.board, cell2.row, cell2.col);

    }

  }

  /** 随机封锁棋盘上的格子（脆弱棋盘阶段2/3） */

  _blockRandomCells(count) {

    if (!this.boonSystem) return;

    const board = this.state.board;

    const rows = board.length;

    const cols = board[0].length;

    const allCells = [];

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        allCells.push({ row: r, col: c });

      }

    }

    // 移除已被封锁的格子

    const blocked = this.boonSystem.getBlockedCells();

    const available = allCells.filter(cell =>

      !blocked.some(b => b.row === cell.row && b.col === cell.col)

    );

    const toBlock = [];

    for (let i = 0; i < count && available.length > 0; i++) {

      const idx = Math.floor(Math.random() * available.length);

      toBlock.push(available.splice(idx, 1)[0]);

    }

    // 封锁格子：清除元素并标记为不可用

    for (const cell of toBlock) {

      if (board[cell.row][cell.col]) {

        this.systems.spawn.removeElement(board, board[cell.row][cell.col]);

      }

      board[cell.row][cell.col] = { _blocked: true };

      this.boardRenderer.updateCell(board, cell.row, cell.col);

    }

    this.boonSystem.setBlockedCells([...blocked, ...toBlock]);

    if (toBlock.length > 0) {

      window.eventBus.emit('notification', {

        message: `💔 脆弱棋盘！${toBlock.length} 个格子被封锁`,

        type: 'warning',

      });

    }

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

    // === 怒气获取：提交订单 +12 ===

    if (this.isRogueMode) {

      this._addRage(12);

    }

    // === Boss 机制：时间吞噬者 - 提交订单延缓吞噬 ===

    if (this._bossState.isActive && this._bossState.bossId === 'boss_time_devourer') {

      this._delayDevour();

    }

    // === 肉鸽诅咒：贪婪代价（分阶段） ===

    if (this.boonSystem && this.boonSystem.hasCurse('curse_greed_price')) {

      if (this.boonSystem.shouldConsumeForGreedPrice()) {

        this._consumeRandomElement();

      }

    }

    // === 缓慢生长：阶段3永久累加 ===

    if (this.boonSystem) {

      this.boonSystem.onOrderSubmittedForSlowGrowth(this.state.emitters);

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

    // 重置怒气值

    this._rageValue = 0;

    // 重置所有大招冷却

      if (this._ultimates) {

        for (const u of this._ultimates) u.lastUsedTime = 0;

      }

    // === Boss 战胜利处理 ===

    if (this._bossState.isActive) {

      this._onBossVictory();

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

    // 创建怒气条（读档恢复时也需要）

    if (this.isRogueMode) {

      if (this.uiManager.createRageBar) {

        this.uiManager.createRageBar(this._ultimates);

      }

      // 重置怒气

      this._rageValue = 0;

      // 重置所有大招冷却

      if (this._ultimates) {

        for (const u of this._ultimates) u.lastUsedTime = 0;

      }

      window.eventBus.emit('rage:updated', { value: 0, max: 100 });

    }

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

    // 重置怒气

    this._rageValue = 0;

    // 重置所有大招冷却

      if (this._ultimates) {

        for (const u of this._ultimates) u.lastUsedTime = 0;

      }

    this.state.isPlaying = false;

  }

}