# 自动合成引擎（AutoPlaySystem）—— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

实现游戏核心操作的自动化闭环——自动点击发射器产出元素、自动合成相邻同类型元素、自动提交匹配订单，让玩家从繁琐的重复操作中解放出来，专注于策略决策。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **决策频率** | 每 333ms 执行一次决策循环 |
| **决策优先级** | ① 自动提交匹配订单 → ② 自动合成相邻元素 → ③ 自动点击发射器 |
| **提交策略** | 优先提交即将超时的订单（剩余时间最短的优先） |
| **合成策略** | 优先合成低等级元素（为高级订单腾出空间） |
| **发射器策略** | 优先点击订单所需元素类型的发射器 |
| **运行条件** | 仅在 `isPlaying === true` 且 `isPaused === false` 时运行 |

### 1.3 设计意图

- **解放双手**：消除重复性点击操作，让玩家聚焦于「选什么祝福」「升什么等级」「先提交哪个订单」等高阶决策
- **机器 vs 人的对比乐趣**：自动合成效率不如手动最优操作，但胜在稳定不疲劳——玩家偶尔手动介入可以获得更高收益
- **策略深度**：自动合成的优先级策略本身就是一种可优化的系统——玩家可以通过祝福/升级来影响自动合成的行为

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 订单系统 | 读取订单列表，调用 `_onOrderClicked` 提交 |
| 合成系统 | 扫描棋盘，调用 `_onCellClick` 触发合成 |
| 发射器系统 | 调用 `_clickEmitter` 产出元素 |
| 手动干预 | 玩家可随时暂停/恢复自动合成，或手动拖动元素 |
| 连击奖励 | 自动合成触发的连击同样计入连击计数 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/AutoPlaySystem.js` —— 新增文件，自动合成引擎核心
- `js/core/GameEngine.js` —— 集成 AutoPlaySystem 的启动/停止

### 2.2 AutoPlaySystem 类设计

```javascript
// js/systems/AutoPlaySystem.js
class AutoPlaySystem {
  /**
   * @param {GameEngine} engine - 游戏引擎实例
   */
  constructor(engine) {
    this.engine = engine;
    this._intervalId = null;
    this._processing = false;
    this._stats = {
      submits: 0,
      merges: 0,
      spawns: 0,
      totalDecisions: 0,
    };
  }

