/**
 * ============================================================
 * 局外成长系统 —— 跨局的永久性升级
 * 包括天赋树、星尘经济、图鉴收藏。
 * 数据持久化到 localStorage，独立于游戏存档。
 * ============================================================
 */
class MetaProgress {
  static STORAGE_KEY = 'merge_game_meta';

  constructor() {
    this.data = this._load();
  }

  /** 默认初始数据 */
  _defaultData() {
    return {
      stardust: 0,           // 星尘
      trophies: 0,           // 奖杯
      shards: 0,             // 碎片
      
      // 天赋解锁状态
      talents: {
        extra_boon_slot_1: false,
        extra_boon_slot_2: false,
        extra_boon_slot_3: false,
        start_gold_50: false,
        start_gold_100: false,
        start_gold_200: false,
        extra_board_2: false,
        permanent_cooldown_5: false,
        permanent_cooldown_10: false,
        permanent_cooldown_20: false,
        choose_from_4: false,
        free_first_refresh: false,
        carry_boon: false,
        unlock_hidden_element: false,
      },
      
      // 图鉴
      bestiary: {
        boons: [],
        curses: [],
        events: [],
        bosses: [],
      },
      
      // 统计
      stats: {
        totalRuns: 0,
        wins: 0,
        bestFloor: 0,
        highestScore: 0,
        totalStardustEarned: 0,
        // 最佳评级记录（按关卡编号索引）
        bestRatings: {},
      },
      
      // 每日挑战记录
      dailyChallenge: {
        lastDate: '',
        completed: false,
      },
    };
  }

  /** 加载存档 */
  _load() {
    try {
      const raw = localStorage.getItem(MetaProgress.STORAGE_KEY);
      if (!raw) return this._defaultData();
      const data = JSON.parse(raw);
      // 合并默认值，防止版本升级缺少字段
      return { ...this._defaultData(), ...data, talents: { ...this._defaultData().talents, ...(data.talents || {}) } };
    } catch {
      return this._defaultData();
    }
  }

