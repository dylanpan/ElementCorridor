# 道具系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

引入可消耗道具系统，让玩家在危急时刻有反制手段，增加策略维度和操作深度。

### 1.2 核心规则

| 道具 | 图标 | 效果 | 获取方式 | 使用时机 |
|---|---|---|---|---|
| **时间停滞** | ⏸️ | 冻结所有订单倒计时 10 秒 | 每存活 60 秒自动获得 1 个 | 多个订单即将超时时 |
| **立即完成** | ✅ | 直接完成一个指定订单（不消耗棋盘元素） | 每提交 5 个订单获得 1 个 | 高价值订单即将超时时 |
| **跳过订单** | ➡️ | 移除当前一个订单，不扣分 | 初始赠送 2 个 | 订单需求元素无法合成时 |
| **元素风暴** | 🌪️ | 所有发射器立即冷却完毕 | 每 90 秒自动获得 1 个 | 棋盘空旷需要快速铺场时 |
| **双倍积分** | �2️⃣ | 下次提交订单积分 x2 | 极小概率掉落 | 准备提交高价值订单前 |

### 1.3 设计意图

- **容错手段**：道具是玩家的「安全网」，在自动合成无法应对突发状况时提供手动干预的强力工具
- **策略深度**：道具的获取和使用时机本身就是一种资源管理——「现在用还是留着？」
- **爽感来源**：道具的强力效果带来「扭转乾坤」的成就感

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 自动合成引擎 | 道具使用可暂停自动合成 |
| 订单倒计时 | 时间停滞冻结倒计时 |
| 生存积分制 | 跳过订单避免扣分 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/ItemSystem.js` —— 新增，道具系统核心
- `js/ui/UIManager.js` —— 道具栏 UI
- `css/style.css` —— 道具栏样式

### 2.2 ItemSystem 类

```javascript
// js/systems/ItemSystem.js
class ItemSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.items = {}; // { itemId: count }
    this._timers = {}; // 自动获取定时器
  }

  static ITEM_DEFS = {
    time_freeze: {
      id: 'time_freeze',
      name: '时间停滞',
      icon: '⏸️',
      description: '冻结所有订单倒计时 10 秒',
      maxStack: 3,
    },
    instant_complete: {
      id: 'instant_complete',
      name: '立即完成',
      icon: '✅',
      description: '直接完成一个指定订单（不消耗棋盘元素）',
      maxStack: 2,
    },
    skip_order: {
      id: 'skip_order',
      name: '跳过订单',
      icon: '➡️',
      description: '移除当前一个订单，不扣分',
      maxStack: 3,
    },
    element_storm: {
      id: 'element_storm',
      name: '元素风暴',
      icon: '🌪️',
      description: '所有发射器立即冷却完毕',
      maxStack: 2,
    },
    double_score: {
      id: 'double_score',
      name: '双倍积分',
      icon: '✖️2️⃣',
      description: '下次提交订单积分 x2',
      maxStack: 1,
    },
  };

  /**
   * 初始化道具系统
   */
  init() {
    // 初始赠送
    this.addItem('skip_order', 2);
    this.addItem('element_storm', 1);

    // 自动获取定时器
    this._startAutoGrant();
  }

  /**
   * 启动自动获取
   */
  _startAutoGrant() {
    // 每 60 秒获得 1 个时间停滞
    this._timers.survival = setInterval(() => {
      this.addItem('time_freeze', 1);
      window.eventBus.emit('item:granted', {
        itemId: 'time_freeze',
        count: 1,
        reason: 'survival',
      });
    }, 60000);

    // 每 90 秒获得 1 个元素风暴
    this._timers.storm = setInterval(() => {
      this.addItem('element_storm', 1);
      window.eventBus.emit('item:granted', {
        itemId: 'element_storm',
        count: 1,
        reason: 'storm_timer',
      });
    }, 90000);
  }

  /**
   * 添加道具
   */
  addItem(itemId, count = 1) {
    const def = ItemSystem.ITEM_DEFS[itemId];
    if (!def) return;
    const current = this.items[itemId] || 0;
    this.items[itemId] = Math.min(current + count, def.maxStack);
  }

  /**
   * 使用道具
   * @param {string} itemId - 道具 ID
   * @param {*} [target] - 使用目标（订单 ID 等）
   * @returns {boolean} 是否使用成功
   */
  useItem(itemId, target) {
    if (!this.items[itemId] || this.items[itemId] <= 0) return false;

    let success = false;
    switch (itemId) {
      case 'time_freeze':
        success = this._useTimeFreeze();
        break;
      case 'instant_complete':
        success = this._useInstantComplete(target);
        break;
      case 'skip_order':
        success = this._useSkipOrder(target);
        break;
      case 'element_storm':
        success = this._useElementStorm();
        break;
      case 'double_score':
        success = this._useDoubleScore();
        break;
    }

    if (success) {
      this.items[itemId]--;
      window.eventBus.emit('item:used', { itemId, target });
      window.eventBus.emit('items:updated', { ...this.items });
    }
    return success;
  }

  /** 时间停滞：冻结所有订单倒计时 */
  _useTimeFreeze() {
    const freezeDuration = 10000; // 10 秒
    for (const order of this.engine.systems.order.orders) {
      if (!order.expired) {
        order.expiresAt += freezeDuration;
      }
    }
    window.eventBus.emit('notification', {
      message: '⏸️ 时间停滞！所有订单倒计时冻结 10 秒',
      type: 'info',
    });
    return true;
  }

  /** 立即完成：直接完成指定订单 */
  _useInstantComplete(orderId) {
    const order = this.engine.systems.order.orders.find(o => o.id === orderId);
    if (!order || order.expired) return false;

    // 直接提交（不消耗棋盘元素）
    this.engine.systems.order.completeOrderDirect(orderId);
    this.engine.state.score += order.reward;
    window.eventBus.emit('notification', {
      message: `✅ 立即完成！获得 ${order.reward} 积分`,
      type: 'reward',
    });
    return true;
  }

  /** 跳过订单：移除订单不扣分 */
  _useSkipOrder(orderId) {
    const order = this.engine.systems.order.orders.find(o => o.id === orderId);
    if (!order || order.expired) return false;

    this.engine.systems.order.removeOrderSilently(orderId);
    window.eventBus.emit('notification', {
      message: '➡️ 已跳过订单',
      type: 'info',
    });
    return true;
  }

  /** 元素风暴：重置所有发射器冷却 */
  _useElementStorm() {
    for (const emitter of this.engine.state.emitters) {
      emitter.resetCooldown();
    }
    window.eventBus.emit('notification', {
      message: '🌪️ 元素风暴！所有发射器已冷却完毕',
      type: 'reward',
    });
    return true;
  }

  /** 双倍积分：下次提交积分 x2 */
  _useDoubleScore() {
    this.engine._nextOrderMultiplier = 2;
    window.eventBus.emit('notification', {
      message: '✖️2️⃣ 下次提交订单积分翻倍！',
      type: 'info',
    });
    return true;
  }

  /**
   * 获取道具列表
   */
  getItems() {
    return { ...this.items };
  }

  /** 清理定时器 */
  destroy() {
    for (const key of Object.keys(this._timers)) {
      clearInterval(this._timers[key]);
    }
    this._timers = {};
  }
}
```

### 2.3 UI 渲染

```javascript
// 在 UIManager 中
_renderItemBar() {
  const items = gameEngine.itemSystem.getItems();
  const container = document.getElementById('item-bar');
  if (!container) return;

  container.innerHTML = '';
  for (const [itemId, count] of Object.entries(items)) {
    if (count <= 0) continue;
    const def = ItemSystem.ITEM_DEFS[itemId];
    const btn = document.createElement('button');
    btn.className = 'item-btn';
    btn.title = `${def.name}: ${def.description}`;
    btn.innerHTML = `${def.icon} <span class="item-count">${count}</span>`;
    btn.addEventListener('click', () => this._onItemClick(itemId));
    container.appendChild(btn);
  }
}
```

### 2.4 CSS 样式

```css
#item-bar {
  display: flex;
  gap: 8px;
  padding: 8px;
  justify-content: center;
}

.item-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 18px;
  color: #fff;
  transition: all 0.2s;
  position: relative;
}

.item-btn:hover {
  background: rgba(255,255,255,0.2);
  transform: translateY(-2px);
}

.item-count {
  font-size: 12px;
  color: #ff9800;
  position: absolute;
  top: -4px;
  right: -4px;
  background: rgba(0,0,0,0.8);
  border-radius: 50%;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
}
```
