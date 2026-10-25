# 连击奖励系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

通过连续成功提交订单获得积分加成奖励，激励玩家保持高效率的运营节奏，同时为自动合成引擎提供额外的策略维度。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **连击触发** | 连续成功提交订单（两次提交之间间隔 ≤ 5 秒） |
| **连击倍率** | 1 次 = x1.0 / 2 次 = x1.2 / 3 次 = x1.5 / 5 次 = x2.0 / 10 次 = x3.0 |
| **连击中段** | 订单超时会中断连击计数 |
| **视觉反馈** | 屏幕上方显示当前连击数和倍率，连击时订单提交有特效 |
| **最大倍率** | x3.0（10 连击），之后不再增长 |

### 1.3 设计意图

- **正向激励**：连击奖励让「快速连续提交」变得有利可图，鼓励玩家优化运营节奏
- **风险对冲**：高连击倍率可以弥补超时扣分带来的损失
- **与自动合成协同**：自动合成引擎天然适合保持连击——只要元素供应充足，它可以稳定地连续提交

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 自动合成引擎 | 自动提交触发连击计数 |
| 订单倒计时 | 超时中断连击 |
| 生存积分制 | 连击倍率影响实际获得的积分 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/core/GameEngine.js` —— 连击计数与倍率计算
- `js/ui/UIManager.js` —— 连击 UI 显示
- `css/style.css` —— 连击特效样式

### 2.2 连击状态管理

在 `GameEngine` 中新增状态：

```javascript
constructor() {
  // ...原有代码...
  this._comboState = {
    count: 0,           // 当前连击数
    multiplier: 1.0,    // 当前倍率
    lastSubmitTime: 0,  // 上次提交时间戳
    timeoutId: null,    // 连击超时定时器
  };
}
```

### 2.3 连击计算

```javascript
/**
 * 更新连击状态（在订单提交成功后调用）
 */
_updateCombo() {
  const now = Date.now();
  const comboWindow = 5000; // 5 秒窗口

  // 检查是否在连击窗口内
  if (now - this._comboState.lastSubmitTime <= comboWindow) {
    this._comboState.count++;
  } else {
    this._comboState.count = 1; // 重新开始连击
  }

  this._comboState.lastSubmitTime = now;

  // 计算倍率
  this._comboState.multiplier = this._calcComboMultiplier(this._comboState.count);

  // 清除旧超时
  if (this._comboState.timeoutId) {
    clearTimeout(this._comboState.timeoutId);
  }

  // 设置新超时（连击窗口过后未提交则重置）
  this._comboState.timeoutId = setTimeout(() => {
    this._comboState.count = 0;
    this._comboState.multiplier = 1.0;
    window.eventBus.emit('combo:broken', { reason: 'timeout' });
    window.eventBus.emit('combo:updated', {
      count: 0,
      multiplier: 1.0,
    });
  }, comboWindow);

  // 发出更新事件
  window.eventBus.emit('combo:updated', {
    count: this._comboState.count,
    multiplier: this._comboState.multiplier,
  });

  // 里程碑检测
  this._checkComboMilestone(this._comboState.count);
}

/**
 * 计算连击倍率
 * @param {number} count - 连击数
 * @returns {number} 倍率
 */
_calcComboMultiplier(count) {
  if (count >= 10) return 3.0;
  if (count >= 5)  return 2.0;
  if (count >= 3)  return 1.5;
  if (count >= 2)  return 1.2;
  return 1.0;
}

/**
 * 连击里程碑检测
 */
_checkComboMilestone(count) {
  const milestones = [3, 5, 10];
  if (milestones.includes(count)) {
    window.eventBus.emit('combo:milestone', {
      milestone: count,
      multiplier: this._calcComboMultiplier(count),
    });
  }
}
```

### 2.4 在订单提交中集成

```javascript
_onOrderClicked(orderId) {
  // ...原有提交逻辑...

  // 提交成功后更新连击
  if (result) {
    this._updateCombo();

    // 应用连击倍率到积分
    const comboMultiplier = this._comboState.multiplier;
    reward = Math.floor(reward * comboMultiplier2);
    this.state.score += reward;
    // ...
  }
}
```

### 2.5 超时中断连击

```javascript
_deductScoreForExpiredOrder(order) {
  // 超时中断连击
  this._comboState.count = 0;
  this._comboState.multiplier = 1.0;
  if (this._comboState.timeoutId) {
    clearTimeout(this._comboState.timeoutId);
    this._comboState.timeoutId = null;
  }
  window.eventBus.emit('combo:broken', { reason: 'expired' });
  window.eventBus.emit('combo:updated', { count: 0, multiplier: 1.0 });

  // ...扣分逻辑...
}
```

### 2.6 UI 渲染

```javascript
// 在 UIManager 中
window.eventBus.on('combo:updated', (data) => {
  const comboDisplay = document.getElementById('combo-display');
  if (!comboDisplay) return;

  if (data.count >= 2) {
    comboDisplay.style.display = 'block';
    comboDisplay.innerHTML = `
      <span class="combo-count">🔥 ${data.count} 连击</span>
      <span class="combo-multiplier">x${data.multiplier.toFixed(1)}</span>
    `;
    comboDisplay.classList.add('combo-active');
  } else {
    comboDisplay.style.display = 'none';
    comboDisplay.classList.remove('combo-active');
  }
});

window.eventBus.on('combo:broken', () => {
  const comboDisplay = document.getElementById('combo-display');
  if (comboDisplay) {
    comboDisplay.classList.add('combo-broken');
    setTimeout(() => comboDisplay.classList.remove('combo-broken'), 500);
  }
});

window.eventBus.on('combo:milestone', (data) => {
  // 显示里程碑特效
  this.showMilestoneEffect(data.milestone, data.multiplier);
});
```

### 2.7 CSS 样式

```css
#combo-display {
  display: none;
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  border: 2px solid #ff9800;
  border-radius: 12px;
  padding: 8px 20px;
  z-index: 999;
  text-align: center;
  animation: combo-slide-in 0.3s ease-out;
}

.combo-count {
  font-size: 20px;
  font-weight: bold;
  color: #ff9800;
}

.combo-multiplier {
  font-size: 16px;
  color: #ffeb3b;
  margin-left: 10px;
}

.combo-active {
  animation: combo-pulse 1s ease-in-out infinite;
}

.combo-broken {
  animation: combo-shake 0.5s ease-in-out;
  border-color: #ef5350 !important;
}

@keyframes combo-slide-in {
  from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0); opacity: 1; }
}

@keyframes combo-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255,152,0,0.3); }
  50%      { box-shadow: 0 0 25px rgba(255,152,0,0.6); }
}

@keyframes combo-shake {
  0%, 100% { transform: translateX(-50%); }
  25%      { transform: translateX(-50%) translateX(-5px); }
  75%      { transform: translateX(-50%) translateX(5px); }
}
```
