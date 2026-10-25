# 危机事件系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

在游戏过程中随机触发负面事件，打破常规节奏，迫使玩家调整策略应对突发状况，增加游戏的不可预测性和挑战性。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **触发频率** | 每 30~45 秒随机触发一次 |
| **事件持续** | 每个事件持续 8~12 秒 |
| **事件类型** | 见下表 |
| **事件预警** | 事件触发前 2 秒有黄色警告横幅 |
| **免疫保护** | 新事件触发后有 10 秒免疫期，避免连续触发 |

### 1.3 事件类型

| 事件 | 图标 | 效果 | 应对策略 |
|---|---|---|---|
| **订单洪流** | 📦 | 同时出现 2 个额外订单（共 5 个） | 优先提交低阶订单 |
| **冷却加倍** | 🐢 | 所有发射器冷却时间 x2 | 使用元素风暴道具 |
| **时间紧缩** | ⏳ | 所有订单倒计时减半 | 使用时间停滞道具 |
| **元素混乱** | 🌪️ | 棋盘上随机 3 个元素互换位置 | 重新规划合成路径 |
| **积分衰减** | 💔 | 接下来 10 秒内提交订单积分减半 | 暂停提交，等待事件结束 |

### 1.4 设计意图

- **打破单调**：随机事件让每局游戏体验各不相同
- **考验应变**：玩家需要根据事件类型快速调整策略
- **道具价值**：危机事件凸显道具的重要性——没有道具时只能硬扛

