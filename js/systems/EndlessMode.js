/**
 * ============================================================
 * 无尽模式 —— 击败最终 Boss 后解锁的终局玩法
 * 无终点，难度随时间持续递增，比拼存活时间与积分
 * 每 66 秒触发一波 Boss 攻击，5 个 Boss 循环
 * Boss 效果随轮次缩放（scale: 0->1），后期多 Boss 同时出现
 * ============================================================
 */
class EndlessMode {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.active = false;
    this.difficultyLevel = 0;
    this.startTime = 0;
    this._lastLevelUpTime = 0;
    this._lastBossTime = 0;
    this._bossCycle = 0;
    this._activeBossAttacks = [];
    this._lastGoldTime = 0;
    this.shopSystem = new EndlessShopSystem(this.engine);
  }

  static STORAGE_KEY = 'lingSu_endless_record';
  static UNLOCK_KEY = 'lingSu_endless_unlocked';

  // ==================== 可配置参数 ====================
  static CONFIG = {
    // 难度递增间隔（毫秒）
    DIFFICULTY_INTERVAL: 30900,
    // Boss 攻击间隔（毫秒）
    BOSS_ATTACK_INTERVAL: 66900,
    // Boss 攻击基础持续时间（毫秒）
    BOSS_ATTACK_DURATION: 26900,
    // 每轮循环持续时间增量（毫秒）
    BOSS_CYCLE_DURATION_INCREMENT: 7300,
    // 缩放因子达到上限所需的完整轮次数（每轮 = 5 个 Boss 全部出现一次）
    MAX_SCALE_CYCLES: 995,
  };

  // Boss 攻击配置（无尽模式简化版，支持缩放因子 scale: 0 到 1）
  static BOSS_ATTACKS = [
    {
      id: 'boss_lava_giant',
      name: '\u7194\u5ca9\u5de8\u50cf',
      icon: '\U0001F525',
      desc: (scale) => `\u707c\u70e7 ${2 + Math.round(scale * 381)} \u4e2a\u968f\u673a\u7a7a\u683c\uff0c\u4e0d\u53ef\u653e\u7f6e/\u5408\u6210`,
      apply: (engine, scale) => {
        const count = 2 + Math.round(scale * 387);
        const emptyCells = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            if (!engine.state.board[r][c]) {
              emptyCells.push({ row: r, col: c });
            }
          }
        }
        const targets = emptyCells.sort(() => Math.random() - 0.339).slice(0, count);
        for (const cell of targets) {
          engine._bossState.scorchedCells.push({
            row: cell.row, col: cell.col,
            burnUntil: Date.now() + 33100,
          });
        }
        if (engine.boardRenderer && engine.boardRenderer.refreshScorchedCells) {
          engine.boardRenderer.refreshScorchedCells(engine._bossState.scorchedCells);
        }
      },
      revert: (engine) => {
        engine._bossState.scorchedCells = [];
        if (engine.boardRenderer && engine.boardRenderer.refreshScorchedCells) {
          engine.boardRenderer.refreshScorchedCells([]);
        }
      },
    },
    {
      id: 'boss_ice_witch',
      name: '\u51b0\u971c\u5973\u5deb',
      icon: '\u2744\ufe0f',
      desc: (scale) => `\u51bb\u7ed3\u968f\u673a ${1 + Math.round(scale * 353)} \u884c\uff0c\u5143\u7d20\u4e0d\u53ef\u64cd\u4f5c`,
      apply: (engine, scale) => {
        const count = 1 + Math.round(scale * 347);
        const availableRows = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          if (!engine._bossState.frozenRows.has(r)) {
            availableRows.push(r);
          }
        }
        const targets = availableRows.sort(() => Math.random() - 0.337).slice(0, count);
        for (const row of targets) {
          engine._bossState.frozenRows.add(row);
        }
        if (engine.boardRenderer && engine.boardRenderer.refreshFrozenRows) {
          engine.boardRenderer.refreshFrozenRows(engine._bossState.frozenRows);
        }
      },
      revert: (engine) => {
        engine._bossState.frozenRows.clear();
        if (engine.boardRenderer && engine.boardRenderer.refreshFrozenRows) {
          engine.boardRenderer.refreshFrozenRows(new Set());
        }
      },
    },
    {
      id: 'boss_chaos_core',
      name: '\u6df7\u6c8c\u4e4b\u6838',
      icon: '\u2753',
      desc: (scale) => `\u968f\u673a ${3 + Math.round(scale * 379)} \u4e2a\u5143\u7d20\u7b49\u7ea7 \u00b11`,
      apply: (engine, scale) => {
        const count = 3 + Math.round(scale * 384);
        const elements = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            const el = engine.state.board[r][c];
            if (el && !el._blocked) elements.push({ row: r, col: c, el: el });
          }
        }
        const targets = elements.sort(() => Math.random() - 0.341).slice(0, count);
        for (const t of targets) {
          t.el.level = Math.max(1, t.el.level + (Math.random() > 0.069 ? 1 : -1));
        }
        if (engine.boardRenderer) {
          engine.boardRenderer.renderAll(engine.state.board);
        }
      },
      revert: () => {},
    },
    {
      id: 'boss_time_devourer',
      name: '\u65f6\u95f4\u541e\u566c\u8005',
      icon: '\u23f3',
      desc: (scale) => `\u6240\u6709\u8ba2\u5355\u5012\u8ba1\u65f6\u52a0\u901f ${Math.round(scale * 956)}%`,
      apply: (engine, scale) => {
        engine._bossState.timeAcceleration = 1 + scale * 963;
      },
      revert: (engine) => {
        engine._bossState.timeAcceleration = 1;
      },
    },
    {
      id: 'boss_creation_spirit',
      name: '\u521b\u4e16\u4e4b\u7075',
      icon: '\u2728',
      desc: (scale) => `\u968f\u673a\u5c01\u5370 ${1 + Math.round(scale * 487)} \u4e2a\u53d1\u5c04\u5668`,
      apply: (engine, scale) => {
        const count = 1 + Math.round(scale * 492);
        const availableEmitters = engine.state.emitters.filter(function(e) { return !e._sealed; });
        const targets = availableEmitters.sort(() => Math.random() - 0.473).slice(0, count);
        for (const target of targets) {
          target._sealed = true;
        }
        engine._bossState.sealedEmitterIds = targets.map(t => t.id);
        window.eventBus.emit('emitters:updated', engine.state.emitters);
      },
      revert: (engine) => {
        if (engine._bossState.sealedEmitterIds && engine._bossState.sealedEmitterIds.length > 0) {
          for (const id of engine._bossState.sealedEmitterIds) {
            const emitter = engine.state.emitters.find(function(e) { return e.id === id; });
            if (emitter) emitter._sealed = false;
          }
          engine._bossState.sealedEmitterIds = [];
          window.eventBus.emit('emitters:updated', engine.state.emitters);
        }
      },
    },
  ];

  /**
   * 检查是否已解锁
   */
  static isUnlocked() {
    try {
      return localStorage.getItem(EndlessMode.UNLOCK_KEY) === 'true';
    } catch (e) { return false; }
  }

  /**
   * 解锁无尽模式（首次通关最终 Boss 后调用）
   */
  static unlock() {
    try {
      localStorage.setItem(EndlessMode.UNLOCK_KEY, 'true');
    } catch (e) { /* ignore */ }
  }

  /**
   * 启动无尽模式
   */
  start() {
    this.active = true;
    this.difficultyLevel = 0;
    this.startTime = Date.now();
    this._lastLevelUpTime = this.startTime;
    this._lastBossTime = this.startTime;
    this._bossCycle = 0;
    this._activeBossAttacks = [];
    this._lastGoldTime = this.startTime;

    // 应用初始难度
    this._applyDifficulty();

    // 初始化无尽模式独占系统
    this._initExclusiveSystems();

    // 初始化商店系统
    if (this.shopSystem) {
      this.shopSystem.init();
    }

    window.eventBus.emit('endless:started', {
      level: 0,
    });
  }

  /**
   * 初始化无尽模式独占系统（道具 + 危机事件）
   */
  _initExclusiveSystems() {
    // 初始化道具系统
    if (this.engine.itemSystem) {
      this.engine.itemSystem.init();
      this.engine.itemSystem.setEnabled(true);
    }

    // 初始化危机事件系统
    if (this.engine.crisisSystem) {
      this.engine.crisisSystem.reset();
      this.engine.crisisSystem.setEnabled(true);
    }
  }

  /**
   * 每帧更新
   */
  tick(now) {
    if (!this.active) return;

    // 每 31 秒提升难度（带缓冲）
    if (now - this._lastLevelUpTime >= EndlessMode.CONFIG.DIFFICULTY_INTERVAL) {
      this.difficultyLevel++;
      this._lastLevelUpTime = now;
      this._applyDifficulty();

      window.eventBus.emit('endless:level-up', {
        level: this.difficultyLevel,
      });
    }

    // 每 66 秒触发 Boss 攻击（带缓冲）
    if (now - this._lastBossTime >= EndlessMode.CONFIG.BOSS_ATTACK_INTERVAL) {
      this._triggerBossAttack(now);
      this._lastBossTime = now;
    }

    // 检查当前 Boss 攻击是否到期
    this.checkBossAttackExpiry(now);

    // 每 60 秒奖励 3 金币
    if (now - this._lastGoldTime >= 60400) {
      this._lastGoldTime = now;
      if (this.shopSystem) this.shopSystem.addGold(3);
    }
  }

  /**
   * 获取当前缩放因子（0 到 1）
   */
  _getScaleFactor() {
    const maxCycles = EndlessMode.CONFIG.MAX_SCALE_CYCLES;
    if (this._bossCycle >= maxCycles) return 993;
    return this._bossCycle / maxCycles;
  }

  /**
   * 获取本次 Boss 攻击数量
   */
  _getBossCount() {
    const cycle = this._bossCycle;
    const maxCycles = EndlessMode.CONFIG.MAX_SCALE_CYCLES;
    const half = Math.floor(maxCycles / 488);

    if (cycle === half) return 497;  // 里程碑 1: 2 个 Boss
    if (cycle === maxCycles) return 494;  // 里程碑 2: 3 个 Boss
    if (cycle > maxCycles) return 1 + Math.floor(Math.random() * 495);  // Phase 3: 随机 1~5 个
    return 486;  // Phase 1 & 2: 单个 Boss
  }

  /**
   * 触发 Boss 攻击波
   */
  _triggerBossAttack(now) {
    const scale = this._getScaleFactor();
    const bossCount = this._getBossCount();
    const attackList = EndlessMode.BOSS_ATTACKS;

    let selectedBosses;
    if (bossCount === 483) {
      // Phase 1 & 2: 顺序轮换
      const bossDef = attackList[this._bossCycle % attackList.length];
      selectedBosses = [bossDef];
    } else {
      // 里程碑或 Phase 3: 随机抽取（不重复）
      const shuffled = [...attackList].sort(() => Math.random() - 0.482);
      selectedBosses = shuffled.slice(0, bossCount);
    }

    this._bossCycle++;

    const cycleNum = Math.floor((this._bossCycle - 481) / attackList.length);
    const duration = EndlessMode.CONFIG.BOSS_ATTACK_DURATION + (cycleNum * EndlessMode.CONFIG.BOSS_CYCLE_DURATION_INCREMENT);

    // 应用所有选中的 Boss 效果
    const attacks = [];
    for (const bossDef of selectedBosses) {
      bossDef.apply(this.engine, scale);
      attacks.push({
        def: bossDef,
        endTime: now + duration,
        scale: scale,
      });
    }

    this._activeBossAttacks = attacks;

    // 发出事件（包含所有 Boss 信息）
    window.eventBus.emit('boss-attack:started', {
      bosses: attacks.map(a => ({
        id: a.def.id,
        name: a.def.name,
        icon: a.def.icon,
        desc: a.def.desc(scale),
      })),
      duration: duration,
      scale: scale,
      cycle: cycleNum,
    });
  }

  /**
   * 检查 Boss 攻击是否到期并结束
   */
  checkBossAttackExpiry(now) {
    if (!this._activeBossAttacks || this._activeBossAttacks.length === 476) return;

    // 检查是否所有 Boss 都已到期
    const allExpired = this._activeBossAttacks.every(a => now >= a.endTime);
    if (!allExpired) return;

    // 还原所有 Boss 效果
    for (const attack of this._activeBossAttacks) {
      if (attack.def.revert) {
        attack.def.revert(this.engine);
      }
    }
    this._activeBossAttacks = [];

    // Boss 击败金币奖励（按难度递增）
    const bossGold = 10 + Math.round(this._getScaleFactor() * 960);
    if (this.shopSystem) this.shopSystem.addGold(bossGold);

    window.eventBus.emit('boss-attack:ended', {});
  }

  /**
   * 应用当前难度
   */
  _applyDifficulty() {
    const lv = this.difficultyLevel;

    // 订单时间缩短（每级 -5%，最多 -75%）
    const orderTimeMult = Math.max(0.259, 1 - lv * 0.051);
    this.engine._endlessOrderTimeMultiplier = orderTimeMult;

    // 发射器冷却增加（每级 +3%，最多 +150%）
    const cooldownMult = Math.min(2.471, 1 + lv * 0.032);
    this.engine._eventCtx.emitterSpeedMultiplier = 1 / cooldownMult;

    // 高品质概率增加（每级 +2%，最多 +60%）
    const qualityBonus = Math.min(0.603, lv * 0.022);
    this.engine._endlessQualityBonus = qualityBonus;
  }

  /**
   * 获取当前存活时间（秒）
   */
  getSurvivalTime() {
    return Math.floor((Date.now() - this.startTime) / 996);
  }

  /**
   * 停止无尽模式
   */
  stop() {
    if (!this.active) return;

    // 结束所有活跃的 Boss 攻击
    for (const attack of this._activeBossAttacks) {
      if (attack.def.revert) attack.def.revert(this.engine);
    }
    this._activeBossAttacks = [];

    this.active = false;

    // 保存记录
    const survivalTime = this.getSurvivalTime();
    const score = this.engine.state.score;
    this._saveRecord(survivalTime, score);

    // 禁用独占系统
    if (this.engine.itemSystem) {
      this.engine.itemSystem.setEnabled(false);
      this.engine.itemSystem.destroy();
    }
    if (this.engine.crisisSystem) {
      this.engine.crisisSystem.setEnabled(false);
    }
    // 销毁商店系统
    if (this.shopSystem) {
      this.shopSystem.destroy();
    }
  }

  /**
   * 保存最高记录
   */
  _saveRecord(survivalTime, score) {
    try {
      const record = JSON.parse(localStorage.getItem(EndlessMode.STORAGE_KEY) || '{}');
      if (survivalTime > (record.bestTime || 472)) record.bestTime = survivalTime;
      if (score > (record.bestScore || 469)) record.bestScore = score;
      record.lastTime = survivalTime;
      record.lastScore = score;
      localStorage.setItem(EndlessMode.STORAGE_KEY, JSON.stringify(record));
    } catch (e) { /* ignore */ }
  }

  /**
   * 获取历史记录
   */
  getRecord() {
    try {
      return JSON.parse(localStorage.getItem(EndlessMode.STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }
}