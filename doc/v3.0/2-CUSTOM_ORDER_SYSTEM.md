# 灵素回廊 v3.0 —— 无尽模式·自定义订单系统

## 方案概述

在无尽模式中解锁「自定义订单」功能，允许玩家根据自己的棋盘布局和策略需求，亲手打造个性化订单。系统根据玩家选择的元素类型和等级，自动计算订单价值并生成评分，打造后的订单存入玩家的携带栏位，随时可在游戏中提交。

---

## 一、功能入口与解锁条件

### 1.1 解锁条件

| 条件 | 说明 |
|------|------|
| 前置模式 | 仅无尽模式可用 |
| 解锁方式 | 通过局外成长天赋解锁（消耗星尘） |
| 解锁天赋名 | 「订单工坊」 |
| 解锁消耗 | 500 星尘 |
| 解锁效果 | 开启自定义订单面板，获得 3 个初始携带栏位 |

### 1.2 功能入口

- **无尽模式主界面**：在订单面板上方新增「订单工坊」按钮（🔧）
- **快捷键**：键盘 `C` 键打开自定义订单面板
- **入口可见性**：仅在无尽模式中显示，肉鸽模式隐藏

---

## 二、携带栏位系统

### 2.1 栏位规则

| 项目 | 说明 |
|------|------|
| 初始栏位数 | 3 个 |
| 栏位扩容 | 通过天赋树解锁（最多 +3，总计 6 个） |
| 栏位用途 | 存放玩家打造的自定义订单 |
| 栏位状态 | 空位 / 已占用（显示订单摘要） |
| 栏位持久化 | 同局内持久化，跨关卡保留 |

### 2.2 栏位扩容天赋

| 天赋名称 | 消耗 | 效果 |
|---------|------|------|
| 订单工坊·扩容Ⅰ | 300 星尘 | 携带栏位 +1（共 4 个） |
| 订单工坊·扩容Ⅱ | 600 星尘 | 携带栏位 +1（共 5 个） |
| 订单工坊·扩容Ⅲ | 1000 星尘 | 携带栏位 +1（共 6 个） |

### 2.3 栏位操作

| 操作 | 说明 |
|------|------|
| 打造订单 | 在空栏位中选择元素类型和等级，系统评分后存入 |
| 替换订单 | 在已占用栏位上重新打造，覆盖旧订单 |
| 清空栏位 | 长按/右键删除已打造的订单 |
| 查看详情 | 点击已占用栏位查看订单详情（类型/等级/评分/价值） |

---

## 三、自定义订单打造流程

### 3.1 打造步骤

```
打开订单工坊面板
  ↓
选择一个空栏位（或点击已有栏位选择「重新打造」）
  ↓
步骤1：选择元素类型
  ├── 🔥 火焰
  ├── 💧 水滴
  ├── 🪨 土块
  ├── 🌪 微风
  ├── 🌿 植物
  └── ⚪ 无属性
  ↓
步骤2：选择元素等级（Lv.1 ~ Lv.6）
  ├── Lv.1 初级（基础分 1）
  ├── Lv.2 中级（基础分 3）
  ├── Lv.3 高级（基础分 8）
  ├── Lv.4 稀有（基础分 20）
  ├── Lv.5 史诗（基础分 50）
  └── Lv.6 传说（基础分 120）
  ↓
步骤3：系统自动评分
  ├── 基础价值 = 等级对应 scoreValue
  ├── 品质评级 = 根据等级映射（Lv.1-2 普通, Lv.3 稀有, Lv.4 史诗, Lv.5-6 传说）
  └── 最终评分 = 基础价值 × 品质倍率
  ↓
步骤4：确认打造
  ├── 显示订单预览（图标 + 名称 + 等级 + 评分）
  ├── 显示「确认打造」按钮
  └── 确认后存入栏位
```

### 3.2 打造界面布局

```
┌─────────────────────────────────────┐
│  🔧 订单工坊                          │
│                                      │
│  ┌─ 携带栏位 ──────────────────────┐ │
│  │ [空位1]  [空位2]  [空位3]       │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ── 打造新订单 ──                     │
│                                      │
│  元素类型:                            │
│  [🔥] [💧] [🪨] [🌪] [🌿] [⚪]       │
│                                      │
│  元素等级:                            │
│  [1] [2] [3] [4] [5] [6]             │
│                                      │
│  ┌─ 订单预览 ──────────────────────┐ │
│  │  🔥 火焰 · Lv.3                  │ │
│  │  评分: ★★★☆☆ 稀有               │ │
│  │  价值: 40 积分                    │ │
│  └──────────────────────────────────┘ │
│                                      │
│  [✅ 确认打造]                        │
└─────────────────────────────────────┘
```