  /** 保存 */
  save() {
    try {
      localStorage.setItem(MetaProgress.STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error('[MetaProgress] 保存失败:', err);
    }
  }

  // ==================== 星尘经济 ====================

  /** 添加星尘 */
  addStardust(amount) {
    this.data.stardust += amount;
    this.data.stats.totalStardustEarned += amount;
    this.save();
  }

  /** 消耗星尘 */
  spendStardust(amount) {
    if (this.data.stardust < amount) return false;
    this.data.stardust -= amount;
    this.save();
    return true;
  }

  /** 获取星尘数 */
  getStardust() { return this.data.stardust; }

  /** 添加奖杯 */
  addTrophies(amount) {
    this.data.trophies += amount;
    this.save();
  }

  /** 获取奖杯数 */
  getTrophies() { return this.data.trophies; }

  // ==================== 天赋系统 ====================

  /** 天赋配置定义 */
  static TALENT_DEFS = {
    extra_boon_slot_1: {
      name: '祝福槽 +1',
      description: '可同时持有的祝福数量增加 1 个',
      cost: 50,
      type: 'stardust',
      requires: [],
      icon: '🔮',
      maxLevel: 1,
    },
    extra_boon_slot_2: {
      name: '祝福槽 +2',
      description: '可同时持有的祝福数量再增加 1 个',
      cost: 150,
      type: 'stardust',
      requires: ['extra_boon_slot_1'],
      icon: '🔮',
      maxLevel: 1,
    },
    extra_boon_slot_3: {
      name: '祝福槽 +3',
      description: '可同时持有的祝福数量再增加 1 个',
      cost: 300,
      type: 'trophy',
      requires: ['extra_boon_slot_2'],
      icon: '🔮',
      maxLevel: 1,
    },
    start_gold_50: {
      name: '初始金币 +50',
      description: '每局开始时额外获得 50 金币',
      cost: 30,
      type: 'stardust',
      requires: [],
      icon: '🪙',
      maxLevel: 1,
    },
    start_gold_100: {
      name: '初始金币 +100',
      description: '每局开始时额外获得 100 金币',
      cost: 80,
      type: 'stardust',
      requires: ['start_gold_50'],
      icon: '🪙',
      maxLevel: 1,
    },
    start_gold_200: {
      name: '初始金币 +200',
      description: '每局开始时额外获得 200 金币',
      cost: 200,
      type: 'trophy',
      requires: ['start_gold_100'],
      icon: '🪙',
      maxLevel: 1,
    },
    extra_board_2: {
      name: '棋盘扩张',
      description: '棋盘默认增加 2 个格子',
      cost: 60,
      type: 'stardust',
      requires: [],
      icon: '📐',
      maxLevel: 1,
    },
    permanent_cooldown_5: {
      name: '永久加速 I',
      description: '所有发射器冷却永久减少 5%',
      cost: 40,
      type: 'stardust',
      requires: [],
      icon: '⚡',
      maxLevel: 1,
    },
    permanent_cooldown_10: {
      name: '永久加速 II',
      description: '所有发射器冷却永久减少 10%',
      cost: 120,
      type: 'stardust',
      requires: ['permanent_cooldown_5'],
      icon: '⚡',
      maxLevel: 1,
    },
    permanent_cooldown_20: {
      name: '永久加速 III',
      description: '所有发射器冷却永久减少 20%',
      cost: 300,
      type: 'trophy',
      requires: ['permanent_cooldown_10'],
      icon: '⚡',
      maxLevel: 1,
    },
    choose_from_4: {
      name: '更多选择',
      description: '开局祝福可选数量从 3 增加到 4',
      cost: 150,
      type: 'stardust',
      requires: [],
      icon: '🃏',
      maxLevel: 1,
    },
    free_first_refresh: {
      name: '首次免费',
      description: '每层第一次刷新订单不消耗积分',
      cost: 80,
      type: 'stardust',
      requires: [],
      icon: '🎁',
      maxLevel: 1,
    },
    carry_boon: {
      name: '传承祝福',
      description: '允许携带 1 个祝福到下一局（需消耗碎片锁定）',
      cost: 200,
      type: 'trophy',
      requires: [],
      icon: '🏅',
      maxLevel: 1,
    },
    unlock_hidden_element: {
      name: '隐藏元素',
      description: '解锁隐藏元素类型「暗影」',
      cost: 500,
      type: 'trophy',
      requires: ['choose_from_4'],
      icon: '👻',
      maxLevel: 1,
    },
  };

  /** 检查天赋是否已解锁 */
  isTalentUnlocked(talentId) {
    return !!this.data.talents[talentId];
  }

  /** 尝试解锁天赋 */
  unlockTalent(talentId) {
    const def = MetaProgress.TALENT_DEFS[talentId];
    if (!def) return { success: false, reason: '天赋不存在' };
    if (this.isTalentUnlocked(talentId)) return { success: false, reason: '已解锁' };

    // 检查前置条件
    for (const req of def.requires) {
      if (!this.isTalentUnlocked(req)) {
        return { success: false, reason: `需要先解锁前置天赋` };
      }
    }

    // 检查资源
    if (def.type === 'stardust') {
      if (this.data.stardust < def.cost) return { success: false, reason: `星尘不足，需要 ${def.cost}` };
      this.data.stardust -= def.cost;
    } else if (def.type === 'trophy') {
      if (this.data.trophies < def.cost) return { success: false, reason: `奖杯不足，需要 ${def.cost}` };
      this.data.trophies -= def.cost;
    }

    this.data.talents[talentId] = true;
    this.save();
    return { success: true };
  }

  /** 获取已激活的天赋效果列表 */
  getActiveEffects() {
    const effects = {};
    if (this.data.talents.extra_boon_slot_1) effects.extraBoonSlots = 1;
    if (this.data.talents.extra_boon_slot_2) effects.extraBoonSlots = 2;
    if (this.data.talents.extra_boon_slot_3) effects.extraBoonSlots = 3;
    if (this.data.talents.start_gold_50) effects.startGold = 50;
    if (this.data.talents.start_gold_100) effects.startGold = 100;
    if (this.data.talents.start_gold_200) effects.startGold = 200;
    if (this.data.talents.extra_board_2) effects.extraBoardCells = 2;
    if (this.data.talents.permanent_cooldown_5) effects.permanentCooldown = 0.05;
    if (this.data.talents.permanent_cooldown_10) effects.permanentCooldown = 0.10;
    if (this.data.talents.permanent_cooldown_20) effects.permanentCooldown = 0.20;
    if (this.data.talents.choose_from_4) effects.initialBoonChoices = 4;
    if (this.data.talents.free_first_refresh) effects.freeFirstRefresh = true;
    if (this.data.talents.carry_boon) effects.canCarryBoon = true;
    if (this.data.talents.unlock_hidden_element) effects.hiddenElement = true;
    return effects;
  }

  // ==================== 图鉴系统 ====================

  /** 记录遇到的祝福 */
  recordBoon(boonId) {
    if (!this.data.bestiary.boons.includes(boonId)) {
      this.data.bestiary.boons.push(boonId);
      this.addStardust(5); // 收集奖励
      this.save();
    }
  }

  /** 记录遇到的诅咒 */
  recordCurse(curseId) {
    if (!this.data.bestiary.curses.includes(curseId)) {
      this.data.bestiary.curses.push(curseId);
      this.addStardust(5);
      this.save();
    }
  }

  /** 记录遇到的事件 */
  recordEvent(eventId) {
    if (!this.data.bestiary.events.includes(eventId)) {
      this.data.bestiary.events.push(eventId);
      this.addStardust(3);
      this.save();
    }
  }

  /** 记录遇到的Boss */
  recordBoss(bossId) {
    if (!this.data.bestiary.bosses.includes(bossId)) {
      this.data.bestiary.bosses.push(bossId);
      this.addStardust(10);
      this.save();
    }
  }

  /** 获取图鉴完成度 */
  getBestiaryProgress() {
    const total = BOON_POOL.length + CURSE_POOL.length +
      Object.values(EVENT_POOL).flat().length + BOSS_CONFIGS.length;
    const collected = this.data.bestiary.boons.length + this.data.bestiary.curses.length +
      this.data.bestiary.events.length + this.data.bestiary.bosses.length;
    return { collected, total, percent: total > 0 ? Math.round(collected / total * 100) : 0 };
  }

  // ==================== 统计 ====================

  /** 记录一局结束 */
  recordRun(won, floorReached, score) {
    this.data.stats.totalRuns++;
    if (won) this.data.stats.wins++;
    if (floorReached > this.data.stats.bestFloor) this.data.stats.bestFloor = floorReached;
    if (score > this.data.stats.highestScore) this.data.stats.highestScore = score;
    this.save();
  }

  /**
   * 记录最佳评级
   * @param {number} level - 关卡编号
   * @param {object} rating - 评级数据（含 overall.grade 等）
   */
  recordBestRating(level, rating) {
    const key = `level_${level}`;
    const existing = this.data.stats.bestRatings[key];
    // 等级分数映射：S=5, A=4, B=3, C=2, D=1
    const gradeScore = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const newScore = gradeScore[rating.overall.grade] || 0;
    const oldScore = existing ? (gradeScore[existing.overallGrade] || 0) : 0;

    if (!existing || newScore > oldScore) {
      this.data.stats.bestRatings[key] = {
        overallGrade: rating.overall.grade,
        overallTitle: rating.overall.title,
        dimensions: {
          speed: rating.dimensions.speed.grade,
          combo: rating.dimensions.combo.grade,
          efficiency: rating.dimensions.efficiency.grade,
          merge: rating.dimensions.merge.grade,
        },
        stats: { ...rating.stats },
        achievedAt: Date.now(),
      };
      this.save();
    }
  }

  /** 获取统计数据 */
  getStats() {
    return { ...this.data.stats };
  }

  /** 结算星尘奖励 */
  calculateStardustReward(floorReached, won, boonsCollected) {
    let reward = floorReached * 3;
    if (won) reward += 20;
    reward += boonsCollected * 2;
    return Math.floor(reward);
  }
}