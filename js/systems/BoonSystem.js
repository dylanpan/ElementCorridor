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
    /** 诅咒阶段状态：{ curseId: currentStage } */
    this._curseStages = {};
    /** 缓慢生长永久累加（每5个订单额外+5%） */
    this._permanentGrowthCount = 0;
    /** 贪婪代价订单计数器 */
    this._greedOrderCount = 0;
    /** 脆弱棋盘封锁格列表 */
    this._blockedCells = [];
  }

  /** 重置（新局调用） */
  reset() {
    this.boons = [];
    this.curses = [];
    this.firstOrderInLevel = true;
    this._curseStages = {};
    this._permanentGrowthCount = 0;
    this._greedOrderCount = 0;
    this._blockedCells = [];
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
      // 如果有分阶段配置，按当前阶段应用效果
      if (curse.stageConfigs && curse.stageConfigs.length > 0) {
        const stage = this._curseStages[curse.id] || 1;
        const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
        if (stageCfg && stageCfg.apply) {
          stageCfg.apply(emitters);
        } else if (curse.penalty) {
          curse.penalty(emitters);
        }
      } else if (curse.penalty) {
        curse.penalty(emitters);
      }
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
   * 检查是否拥有某祝福（考虑创世之灵封印）
   */
  hasBoon(boonId) {
    if (this.sealedBoons && this.sealedBoons.includes(boonId)) return false;
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
    return this.curses.map(c => {
      const stage = this._curseStages[c.id] || 1;
      const stageCfg = c.stageConfigs ? c.stageConfigs.find(s => s.stage === stage) : null;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        description: stageCfg ? stageCfg.desc : c.description,
        compensation: c.compensation,
        currentStage: stage,
        totalStages: c.stageConfigs ? c.stageConfigs.length : 1,
      };
    });
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

  // ==================== 诅咒分阶段升级系统 ====================

  /**
   * 检查诅咒是否需要升级（按当前层数）
   * @param {number} floor - 当前层数
   * @returns {Array} 升级了的诅咒列表 [{ curseId, stage, desc }]
   */
  checkCurseProgression(floor) {
    const upgraded = [];

    for (const curse of this.curses) {
      if (!curse.stageConfigs || curse.stageConfigs.length === 0) continue;

      const currentStage = this._curseStages[curse.id] || 0;

      // 查找可以升级到的最高阶段
      let newStage = currentStage;
      for (const cfg of curse.stageConfigs) {
        if (cfg.stage > newStage && floor >= cfg.triggerFloor) {
          newStage = cfg.stage;
        }
      }

      if (newStage > currentStage) {
        this._curseStages[curse.id] = newStage;
        upgraded.push({ curseId: curse.id, stage: newStage, desc: this._getStageDesc(curse, newStage) });
      }
    }

    // 如果有诅咒升级，发射事件通知UI
    if (upgraded.length > 0) {
      window.eventBus.emit('rogue:curse-upgraded', upgraded);
    }

    return upgraded;
  }

  /**
   * 应用指定诅咒的指定阶段效果到发射器
   * @param {string} curseId - 诅咒ID
   * @param {number} stage - 目标阶段
   * @param {Array} emitters - 发射器数组
   */
  applyCurseStage(curseId, stage, emitters) {
    const curse = this.curses.find(c => c.id === curseId);
    if (!curse || !curse.stageConfigs) return;

    const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
    if (!stageCfg) return;

    // 如果有 apply 函数则执行
    if (stageCfg.apply && emitters) {
      stageCfg.apply(emitters);
    }

    // 处理额外效果
    if (stageCfg.extraEffect === 'permanentGrowth') {
      this._permanentGrowthCount = 0; // 重置计数器
    }
  }

  /**
   * 获取诅咒当前阶段
   * @param {string} curseId
   * @returns {number}
   */
  getCurseStage(curseId) {
    return this._curseStages[curseId] || 0;
  }

  /**
   * 获取诅咒当前阶段的配置
   * @param {string} curseId
   * @returns {object|null}
   */
  getCurseStageConfig(curseId) {
    const curse = this.curses.find(c => c.id === curseId);
    if (!curse || !curse.stageConfigs) return null;

    const stage = this._curseStages[curseId] || 1;
    return curse.stageConfigs.find(s => s.stage === stage) || null;
  }

  /**
   * 获取所有诅咒的阶段摘要（用于UI展示）
   * @returns {Array}
   */
  getCurseStagesSummary() {
    return this.curses.map(c => {
      const stage = this._curseStages[c.id] || 1;
      const stageCfg = c.stageConfigs ? c.stageConfigs.find(s => s.stage === stage) : null;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        currentStage: stage,
        totalStages: c.stageConfigs ? c.stageConfigs.length : 1,
        description: stageCfg ? stageCfg.desc : c.description,
        compensation: c.compensation,
      };
    });
  }

  /** 获取阶段描述文本 */
  _getStageDesc(curse, stage) {
    if (!curse.stageConfigs) return '';
    const cfg = curse.stageConfigs.find(s => s.stage === stage);
    return cfg ? cfg.desc : '';
  }

  /** 缓慢生长：每提交5个订单额外+5%冷却惩罚 */
  onOrderSubmittedForSlowGrowth(emitters) {
    if (!this.hasCurse('curse_slow_growth')) return;
    const stage = this._curseStages['curse_slow_growth'] || 1;
    if (stage < 3) return; // 仅阶段3有永久累加效果

    this._permanentGrowthCount++;
    if (this._permanentGrowthCount >= 5) {
      this._permanentGrowthCount = 0;
      emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 1.05; });
      window.eventBus.emit('notification', {
        message: '🐢 缓慢生长加剧！冷却惩罚 +5%',
        type: 'warning',
      });
    }
  }

  /** 贪婪代价：检查是否需要消耗元素 */
  shouldConsumeForGreedPrice() {
    if (!this.hasCurse('curse_greed_price')) return false;
    const stage = this._curseStages['curse_greed_price'] || 1;
    const curse = this.curses.find(c => c.id === 'curse_greed_price');
    if (!curse || !curse.stageConfigs) return false;

    const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
    if (!stageCfg) return false;

    this._greedOrderCount++;
    if (this._greedOrderCount >= stageCfg.orderInterval) {
      this._greedOrderCount = 0;
      return true;
    }
    return false;
  }

  /** 获取贪婪代价消耗的最低元素等级 */
  getGreedMinLevel() {
    if (!this.hasCurse('curse_greed_price')) return 1;
    const stage = this._curseStages['curse_greed_price'] || 1;
    const curse = this.curses.find(c => c.id === 'curse_greed_price');
    if (!curse || !curse.stageConfigs) return 1;
    const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
    return stageCfg ? stageCfg.minLevel : 1;
  }

  /** 获取元素混淆的随机产出概率 */
  getConfusionRandomChance() {
    if (!this.hasCurse('curse_element_confusion')) return 0;
    const stage = this._curseStages['curse_element_confusion'] || 1;
    const curse = this.curses.find(c => c.id === 'curse_element_confusion');
    if (!curse || !curse.stageConfigs) return 0.3;
    const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
    return stageCfg ? stageCfg.randomChance : 0.3;
  }

  /** 是否处于元素混淆阶段3（需要交换元素） */
  shouldSwapElementsOnLevelStart() {
    if (!this.hasCurse('curse_element_confusion')) return false;
    const stage = this._curseStages['curse_element_confusion'] || 1;
    return stage >= 3;
  }

  /** 获取脆弱棋盘封锁格数量 */
  getFragileBlockCount() {
    if (!this.hasCurse('curse_fragile_board')) return 0;
    const stage = this._curseStages['curse_fragile_board'] || 1;
    const curse = this.curses.find(c => c.id === 'curse_fragile_board');
    if (!curse || !curse.stageConfigs) return 0;
    const stageCfg = curse.stageConfigs.find(s => s.stage === stage);
    return stageCfg ? (stageCfg.blockCount || 0) : 0;
  }

  /** 设置/获取被封锁的格子 */
  setBlockedCells(cells) { this._blockedCells = cells; }
  getBlockedCells() { return [...this._blockedCells]; }

  /** 获取脆弱棋盘棋盘缩减配置 */
  getFragileBoardReduction() {
    if (!this.hasCurse('curse_fragile_board')) return { colsReduce: 0, rowsReduce: 0 };
    const stage = this._curseStages['curse_fragile_board'] || 1;
    const curse = this.curses.find(c => c.id === 'curse_fragile_board');
    if (!curse || !curse.stageConfigs) return { colsReduce: 0, rowsReduce: 0 };

    let totalColsReduce = 0;
    let totalRowsReduce = 0;
    for (const cfg of curse.stageConfigs) {
      if (cfg.stage <= stage) {
        totalColsReduce += cfg.colsReduce || 0;
        totalRowsReduce += cfg.rowsReduce || 0;
      }
    }
    return { colsReduce: totalColsReduce, rowsReduce: totalRowsReduce };
  }
}