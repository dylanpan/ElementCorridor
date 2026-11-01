/**
 * ============================================================
 * 图鉴与统计系统
 * 记录游戏中遇到的祝福、诅咒、事件、Boss，
 * 以及玩家的历史战绩统计。
 * 数据持久化到 localStorage。
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
      return { ...this._defaultData(), ...data };
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

  // ==================== 图鉴系统 ====================

  /** 记录遇到的祝福 */
  recordBoon(boonId) {
    if (!this.data.bestiary.boons.includes(boonId)) {
      this.data.bestiary.boons.push(boonId);
      this.save();
    }
  }

  /** 记录遇到的诅咒 */
  recordCurse(curseId) {
    if (!this.data.bestiary.curses.includes(curseId)) {
      this.data.bestiary.curses.push(curseId);
      this.save();
    }
  }

  /** 记录遇到的事件 */
  recordEvent(eventId) {
    if (!this.data.bestiary.events.includes(eventId)) {
      this.data.bestiary.events.push(eventId);
      this.save();
    }
  }

  /** 记录遇到的Boss */
  recordBoss(bossId) {
    if (!this.data.bestiary.bosses.includes(bossId)) {
      this.data.bestiary.bosses.push(bossId);
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
}
