# 升级系统（局外成长）—— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

引入局外成长机制——每次游戏结束后根据表现获得升级点数，用于永久提升基础属性，让玩家感受到「每次失败都在变强」的成长感。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **升级点数获取** | 每存活 30 秒获得 1 点，每提交 5 个订单额外获得 1 点 |
| **升级项目** | 见下表 |
| **重置机制** | 所有升级可免费重置重新分配 |
| **存储方式** | localStorage 持久化保存 |

### 1.3 升级项目

| 升级项 | 最大等级 | 每级效果 | 每级花费 | 说明 |
|---|---|---|---|---|
| **初始积分** | 5 | +2 初始积分 | 3 点 | 初始 10 → 12 → 14 → ... → 20 |
| **订单时间** | 5 | +10% 倒计时时长 | 2 点 | 缓解时间压力 |
| **发射器速度** | 5 | -8% 冷却时间 | 3 点 | 更快产出元素 |
| **积分加成** | 5 | +5% 订单积分 | 3 点 | 更多积分收入 |
| **道具上限** | 3 | 道具堆叠上限 +1 | 4 点 | 更多道具储备 |

### 1.4 设计意图

- **Roguelike 经典设计**：局外成长是肉鸽类游戏的核心魅力之一——「每次失败都是积累」
- **降低挫败感**：即使游戏失败，获得的升级点数也让玩家感觉有收获
- **长期留存**：升级系统为玩家提供明确的长期目标

### 1.5 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 生存积分制 | 初始积分升级直接影响生存能力 |
| 订单倒计时 | 订单时间升级延长倒计时 |
| 自动合成引擎 | 发射器速度升级提高产出效率 |
| 道具系统 | 道具上限升级增加储备 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/UpgradeSystem.js` —— 新增，升级系统核心
- `js/ui/UIManager.js` —— 升级界面
- `js/core/GameEngine.js` —— 应用升级效果

### 2.2 UpgradeSystem 类

```javascript
// js/systems/UpgradeSystem.js
class UpgradeSystem {
  static STORAGE_KEY = 'lingSu_upgrades';

  static UPGRADE_DEFS = {
    initial_score: {
      id: 'initial_score',
      name: '初始积分',
      icon: '❤️',
      description: '每级 +2 初始积分',
      maxLevel: 5,
      costPerLevel: 3,
      effect: (level) => ({ initialScore: level * 2 }),
    },
    order_time: {
      id: 'order_time',
      name: '订单时间',
      icon: '⏱️',
      description: '每级 +10% 订单倒计时',
      maxLevel: 5,
      costPerLevel: 2,
      effect: (level) => ({ orderTimeMultiplier: 1 + level * 0.1 }),
    },
    emitter_speed: {
      id: 'emitter_speed',
      name: '发射器速度',
      icon: '⚡',
      description: '每级 -8% 发射器冷却',
      maxLevel: 5,
      costPerLevel: 3,
      effect: (level) => ({ emitterCooldownReduction: level * 0.08 }),
    },
    score_bonus: {
      id: 'score_bonus',
      name: '积分加成',
      icon: '🌟',
      description: '每级 +5% 订单积分',
      maxLevel: 5,
      costPerLevel: 3,
      effect: (level) => ({ scoreMultiplier: 1 + level * 0.05 }),
    },
    item_capacity: {
      id: 'item_capacity',
      name: '道具上限',
      icon: '🎒',
      description: '每级道具堆叠上限 +1',
      maxLevel: 3,
      costPerLevel: 4,
      effect: (level) => ({ extraItemCapacity: level }),
    },
  };

  constructor() {
    this.data = this._load();
  }

  /**
   * 获取升级点数
   */
  getPoints() {
    return this.data.points || 0;
  }

  /**
   * 添加升级点数
   */
  addPoints(amount) {
    this.data.points = (this.data.points || 0) + amount;
    this._save();
  }

  /**
   * 获取指定升级的等级
   */
  getLevel(upgradeId) {
    return this.data.levels[upgradeId] || 0;
  }

  /**
   * 升级
   * @param {string} upgradeId - 升级项 ID
   * @returns {boolean} 是否成功
   */
  upgrade(upgradeId) {
    const def = UpgradeSystem.UPGRADE_DEFS[upgradeId];
    if (!def) return false;

    const currentLevel = this.getLevel(upgradeId);
    if (currentLevel >= def.maxLevel) return false;

    const cost = def.costPerLevel;
    if ((this.data.points || 0) < cost) return false;

    this.data.points -= cost;
    this.data.levels[upgradeId] = currentLevel + 1;
    this._save();
    return true;
  }

  /**
   * 重置所有升级
   */
  reset() {
    const refund = this._calculateTotalSpent();
    this.data.levels = {};
    this.data.points = (this.data.points || 0) + refund;
    this._save();
  }

  /**
   * 获取所有已激活的效果
   */
  getActiveEffects() {
    const effects = {
      initialScore: 0,
      orderTimeMultiplier: 1,
      emitterCooldownReduction: 0,
      scoreMultiplier: 1,
      extraItemCapacity: 0,
    };

    for (const [id, def] of Object.entries(UpgradeSystem.UPGRADE_DEFS)) {
      const level = this.getLevel(id);
      if (level > 0) {
        const partial = def.effect(level);
        Object.assign(effects, partial);
      }
    }
    return effects;
  }

  _calculateTotalSpent() {
    let total = 0;
    for (const [id, level] of Object.entries(this.data.levels)) {
      const def = UpgradeSystem.UPGRADE_DEFS[id];
      if (def) total += level * def.costPerLevel;
    }
    return total;
  }

  _load() {
    try {
      const raw = localStorage.getItem(UpgradeSystem.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { points: 0, levels: {} };
  }

  _save() {
    localStorage.setItem(UpgradeSystem.STORAGE_KEY, JSON.stringify(this.data));
  }
}
```

### 2.3 在 GameEngine 中应用升级效果

```javascript
// 在 startRogueLevel 中
startRogueLevel(targetScore, node) {
  // 应用升级效果
  const effects = this.upgradeSystem.getActiveEffects();
  this.state.score = 10 + effects.initialScore;
  this._upgradeEffects = effects;

  // ...原有逻辑...
}

// 在订单生成时应用时间加成
// OrderSystem.generateOrder 中
const timeMultiplier = gameEngine._upgradeEffects?.orderTimeMultiplier || 1;
order.timeLimit = Math.floor(baseTime * timeMultiplier);
order.expiresAt = Date.now() + order.timeLimit;

// 在提交订单时应用积分加成
// _onOrderClicked 中
const scoreBonus = this._upgradeEffects?.scoreMultiplier || 1;
reward = Math.floor(reward * scoreBonus);
```

### 2.4 游戏结束时发放升级点数

```javascript
_onGameOver(reason) {
  // 计算获得的升级点数
  const survivalPoints = Math.floor(this._survivalTime / 30000); // 每 30 秒 1 点
  const orderPoints = Math.floor(this._totalOrdersCompleted / 5); // 每 5 个订单 1 点
  const totalPoints = survivalPoints + orderPoints;

  if (totalPoints > 0) {
    this.upgradeSystem.addPoints(totalPoints);
  }

  // ...原有逻辑...
}
```
