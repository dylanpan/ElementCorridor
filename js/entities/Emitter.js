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

  /** 执行产出，返回 Element 实例或数组（双重产出/多元素产出） */
  spawn(currentTime, spawnContext = null) {
    // 元素风暴：跳过冷却检查
    const isStormActive = window.__gameEngine && window.__gameEngine.itemSystem &&
      window.__gameEngine.itemSystem._stormEndTime > currentTime;
    if (!isStormActive && !this.isReadyToSpawn(currentTime)) {
      return null;
    }
    this.lastSpawnTime = currentTime;
    this._frozenDuration = 0;  // 重置冻结累计，避免累积到下一周期
    this.totalSpawns++;

    // 如果提供了 spawnContext（单一发射器模式），使用上下文中的类型和概率
    if (spawnContext && spawnContext.availableTypes && spawnContext.availableTypes.length > 0) {
      return this._spawnWithContext(spawnContext);
    }

    // 原有逻辑（兼容旧版多发射器模式）
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

    return results[0];
  }

  /**
   * 使用上下文信息执行产出（单一发射器模式）
   * 支持概率产出和多元素产出
   * @param {Object} spawnContext - 产出上下文
   * @param {string[]} spawnContext.availableTypes - 可产出的元素类型列表
   * @param {Object<string, number>} spawnContext.probabilities - 概率映射
   * @param {Object} spawnContext.multiSpawnFlags - 多元素产出标志
   * @returns {Element|Element[]|null}
   */
  _spawnWithContext(spawnContext) {
    const { availableTypes, probabilities, multiSpawnFlags } = spawnContext;
    const results = [];

    // 计算本次点击要产出几组元素
    let groups = 1;
    if (Math.random() < (this.modifiers.dualChance || 0)) groups = 2;

    for (let g = 0; g < groups; g++) {
      // 计算每组产出几种不同元素
      let typesInGroup = 1;
      if (multiSpawnFlags && multiSpawnFlags.myriadSource && availableTypes.length >= 3) {
        typesInGroup = 3;
      } else if (multiSpawnFlags && multiSpawnFlags.splitFlow && availableTypes.length >= 2) {
        typesInGroup = 2;
      }

      // 从可用元素中按概率选出 typesInGroup 种不同类型
      const selectedTypes = this._pickDistinctTypes(availableTypes, probabilities, typesInGroup);

      for (const type of selectedTypes) {
        let level = this.spawnLevel + this.modifiers.spawnLevelBonus;
        if (Math.random() < this.modifiers.upgradeChance) {
          level += 1;
        }
        level = Math.min(level, ELEMENT_LEVELS.length);
        results.push(new Element(type, level));
      }
    }

    if (results.length === 1) return results[0];
    return results;
  }

  /**
   * 从可用元素中按概率选出指定数量的不同类型
   * @param {string[]} types - 可用元素类型列表
   * @param {Object<string, number>} probs - 概率映射
   * @param {number} count - 需要选出的数量
   * @returns {string[]}
   */
  _pickDistinctTypes(types, probs, count) {
    if (types.length <= count) return [...types];

    const selected = [];
    const available = [...types];

    for (let i = 0; i < count; i++) {
      const totalWeight = available.reduce((sum, t) => sum + (probs[t] || 0), 0);
      if (totalWeight <= 0) break;
      let rand = Math.random() * totalWeight;

      for (let j = 0; j < available.length; j++) {
        const type = available[j];
        rand -= (probs[type] || 0);
        if (rand <= 0) {
          selected.push(type);
          available.splice(j, 1);
          break;
        }
      }
    }

    return selected;
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