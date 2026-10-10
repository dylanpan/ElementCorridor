/**
 * ============================================================
 * 祝福系统 —— 管理本局内的祝福与诅咒效果
 * 纯逻辑层，通过事件通知UI更新。
 * 迁移至Godot时可直接复用为 Resource 管理器。
 * ============================================================
 */
class BoonSystem {
  constructor() {
    this.boons = [];
    this.curses = [];
    this.maxBoons = ROGUE_DIFFICULTY.maxBoons;
    this.firstOrderInLevel = true;
  }

  /** 重置（新局调用） */
  reset() {
    this.boons = [];
    this.curses = [];
    this.firstOrderInLevel = true;
  }

  /** 获取当前祝福列表 */
  getBoons() { return [...this.boons]; }

  /** 获取当前诅咒列表 */
  getCurses() { return [...this.curses]; }

  /**
   * 添加祝福
   * @param {object} boonConfig - 祝福配置对象
   * @param {number} [replaceIndex] - 替换第几个祝福（超出上限时必传）
   * @returns {boolean} 是否成功
   */
  addBoon(boonConfig, replaceIndex = -1) {
    if (this.boons.length >= this.maxBoons && replaceIndex < 0) return false;
    
    if (replaceIndex >= 0 && replaceIndex < this.boons.length) {
      this.boons.splice(replaceIndex, 1, { ...boonConfig });
    } else {
      this.boons.push({ ...boonConfig });
    }
    
    window.eventBus.emit('rogue:boons-updated', this.getBoonSummary());
    return true;
  }

  /**
   * 添加诅咒
   */
  addCurse(curseConfig) {
    this.curses.push({ ...curseConfig });
    window.eventBus.emit('rogue:curses-updated', this.getCurseSummary());

    // curse_fragile_board 补偿：初始获得一个传说祝福
    if (curseConfig.id === 'curse_fragile_board') {
      const legendaries = this.pickRandomBoons(1, 'legendary');
      if (legendaries.length > 0) {
        this.addBoon(legendaries[0]);
        window.eventBus.emit('rogue:compensation-boon', {
          boon: legendaries[0],
          message: `脆弱棋盘的补偿：获得传说祝福 ${legendaries[0].icon} ${legendaries[0].name}`,
        });
      }
    }
  }

  /**
   * 应用所有祝福到发射器
   */
  applyToEmitters(emitters) {
    for (const boon of this.boons) {
      if (boon.apply && boon.category === 'production') {
        boon.apply(emitters);
      }
    }
    for (const curse of this.curses) {
      if (curse.penalty) curse.penalty(emitters);
      if (curse.compensator) curse.compensator();
    }
  }

  /**
   * 获取祝福对订单积分的倍率修正
   */
  getOrderRewardMultiplier() {
    let mult = 1.0;
    if (this.hasBoon('boon_rush_reward')) mult *= 1.3;
    if (this.hasCurse('curse_slow_growth')) mult *= 1.6; // compensation
    if (this.hasCurse('curse_greed_price')) mult *= 2.0;
    if (this.firstOrderInLevel && this.hasBoon('boon_high_price')) mult *= 3.0;
    return mult;
  }

  /** 标记本关首单已提交 */
  markFirstOrderSubmitted() {
    this.firstOrderInLevel = false;
  }

  /** 重置首单标记（进入新关卡时调用） */
  resetFirstOrderFlag() {
    this.firstOrderInLevel = true;
  }

  /**
   * 获取合成额外积分加成
   */
  getMergeBonus(elementLevel) {
    let bonus = 0;
    if (this.hasBoon('boon_merge_bonus')) bonus += 2;
    if (this.hasBoon('boon_exp_accumulate')) bonus += elementLevel * 2;
    return bonus;
  }

  /**
   * 检查是否拥有某祝福
   */
  hasBoon(boonId) {
    return this.boons.some(b => b.id === boonId);
  }

  /**
   * 检查是否拥有某诅咒
   */
  hasCurse(curseId) {
    return this.curses.some(c => c.id === curseId);
  }

  /**
   * 获取连击窗口修正
   */
  getComboWindow() {
    return this.hasBoon('boon_combo_master') ? 5000 : 3000;
  }

  /**
   * 是否免费刷新订单
   */
  isFreeRefresh() {
    return this.hasBoon('boon_free_refresh');
  }

  /**
   * 获取额外订单槽位数
   */
  getExtraOrderSlots() {
    return this.hasBoon('boon_demand_foresight') ? 1 : 0;
  }

  /**
   * 获取祝福摘要（用于UI展示）
   */
  getBoonSummary() {
    return this.boons.map(b => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      rarity: b.rarity,
      description: b.description,
      flavor: b.flavor,
      category: b.category,
    }));
  }

  /**
   * 获取诅咒摘要
   */
  getCurseSummary() {
    return this.curses.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      compensation: c.compensation,
    }));
  }

  /**
   * 按稀有度筛选可选的祝福（用于三选一）
   * @param {number} count - 返回数量
   * @param {string} [forceRarity] - 强制指定稀有度
   * @returns {Array} 候选祝福配置
   */
  pickRandomBoons(count = 3, forceRarity = null) {
    const excludeIds = this.boons.map(b => b.id);
    const candidates = BOON_POOL.filter(b => !excludeIds.includes(b.id));
    
    if (candidates.length === 0) return [];
    
    const picked = [];
    const pool = [...candidates];
    
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      let rarity = forceRarity;
      if (!rarity) {
        rarity = this._rollRarity();
      }
      const filtered = pool.filter(b => b.rarity === rarity);
      const source = filtered.length > 0 ? filtered : pool;
      const idx = Math.floor(Math.random() * source.length);
      picked.push(source[idx]);
      pool.splice(pool.indexOf(source[idx]), 1);
    }
    
    return picked;
  }

  /** 随机选取一个诅咒 */
  pickRandomCurse() {
    const idx = Math.floor(Math.random() * CURSE_POOL.length);
    return CURSE_POOL[idx];
  }

  /** 随机掷稀有度 */
  _rollRarity() {
    const entries = Object.entries(BOON_RARITY);
    const total = entries.reduce((s, [, v]) => s + v.weight, 0);
    let r = Math.random() * total;
    for (const [key, val] of entries) {
      r -= val.weight;
      if (r <= 0) return key;
    }
    return 'common';
  }

  /** 序列化 */
  serialize() {
    return {
      boonIds: this.boons.map(b => b.id),
      curseIds: this.curses.map(c => c.id),
      firstOrderInLevel: this.firstOrderInLevel,
    };
  }

  /** 反序列化 */
  deserialize(data) {
    this.reset();
    if (data.boonIds) {
      for (const id of data.boonIds) {
        const cfg = BOON_POOL.find(b => b.id === id);
        if (cfg) this.boons.push({ ...cfg });
      }
    }
    if (data.curseIds) {
      for (const id of data.curseIds) {
        const cfg = CURSE_POOL.find(c => c.id === id);
        if (cfg) this.curses.push({ ...cfg });
      }
    }
    this.firstOrderInLevel = data.firstOrderInLevel !== false;
  }
}