  /**
   * 启动自动合成
   */
  start() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => this._decisionLoop(), 333);
  }

  /**
   * 停止自动合成
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * 主决策循环
   * 优先级：提交 > 合成 > 产元素
   */
  _decisionLoop() {
    if (!this.engine.state.isPlaying || this.engine.state.isPaused) return;
    if (this._processing) return; // 防止重入

    this._processing = true;
    this._stats.totalDecisions++;

    try {
      // 优先级 1：自动提交匹配订单
      if (this._tryAutoSubmit()) return;

      // 优先级 2：自动合成相邻元素
      if (this._tryAutoMerge()) return;

      // 优先级 3：自动点击发射器
      this._tryAutoSpawn();
    } finally {
      this._processing = false;
    }
  }

  /**
   * 自动提交：遍历订单，优先提交即将超时的
   * @returns {boolean} 是否成功提交
   */
  _tryAutoSubmit() {
    const orders = this.engine.systems.order.getOrders()
      .filter(o => !o.expired);

    // 按剩余时间升序排序（即将超时的优先提交）
    orders.sort((a, b) => a.expiresAt - b.expiresAt);

    for (const order of orders) {
      const matches = this.engine.systems.spawn.findElementsByTypeAndLevel(
        this.engine.state.board,
        order.elementType,
        order.level
      );
      if (matches.length > 0) {
        this.engine._onOrderClicked(order.id);
        this._stats.submits++;
        return true;
      }
    }
    return false;
  }

  /**
   * 自动合成：扫描棋盘，找到可合成的相邻元素
   * 优先合成低等级元素
   * @returns {boolean} 是否成功合成
   */
  _tryAutoMerge() {
    const board = this.engine.state.board;
    const candidates = [];

    // 扫描所有相邻对
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const el = board[r][c];
        if (!el || el._blocked) continue;

        // 检查右侧邻居
        if (c + 1 < board[r].length) {
          const neighbor = board[r][c + 1];
          if (neighbor && !neighbor._blocked && Element.canMerge(el, neighbor)) {
            candidates.push({
              from: { row: r, col: c },
              to: { row: r, col: c + 1 },
              level: el.level,
            });
          }
        }

        // 检查下方邻居
        if (r + 1 < board.length) {
          const neighbor = board[r + 1][c];
          if (neighbor && !neighbor._blocked && Element.canMerge(el, neighbor)) {
            candidates.push({
              from: { row: r, col: c },
              to: { row: r + 1, col: c },
              level: el.level,
            });
          }
        }
      }
    }

    if (candidates.length === 0) return false;

    // 优先合成最低等级的（为高级元素腾空间）
    candidates.sort((a, b) => a.level - b.level);
    const best = candidates[0];

    // 模拟点击：先选中第一个，再点击第二个触发合成
    this.engine.boardRenderer.selectCell(best.from.row, best.from.col, board);
    this.engine._onCellClick(best.to.row, best.to.col);
    this._stats.merges++;
    return true;
  }

  /**
   * 自动点击发射器：优先点击订单所需元素类型的发射器
   * @returns {boolean} 是否成功点击发射器
   */
  _tryAutoSpawn() {
    const orders = this.engine.systems.order.getOrders()
      .filter(o => !o.expired collect);
    if (orders.length === 0) return false;

    // 统计订单中各元素类型的需求量
    const demandMap = {};
    for (const order of orders) {
      demandMap[order.elementType] = (demandMap[order.elementType] || 0) + 1;
    }

    // 按需求量降序排列元素类型
    const sortedTypes = Object.entries(demandMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    // 优先点击需求量最大的元素类型对应的发射器
    for (const type of sortedTypes) {
      const emitter = this.engine.state.emitters.find(
        e => e.elementType === type && e.isReadyToSpawn(Date.now())
      );
      if (emitter) {
        this.engine._clickEmitter(emitter.id);
        this._stats.spawns++;
        return true;
      }
    }

    // 没有匹配的发射器，点击任意就绪的发射器
    const anyEmitter = this.engine.state.emitters.find(
      e => e.isReadyToSpawn(Date.now())
    );
    if (anyEmitter) {
      this.engine._clickEmitter(anyEmitter.id);
      this._stats.spawns++;
      return true;
    }

    return false;
  }
}
```

### 2.3 在 GameEngine 中集成

**构造函数中初始化**：

```javascript
constructor() {
  // ...原有代码...
  this.autoPlay = null;
}
```

**启动关卡时启动自动合成**：

```javascript
startRogueLevel(targetScore, node) {
  // ...原有逻辑...

  // 启动自动合成引擎
  if (!this.autoPlay) {
    this.autoPlay = new AutoPlaySystem(this);
  }
  this.autoPlay.start();
}
```

**通关/失败时停止**：

```javascript
_onLevelComplete() {
  if (this.autoPlay) this.autoPlay.stop();
  // ...原有逻辑...
}

_onGameOver(reason) {
  if (this.autoPlay) this.autoPlay.stop();
  // ...原有逻辑...
}
```

### 2.4 性能考量

- **决策频率 333ms**：约每秒 3 次决策，平衡响应速度与性能开销
- **重入锁**：`_processing` 标志防止递归调用
- **扫描范围**：每次扫描整个棋盘（最大 10×8 = 80 格），性能可接受
- **优化空间**：可维护「可合成对列表」增量更新，避免全盘扫描

### 2.5 调试与可视化

在开发阶段可添加调试模式：

```javascript
// 在 AutoPlaySystem 中
enableDebug() {
  this._debug = true;
}

_decisionLoop() {
  // ...
  if (this._debug) {
    console.log(`[AutoPlay] 决策 #${this._stats.totalDecisions}: ` +
      `提交=${this._stats.submits} 合成=${this._stats.merges} 发射=${this._stats.spawns}`);
  }
}
```
