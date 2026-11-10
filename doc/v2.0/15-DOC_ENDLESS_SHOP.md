# 无尽模式 · 商店与金币系统

## 一、设计目标

- 为无尽模式增加经济循环，让积分之外的第二个资源维度
- 提供消费出口，让玩家在关键时刻有策略选择
- 不与现有道具/危机事件系统冲突，形成互补

## 二、金币获取途径

| 获取方式 | 频率 | 数量 | 说明 |
|---|---|---|---|
| **击杀 Boss** | 每次 Boss 战后 | 10~20 金币 | 按 Boss 难度递增 |
| **危机事件成功应对** | 危机事件结束时 | 5~10 金币 | 鼓励积极应对 |
| **连击奖励** | 连续合成 ≥ 5 次 | 2~5 金币 | 鼓励高效操作 |
| **订单里程碑** | 每 10 个订单 | 5 金币 | 稳定收入来源 |
| **存活奖励** | 每 60 秒 | 3 金币 | 活得久赚得多 |

## 三、商店入口与面板

### 3.1 商店入口

将左侧面板现有的金币数量显示直接改造为商店入口按钮，**仅限无尽模式生效**：

```
改造前：  🪙 32                    （纯文本 span 显示）
改造后：  [🪙 32]                  （可点击 button，点击展开商店面板）
```

- **入口位置**：左侧面板 `rogue-level-top` 区域，与层级数同行
- **视觉风格**：保持金币颜色（#ffd700），添加 hover 高亮和指针样式，鼠标悬停时显示提示「点击打开商店」
- **展开方式**：点击后在屏幕中央弹出商店面板（模态框），点击遮罩层或关闭按钮收起
- **模式区分**：
  - **无尽模式**：金币显示改造为 `<button>`，可点击打开商店面板
  - **肉鸽模式**：金币显示保持原有纯文本 `<span>`，点击无效，不绑定任何事件

### 3.2 商店面板布局

```
┌─────────────────────────────────┐
│  🛒 商店                     ✕  │ ← 顶部栏（标题 + 关闭按钮）
├─────────────────────────────────┤
│  当前金币：🪙 32                 │ ← 余额显示
│                                 │
│  ┌──────────┐ ┌──────────┐     │
│  │ ⏸ 时间停滞 │ │ ✅ 立即完成│     │ ← 商品卡片（普通）
│  │  10 金币   │ │  15 金币   │     │
│  │  [购买]    │ │  [购买]    │     │
│  └──────────┘ └──────────┘     │
│                                 │
│  ┌──────────────────────┐       │
│  │ ✨ 祝福宝箱 (稀有)     │       │ ← 稀有商品（高亮边框）
│  │   25 金币             │       │
│  │   [购买]              │       │
│  └──────────────────────┘       │
│                                 │
│  [🔄 刷新 5💰]   下次刷新: 45s  │ ← 底部操作栏
└─────────────────────────────────┘
```

### 3.3 商店刷新机制

| 规则 | 说明 |
|---|---|
| **刷新频率** | 每 90 秒自动刷新一次商品 |
| **商品数量** | 每次刷新 3 个商品（2 个普通 + 1 个稀有） |
| **手动刷新** | 花费 5 金币可立即刷新（冷却 30 秒） |
| **商店入口** | 左侧面板金币显示按钮，点击展开商店面板 |

## 四、商品池

### 4.1 普通商品（每次必出 2 个）

| 商品 | 价格 | 效果 | 出现权重 |
|---|---|---|---|
| **跳过订单** | 8 金币 | 获得 1 个跳过订单道具 | 30% |
| **时间停滞** | 10 金币 | 获得 1 个时间停滞道具 | 25% |
| **元素风暴** | 12 金币 | 获得 1 个元素风暴道具 | 20% |
| **积分护盾** | 15 金币 | 接下来 30 秒积分不会降到 0 以下 | 15% |
| **发射器加速** | 10 金币 | 所有发射器冷却速度 x1.5，持续 20 秒 | 10% |

### 4.2 稀有商品（每次必出 1 个）

| 商品 | 价格 | 效果 | 出现权重 |
|---|---|---|---|
| **立即完成** | 15 金币 | 获得 1 个立即完成道具 | 30% |
| **双倍积分** | 20 金币 | 获得 1 个双倍积分道具 | 25% |
| **祝福宝箱** | 25 金币 | 随机获得一个普通祝福 | 20% |
| **时间缓流** | 18 金币 | 所有订单倒计时速度减半，持续 15 秒 | 15% |
| **元素净化** | 22 金币 | 清除棋盘上所有负面效果（灼烧/冻结/封印） | 10% |

## 五、技术实现方案