### 1.5 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 道具系统 | 道具是应对危机事件的最强手段 |
| 自动合成引擎 | 事件期间自动合成策略不变，但效率受影响 |
| 生存积分制 | 积分衰减事件直接影响生存状态 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/CrisisSystem.js` —— 新增，危机事件系统
- `js/ui/UIManager.js` —— 事件预警与横幅
- `css/style.css` —— 事件特效样式

### 2.2 CrisisSystem 类

```javascript
// js/systems/CrisisSystem.js
class CrisisSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this._activeEvent = null;
    this._immuneUntil = 0;
    this._nextCheckTime = 0;
    this._originalState = {};
  }

  static EVENTS = [
    {
      id: 'order_flood',
      name: '订单洪流',
      icon: '📦',
      description: '同时出现 2 个额外订单',
      duration: 10000,
      apply: (ctx) => {
        // 添加 2 个额外订单
        for (let i = 0; i < 2; i++) {
          const order = ctx.engine.systems.order.generateOrder();
          if (order) ctx.engine.systems.order.addRushOrder(order);
        }
      },
      revert: (ctx) => {
        // 移除额外订单
        ctx.engine.systems.order.removeRushOrders();
      },
    },
    {
      id: 'cooldown_double',
      name: '冷却加倍',
      icon: '🐢',
      description: '所有发射器冷却时间 x2',
      duration: 12000,
      apply: (ctx) => {
        ctx._originalState.cooldownMultiplier = ctx.engine._eventCtx.emitterSpeedMultiplier;
        ctx.engine._eventCtx.emitterSpeedMultiplier *= 0.5;
      },
      revert: (ctx) => {
        ctx.engine._eventCtx.emitterSpeedMultiplier = ctx._originalState.cooldownMultiplier || 1;
      },
    },
    {
      id: 'time_crunch',
      name: '时间紧缩',
      icon: '⏳',
      description: '所有订单倒计时减半',
      duration: 10000,
      apply: (ctx) => {
        for (const order of ctx.engine.systems.order.orders) {
          if (!order.expired) {
            const remaining = order.expiresAt - Date.now();
            order.expiresAt = Date.now() + remaining / 2;
          }
        }
      },
      revert: () => {},
    },
    {
      id: 'element_chaos',
      name: '元素混乱',
      icon: '🌪️',
      description: '棋盘上随机 3 个元素互换位置',
      duration: 8000,
      apply: (ctx) => {
        const board = ctx.engine.state.board;
        const cells = [];
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] && !board[r][c]._blocked) {
              cells.push({ row: r, col: c, el: board[r][c] });
            }
          }
        }
        if (cells.length >= 3) {
          // 随机洗牌 3 个元素
          const shuffled = [...cells].sort(() => Math.random() - 0.5).slice(0, 3);
          const temp = shuffled[0].el;
          shuffled[0].el = shuffled[1].el;
          shuffled[1].el = shuffled[2].el;
          shuffled[2].el = temp;
          // 更新棋盘
          for (const cell of shuffled) {
            board[cell.row][cell.col] = cell.el;
          }
          ctx.engine.boardRenderer.renderAll(board);
        }
      },
      revert: () => {},
    },
    {
      id: 'score_decay',
      name: '积分衰减',
      icon: '💔',
      description: '提交订单积分减半',
      duration: 10000,
      apply: (ctx) => {
        ctx._originalState.scoreMultiplier = ctx.engine._eventCtx.scoreMultiplier;
        ctx.engine._eventCtx.scoreMultiplier *= 0.5;
      },
      revert: (ctx) => {
        ctx.engine._eventCtx.scoreMultiplier = ctx._originalState.scoreMultiplier || 1;
      },
    },
  ];

  /**
   * 每帧检查是否触发事件
   */
  tick(now) {
    if (now < this._nextCheckTime) return;
    if (now < this._immuneUntil) return;
    if (this._activeEvent) return;

    // 随机触发
    if (Math.random() < 0.15) {
      this._triggerEvent();
    }
    this._nextCheckTime = now + 5000; // 每 5 秒检查一次
  }

  /**
   * 触发随机事件
   */
  _triggerEvent() {
    const eventDef = CrisisSystem.EVENTS[
      Math.floor(Math.random() * CrisisSystem.EVENTS.length)
    ];

    this._activeEvent = {
      def: eventDef,
      endTime: Date.now() + eventDef.duration,
    };

    // 应用事件效果
    eventDef.apply(this);

    // 发出事件通知
    window.eventBus.emit('crisis:started', {
      id: eventDef.id,
      name: eventDef.name,
      icon: eventDef.icon,
      description: eventDef.description,
      duration: eventDef.duration,
    });
  }

  /**
   * 每帧更新事件状态
   */
  update(now) {
    if (!this._activeEvent) return;

    if (now >= this._activeEvent.endTime) {
      // 事件结束
      this._activeEvent.def.revert(this);
      this._activeEvent = null;
      this._immuneUntil = now + 10000; // 10 秒免疫

      window.eventBus.emit('crisis:ended', {});
    }
  }

  /**
   * 重置系统
   */
  reset() {
    if (this._activeEvent) {
      this._activeEvent.def.revert(this);
      this._activeEvent = null;
    }
    this._immuneUntil = 0;
    this._nextCheckTime = Date.now() + 15000; // 开局 15 秒后才触发
  }
}
```

### 2.4 在 GameEngine 中集成

```javascript
constructor() {
  // ...
  this.crisisSystem = new CrisisSystem(this);
}

startRogueLevel(targetScore, node) {
  // ...
  this.crisisSystem.reset();
}

_gameLoop(timestamp) {
  // ...原有逻辑...
  const now = Date.now();
  this.crisisSystem.tick(now);
  this.crisisSystem.update(now);
}
```

### 2.5 UI 事件横幅

```javascript
// 在 UIManager 中
window.eventBus.on('crisis:started', (data) => {
  this._showCrisisBanner(data);
});

_showCrisisBanner(data) {
  const banner = document.createElement('div');
  banner.className = 'crisis-banner';
  banner.id = `crisis-${data.id}`;
  banner.innerHTML = `
    <div class="crisis-icon">${data.icon}</div>
    <div class="crisis-info">
      <div class="crisis-name">${data.name}</div>
      <div class="crisis-desc">${data.description}</div>
    </div>
    <div class="crisis-timer" id="crisis-timer-${data.id}">
      ${(data.duration / 1000).toFixed(0)}s
    </div>
  `;
  document.body.appendChild(banneripse;

  // 滑入动画
  requestAnimationFrame(() => banner.classList.add('show'));
}
```
