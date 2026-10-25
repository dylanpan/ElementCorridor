# 订单倒计时系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

为每个订单添加独立的倒计时机制，超时未完成则扣除玩家积分，营造持续的紧迫感和策略抉择空间。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **倒计时触发** | 每个订单生成时立即开始倒计时 |
| **倒计时时长** | 根据订单难度动态分配（简单 20s / 普通 25s / 困难 32s / 稀有 40s） |
| **超时惩罚** | 订单超时后自动移除，扣除积分（reward × 50%，至少 1 分，最多 3 分） |
| **提交重置** | 成功提交订单后，该订单被移除，系统补充新订单（新订单自带倒计时） |
| **视觉反馈** | 倒计时进度条实时显示，最后 5 秒变红闪烁警告 |

### 1.3 设计意图

- **差异化难度**：简单订单时间短但分低，稀有订单时间长但分高，玩家需权衡「快速保底」与「憋高分」
- **渐进式压力**：随着游戏进行，订单难度上升 → 倒计时缩短 → 压力递增，形成自然的难度曲线
- **视觉紧迫感**：进度条 + 最后 5 秒红色闪烁，给玩家清晰的「即将超时」预警
- **惩罚克制**：单次扣分上限 3 分（初始 10 分的 30%），避免一次失误直接判死

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 生存积分制 | 超时触发扣分，直接影响生存状态 |
| 自动合成引擎 | 自动合成优先处理即将超时的订单 |
| 连击奖励 | 超时中断连击计数 |
| 手动干预 | 玩家可手动选择优先提交哪个订单 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/OrderSystem.js` —— 订单数据结构与倒计时逻辑
- `js/core/GameEngine.js` —— 游戏循环中检测超时
- `js/ui/UIManager.js` —— 倒计时进度条渲染
- `css/style.css` —— 倒计时进度条样式

### 2.2 订单数据结构变更

**修改前**：

```javascript
const order = {
  id: 'order_xxx',
  elementType: 'fire',
  level: 2,
  reward: 15,
  difficulty: 'medium',
  completed: false,
  createdAt: Date.now(),
};
```

**修改后**：

```javascript
const order = {
  id: 'order_xxx',
  elementType: 'fire',
  level: 2,
  reward: 15,
  difficulty: 'medium',
  completed: false,
  createdAt: Date.now(),
  // 新增字段
  timeLimit: 25000,          // 倒计时总时长（毫秒）
  expiresAt: Date.now() + 25000, // 过期时间戳
  expired: false,            // 是否已超时
};
```

### 2.3 倒计时时长配置

在 `OrderSystem` 中新增方法：

```javascript
/**
 * 根据难度获取倒计时时长
 * @param {string} difficulty - 订单难度
 * @returns {number} 倒计时毫秒数
 */
_getTimeLimit(difficulty) {
  const limits = {
    easy: 20000,    // 20 秒
    medium: 27000,  // 27 秒
    hard: 36000,    // 36 秒
    rare: 42000,    // 42 秒
  };
  return limits[difficulty] || 25000;
}
```

在 `generateOrder()` 中调用：

```javascript
generateOrder() {
  const template = this._pickOrderTemplate(excludeIds);
  if (!template) return null;

  const order = {
    // ...原有字段...
    timeLimit: this._getTimeLimit(template.difficulty),
    expiresAt: Date.now() + this._getTimeLimit(template.difficulty),
    expired: false,
  };
  return order;
}
```

### 2.4 游戏循环中超时检测

在 `GameEngine._startGameLoop` 的循环体中新增：

```javascript
// 在 _gameLoop 的 tick 中
const now = Date.now();
for (const order of this.systems.order.orders) {
  if (!order.expired && now >= order.expiresAt) {
    order.expired = true;
    this._deductScoreForExpiredOrder(order);
    this.systems.order.removeExpiredOrder(order.id);
  }
}
```

### 2.5 移除超时订单

在 `OrderSystem` 中新增方法：

```javascript
/**
 * 移除超时订单并补充新订单
 * @param {string} orderId - 超时订单 ID
 */
removeExpiredOrder(orderId) {
  const idx = this.orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  this.orders.splice(idx, 1);
  this.fillOrders(); // 补充新订单
}
```

### 2.6 UI 渲染

在 `UIManager.renderOrders` 中，每个订单卡片底部增加倒计时进度条：

```javascript
// 在每个订单卡片中
const now = Date.now();
const remainingMs = Math.max(0, order.expiresAt - now);
const progress = order.timeLimit > 0 ? remainingMs / order.timeLimit : 0;
const remainingSec = Math.ceil(remainingMs / 1000);
const isUrgent = remainingSec <= 5;

const timerHtml = `
  <div class="order-timer-bar-container">
    <div class="order-timer-bar ${isUrgent ? 'urgent' : ''}"
         style="width:${progress * 100}%"></div>
    <span class="order-timer-text ${isUrgent ? 'urgent' : ''}">
      ${remainingSec}s
    </span>
  </div>
`;
card.insertAdjacentHTML('beforeend', timerHtml);
```

### 2.7 游戏循环中更新倒计时 UI

在 `_gameLoop` 中每帧更新：

```javascript
// 更新订单倒计时 UI
window.eventBus.emit('order-timers:updated', {
  orders: this.systems.order.orders.map(o => ({
    id: o.id,
    remainingMs: Math.max(0, o.expiresAt - Date.now()),
    timeLimit: o.timeLimit,
    expired: o.expired,
  })),
});
```

在 `UIManager` 中监听并更新进度条：

```javascript
window.eventBus.on('order-timers:updated', (data) => {
  for (const timerData of data.orders) {
    const card = this.orderCards.find(c => c.dataset.orderId === timerData.id);
    if (!card) continue;
    const bar = card.querySelector('.order-timer-bar');
    const text = card.querySelector('.order-timer-text');
    if (!bar || !text) continue;

    const progress = timerData.timeLimit > 0
      ? timerData.remainingMs / timerData.timeLimit : 0;
    const sec = Math.ceil(timerData.remainingMs / 1000hed);
    const urgent = sec <= 5;

    bar.style.width = `${progress * 100}%`;
    bar.className = `order-timer-bar ${urgent ? 'urgent' : ''}`;
    text.textContent = `${sec}s`;
    text.className = `order-timer-text ${urgent ? 'urgent' : ''}`;
  }
});
```

### 2.8 CSS 样式

```css
/* 订单倒计时进度条 */
.order-timer-bar-container {
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  margin-top: 8px;
  position: relative;
  overflow: hidden;
}

.order-timer-bar {
  height: 100%;
  background: linear-gradient(90deg, #66bb6a, #43a047);
  border-radius: 2px;
  transition: width 0.3s linear;
}

.order-timer-bar.urgent {
  background: linear-gradient(90deg, #ef5350, #c62828);
  animation: timer-pulse 0.5s ease-in-out infinite alternate;
}

.order-timer-text {
  position: absolute;
  right: 0;
  top: -16px;
  font-size: 11px;
  color: #aaa;
}

.order-timer-text.urgent {
  color: #ef5350;
  font-weight: bold;
}

@keyframes timer-pulse {
  from { opacity: 0.7; }
  to   { opacity: 1; }
}
```
