# 无尽模式 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

在击败最终 Boss 后开启无尽模式——没有终点，难度随时间持续递增，比拼玩家能存活多久、获得多少积分。为追求极限的玩家提供终极挑战。

### 1.2 解锁与入口

| 规则项 | 说明 |
|---|---|
| **解锁条件** | 首次通关肉鸽模式（击败最终 Boss）后解锁 |
| **入口位置** | 首次通关后，游戏开始的弹窗中新增「无尽模式」按钮，与「开始游戏」并列 |
| **关卡性质** | 整个无尽模式作为一个独立关卡，由 EndlessMode 接管游戏循环，不经过普通关卡的路线图选择 |
| **保存状态** | 解锁状态保存在 localStorage，后续启动游戏时直接显示入口 |

#### 入口界面示意

```
┌─────────────────────────────┐
│      🌿 灵素回廊             │
│                             │
│   🏆 上次成绩：存活 128 秒    │
│     最高积分：2450           │
│                             │
│  ┌─────────┐ ┌───────────┐  │
│  │ ▶ 开始游戏│ │ ♾ 无尽模式  │  │
│  └─────────┘ └───────────┘  │
│                             │
│  [升级] [图鉴] [设置]        │
└─────────────────────────────┘
```

### 1.3 核心规则

| 规则项 | 说明 |
|---|---|
| **难度递增** | 每 30 秒难度提升一级，共 ∞ 级 |
| **难度参数** | 订单时间缩短 5%/级、发射器冷却 +3%/级、高品质订单概率 +2%/级 |
| **结束条件** | 积分 ≤ 0 或棋盘满且无护盾 |
| **记录保存** | 最高存活时间和最高积分保存在 localStorage |

### 1.4 难度曲线

| 阶段 | 时间 | 特点 |
|---|---|---|
| 平稳期 | 0~60 秒 | 基础难度，适应节奏 |
| 上升期 | 60~180 秒 | 难度稳步提升，开始出现危机事件 |
| 高压期 | 180~300 秒 | 订单时间显著缩短，高品质订单增多，危机事件频发 |
| 极限期 | 300 秒+ | 几乎每秒都有订单超时风险，需要完美运营 |

### 1.5 无尽模式独占内容

以下系统仅在无尽模式中触发，普通关卡模式（肉鸽通关流程）不会触发：

| 系统 | 说明 |
|---|---|
| **道具系统** | 道具的自动获取（时间停滞/元素风暴等）、使用、UI 展示仅在无尽模式可用。普通关卡中道具栏隐藏，不生成道具 |
| **危机事件系统** | 危机事件的随机触发、事件效果、事件横幅仅在无尽模式可用。普通关卡中不触发任何危机事件 |

#### 设计理由

- **普通关卡聚焦核心体验**：肉鸽通关流程已包含祝福、诅咒、Boss 战等丰富机制，再加入道具和危机事件会增加认知负担
- **无尽模式需要更多策略维度**：无尽模式难度持续递增，道具和危机事件提供了必要的策略深度和容错手段
- **差异化体验**：普通关卡是「探索与成长」，无尽模式是「极限生存」，两者应有不同的机制组合

### 1.6 设计意图

- **终局内容**：为通关玩家提供继续游玩的理由
- **自我超越**：每次挑战都追求比上一次活得更久、分数更高
- **社区话题**：无尽模式的最高分/最长存活时间可作为玩家间的谈资

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/EndlessMode.js` —— 新增，无尽模式核心
- `js/core/GameEngine.js` —— 无尽模式启动与状态管理
- `js/ui/UIManager.js` —— 无尽模式入口 UI 与状态展示
- `js/systems/ItemSystem.js` —— 道具系统（仅在无尽模式初始化）
- `js/systems/CrisisSystem.js` —— 危机事件系统（仅在无尽模式初始化）

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
  static UNLOCK_KEY = 'lingSu_endless_unlocked';

  /**
   * 检查是否已解锁
   */
  static isUnlocked() {
    try {
      return localStorage.getItem(EndlessMode.UNLOCK_KEY) === 'true';
    } catch (e) { return false; }
  }

  /**
   * 解锁无尽模式（首次通关后调用）
   */
  static unlock() {
    try {
      localStorage.setItem(EndlessMode.UNLOCK_KEY, 'true');
    } catch (e) { /* ignore */ }
  }

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

    // 初始化无尽模式独占系统
    this._initExclusiveSystems();

    window.eventBus.emit('endless:started', {
      level: 0,
    });
  }

  /**
   * 初始化无尽模式独占系统（道具 + 危机事件）
   */
  _initExclusiveSystems() {
    // 初始化道具系统
    if (this.engine.itemSystem) {
      this.engine.itemSystem.init();
      this.engine.itemSystem.setEnabled(true);
    }

    // 初始化危机事件系统
    if (this.engine.crisisSystem) {
      this.engine.crisisSystem.reset();
      this.engine.crisisSystem.setEnabled(true);
    }
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
    const orderTimeMult = Math.max(0.25, 1 - lv * 0.05);
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
    this._saveRecord(survivalTime, score,$score);

    // 禁用独占系统
    if (this.engine.itemSystem) {
      this.engine.itemSystem.setEnabled(false);
      this.engine.itemSystem.destroy();
    }
    if (this.engine.crisisSystem) {
      this.engine.crisisSystem.setEnabled(false);
    }
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
  this._isEndlessMode = false; // 标记当前是否为无尽模式
}

// 通关后解锁无尽模式
_onLevelComplete() {
  // ...原有通关逻辑...

  // 如果是最终 Boss 胜利，解锁无尽模式
  if (this._bossState.isActive && this._bossState.bossId === 'boss_creation_spirit') {
    EndlessMode.unlock();
    window.eventBus.emit('endless:unlocked', {});
  }
}

// 启动无尽模式
startEndlessMode() {
  this._isEndlessMode = true;
  this.endlessMode.start();
  // 使用基础难度配置启动游戏循环
  this.startRogueLevel(999999, { type: 'endless', difficulty: 'normal' });
}

// 游戏循环中更新
_gameLoop(timestamp) {
  // ...
  if (this._isEndlessMode) {
    this.endlessMode.tick(Date.now());
  }
}
```

