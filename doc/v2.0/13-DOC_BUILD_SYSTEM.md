# 构筑流派系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

在现有祝福系统的基础上，进一步深化流派构筑——玩家在游戏过程中选择不同的「流派路线」，每条路线提供独特的自动合成策略加成，形成多样化的 Build 玩法。

### 1.2 核心流派

| 流派 | 核心思路 | 自动合成策略 | 关键祝福 | 适合场景 |
|---|---|---|---|---|
| **速攻流** | 快速提交低阶订单，以量取胜 | 优先合成低等级元素，尽快提交 | 连击加成、订单加速 | 订单时间较短时 |
| **发育流** | 憋高级元素，一波肥 | 优先合成高等级元素，延迟提交 | 经验加成、合成奖励 | 订单时间充裕时 |
| **均衡流** | 稳扎稳打，见招拆招 | 动态平衡低阶和高阶合成 | 通用加成 | 新手推荐 |
| **道具流** | 以道具为核心，靠道具爆发 | 常规合成，保留道具应对危机 | 道具获取、道具强化 | 喜欢策略操作 |
| **赌狗流** | 高风险高回报，依赖随机事件 | 激进合成，不保底 | 随机奖励、暴击 | 追求刺激 |

### 1.3 流派切换

- **开局选择**：游戏开始时从 3 个随机流派中选择 1 个
- **中途转职**：每存活 60 秒可获得一次「转职」机会（更换流派）
- **流派等级**：选择同一流派多次可提升流派等级，获得更强效果

### 1.4 设计意图

