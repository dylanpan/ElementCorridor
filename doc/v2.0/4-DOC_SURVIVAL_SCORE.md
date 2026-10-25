# 生存积分制 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

将传统「累积积分→达标通关」的线性目标制，改为「初始持有生命积分→维持积分不归零」的生存制，从根本上改变游戏的胜负判定逻辑，提升策略深度与紧张感。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **初始积分** | 玩家开局拥有 **10 分** |
| **积分获取** | 成功提交订单可获得该订单的 reward 分值 |
| **积分扣除** | 订单超时未完成将扣除积分（惩罚机制） |
| **游戏失败** | 积分 ≤ 0 时游戏结束 |
| **游戏胜利** | 击败最终 Boss 即为胜利（肉鸽模式原有胜利条件不变） |

### 1.3 设计意图

- **容错空间**：10 分 ≈ 约 3~5 次超时惩罚的容错量，既给予新手学习空间，又对高手形成持续压力
- **正负反馈并存**：提交订单的正反馈（加分）与超时的负反馈（扣分）交替作用，形成情绪曲线
- **策略取舍**：玩家需要在「尽快提交低分订单保底」和「憋高级元素拿高分」之间做权衡——追求高分意味着冒超时风险
- **与肉鸽模式兼容**：不影响现有 Boss 战胜利条件，Boss 战仍是最终目标，生存制作为过程约束

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 订单系统 | 订单 reward 直接加到积分上 |
| 倒计时系统 | 超时触发扣分 |
| 自动合成引擎 | 自动提交成功加分，自动超时扣分 |
| 肉鸽 Boss 战 | Boss 战胜利直接通关，不受积分制影响 |
| 守护结界祝福 | 棋盘满时消耗结界次数，不触发积分相关失败 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/core/GameEngine.js` —— 核心状态与胜负判定
- `js/ui/UIManager.js` —— 积分显示与游戏结束 UI

### 2.2 状态字段变更

**修改前**（GameEngine.constructor）：

```javascript
this.state = {
  level: 1,
  score: 0,           // 从 0 累加
  targetScore: 100,   // 达标即通关
  // ...
};
```

**修改后**：

```javascript
this.state = {
  level: 1,
  score: 10,             // 初始 10 分（生命值）
  targetScore: Infinity, // 不再需要目标分
  // ...
};
```

### 2.3 积分增减逻辑

#### 加分（提交订单成功）

在 `_onOrderClicked` 方法的积分计算部分，保持原有逻辑不变——`this.state.score += reward` 自然累加。

#### 扣分（订单超时）

新增方法：

```javascript
/**
 * 订单超时扣分
 * @param {object} order - 超时的订单对象
 */
_deductScoreForExpiredOrder(order) {
  // 扣分 = reward 的 50%，至少 1 分，最多 3 分
  const penalty = Math.max(1, Math.min(3, Math.floor(order.reward * 0.5)));
  this.state.score -= penalty;

  // 发出扣分通知
  window.eventBus.emit('notification', {
    message: `⏰ 订单超时！扣除 ${penalty} 积分`,
    type: 'danger',
  });

  // 更新 UI
  window.eventBus.emit('score:updated', {
    score: this.state.score,
    targetScore: this.state.targetScore,
  });

  // 检查是否游戏结束
  if (this.state.score <= 0) {
    this._onGameOver('积分归零，游戏结束！');
  }
}
```

#### 游戏结束判定

新增方法：

```javascript
/**
 * 游戏结束处理
 * @param {string} reason - 失败原因
 */
_onGameOver(reason) {
  if (!this.state.isPlaying) return;
  this.state.isPlaying = false;

  // 停止自动合成
  if (this.autoPlay) this.autoPlay.stop();

  // 停止游戏循环
  this._stopGameLoop();
  this._stopAutoSave();
  this._stopAutoSort();

  // 发出游戏结束事件
  window.eventBus.emit('game:over', {
    reason: reason,
    score: this.state.score,
    isRogue: this.isRogueMode,
  });
}
```

### 2.4 触发条件汇总

游戏结束在以下任一条件满足时触发：

1. **积分 ≤ 0** —— 由 `_deductScoreForExpiredOrder` 检测
2. **棋盘满且无守护结界** —— 现有 `_clickEmitter` 中的逻辑（保持不变）
3. **时间吞噬者 Boss 战失败** —— 现有逻辑（保持不变）

### 2.5 与现有系统的兼容处理

- **`_checkScoreComplete` 方法**：由于 `targetScore = Infinity`，`score >= targetScore` 永不为真，该方法自动失效，无需修改
- **`_checkWaveProgress` 方法**：波次系统中 `type: 'score'` 的判断同样因 `Infinity` 而失效，需将波次系统改为基于「存活时间」或「提交订单数」推进
- **`_onLevelComplete` 方法**：只在 Boss 战胜利时触发，不受积分制影响

### 2.6 波次系统适配

由于目标分改为 Infinity，波次系统需要调整推进条件：

```javascript
_checkWaveProgress() {
  // ...原有逻辑...
  switch (currentWave.type) {
    case 'score':
      // 在生存模式下，score 类型波次改为基于存活时间
      isMet = this._survivalTime >= currentWave.target;
      break;
    // 其他类型保持不变
  }
}
```

或者在生存模式下禁用波次系统，改为基于时间的难度递增。