---

## 四、评分系统

### 4.1 基础价值表

| 等级 | 基础价值（scoreValue） | 品质评级 | 品质倍率 |
|------|----------------------|---------|---------|
| Lv.1 | 1 | 普通（common） | ×1.0 |
| Lv.2 | 3 | 普通（common） | ×1.0 |
| Lv.3 | 8 | 稀有（rare） | ×1.5 |
| Lv.4 | 20 | 史诗（epic） | ×2.5 |
| Lv.5 | 50 | 传说（legendary） | ×5.0 |
| Lv.6 | 120 | 传说（legendary） | ×5.0 |

### 4.2 最终价值计算公式

```
最终价值 = 基础价值 × 品质倍率
```

| 等级 | 计算过程 | 最终价值 |
|------|---------|---------|
| Lv.1 | 1 × 1.0 | 1 |
| Lv.2 | 3 × 1.0 | 3 |
| Lv.3 | 8 × 1.5 | 12 |
| Lv.4 | 20 × 2.5 | 50 |
| Lv.5 | 50 × 5.0 | 250 |
| Lv.6 | 120 × 5.0 | 600 |

### 4.3 评分星级

| 最终价值区间 | 星级 | 评级标签 |
|-------------|------|---------|
| 1 ~ 5 | ★☆☆☆☆ | 普通 |
| 6 ~ 20 | ★★☆☆☆ | 优良 |
| 21 ~ 60 | ★★★☆☆ | 稀有 |
| 61 ~ 300 | ★★★★☆ | 史诗 |
| 301 ~ 600 | ★★★★★ | 传说 |

### 4.4 评分展示

打造完成后，订单卡片上显示：
- 元素图标和名称
- 等级标签（Lv.X）
- 星级评分（★ 图标）
- 最终价值数值
- 品质颜色边框（灰/蓝/紫/金）

---

## 五、自定义订单与游戏内订单系统的关系

### 5.1 共存规则

| 方面 | 系统自动订单 | 自定义订单 |
|------|------------|-----------|
| 来源 | 系统自动生成 | 玩家亲手打造 |
| 倒计时 | 有（45~75秒） | **无倒计时** |
| 数量 | 由 maxOrders 控制 | 由携带栏位控制（3~6个） |
| 刷新 | 提交后自动补充 | 提交后栏位变空，需重新打造 |
| 显示位置 | 订单面板左侧 | 订单面板右侧/下方 |
| 提交方式 | 点击订单卡片 | 点击订单卡片（同自动订单） |
| 积分奖励 | 正常计算 | 按评分系统计算的最终价值 |
| 过期 | 会过期 | **永不过期** |

### 5.2 提交逻辑

自定义订单的提交复用现有 `_onOrderClicked` 逻辑，但需要区分订单来源：

```javascript
// 自定义订单对象结构
{
  id: 'custom_order_xxx',
  elementType: 'fire',
  level: 3,
  reward: 12,           // 由评分系统计算
  quality: 'rare',       // 品质评级
  stars: 3,              // 星级
  isCustom: true,        // 标记为自定义订单
  slotIndex: 0,          // 所属栏位索引
  completed: false,
  expired: false,        // 永不过期
}
```

### 5.3 提交后行为

1. 从携带栏位中移除该订单
2. 栏位变为空位
3. 积分奖励 = 订单的最终价值
4. 触发正常的订单提交事件（特效、音效等）
5. 不触发系统订单的补充逻辑（因为是自定义订单）

---

## 六、数值平衡说明

### 6.1 自定义订单 vs 系统订单价值对比

| 等级 | 系统订单平均价值 | 自定义订单价值 | 比值 |
|------|----------------|---------------|------|
| Lv.2 | 10~18 | 3 | 自定义偏低 |
| Lv.3 | 30~40 | 12 | 自定义偏低 |
| Lv.4 | 80~95 | 50 | 自定义偏低 |
| Lv.5 | 180~220 | 250 | 自定义偏高 |
| Lv.6 | 无（系统最高Lv.5） | 600 | 独特优势 |

### 6.2 设计理由

- **低等级（Lv.1~4）**：自定义订单价值低于系统订单，鼓励玩家在前期使用系统订单
- **高等级（Lv.5~6）**：自定义订单价值高于系统订单，奖励玩家合成高等级元素的能力
- **无倒计时**：自定义订单的最大优势——可以囤积高价值订单等待最佳时机提交
- **栏位限制**：3~6 个栏位限制了玩家同时持有的自定义订单数量，防止过度囤积