### 2.4 道具系统改动（ItemSystem.js）

```javascript
class ItemSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.items = {};
    this._timers = {};
    this._enabled = false; // 默认禁用，仅在无尽模式启用
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    // 更新 UI 显示
    const itemBar = document.getElementById('item-bar');
    if (itemBar) {
      itemBar.style.display = enabled ? 'flex' : 'none';
    }
  }

  /**
   * 初始化道具系统
   */
  init() {
    if (!this._enabled) return;
    // 初始赠送
    this.addItem('skip_order', 2);
    this.addItem('element_storm', 1);
    // 自动获取定时器
    this._startAutoGrant();
  }

  // ...其余方法保持不变，但在方法开头检查 this._enabled ...
}
```

### 2.5 危机事件系统改动（CrisisSystem.js）

```javascript
class CrisisSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this._activeEvent = null;
    this._immuneUntil = 0;
    this._nextCheckTime = 0;
    this._originalState = {};
    this._enabled = false; // 默认禁用，仅在无尽模式启用
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled && this._activeEvent) {
      // 禁用时立即结束当前事件
      this._activeEvent.def.revert(this);
      this._activeEvent = null;
    }
  }

  /**
   * 每帧检查是否触发事件
   */
  tick(now) {
    if (!this._enabled) return;
    // ...原有逻辑...
  }

  // ...其余方法保持不变，但在方法开头检查 this._enabled ...
}
```

### 2.6 入口 UI（UIManager.js）

```javascript
// 在 showMainMenu 或游戏开始弹窗中
_showStartDialog() {
  // ...原有弹窗内容...

  // 检查无尽模式是否已解锁
  if (EndlessMode.isUnlocked()) {
    const endlessBtn = document.createElement('button');
    endlessBtn.className = 'modal-btn endless-btn';
    endlessBtn.textContent = '♾ 无尽模式';
    endlessBtn.addEventListener('click', () => {
      this.hideModal();
      if (window.__gameEngine) {
        window.__gameEngine.startEndlessMode();
      }
    });
    modalFooter.appendChild(endlessBtn);
  }
}
```

### 2.7 普通关卡中的系统隔离

在 `startRogueLevel` 中确保普通关卡不触发独占系统：

```javascript
startRogueLevel(targetScore, node) {
  // ...

  // 普通关卡：禁用道具系统和危机事件系统
  if (!this._isEndlessMode) {
    if (this.itemSystem) {
      this.itemSystem.setEnabled(false);
      this.itemSystem.destroy();
    }
    if (this.crisisSystem) {
      this.crisisSystem.setEnabled(false);
    }
  }

  // ...
}
```

---

## 三、开发优先级

| 优先级 | 任务 | 依赖 |
|---|---|---|
| P0 | EndlessMode 核心类（难度递增、tick 循环） | 无 |
| P0 | 通关解锁 + 入口 UI | GameEngine 通关逻辑 |
| P1 | 道具系统无尽模式独占 | ItemSystem |
| P1 | 危机事件系统无尽模式独占 | CrisisSystem |
| P2 | 最高记录保存与展示 | EndlessMode 核心 |
| P3 | 无尽模式专属成就/称号 | 记录系统 |