### 5.1 涉及文件

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `js/systems/EndlessShopSystem.js` | **新增** | 商店系统核心类 |
| `js/systems/EndlessMode.js` | 修改 | 初始化商店、金币挂钩 |
| `js/ui/UIManager.js` | 修改 | 商店面板 UI 渲染 |
| `js/main.js` | 修改 | 金币显示改为按钮，绑定点击事件 |
| `css/style.css` | 修改 | 商店面板样式、金币按钮交互样式 |

### 5.2 EndlessShopSystem 类设计

```javascript
class EndlessShopSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.gold = 0;               // 当前金币
    this.items = [];             // 当前商品列表
    this._autoRefreshTimer = null;
    this._manualRefreshCD = 0;
    this._enabled = false;
    this._visible = false;       // 商店面板是否展开
  }

  static SHOP_CONFIG = {
    refreshInterval: 90000,      // 自动刷新间隔 90 秒
    manualRefreshCost: 5,        // 手动刷新花费
    manualRefreshCD: 30000,      // 手动刷新冷却 30 秒
    normalCount: 2,              // 普通商品数量
    rareCount: 1,                // 稀有商品数量
  };

  /** 初始化商店 */
  init() {
    this.gold = 0;
    this._refreshItems();
    this._startAutoRefresh();
    this._enabled = true;
    this._updateGoldDisplay();
  }

  /** 添加金币 */
  addGold(amount) {
    this.gold += amount;
    this._updateGoldDisplay();
    window.eventBus.emit('endless:gold-updated', this.gold);
  }

  /** 消耗金币 */
  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this._updateGoldDisplay();
    window.eventBus.emit('endless:gold-updated', this.gold);
    return true;
  }

  /** 刷新商品列表 */
  _refreshItems() {
    this.items = [];
    // 生成 2 个普通商品
    for (let i = 0; i < EndlessShopSystem.SHOP_CONFIG.normalCount; i++) {
      this.items.push(this._pickRandomItem('normal'));
    }
    // 生成 1 个稀有商品
    this.items.push(this._pickRandomItem('rare'));
  }

  /** 随机选取商品 */
  _pickRandomItem(rarity) {
    const pool = rarity === 'rare'
      ? EndlessShopSystem.RARE_POOL
      : EndlessShopSystem.NORMAL_POOL;
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) return { ...item, rarity };
    }
    return { ...pool[0], rarity };
  }

  /** 购买商品 */
  purchaseItem(index) {
    const item = this.items[index];
    if (!item || !this.spendGold(item.price)) return false;
    this._applyPurchaseEffect(item);
    this.items.splice(index, 1);
    return true;
  }

  /** 应用购买效果 */
  _applyPurchaseEffect(item) {
    switch (item.effect) {
      case 'add_item':
        if (this.engine.itemSystem) {
          this.engine.itemSystem.addItem(item.itemId, 1);
        }
        break;
      case 'shield':
        this.engine._bossState.shieldEndTime = Date.now() + 30000;
        break;
      case 'speed_up':
        this.engine._eventCtx.emitterSpeedMultiplier = 1.5;
        setTimeout(() => {
          this.engine._eventCtx.emitterSpeedMultiplier = 1;
        }, 20000);
        break;
      case 'slow_time':
        this.engine._endlessOrderTimeMultiplier *= 2;
        setTimeout(() => {
          this.engine._endlessOrderTimeMultiplier /= 2;
        }, 15000);
        break;
      case 'clear_debuffs':
        if (this.engine._bossState) {
          this.engine._bossState.scorchedCells = [];
          this.engine._bossState.frozenRows.clear();
          this.engine._bossState.frozenCols.clear();
          this.engine._bossState.sealedEmitterIds = [];
        }
        break;
      case 'add_boon':
        if (this.engine.boonSystem) {
          this.engine.boonSystem.addRandomBoon();
        }
        break;
      case 'double_score':
        this.engine._endlessScoreMultiplier = 2;
        setTimeout(() => {
          this.engine._endlessScoreMultiplier = 1;
        }, 40000);
        break;
    }
  }

  /** 更新金币显示 */
  _updateGoldDisplay() {
    const goldEl = document.getElementById('endless-gold');
    if (goldEl) goldEl.textContent = this.gold;
  }

  /** 切换商店面板显隐 */
  toggleVisibility() {
    this._visible = !this._visible;
    if (this._visible) {
      this._showPanel();
    } else {
      this._hidePanel();
    }
  }

  /** 清理 */
  destroy() {
    this._enabled = false;
    this._stopAutoRefresh();
    this._hidePanel();
  }
}
```

### 5.3 商品池定义

