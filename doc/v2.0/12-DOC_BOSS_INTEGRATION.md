# Boss 战整合（无尽模式）—— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

将现有的五个 Boss 机制（熔岩巨像、冰霜女巫、混沌之核、时间吞噬者、创世之灵）整合到**无尽模式**中，作为无尽模式下的阶段性挑战事件——玩家开启无尽模式后，每隔一段时间触发一波 Boss 攻击，考验玩家的应变能力，丰富无尽模式的玩法层次。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **解锁条件** | 击败最终 Boss（通关肉鸽模式）后解锁无尽模式 |
| **触发前提** | 必须开启无尽模式后才可遭遇 Boss 生存战 |
| **触发时机** | 无尽模式下每存活 60 秒触发一波 Boss 攻击 |
| **Boss 顺序** | 熔岩巨像 → 冰霜女巫 → 混沌之核 → 时间吞噬者 → 创世之灵 → 循环 |
| **攻击持续** | 每波持续 15 秒 |
| **攻击强度** | 每轮循环 Boss 攻击强度 +20%（持续时间更长、效果更强） |
| **叠加规则** | 同一时间只会有一个 Boss 攻击生效 |
| **与难度递增的关系** | Boss 攻击与无尽模式每 30 秒的难度递增**并行叠加**，共同构成挑战 |

### 1.3 Boss 攻击效果（无尽模式版）

| Boss | 攻击效果 | 持续 | 应对策略 |
|---|---|---|---|
| **熔岩巨像** | 随机 2 个格子被灼烧（不可放置/合成），灼烧蔓延 | 15 秒 | 尽快合成灭火 |
| **冰霜女巫** | 随机 1 行被冻结（元素不可操作） | 15 秒 | 在其他行运营 |
| **混沌之核** | 随机 3 个元素改变等级（±1） | 15 秒 | 重新规划合成路径 |
| **时间吞噬者** | 所有订单倒计时加速 50% | 15 秒 | 使用时间停滞道具 |
| **创世之灵** | 随机封印 1 个发射器（不可用） | 15 秒 | 使用元素风暴恢复 |

### 1.4 无尽模式完整流程

```
通关肉鸽模式（击败创世之灵）
    │
    ▼
┌──────────────────────────────────────┐
│  弹出「开启无尽模式」询问             │
│  → 选择「开始」进入无尽模式           │
│  → 选择「结束」返回主菜单             │
└──────────────────────────────────────┘
    │
    ▼ 选择「开始」
┌──────────────────────────────────────┐
│  无尽模式启动                         │
│  · 难度等级 0（每 30 秒递增）         │
│  · Boss 攻击倒计时 60 秒              │
│  · 积分从当前累计值继续               │
└──────────────────────────────────────┘
    │
    ├── 每 30 秒 → 难度递增（订单时间↓、冷却↑、高品质↑）
    │
    └── 每 60 秒 → Boss 攻击波
         │
         ├── 第 60 秒  → 熔岩巨像（15 秒）
         ├── 第 120 秒 → 冰霜女巫（15 秒）
         ├── 第 180 秒 → 混沌之核（15 秒）
         ├── 第 240 秒 → 时间吞噬者（15 秒）
         ├── 第 300 秒 → 创世之灵（15 秒）
         ├── 第 360 秒 → 熔岩巨像·强化（18 秒）
         ├── 第 420 秒 → 冰霜女巫·强化（18 秒）
         └── ... 循环，每轮 +3 秒
    │
    ▼ 积分 ≤ 0 或棋盘满且无护盾
┌──────────────────────────────────────┐
│  无尽模式结束                         │
│  · 显示存活时间 & 最终积分            │
│  · 保存最高记录到 localStorage        │
│  · 返回主菜单                         │
└──────────────────────────────────────┘
```

### 1.5 设计意图

