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
  }

  /** 检查发射器是否就绪 */
  isReadyToSpawn(currentTime) {
    return currentTime - this.lastSpawnTime >= this.cooldownMs;
  }

  /** 执行产出，返回新的 Element 实例 */
  spawn(currentTime) {
    if (!this.isReadyToSpawn(currentTime)) {
      return null;
    }
    this.lastSpawnTime = currentTime;
    this.totalSpawns++;
    return new Element(this.elementType, this.spawnLevel);
  }

  /** 获取冷却进度 (0~1) */
  getCooldownProgress(currentTime) {
    const elapsed = currentTime - this.lastSpawnTime;
    return Math.min(elapsed / this.cooldownMs, 1);
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
    };
  }

  /** 反序列化 */
  static deserialize(data) {
    const config = EMITTER_CONFIGS.find((c) => c.id === data.id);
    if (!config) return null;
    const emitter = new Emitter(config);
    emitter.lastSpawnTime = data.lastSpawnTime;
    emitter.totalSpawns = data.totalSpawns;
    return emitter;
  }
}