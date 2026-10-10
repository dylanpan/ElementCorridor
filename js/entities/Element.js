/**
 * ============================================================
 * 元素实体 —— 棋盘上的基础单位
 * 每个元素有类型和等级两个核心属性。
 * 纯数据类，不包含渲染逻辑，方便迁移至 Godot。
 * ============================================================
 */
class Element {
  /**
   * @param {string} typeId - 元素类型ID (如 'fire')
   * @param {number} level - 元素等级 (1-6)
   * @param {number} [id] - 可选，唯一标识符
   */
  constructor(typeId, level, id = null) {
    this.id = id || Element._nextId++;
    this.typeId = typeId;
    this.level = level;
    this.gridRow = -1;
    this.gridCol = -1;

    // 从配置中获取类型信息
    const typeConfig = ELEMENT_TYPES[typeId];
    const levelConfig = ELEMENT_LEVELS[level - 1];

    this.name = typeConfig ? typeConfig.name : '未知';
    this.icon = typeConfig ? typeConfig.icon : '❓';
    this.color = typeConfig ? typeConfig.color : '#999';
    this.bgColor = typeConfig ? typeConfig.bgColor : '#eee';
    this.scoreValue = levelConfig ? levelConfig.scoreValue : 0;
    this.levelLabel = levelConfig ? levelConfig.label : '';
  }

  /** 判断两个元素是否可以合成（同类型同等级） */
  static canMerge(a, b) {
    if (!a || !b) return false;
    if (a.id === b.id) return false;
    return a.typeId === b.typeId && a.level === b.level;
  }

  /** 合成后的新等级 */
  static getMergedLevel(a, b) {
    if (!Element.canMerge(a, b)) return -1;
    const nextLevel = a.level + 1;
    return nextLevel <= ELEMENT_LEVELS.length ? nextLevel : -1;
  }

  /** 克隆元素（新ID） */
  clone() {
    const el = new Element(this.typeId, this.level);
    el.gridRow = this.gridRow;
    el.gridCol = this.gridCol;
    return el;
  }

  /** 获取显示文本 */
  getDisplayName() {
    const levelLabel = ELEMENT_LEVELS[this.level - 1]?.label || '';
    return `${this.icon} ${levelLabel}${this.name}`;
  }

  /** 序列化（用于存档） */
  serialize() {
    return {
      typeId: this.typeId,
      level: this.level,
      gridRow: this.gridRow,
      gridCol: this.gridCol,
    };
  }

  /** 反序列化 */
  static deserialize(data) {
    const el = new Element(data.typeId, data.level);
    el.gridRow = data.gridRow;
    el.gridCol = data.gridCol;
    return el;
  }
}

Element._nextId = 1;