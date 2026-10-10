/**
 * ============================================================
 * 合成系统 —— 处理元素的合并逻辑
 * 纯逻辑层，不依赖DOM，方便迁移至Godot。
 * ============================================================
 */
class MergeSystem {
  constructor() {
    this.comboCount = 0;
    this.lastMergeTime = 0;
    this.comboTimeout = null;
    this.COMBO_WINDOW_MS = 3000; // 连击判定窗口（3秒内连续合成为连击）
  }

  /**
   * 尝试合成两个元素
   * @param {Element} a - 源元素
   * @param {Element} b - 目标元素
   * @param {number} currentTime - 当前时间戳
   * @returns {object|null} - 合成结果 { merged: Element, consumed: [Element, Element], comboMultiplier: number }
   */
  tryMerge(a, b, currentTime) {
    if (!Element.canMerge(a, b)) return null;

    const newLevel = Element.getMergedLevel(a, b);
    if (newLevel === -1) return null;

    // 创建合成后的新元素
    const merged = new Element(a.typeId, newLevel);
    merged.gridRow = a.gridRow;
    merged.gridCol = a.gridCol;

    // 计算连击倍率
    let comboMultiplier = 1;
    if (currentTime - this.lastMergeTime < this.COMBO_WINDOW_MS) {
      this.comboCount++;
      comboMultiplier = 1 + (this.comboCount - 1) * GAME_SETTINGS.comboBonusMultiplier;
    } else {
      this.comboCount = 1;
    }
    this.lastMergeTime = currentTime;

    // 清除之前的连击超时
    if (this.comboTimeout) {
      clearTimeout(this.comboTimeout);
    }

    return {
      merged,
      consumed: [a, b],
      comboCount: this.comboCount,
      comboMultiplier,
    };
  }

  /** 重置连击计数 */
  resetCombo() {
    this.comboCount = 0;
    this.lastMergeTime = 0;
  }

  /** 获取当前连击信息 */
  getComboInfo() {
    return {
      count: this.comboCount,
      multiplier: this.comboCount > 1
        ? 1 + (this.comboCount - 1) * GAME_SETTINGS.comboBonusMultiplier
        : 1,
    };
  }

  /** 序列化 */
  serialize() {
    return {
      comboCount: this.comboCount,
      lastMergeTime: this.lastMergeTime,
    };
  }

  /** 反序列化 */
  static deserialize(data) {
    const system = new MergeSystem();
    system.comboCount = data.comboCount || 0;
    system.lastMergeTime = data.lastMergeTime || 0;
    return system;
  }
}