- **内容复用**：充分利用已有的 Boss 机制，减少开发成本
- **节奏变化**：每 60 秒的 Boss 攻击打破常规运营节奏，避免无尽模式单调
- **双重压力**：Boss 攻击（突发性威胁）+ 难度递增（持续性压力）并行叠加，形成丰富的挑战层次
- **熟悉感**：玩家在肉鸽模式中已熟悉各 Boss 机制，无尽模式中面对时更有策略感
- **终局价值**：为通关玩家提供持续的挑战动力，每次无尽模式都是不同的 Boss 组合体验

---

## 二、技术实现方案

### 2.1 涉及文件

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `js/systems/EndlessMode.js` | 修改 | 新增 Boss 攻击调度逻辑 |
| `js/core/GameEngine.js` | 修改 | Boss 攻击触发与效果应用 |
| `js/ui/UIManager.js` | 修改 | Boss 攻击预警与横幅 |

### 2.2 EndlessMode 类改造

```javascript
// js/systems/EndlessMode.js

class EndlessMode {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.active = false;
    this.difficultyLevel = 0;
    this.startTime = 0;
    this._lastLevelUpTime = 0;
    this._lastBossTime = 0;       // 上次 Boss 攻击触发时间
    this._bossCycle = 0;           // Boss 循环计数
    this._activeBossAttack = null; // 当前活跃的 Boss 攻击
  }

  static STORAGE_KEY = 'lingSu_endless_record';

  // Boss 攻击配置
  static BOSS_ATTACKS = [
    {
      id: 'boss_lava_giant',
      name: '熔岩巨像',
      icon: '🌋',
      apply: (engine) => {
        // 灼烧 2 个随机空格
        const emptyCells = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            if (!engine.state.board[r][c]) {
              emptyCells.push({ row: r, col: c });
            }
          }
        }
        const targets = emptyCells.sort(() => Math.random() - 0.5).slice(0, 2);
        for (const cell of targets) {
          engine._bossState.scorchedCells.push({
            row: cell.row, col: cell.col,
            burnUntil: Date.now() + 15000,
          });
        }
        engine.boardRenderer.refreshScorchedCells(engine._bossState.scorchedCells);
      },
      revert: (engine) => {
        engine._bossState.scorchedCells = [];
        engine.boardRenderer.refreshScorchedCells([]);
      },
    },
    {
      id: 'boss_ice_witch',
      name: '冰霜女巫',
      icon: '❄',
      apply: (engine) => {
        const row = Math.floor(Math.random() * engine.state.board.length);
        engine._bossState.frozenRows.add(row);
        engine.boardRenderer.refreshFrozenRows(engine._bossState.frozenRows);
      },
      revert: (engine) => {
        engine._bossState.frozenRows.clear();
        engine.boardRenderer.refreshFrozenRows(new Set());
      },
    },
    {
      id: 'boss_chaos_core',
      name: '混沌之核',
      icon: '❓',
      apply: (engine) => {
        const elements = [];
        for (let r = 0; r < engine.state.board.length; r++) {
          for (let c = 0; c < engine.state.board[r].length; c++) {
            const el = engine.state.board[r][c];
            if (el && !el._blocked) elements.push({ row: r, col: c, el });
          }
        }
        const targets = elements.sort(() => Math.random() - 0.5).slice(0, 3);
        for (const t of targets) {
          t.el.level = Math.max(1, t.el.level + (Math.random() > 0.5 ? 1 : -1));
        }
        engine.boardRenderer.renderAll(engine.state.board);
      },
      revert: () => {},
    },
    {
      id: 'boss_time_devourer',
      name: '时间吞噬者',
      icon: '⏳',
      apply: (engine) => {
        engine._bossState.timeAcceleration = 1.5;
      },
      revert: (engine) => {
        engine._bossState.timeAcceleration = 1;
      },
    },
    {
      id: 'boss_creation_spirit',
      name: '创世之灵',
      icon: '✨',
      apply: (engine) => {
        const emitters = engine.state.emitters.filter(e => !e._sealed);
        if (emitters.length > 0) {
          const target = emitters[Math.floor(Math.random() * emitters.length)];
          target._sealed = true;
          engine._bossState.sealedEmitterId = target.id;
          window.eventBus.emit('emitters:updated', engine.state.emitters);
        }
      },
      revert: (engine) => {
        if (engine._bossState.sealedEmitterId) {
          const emitter = engine.state.emitters.find(
            e => e.id === engine._bossState.sealedEmitterId
          );
          if (emitter) emitter._sealed = false;
          engine._bossState.sealedEmitterId = null;
          window.eventBus.emit('emitters:updated', engine.state.emitters);
        }
      },
    },
  ];

  /**
   * 启动无尽模式
   */
  start() {
    this.active = true;
    this.difficultyLevel = 0;
    this.startTime = Date.now();
    this._lastLevelUpTime = this.startTime;
    this._lastBossTime = this.startTime;
    this._bossCycle = 0;
    this._activeBossAttack = null;

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

    // 每 60 秒触发 Boss 攻击
    if (now - this._lastBossTime >= 80000) {
      // 检查是否有活跃的 Boss 攻击需要结束
      // 实际 Boss 攻击持续 15 秒，由 GameEngine 管理
      this._triggerBossAttack(now);
      this._lastBossTime = now;
    }
  }

  /**
   * 触发 Boss 攻击波
   */
  _triggerBossAttack(now) {
    const attackList = EndlessMode.BOSS_ATTACKS;
    const bossDef = attackList[this._bossCycle % attackList.length];
    const cycleNum = Math.floor(this._bossCycle / attackList.length-dom);

    this._bossCycle++;

    // 计算持续时间：基础 15 秒，每轮 +3 秒
    const duration = 15000 + (cycleNum * 3000);

    this._activeBossAttack = {
      def: bossDef,
      endTime: now + duration,
      cycle: cycleNum,
    };

    // 应用 Boss 效果
    bossDef.apply(this.engine);

    // 发出事件
    window.eventBus.emit('boss-attack:started', {
      id: bossDef.id,
      name: bossDef.name,
      icon: bossDef.icon,
      duration: duration,
      cycle: cycleNum,
    });
  }

  /**
   * 检查 Boss 攻击是否到期并结束
   */
  checkBossAttackExpiry(now) {
    if (!this._activeBossAttack) return;

    if (now >= this._activeBossAttack.endTime) {
      const bossDef = this._activeBossAttack.def;
      if (bossDef.revert) {
        bossDef.revert(this.engine);
      }
      this._activeBossAttack = null;

      window.eventBus.emit('boss-attack:ended', {});
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

    // 结束当前活跃的 Boss 攻击
    if (this._activeBossAttack) {
      const bossDef = this._activeBossAttack.def;
      if (bossDef.revert) bossDef.revert(this.engine);
      this._activeBossAttack = null;
    }

    this.active = false;

    // 保存记录
    const survivalTime = this.getSurvivalTime();
    const score = this.engine.state.score;
    this._saveRecord(survivalTime, score);
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
// js/core/GameEngine.js

constructor() {
  // ...
  this.endlessMode = new EndlessMode(this);
  this._endlessOrderTimeMultiplier = 1;
  this._endlessQualityBonus = 0;
  this._bossState = {
    scorchedCells: [],
    frozenRows: new Set(),
    timeAcceleration: 1,
    sealedEmitterId: null,
  };
}

// 通关后启动无尽模式
_onLevelComplete() {
  // ...原有通关逻辑...

  // 如果是最终 Boss 胜利，弹出无尽模式询问
  if (this._bossState.isActive && this._bossState.bossId === 'boss_creation_spirit') {
    window.eventBus.emit('endless:offer', {});
  }
}

// 游戏循环中更新
_gameLoop(timestamp) {
  // ...
  const now = Date.now();
  this.endlessMode.tick(now);
  this.endlessMode.checkBossAttackExpiry(now);
}

// 响应无尽模式开启
_startEndlessMode() {
  // 重置 Boss 状态
  this._bossState = {
    scorchedCells: [],
    frozenRows: new Set(),
    timeAcceleration: 1,
    sealedEmitterId: null,
  };

  // 启动无尽模式
  this.endlessMode.start();
}

// 响应无尽模式结束
_onEndlessGameOver() {
  this.endlessMode.stop();
  // ...显示结算画面...
}
```

