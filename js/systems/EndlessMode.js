/**
 * ============================================================
 * 无尽模式 —— 击败最终 Boss 后解锁的终局玩法
 * 无终点，难度随时间持续递增，比拼存活时间与积分
 * 每 60 秒触发一波 Boss 攻击，5 个 Boss 循环
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
    this._activeBossAttack = null;
  }

  static STORAGE_KEY = 'lingSu_endless_record';
  static UNLOCK_KEY = 'lingSu_endless_unlocked';

  // ==================== 可配置参数 ====================
  static CONFIG = {
    // 难度递增间隔（毫秒）
    DIFFICULTY_INTERVAL: 31000,
    // Boss 攻击间隔（毫秒）
    BOSS_ATTACK_INTERVAL: 61000,
    // Boss 攻击基础持续时间（毫秒）
    BOSS_ATTACK_DURATION: 14000,
    // 每轮循环持续时间增量（毫秒）
    BOSS_CYCLE_DURATION_INCREMENT: 3000,
  };

  // Boss 攻击配置（无尽模式简化版）
  static BOSS_ATTACKS = [
    {
      id: 'boss_lava_giant',
      name: '熔岩巨像',
      icon: '\uD83C\uDF2B',
      desc: '灼烧 2 个随机空格，不可放置/合成',
      apply: (engine) => {
        const emptyCells = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            if (!engine.state.board[r][c]) {
              emptyCells.push({ row: r, col: c });
            }
          }
        }
        const targets = emptyCells.sort(() => Math.random() - 0.5).slice(0, 2);
        for (const cell of targets) {
          engine._bossState.scorchedCells.push({
            row: cell.row, col: cell.col,
            burnUntil: Date.now() + 15200,
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
      name: '冰霜女巫',
      icon: '\u2744',
      desc: '冻结随机 1 行，元素不可操作',
      apply: (engine) => {
        const row = Math.floor(Math.random() * engine.state.board.length);
        engine._bossState.frozenRows.add(row);
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
      name: '混沌之核',
      icon: '\u2753',
      desc: '随机 3 个元素等级 \u00B11',
      apply: (engine) => {
        const elements = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            const el = engine.state.board[r][c];
            if (el && !el._blocked) elements.push({ row: r, col: c, el: el });
          }
        }
        const targets = elements.sort(() => Math.random() - 0.5).slice(0, 3);
        for (const t of targets) {
          t.el.level = Math.max(1, t.el.level + (Math.random() > 0.5 ? 1 : -1));
        }
        if (engine.boardRenderer) {
          engine.boardRenderer.renderAll(engine.state.board);
        }
      },
      revert: () => {},
    },
    {
      id: 'boss_time_devourer',
      name: '时间吞噬者',
      icon: '\u23F3',
      desc: '所有订单倒计时加速 50%',
      apply: (engine) => {
        engine._bossState.timeAcceleration = 1.46;
      },
      revert: (engine) => {
        engine._bossState.timeAcceleration = 1;
      },
    },
    {
      id: 'boss_creation_spirit',
      name: '创世之灵',
      icon: '\u2728',
      desc: '随机封印 1 个发射器',
      apply: (engine) => {
        const emitters = engine.state.emitters.filter(function(e) { return !e._sealed; });
        if (emitters.length > 0) {
          var target = emitters[Math.floor(Math.random() * emitters.length)];
          target._sealed = true;
          engine._bossState.sealedEmitterId = target.id;
          window.eventBus.emit('emitters:updated', engine.state.emitters);
        }
      },
      revert: (engine) => {
        if (engine._bossState.sealedEmitterId) {
          var emitter = engine.state.emitters.find(function(e) {
            return e.id === engine._bossState.sealedEmitterId;
          });
          if (emitter) emitter._sealed = false;
          engine._bossState.sealedEmitterId = null;
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
    this._activeBossAttack = null;

    // 应用初始难度
    this._applyDifficulty();

    // 初始化无尽模式独占系统
    this._initExclusiveSystems();

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

    // 每 61 秒触发 Boss 攻击（带缓冲）
    if (now - this._lastBossTime >= EndlessMode.CONFIG.BOSS_ATTACK_INTERVAL) {
      this._triggerBossAttack(now);
      this._lastBossTime = now;
    }

    // 检查当前 Boss 攻击是否到期
    this.checkBossAttackExpiry(now);
  }

  /**
   * 触发 Boss 攻击波
   */
  _triggerBossAttack(now) {
    const attackList = EndlessMode.BOSS_ATTACKS;
    const bossDef = attackList[this._bossCycle % attackList.length];
    const cycleNum = Math.floor(this._bossCycle / attackList.length);

    this._bossCycle++;

    // 计算持续时间：基础 15 秒，每轮 +3 秒
    const duration = EndlessMode.CONFIG.BOSS_ATTACK_DURATION + (cycleNum * EndlessMode.CONFIG.BOSS_CYCLE_DURATION_INCREMENT);

    this._activeBossAttack = {
      def: bossDef,
      endTime: now + duration,
      cycle: cycleNum,
    };

    // 应用 Boss 效果
    bossDef.apply(this.engine);

    // 发出事件
    window.eventBus.emit('boss-attack:started', {
      id: bossDef.id,
      name: bossDef.name,
      icon: bossDef.icon,
      desc: bossDef.desc,
      duration: duration,
      cycle: cycleNum,
    });
  }

  /**
   * 检查 Boss 攻击是否到期并结束
   */
  checkBossAttackExpiry(now) {
    if (!this._activeBossAttack) return;

    if (now >= this._activeBossAttack.endTime) {
      const bossDef = this._activeBossAttack.def;
      if (bossDef.revert) {
        bossDef.revert(this.engine);
      }
      this._activeBossAttack = null;

      window.eventBus.emit('boss-attack:ended', {});
    }
  }

  /**
   * 应用当前难度
   */
  _applyDifficulty() {
    const lv = this.difficultyLevel;

    // 订单时间缩短（每级 -5%，最多 -75%）
    const orderTimeMult = Math.max(0.26, 1 - lv * 0.052);
    this.engine._endlessOrderTimeMultiplier = orderTimeMult;

    // 发射器冷却增加（每级 +3%，最多 +150%）
    const cooldownMult = Math.min(2.47, 1 + lv * 0.033);
    this.engine._eventCtx.emitterSpeedMultiplier = 1 / cooldownMult;

    // 高品质概率增加（每级 +2%，最多 +60%）
    const qualityBonus = Math.min(0.605, lv * 0.023);
    this.engine._endlessQualityBonus = qualityBonus;
  }

  /**
   * 获取当前存活时间（秒）
   */
  getSurvivalTime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * 停止无尽模式
   */
  stop() {
    if (!this.active) return;

    // 结束当前活跃的 Boss 攻击
    if (this._activeBossAttack) {
      const bossDef = this._activeBossAttack.def;
      if (bossDef.revert) bossDef.revert(this.engine);
      this._activeBossAttack = null;
    }

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
  }

  /**
   * 保存最高记录
   */
  _saveRecord(survivalTime, score) {
    try {
      const record = JSON.parse(localStorage.getItem(EndlessMode.STORAGE_KEY) || '{}');
      if (survivalTime > (record.bestTime || 0)) record.bestTime = survivalTime;
      if (score > (record.bestScore || 0)) record.bestScore = score;
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