### 6.3 策略考量

- 玩家可以在空闲时打造高等级订单备用
- 面对紧急情况（棋盘快满时），可以提交自定义订单快速清空棋盘
- 高等级自定义订单（Lv.5~6）是后期冲分的关键
- 与系统订单配合使用：系统订单有倒计时压力，自定义订单无压力

---

## 七、实现方案

### 7.1 新增文件

| 文件 | 职责 |
|------|------|
| `js/systems/CustomOrderSystem.js` | 自定义订单核心逻辑（打造/评分/栏位管理） |
| `js/ui/CustomOrderUI.js` | 订单工坊面板UI |

### 7.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `js/core/GameEngine.js` | 初始化 CustomOrderSystem；_onOrderClicked 中处理自定义订单提交 |
| `js/systems/OrderSystem.js` | 新增 `submitCustomOrder` 方法（不触发自动补充） |
| `js/ui/UIManager.js` | 订单面板中新增自定义订单区域；添加工坊按钮 |
| `js/systems/MetaProgress.js` | 新增「订单工坊」天赋及其扩容天赋 |
| `index.html` | 引入 CustomOrderUI.js 脚本 |

### 7.3 CustomOrderSystem 核心设计

```javascript
class CustomOrderSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.slots = [];           // 携带栏位数组
    this.maxSlots = 3;         // 初始栏位数
    this.isUnlocked = false;   // 是否已解锁
  }

  /** 解锁自定义订单功能 */
  unlock() { this.isUnlocked = true; }

  /** 扩容栏位 */
  expandSlot() { this.maxSlots++; }

  /** 打造订单 */
  craftOrder(slotIndex, elementType, level) {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
    const value = this._calculateValue(elementType, level);
    const quality = this._evaluateQuality(level);
    const stars = this._calculateStars(value);
    const order = {
      id: `custom_order_${Date.now()}`,
      elementType,
      level,
      reward: value,
      quality,
      stars,
      isCustom: true,
      slotIndex,
      completed: false,
      expired: false,
    };
    this.slots[slotIndex] = order;
    return order;
  }

  /** 计算订单价值 */
  _calculateValue(elementType, level) {
    const baseValues = { 1: 1, 2: 3, 3: 8, 4: 20, 5: 50, 6: 120 };
    const qualityMultipliers = { 1: 1.0, 2: 1.0, 3: 1.5, 4: 2.5, 5: 5.0, 6: 5.0 };
    const base = baseValues[level] || 1;
    const mult = qualityMultipliers[level] || 1.0;
    return Math.floor(base * mult);
  }

  /** 评价品质 */
  _evaluateQuality(level) {
    const map = { 1: 'common', 2: 'common', 3: 'rare', 4: 'epic', 5: 'legendary', 6: 'legendary' };
    return map[level] || 'common';
  }

  /** 计算星级 */
  _calculateStars(value) {
    if (value <= 5) return 1;
    if (value <= 20) return 2;
    if (value <= 60) return 3;
    if (value <= 300) return 4;
    return 5;
  }

  /** 提交自定义订单 */
  submitOrder(slotIndex) {
    const order = this.slots[slotIndex];
    if (!order || order.completed) return null;
    order.completed = true;
    this.slots[slotIndex] = null; // 清空栏位
    return order;
  }

  /** 获取栏位状态 */
  getSlots() { return [...this.slots]; }

  /** 序列化 */
  serialize() {
    return {
      slots: this.slots,
      maxSlots: this.maxSlots,
      isUnlocked: this.isUnlocked,
    };
  }
}
```

### 7.4 提交处理（GameEngine.js 修改）

在 `_onOrderClicked` 中，先判断订单是否为自定义订单：

```javascript
_onOrderClicked(orderId) {
  // ... 现有逻辑 ...

  // 检查是否为自定义订单
  if (orderId.startsWith('custom_order_')) {
    // 从 CustomOrderSystem 中查找
    const slotIndex = this.customOrderSystem.slots.findIndex(
      s => s && s.id === orderId
    );
    if (slotIndex === -1) return;
    
    const order = this.customOrderSystem.submitOrder(slotIndex);
    if (!order) return;
    
    // 检查棋盘上是否有匹配元素
    const matches = this.systems.spawn.findElementsByTypeAndLevel(
      this.state.board, order.elementType, order.level
    );
    if (matches.length === 0) {
      // 撤销提交（栏位恢复）
      this.customOrderSystem.slots[slotIndex] = order;
      order.completed = false;
      return;
    }
    
    // 消耗元素
    const match = matches[0];
    this.systems.spawn.removeElement(this.state.board, match.element);
    
    // 发放积分
    this.state.score += order.reward;
    
    // 更新UI
    window.eventBus.emit('custom-order:submitted', { slotIndex, order });
    window.eventBus.emit('score:updated', { score: this.state.score });
    return;
  }

  // ... 现有系统订单逻辑 ...
}
```