### 2.4 UI 集成

```javascript
// UIManager.js

// 监听 Boss 攻击事件
window.eventBus.on('endless:offer', () => {
  // 弹出「开启无尽模式」对话框
  this._showEndlessOfferDialog();
});

window.eventBus.on('boss-attack:started', (data) => {
  // 显示 Boss 攻击预警横幅
  this._showBossWarning(data);
});

window.eventBus.on('boss-attack:ended', () => {
  // 隐藏 Boss 攻击横幅
  this._hideBossWarning();
});

/**
 * 显示 Boss 攻击预警
 */
_showBossWarning(data) {
  const warning = document.getElementById('boss-warning');
  if (!warning) return;

  warning.innerHTML = `
    <div class="boss-warning-content">
      <span class="boss-icon">${data.icon}</span>
      <span class="boss-name">${data.name}</span>
      <span class="boss-duration">${(data.duration / 1000).toFixed(0)}秒</span>
    </div>
  `;
  warning.classList.add('visible');

  // 播放震动动画
  warning.style.animation = 'none';
  requestAnimationFrame(() => {
    warning.style.animation = 'bossShake 0.5s ease-in-out';
  });
}

/**
 * 隐藏 Boss 攻击预警
 */
_hideBossWarning() {
  const warning = document.getElementById('boss-warning');
  if (warning) {
    warning.classList.remove('visible');
  }
}
```

