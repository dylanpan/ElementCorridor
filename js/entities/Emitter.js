/**
 * ============================================================
 * 发射器实体 —— 负责产出元素
 * 管理冷却状态、产出逻辑。不包含UI渲染。
 * ============================================================
 */
class Emitter {
  /**
   * @param {object} config - 发射器配置项
   */
  constructor(config) {
    this.id = config.id;
    this.elementType = config.elementType;
    this.name = config.name;
    this.icon = config.icon;
    this.cooldownMs = config.cooldownMs;
    this.spawnLevel = config.spawnLevel || 1;
    this.description = config.description || '';

    // 运行时状态
    this.lastSpawnTime = 0;
    this.isReady = true;
    this.totalSpawns = 0;

    // 冻结状态（紧急事件系统使用）
    this._frozenDuration = 0;   // 累计冻结毫秒数
    this._freezeStartTime = 0;  // 当前冻结开始时间戳

    // 祝福修饰器（肉鸽模式使用）
    this.modifiers = {
      cooldownMultiplier: 1.0,
      dualChance: 0,
      spawnLevelBonus: 0,
      upgradeChance: 0,
      randomType: false,
      _typePool: [],
    };
  }

  /** 获取实际冷却时间（考虑祝福修正） */
  getActualCooldown() {
    return this.cooldownMs * this.modifiers.cooldownMultiplier;
  }

  /** 检查发射器是否就绪（考虑冻结暂停时间） */
  isReadyToSpawn(currentTime) {
    // 【暴风雪】活跃冻结中不可产出
    if (this._freezeStartTime > 0) {
      return false;
    }
    let effectiveElapsed = currentTime - this.lastSpawnTime - this._frozenDuration;
    if (effectiveElapsed < 0) effectiveElapsed = 0;
    return effectiveElapsed >= this.getActualCooldown();
  }

  /** 执行产出，返回 Element 实例或数组（双重产出） */
  spawn(currentTime) {
    if (!this.isReadyToSpawn(currentTime)) {
      return null;
    }
    this.lastSpawnTime = currentTime;
    this._frozenDuration = 0;  // 重置冻结累计，避免累积到下一周期
    this.totalSpawns++;

    const results = [];
    const count = Math.random() < this.modifiers.dualChance ? 2 : 1;

    for (let i = 0; i < count; i++) {
      let type = this.elementType;
      if (this.modifiers.randomType && this.modifiers._typePool.length > 0) {
        type = this.modifiers._typePool[Math.floor(Math.random() * this.modifiers._typePool.length)];
      }
      let level = this.spawnLevel + this.modifiers.spawnLevelBonus;
      if (Math.random() < this.modifiers.upgradeChance) {
        level += 1;
      }
      level = Math.min(level, ELEMENT_LEVELS.length);
      results.push(new Element(type, level));
    }

    // 兼容原有单元素返回逻辑
    return results[0];
  }

  /** 获取冷却进度 (0~1)，考虑冻结暂停的时间 */
  getCooldownProgress(currentTime) {
    // 【暴风雪】活跃冻结中，进度停留在冻结开始时的状态
    if (this._freezeStartTime > 0) {
      const freezeStartElapsed = this._freezeStartTime - this.lastSpawnTime - this._frozenDuration;
      if (freezeStartElapsed < 0) return 0;
      const actualCd = this.getActualCooldown();
      return Math.min(freezeStartElapsed / actualCd, 1);
    }
    let effectiveElapsed = currentTime - this.lastSpawnTime - this._frozenDuration;
    if (effectiveElapsed < 0) effectiveElapsed = 0;
    const actualCd = this.getActualCooldown();
    return Math.min(effectiveElapsed / actualCd, 1);
  }

  /** 开始冻结：记录冻结开始时间 */
  startFreeze(currentTime) {
    if (this._freezeStartTime === 0) {
      this._freezeStartTime = currentTime || Date.now();
    }
  }

  /** 结束冻结：将本次冻结时长累加到 _frozenDuration */
  endFreeze(currentTime) {
    if (this._freezeStartTime > 0) {
      const now = currentTime || Date.now();
      this._frozenDuration += now - this._freezeStartTime;
      this._freezeStartTime = 0;
    }
  }

  /** 重置冷却 */
  resetCooldown() {
    this.lastSpawnTime = 0;
    this.isReady = true;
  }

  /** 重置冷却 */
  resetCooldown() {
    this.lastSpawnTime = 0;
    this.isReady = true;
  }

  /** 序列化 */
  serialize() {
    return {
      id: this.id,
      lastSpawnTime: this.lastSpawnTime,
      totalSpawns: this.totalSpawns,
      _frozenDuration: this._frozenDuration,
      modifiers: { ...this.modifiers },
    };
  }

  /** 反序列化 */
  static deserialize(data) {
    const config = EMITTER_CONFIGS.find((c) => c.id === data.id);
    if (!config) return null;
    const emitter = new Emitter(config);
    emitter.lastSpawnTime = data.lastSpawnTime;
    emitter.totalSpawns = data.totalSpawns;
    emitter._frozenDuration = data._frozenDuration || 0;
    if (data.modifiers) {
      emitter.modifiers = { ...emitter.modifiers, ...data.modifiers };
    }
    return emitter;
  }
}