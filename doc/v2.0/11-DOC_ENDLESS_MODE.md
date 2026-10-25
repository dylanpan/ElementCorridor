# 无尽模式 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

在击败最终 Boss 后开启无尽模式——没有终点，难度随时间持续递增，比拼玩家能存活多久、获得多少积分。为追求极限的玩家提供终极挑战。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **解锁条件** | 击败最终 Boss（通关肉鸽模式）后解锁 |
| **难度递增** | 每 30 秒难度提升一级，共 ∞ 级 |
| **难度参数** | 订单时间缩短 5%/级、发射器冷却 +3%/级、高品质订单概率 +2%/级 |
| **结束条件** | 积分 ≤ 0 或棋盘满且无护盾 |
| **记录保存** | 最高存活时间和最高积分保存在 localStorage |

### 1.3 难度曲线

| 阶段 | 时间 | 特点 |
|---|---|---|
| 平稳期 | 0~60 秒 | 基础难度，适应节奏 |
| 上升期 | 60~180 秒 | 难度稳步提升，需要开始使用道具 |
| 高压期 | 180~300 秒 | 订单时间显著缩短，高品质订单增多 |
| 极限期 | 300 秒+ | 几乎每秒都有订单超时风险，需要完美运营 |

### 1.4 设计意图

- **终局内容**：为通关玩家提供继续游玩的理由
- **自我超越**：每次挑战都追求比上一次活得更久、分数更高
- **社区话题**：无尽模式的最高分/最长存活时间可作为玩家间的谈资

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/EndlessMode.js` —— 新增，无尽模式核心
- `js/core/GameEngine.js` —— 无尽模式启动与状态管理
- `js/ui/UIManager.js` —— 无尽模式 UI

### 2.2 EndlessMode 类

```javascript
// js/systems/EndlessMode.js
class EndlessMode {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.active = false;
    this.difficultyLevel = 0;
    this.startTime = 0;
    this._lastLevelUpTime = 0;
  }

  static STORAGE_KEY = 'lingSu_endless_record';

  /**
   * 启动无尽模式
   */
  start() {
    this.active = true;
    this.difficultyLevel = 0;
    this.startTime = Date.now();
    this._lastLevelUpTime = this.startTime;

    // 应用初始难度
    this._applyDifficulty();

    window.eventBus.emit('endless:started', {
      level: 0,
    });
  }

  /**
   * 每帧更新
   */
  tick(now) {
    if (!this.active) return;

    // 每 30 秒提升难度
    if (now - this._lastLevelUpTime >= 30000) {
      this.difficultyLevel++;
      this._lastLevelUpTime = now;
      this._applyDifficulty();

      window.eventBus.emit('endless:level-up', {
        level: this.difficultyLevel,
      });
    }
  }

  /**
   * 应用当前难度
   */
  _applyDifficulty() {
    const lv = this.difficultyLevel;

    // 订单时间缩短（每级 -5%，最多 -75%）
    const orderTimeMult = Math.max(0.25, 1 - lv * 0.05 proiektuak);
    this.engine._endlessOrderTimeMultiplier = orderTimeMult;

    // 发射器冷却增加（每级 +3%，最多 +150%）
    const cooldownMult = Math.min(2.5, 1 + lv * 0.03);
    this.engine._eventCtx.emitterSpeedMultiplier = 1 / cooldownMult;

    // 高品质概率增加（每级 +2%，最多 +60%）
    const qualityBonus = Math.min(0.6, lv * 0.02);
    this.engine._endlessQualityBonus = qualityBonus;
  }

  /**
   * 获取当前存活时间（秒）
   */
  getSurvivalTime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * 停止无尽模式
   */
  stop() {
    if (!this.active) return;
    this.active = false;

    // 保存记录
    const survivalTime = this.getSurvivalTime();
    const score = this.engine.state.score;
    this._saveRecord(survivalTime, scoreipse);
  }

  /**
   * 保存最高记录
   */
  _saveRecord(survivalTime, score) {
    try {
      const record = JSON.parse(localStorage.getItem(EndlessMode.STORAGE_KEY) || '{}');
      if (survivalTime > (record.bestTime || 0)) record.bestTime = survivalTime;
      if (score > (record.bestScore || 0)) record.bestScore = score;
      record.lastTime = survivalTime;
      record.lastScore = score;
      localStorage.setItem(EndlessMode.STORAGE_KEY, JSON.stringify(record));
    } catch (e) { /* ignore */ }
  }

  /**
   * 获取历史记录
   */
  getRecord() {
    try {
      return JSON.parse(localStorage.getItem(EndlessMode.STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }
}
```

### 2.3 在 GameEngine 中集成

```javascript
constructor() {
  // ...
  this.endlessMode = new EndlessMode(this);
  this._endlessOrderTimeMultiplier = 1;
  this._endlessQualityBonus = 0;
}

// 通关后启动无尽模式
_onLevelComplete() {
  // ...原有通关逻辑...

  // 如果是最终 Boss 胜利，询问是否进入无尽模式
  if (this._bossState.isActive && this._bossState.bossId === 'boss_creation_spirit') {
    window.eventBus.emit('endless:offer', {});
  }
}

// 游戏循环中更新
_gameLoop(timestamp) {
  // ...
  this.endlessMode.tick(Date.now());
}
```