### 2.5 无尽模式开启对话框

```html
<!-- 在 index.html 中添加 -->
<div id="endless-offer-dialog" class="dialog-overlay hidden">
  <div class="dialog-box">
    <h2>🌿 灵素回廊·无尽</h2>
    <p>你已击败创世之灵，灵素之力仍在涌动……</p>
    <p>开启无尽模式，挑战极限？</p>
    <div class="endless-stats">
      <span>当前积分：<strong id="endless-current-score">0</strong></span>
    </div>
    <div class="dialog-buttons">
      <button id="btn-start-endless" class="btn-primary">开始无尽挑战</button>
      <button id="btn-quit-endless" class="btn-secondary">返回主菜单</button>
    </div>
  </div>
</div>
```

---

## 三、设计合理性分析

### 3.1 设计优点

| 方面 | 说明 |
|---|---|
| **内容复用** | 直接使用肉鸽模式已有的 Boss 机制，零新增美术/逻辑成本 |
| **节奏变化** | 每 60 秒的 Boss 攻击打破无尽模式「纯运营」的单调感 |
| **双重压力** | 难度递增（持续性）+ Boss 攻击（突发性）= 丰富挑战层次 |
| **渐进强化** | 每轮循环 Boss 攻击 +3 秒，与难度递增同步增长，自然过渡 |
| **终局价值** | 为通关玩家提供持续的挑战动力 |

### 3.2 潜在风险与缓解

| 风险 | 缓解措施 |
|---|---|
| **Boss 攻击过于频繁** | 60 秒间隔 + 15 秒持续，空闲窗口 45 秒，足够喘息 |
| **Boss 叠加导致混乱** | 同一时间只有一个 Boss 攻击生效，不叠加 |
| **新手不适应** | 无尽模式本身就是通关后内容，玩家已熟悉所有 Boss 机制 |

---

## 四、修改文件清单

| 文件 | 修改内容 | 预估改动量 |
|---|---|---|
| `js/systems/EndlessMode.js` | 新增 Boss 攻击调度、BOSS_ATTACKS 配置、tick 中触发逻辑 | ~120 行 |
| `js/core/GameEngine.js` | 新增 _bossState 管理、_startEndlessMode、_onEndlessGameOver | ~50 行 |
| `js/ui/UIManager.js` | 新增 Boss 攻击预警横幅、无尽模式开启对话框 | ~80 行 |
| `index.html` | 新增无尽模式开启对话框 HTML | ~20 行 |
| **总计** | | **~270 行** |
