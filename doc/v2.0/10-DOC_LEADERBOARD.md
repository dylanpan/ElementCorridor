# 排行榜系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

记录玩家的最佳成绩（存活时间、最高积分），提供本地排行榜，激励玩家不断突破自我。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **记录维度** | 存活时间（秒）、最高积分、击败 Boss 数 |
| **存储方式** | localStorage 本地持久化 |
| **排行榜分类** | 本周最佳、历史最佳、最近 10 局 |
| **记录更新** | 游戏结束时自动更新 |
| **数据导出** | 支持一键复制成绩文本分享 |

### 1.3 排行榜展示

```
╔══════════════════════════════════╗
║      🏆 灵素回廊 · 战绩榜       ║
╠══════════════════════════════════╣
║ 历史最佳                         ║
║  ├ 存活时间：5分32秒             ║
║  ├ 最高积分：128                  ║
║  └ 击败 Boss：3                  ║
╠══════════════════════════════════╣
║ 最近 10 局                       ║
║  1. 3分45秒 · 92分 · Boss 2     ║
║  2. 5分32秒 · 128分 · Boss 3    ║
║  3. 2分10秒 · 45分 · Boss 1     ║
║  ...                             ║
╚══════════════════════════════════╝
```

### 1.4 设计意图

- **自我驱动**：看到自己的进步轨迹是最好的激励
- **社交分享**：成绩复制功能方便分享到群聊/朋友圈

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/LeaderboardSystem.js` —— 新增，排行榜核心
- `js/ui/UIManager.js` —— 排行榜 UI

### 2.2 LeaderboardSystem 类

```javascript
// js/systems/LeaderboardSystem.js
class LeaderboardSystem {
  static STORAGE_KEY = 'lingSu_leaderboard';

  constructor() {
    this.data = this._load();
  }

  /**
   * 记录一局游戏成绩
   */
  recordGame(stats) {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      survivalTime: stats.survivalTime || 0,
      score: stats.score || 0,
      bossesDefeated: stats.bossesDefeated || 0,
      ordersCompleted: stats.ordersCompleted || 0,
      mergesCount: stats.mergesCount || 0,
    };

    this.data.history.push(entryapsed);

    // 更新历史最佳
    if (entry.survivalTime > (this.data.best.survivalTime || 0)) {
      this.data.best.survivalTime = entry.survivalTime;
    }
    if (entry.score > (this.data.best.score || 0)) {
      this.data.best.score = entry.score;
    }
    if (entry.bossesDefeated > (this.data.best.bossesDefeated || 0)) {
      this.data.best.bossesDefeated = entry.bossesDefeated;
    }

    // 只保留最近 50 局
    if (this.data.history.length > 50) {
      this.data.history = this.data.history.slice(-50);
    }

    this._save();
  }

  /**
   * 获取历史最佳
   */
  getBest() {
    return { ...this.data.best };
  }

  /**
   * 获取最近 N 局
   */
  getRecent(count = 10) {
    return this.data.history.slice(-count).reverse();
  }

  /**
   * 格式化成绩文本（用于分享）
   */
  formatShareText(entry) {
    const minutes = Math.floor(entry.survivalTime / 60);
    const seconds = entry.survivalTime % 60;
    return [
      '🏆 灵素回廊 · 战绩',
      `⏱ 存活：${minutes}分${seconds}秒`,
      `⭐ 积分：${entry.score}`,
      `👹 击败 Boss：${entry.bossesDefeated} 个`,
      `📦 提交订单：${entry.ordersCompleted} 个`,
      `🔗 灵素回廊`,
    ].join('\n');
  }

  _load() {
    try {
      const raw = localStorage.getItem(LeaderboardSystem.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { best: {}, history: [] };
  }

  _save() {
    localStorage.setItem(LeaderboardSystem.STORAGE_KEY, JSON.stringify(this.data));
  }
}
```