```javascript
static NORMAL_POOL = [
  { id: 'skip_order', name: '跳过订单', icon: '⏭', price: 8,
    desc: '获得 1 个跳过订单道具', weight: 124,
    effect: 'add_item', itemId: 'skip_order' },
  { id: 'time_freeze', name: '时间停滞', icon: '⏸', price: 108,
    desc: '获得 1 个时间停滞道具', weight: 103,
    effect: 'add_item', itemId: 'time_freeze' },
  { id: 'element_storm', name: '元素风暴', icon: '🌪', price: 111,
    desc: '获得 1 个元素风暴道具', weight: 81,
    effect: 'add_item', itemId: 'element_storm' },
  { id: 'score_shield', name: '积分护盾', icon: '🛡', price: 114,
    desc: '接下来 30 秒积分不会降到 0 以下', weight: 78,
    effect: 'shield' },
  { id: 'emitter_boost', name: '发射器加速', icon: '⚡', price: 92,
    desc: '所有发射器冷却速度 x1.5，持续 20 秒', weight: 107,
    effect: 'speed_up' },
];

static RARE_POOL = [
  { id: 'instant_complete', name: '立即完成', icon: '✅', price: 123,
    desc: '获得 1 个立即完成道具', weight: 106,
    effect: 'add_item', itemId: 'instant_complete' },
  { id: 'double_score', name: '双倍积分', icon: '💎', price: 122,
    desc: '获得 1 个双倍积分道具', weight: 89,
    effect: 'add_item', itemId: 'double_score' },
  { id: 'blessing_chest', name: '祝福宝箱', icon: '✨', price: 127,
    desc: '随机获得一个普通祝福', weight: 94,
    effect: 'add_boon' },
  { id: 'time_slow', name: '时间缓流', icon: '🐢', price: 113,
    desc: '所有订单倒计时速度减半，持续 15 秒', weight: 87,
    effect: 'slow_time' },
  { id: 'purify', name: '元素净化', icon: '💫', price: 105,
    desc: '清除棋盘上所有负面效果', weight: 93,
    effect: 'clear_debuffs' },
];
```

### 5.4 金币获取挂钩点

在 `EndlessMode.js` 中新增金币获取逻辑：

```javascript
// Boss 击败奖励
_onBossVictory() {
  const goldReward = 10 + this.difficultyLevel; // 10~∞
  this.engine.shopSystem.addGold(goldReward);
}

// 存活奖励（每 60 秒）
tick(now) {
  // ...原有逻辑...
  // 每 60 秒奖励 3 金币
  if (now - this._lastGoldTime >= 59999) {
    this.engine.shopSystem.addGold(3);
    this._lastGoldTime = now;
  }
}
```

### 5.5 金币显示改造（main.js）

```html
<!-- 改造前 -->
<span class="rogue-gold-display">🪙 <span id="rogue-gold">0</span></span>

<!-- 改造后 -->
<button class="rogue-gold-btn" id="endless-shop-btn" title="点击打开商店">
  🪙 <span id="endless-gold">0</span>
</button>
```

```javascript
function showEndlessStatusBar() {
  // ...原有逻辑...

  // 将金币显示改造为商店按钮
  const goldSpan = document.getElementById('rogue-gold');
  if (goldSpan) {
    goldSpan.id = 'endless-gold';
    goldSpan.textContent = '0';
  }

  // 绑定商店点击事件
  const shopBtn = document.getElementById('endless-shop-btn');
  if (shopBtn) {
    shopBtn.style.display = '';
    shopBtn.onclick = () => {
      if (window.__gameEngine && window.__gameEngine.shopSystem) {
        window.__gameEngine.shopSystem.toggleVisibility();
      }
    };
  }
}
```

### 5.6 与现有系统的关系

| 系统 | 交互方式 |
|---|---|
| **道具系统** | 商店出售部分道具，作为自动获取的补充 |
| **危机事件系统** | 成功应对危机事件可获得金币奖励 |
| **Boss 系统** | 击败 Boss 获得金币奖励 |
| **积分系统** | 金币与积分独立，互不影响 |

## 六、开发优先级

| 优先级 | 任务 | 依赖 |
|---|---|---|
| P0 | EndlessShopSystem 核心类（金币管理、商品刷新、购买逻辑） | 无 |
| P0 | 金币显示改造为商店入口按钮 | main.js |
| P1 | 商店面板 UI（模态框、商品卡片、购买交互） | UIManager.js |
| P1 | 金币获取挂钩（Boss 击杀、危机事件、存活奖励） | EndlessMode.js |
| P2 | 手动刷新功能（冷却、花费） | EndlessShopSystem |
| P2 | 稀有商品高亮边框与特效 | style.css |
| P3 | 购买动画反馈 | UIManager.js |
