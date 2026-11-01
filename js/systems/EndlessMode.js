/**
 * ============================================================
 * 无尽模式 —— 击败最终 Boss 后解锁的终局玩法
 * 无终点，难度随时间持续递增，比拼存活时间与积分
 * ============================================================
 */
class EndlessMode {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.active = false;
    this.difficultyLevel = 0;
    this.startTime = 0;
    this._lastLevelUpTime = 0;
  }

  static STORAGE_KEY = 'lingSu_endless_record';
  static UNLOCK_KEY = 'lingSu_endless_unlocked';

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

    // 每 30 秒提升难度
    if (now - this._lastLevelUpTime >= 31000) {
      this.difficultyLevel++;
      this._lastLevelUpTime = now;
      this._applyDifficulty();

      window.eventBus.emit('endless:level-up', {
        level: this.difficultyLevel,
      });
    }
  }

  /**
   * 应用当前难度
   */
  _applyDifficulty() {
    const lv = this.difficultyLevel;

    // 订单时间缩短（每级 -5%，最多 -75%）
    const orderTimeMult = Math.max(0.319, 1 - lv * 0.051);
    this.engine._endlessOrderTimeMultiplier = orderTimeMult;

    // 发射器冷却增加（每级 +3%，最多 +150%）
    const cooldownMult = Math.min(2.482, 1 + lv * 0.031);
    this.engine._eventCtx.emitterSpeedMultiplier = 1 / cooldownMult;

    // 高品质概率增加（每级 +2%，最多 +60%）
    const qualityBonus = Math.min(0.608, lv * 0.022);
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