- **重玩性**：不同流派的玩法差异巨大，鼓励玩家多次尝试
- **策略深度**：流派选择 + 祝福搭配 + 实时决策，三层策略叠加
- **个性化**：玩家可以找到最适合自己的流派风格

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/BuildSystem.js` —— 新增，流派系统核心
- `js/core/GameEngine.js` —— 流派效果应用
- `js/ui/UIManager.js` —— 流派选择 UI

### 2.2 BuildSystem 类

```javascript
// js/systems/BuildSystem.js
class BuildSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.currentBuild = null;
    this.buildLevel = 0;
    this._availableBuilds = [];
  }

  static BUILDS = {
    speed: {
      id: 'speed',
      name: '速攻流',
      icon: '⚡',
      description: '快速提交，以量取胜',
      color: '#ff9800',
      // 自动合成策略参数
      strategy: {
        submitPriority: 'earliest',  // 优先提交最早到期的
        mergeTarget: 'lowest',       // 优先合成低等级
        spawnFocus: 'demand',        // 按需求产出
        riskTolerance: 'low',        // 低风险容忍
      },
      // 被动加成
      bonuses: {
        submitSpeedBonus: 0.15,      // 提交速度 +15%
        comboBonus: 0.2,             // 连击加成 +20%
        lowLevelRewardBonus: 0.1,    // 低阶订单奖励 +10%
      },
    },
    growth: {
      id: 'growth',
      name: '发育流',
      icon: '🌱',
      description: '憋高级元素，一波肥',
      color: '#4caf50',
      strategy: {
        submitPriority: 'latest',     // 优先提交最晚到期的
        mergeTarget: 'highest',       // 优先合成高等级
        spawnFocus: 'balanced',       // 均衡产出
        riskTolerance: 'high',        // 高风险容忍
      },
      bonuses: {
        highLevelRewardBonus: 0.25,   // 高阶订单奖励 +25%
        mergeExpBonus: 0.3,           // 合成经验 +30%
        maxLevelCap: 1,               // 可合成等级上限 +1
      },
    },
    balanced: {
      id: 'balanced',
      name: '均衡流',
      icon: '⚖',
      description: '稳扎稳打，见招拆招',
      color: '#42a5f5',
      strategy: {
        submitPriority: 'balanced',
        mergeTarget: 'balanced',
        spawnFocus: 'balanced',
        riskTolerance: 'medium',
      },
      bonuses: {
        allRoundBonus: 0.1,           // 全属性 +10%
        emergencyBonus: 0.15,         // 危机时加成 +15%
      },
    },
    item_master: {
      id: 'item_master',
      name: '道具流',
      icon: '🎒',
      description: '以道具为核心，靠道具爆发',
      color: '#ab47bc',
      strategy: {
        submitPriority: 'balanced',
        mergeTarget: 'balanced',
        spawnFocus: 'demand',
        riskTolerance: 'medium',
      },
      bonuses: {
        itemDropRate: 0.3,            // 道具获取率 +30%
        itemDurationBonus: 0.25,      // 道具持续时间 +25%
        itemEffectBonus: 0.2,         // 道具效果 +20%
        startingItems: ['skip_order', 'time_freeze'],
      },
    },
    lucky: {
      id: 'lucky',
      name: '赌狗流',
      icon: '🎲',
      description: '高风险高回报，一切看脸',
      color: '#e91e63',
      strategy: {
        submitPriority: 'risky',
        mergeTarget: 'risky',
        spawnFocus: 'random',
        riskTolerance: 'extreme',
      },
      bonuses: {
        critChance: 0.15,             // 暴击率 15%
        critMultiplier: 3.0,          // 暴击倍率 x3
        randomBonusChance: 0.2,       // 随机奖励率 20%
        penaltyChance: 0.1,           // 惩罚率 10%（平衡风险）
      },
    },
  };

  /**
   * 获取开局可选的流派
   */
  getStartingChoices(count = 3) {
    const keys = Object.keys(BuildSystem.BUILDS);
    const shuffled = keys.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(k => BuildSystem.BUILDS[k]);
  }

  /**
   * 选择流派
   */
  selectBuild(buildId) {
    const build = BuildSystem.BUILDS[buildId];
    if (!build) return false;

    if (this.currentBuild && this.currentBuild.id === buildId) {
      // 选择同一流派 → 提升等级
      this.buildLevel = Math.min(3, this.buildLevel + 1);
    } else {
      // 切换流派
      this.currentBuild = build;
      this.buildLevel = 1;
    }

    this._applyBonuses();
    return true;
  }

  /**
   * 应用流派加成
   */
  _applyBonuses() {
    if (!this.currentBuild) return;

    const level = this.buildLevel;
    const bonuses = this.currentBuild.bonuses;

    // 将加成注入到引擎
    for (const [key, value] of Object.entries(bonuses)) {
      this.engine[`_buildBonus_${key}`] = value * level;
    }

    // 应用策略参数到自动合成引擎
    if (this.engine.autoPlay) {
      this.engine.autoPlay.setStrategy(this.currentBuild.strategy);
    }

    window.eventBus.emit('build:activated', {
      build: this.currentBuild,
      level: this.buildLevel,
    });
  }

  /**
   * 获取当前流派信息
   */
  getCurrentBuild() {
    if (!this.currentBuild) return null;
    return {
      ...this.currentBuild,
      level: this.buildLevel,
    };
  }
}
```

### 2.3 在 AutoPlaySystem 中应用策略

```javascript
// 在 AutoPlaySystem 中新增
setStrategy(strategy) {
  this._strategy = strategy;
}

_tryAutoSubmit() {
  const orders = this.engine.systems.order.getOrders()
    .filter(o => !o.expired);

  if (!this._strategy || this._strategy.submitPriority === 'earliest') {
    // 速攻流：优先提交最早到期的
    orders.sort((a, b) => a.expiresAt - b.expiresAt);
  } else if (this._strategy.submitPriority === 'latest') {
    // 发育流：优先提交最晚到期的（憋高级元素）
    orders.sort((a, b) => b.expiresAt - a.expiresAt);
  } else if (this._strategy.submitPriority === 'risky') {
    // 赌狗流：随机提交
    orders.sort(() => Math.random() - 0.5);
  }
  // ...后续逻辑...
}
```