---

## 八、UI 设计

### 8.1 订单面板布局（无尽模式）

```
┌─────────────────────────────────────────┐
│  📋 订单面板    [🔧 订单工坊]            │
├─────────────────────────────────────────┤
│                                         │
│  ── 系统订单（有时限） ──               │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │🔥Lv.3│ │💧Lv.2│ │🌿Lv.4│            │
│  │ 12分 │ │ 3分  │ │ 50分 │            │
│  │ ⏱32s │ │ ⏱18s │ │ ⏱55s │            │
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  ── 自定义订单（无时限） ──              │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │🔥Lv.5│ │ 空位  │ │ 空位  │            │
│  │250分 │ │      │ │      │            │
│  │★★★★★│ │      │ │      │            │
│  └──────┘ └──────┘ └──────┘            │
└─────────────────────────────────────────┘
```

### 8.2 自定义订单卡片样式

```css
.custom-order-card {
  width: 100px;
  height: 100px;
  border-radius: 10px;
  border: 2px solid var(--quality-color);
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.custom-order-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px var(--quality-color)33;
}

.custom-order-card .stars {
  font-size: 10px;
  letter-spacing: 1px;
}

.custom-order-card .value {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
}

.custom-order-empty {
  border: 2px dashed rgba(255,255,255,0.2);
  opacity: 0.5;
}

.custom-order-empty:hover {
  opacity: 0.8;
  border-color: rgba(255,255,255,0.4);
}
```

---

## 九、与现有系统的交互

### 9.1 与祝福系统的交互

| 祝福 | 交互影响 |
|------|---------|
| 急单奖励（订单积分+30%） | 对自定义订单生效，最终价值 ×1.3 |
| 高价收购（首单3倍） | 对自定义订单生效（如果自定义订单是本关第一个提交的订单） |
| 批量交付 | 对自定义订单不生效（仅系统订单） |
| 需求预见（多显示一个订单） | 对自定义订单不生效（由栏位控制） |

### 9.2 与 Boss 机制的交互

| Boss | 交互影响 |
|------|---------|
| 熔岩巨像 | 自定义订单无影响，正常提交 |
| 冰霜女巫 | 自定义订单无影响，正常提交 |
| 混沌之核 | 自定义订单不会被刷新（无倒计时） |
| 时间吞噬者 | 自定义订单无倒计时，可正常提交 |
| 创世之灵 | 自定义订单无影响，正常提交 |

### 9.3 与道具系统的交互

| 道具 | 交互影响 |
|------|---------|
| 双倍积分 | 自定义订单提交积分翻倍 |
| 加急订单 | 与自定义订单独立，互不影响 |
| 自动合成 | 自动合成不会自动提交自定义订单（需手动） |

---

## 十、数据存储

### 10.1 序列化结构

```javascript
// 保存在游戏存档中
customOrderSystem: {
  isUnlocked: true,
  maxSlots: 3,
  slots: [
    null,  // 空位
    {
      id: 'custom_order_1730700000123',
      elementType: 'fire',
      level: 5,
      reward: 250,
      quality: 'legendary',
      stars: 4,
      isCustom: true,
      slotIndex: 1,
      completed: false,
      expired: false,
    },
    null,  // 空位
  ],
}
```

### 10.2 跨关卡持久化

自定义订单栏位在无尽模式中跨关卡保留，不会在进入新关卡时被清空。仅在提交后对应栏位变为空位。

---

## 十一、开发路线图

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| P0 | CustomOrderSystem 核心逻辑（打造/评分/栏位管理） | 2h |
| P0 | GameEngine 集成（初始化、提交处理） | 1h |
| P0 | 基础UI（工坊面板、栏位显示） | 2h |
| P1 | 天赋树集成（解锁 + 扩容） | 1h |
| P1 | 订单面板自定义订单区域 | 1h |
| P2 | 音效/特效反馈 | 0.5h |
| P2 | 数值平衡调整 | 1h |
