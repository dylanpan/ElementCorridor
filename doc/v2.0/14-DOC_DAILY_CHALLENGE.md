# 每日挑战 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

提供每日一次的固定种子挑战——所有玩家当天面对的订单序列、元素掉落完全相同，比拼谁能在相同条件下获得更高分数。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **刷新时间** | 每天 UTC 0:00 刷新 |
| **种子机制** | 基于日期的确定性随机种子，确保所有玩家当天挑战相同 |
| **挑战次数** | 每天免费 3 次，之后可观看广告/消耗道具增加次数 |
| **计分规则** | 与生存模式相同，取当日最高分 |
| **排行榜** | 仅显示当日好友/全局排名 |

### 1.3 种子算法

```javascript
/**
 * 基于日期生成确定性种子
 * @param {Date} date - 日期
 * @returns {number} 种子值
 */
function generateDailySeed(date) {
  const d = date || new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // 简单的哈希：年月日组合
  return y * 10000 + m * 100 + day;
}
```

### 1.4 设计意图

- **公平竞技**：相同种子确保所有玩家起点一致
- **每日仪式感**：每天打开游戏的第一件事就是挑战今日种子
- **社区话题**：玩家可以讨论今日挑战的策略

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/DailyChallenge.js` —— 新增，每日挑战核心
- `js/utils/SeededRandom.js` —— 确定性随机数生成器

### 2.2 SeededRandom 类

```javascript
// js/utils/SeededRandom.js
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  /**
   * 生成 [0, 1) 之间的伪随机数
   */
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }

  /**
   * 生成 [min, max) 之间的整数
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * 从数组中随机选取一个元素
   */
  pick(array) {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * 洗牌数组
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
```

### 2.3 DailyChallenge 类

```javascript
// js/systems/DailyChallenge.js
class DailyChallenge {
  static STORAGE_KEY = 'lingSu_daily';

  constructor(gameEngine) {
    this.engine = gameEngine;
    this.todaySeed = this._getTodaySeed();
    this.data = this._load();
  }

  /**
   * 获取今日种子
   */
  _getTodaySeed() {
    const now = new Date();
    return now.getUTCFullYear() * 10000 +
      (now.getUTCMonth() + 1) * 100 +
      now.getUTCDate();
  }

  /**
   * 检查今日是否已挑战过
   */
  hasPlayedToday() {
    return this.data.lastPlayedDate === this.todaySeed;
  }

  /**
   * 获取今日剩余挑战次数
   */
  getRemainingAttempts() {
    if (this.hasPlayedToday()) {
      return Math.max(0, 3 - (this.data.todayAttempts || 0));
    }
    return 3;
  }

  /**
   * 开始今日挑战
   * @returns {boolean} 是否可开始
   */
  startChallenge() {
    if (this.getRemainingAttempts() <= 0) return false;

    if (!this.hasPlayedToday()) {
      this.data.lastPlayedDate = this.todaySeed;
      this.data.todayAttempts = 0;
      this.data.todayBestScore = 0;
    }

    this.data.todayAttempts++;
    this._save();

    // 注入种子到游戏系统
    this.engine._random = new SeededRandom(this.todaySeed);
    return true;
  }

  /**
   * 记录成绩
   */
  recordScore(score) {
    if (score > (this.data.todayBestScore || 0)) {
      this.data.todayBestScore = score;
      this._save();
    }
  }

  /**
   * 获取今日最佳
   */
  getTodayBest() {
    return this.data.todayBestScore || 0;
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(DailyChallenge.STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }

  _save() {
    localStorage.setItem(DailyChallenge.STORAGE_KEY, JSON.stringify(this.data));
  }
}
```
