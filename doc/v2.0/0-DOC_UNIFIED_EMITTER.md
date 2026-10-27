# 单一发射器 + 元素解锁系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

将原有的 5 个独立发射器（火焰/水滴/土块/微风/植物）合并为**一个统一的「灵素之源」发射器**，点击后按概率产出多种元素。玩家初始只能产出一种基础的**无属性元素**，随着游戏进程通过获得「元素亲和」系列祝福逐步解锁火/水/土/风/植物等属性元素。另有新增祝福支持单次点击产出多种不同类型元素。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **发射器数量** | 唯一的 1 个「灵素之源」发射器 |
| **初始可产出** | 仅「无属性元素」⚪（基础元素，无属性标签） |
| **属性元素解锁** | 获得对应「元素亲和·X」祝福后解锁该属性元素 |
| **无属性元素退出** | 获得任意一个「元素亲和」祝福后，无属性元素不再产出 |
| **产出概率** | 已解锁元素按配置的概率分布随机产出 |
| **多元素产出** | 新增祝福可使单次点击产出 2~3 种不同元素 |
| **订单适配** | 仅产出无属性元素时：订单从五种属性元素中随机生成；已产出属性元素时：订单按发射器产出类型加权，至少保留 1 个与发射器对应元素类型的订单，但仍可能出现其他元素类型的订单 |

### 1.3 无属性元素特殊规则

| 规则项 | 说明 |
|---|---|
| **元素类型** | 无属性（`basic`），图标 ⚪，无元素标签 |
| **合成规则** | 与普通元素相同——两个同等级无属性元素合成为高一级无属性元素 |
| **提交规则** | 无属性元素可以提交**任意类型**的订单，但等级需比订单需求**高 1 级**才可提交 |
| **退出机制** | 获得任意一个「元素亲和·X」祝福后，发射器不再产出无属性元素；同时棋盘上已有的无属性元素**全部转化为该祝福对应的属性元素**，等级保持不变 |

**提交示例**：
- 订单需求：火焰 Lv.3
- 棋盘上有：无属性 Lv.4 元素
- 结果：可以用无属性 Lv.4 代替提交（比需求高 1 级），不限订单元素类型

**转化示例**：
- 获得「元素亲和·火」祝福时
- 棋盘上有：无属性 Lv.2 × 3、无属性 Lv.3 × 1
- 转化后：火焰 Lv.2 × 3、火焰 Lv.3 × 1

### 1.4 元素解锁流程

```
游戏开始
    │
    ▼
┌──────────────────────────────────────┐
│  初始解锁：无属性元素（⚪）           │
│  产出概率：无属性 100%                │
│  订单范围：五种属性元素随机生成        │
│  提交方式：无属性元素比订单需求高 1 级 │
│           即可提交任意类型订单         │
│  玩家目标：合成无属性元素提交订单      │
└──────────────────────────────────────┘
    │
    ▼ 获得第一个「元素亲和」祝福（如·火）
┌──────────────────────────────────────┐
│  解锁：火焰（🔥）                     │
│  无属性元素停止产出                    │
│  ★ 棋盘上所有无属性元素 → 火焰（同等级）│
│  产出概率：火焰 100%                   │
│  订单范围：火焰订单权重增加，至少保留 1 │
│           个火焰订单，仍可能生成其他元素│
└──────────────────────────────────────┘
    │
    ▼ 获得「元素亲和·水」祝福
┌──────────────────────────────────┐
│  已解锁：火焰 + 水滴              │
│  产出概率：火焰 60% / 水滴 40%    │
│  订单范围：火/水订单权重增加，至少 │
│           保留 1 个火/水订单       │
└──────────────────────────────────┘
    │
    ▼ 获得「元素亲和·土」祝福
┌──────────────────────────────────┐
│  已解锁：火焰 + 水滴 + 土块       │
│  产出概率：火焰 40% / 水滴 30%    │
│            / 土块 30%             │
│  订单范围：火/水/土订单权重增加    │
└──────────────────────────────────┘
    │
    ▼ 获得「元素亲和·风」祝福
┌──────────────────────────────────┐
│  已解锁：火焰+水滴+土块+风        │
│  产出概率：火焰 30% / 水滴 25%    │
│            / 土块 25% / 风 20%    │
│  订单范围：四种元素订单权重增加    │
└──────────────────────────────────┘
    │
    ▼ 获得「元素亲和·植物」祝福
┌──────────────────────────────────┐
│  全部五种属性元素已解锁            │
│  产出概率：各 20% 均匀分布         │
│  订单范围：全部五种元素            │
└──────────────────────────────────┘
```

### 1.5 概率分布设计

#### 属性元素概率（获得亲和祝福后，无属性退出）

| 已解锁属性元素数 | 概率分布 |
|---|---|
| 1 种 | 100% |
| 2 种 | 60% / 40% |
| 3 种 | 40% / 30% / 30% |
| 4 种 | 30% / 25% / 25% / 20% |
| 5 种 | 各 20% 均匀分布 |

**设计理由**：越晚解锁的元素概率越低，鼓励玩家优先解锁新元素，同时保证早期元素有稳定的产出保障。

#### 多元素产出祝福（新增祝福，原有祝福效果不动）

| 祝福 | 效果 | 触发条件 |
|---|---|---|
| **元素共鸣**（boon_element_resonance） | 原有效果不变（元素共鸣相关） | — |
| **变异孢子**（boon_variant_spore） | 原有效果不变（变异孢子相关） | — |
| **双重产出**（boon_dual_spawn） | 原有效果不变（20%概率产2个） | — |
| **（新增）灵素分流**（boon_split_flow） | 单次点击产出 2 种不同属性元素 | 已解锁 ≥ 2 种属性元素 |
| **（新增）万象之源**（boon_myriad_source） | 单次点击产出 3 种不同属性元素 | 已解锁 ≥ 3 种属性元素 |

**多元素产出的交互规则**：
- 灵素分流 + 万象之源 同时拥有时，取最高效果（3 种）
- 双重产出可与多元素祝福叠加：20%概率触发时，产出 2 组多元素（共 4~6 个元素）
- 多元素产出时，每种元素类型不重复
- 多元素产出仅在「可产出多种属性元素」的条件下生效

### 1.6 订单系统适配

| 规则项 | 说明 |
|---|---|
| **仅产出无属性元素时** | 订单从五种属性元素中**随机生成**，不设权重偏向 |
| **已产出属性元素时** | 订单按发射器当前产出类型加权，**至少保留 1 个**与发射器对应元素类型的订单；但仍可能生成其他元素类型的订单（促使玩家使用刷新功能） |
| **无属性提交** | 无属性元素可提交任意类型订单，但等级需比订单需求高 1 级 |
| **难度递进** | 随解锁元素增多，订单难度和奖励逐步提升 |
| **卡关防护** | 至少保证 1 个可完成的订单存在于列表中 |
| **解锁过渡** | 解锁新元素后，首批订单为低难度（Lv.1~2） |

### 1.7 设计意图

- **降低前期复杂度**：初期只有 1 个发射器 + 1 种无属性元素，玩家专注学习合成机制
- **无属性缓冲期**：在获得第一个亲和祝福前，玩家用无属性元素应对随机生成的订单，熟悉核心玩法
- **高一级提交的巧思**：无属性元素不能直接提交，但高一级可代替——既保持了无属性的「练习」定位，又让残留的无属性元素有价值
- **订单加权设计**：已产出属性元素时，订单偏向发射器产出类型（至少保留 1 个对应订单），但仍保留其他元素类型的订单，促使玩家使用刷新功能灵活调配
- **刷新功能价值**：当订单列表中出现难以完成的非产出类型订单时，刷新功能成为关键的策略调节手段
- **渐进式教学**：每解锁一种新属性元素都是一次「啊哈时刻」，保持新鲜感
- **策略深度**：玩家需要规划解锁顺序——先解锁哪种元素？是否跳过某些元素？
- **祝福价值重塑**：「元素亲和」系列祝福从「锦上添花」变为「核心解锁要素」
- **减少操作负担**：不再需要在 5 个发射器之间切换点击，聚焦于合成策略

---

## 二、技术实现方案

### 2.1 涉及文件

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `js/config/gameConfig.js` | 修改 | 新增无属性元素类型、替换 EMITTER_CONFIGS 为单一发射器 |
| `js/entities/Emitter.js` | 修改 | 新增概率产出逻辑、多元素产出逻辑 |
| `js/systems/BoonSystem.js` | 修改 | 新增元素解锁状态管理、亲和祝福处理、无属性退出机制 |
| `js/core/GameEngine.js` | 修改 | 适配单一发射器、初始化解锁状态、无属性提交逻辑 |
| `js/systems/OrderSystem.js` | 修改 | 订单生成适配已解锁属性元素、卡关防护 |
| `js/ui/UIManager.js` | 修改 | 发射器 UI 改为单一按钮 + 元素池展示 |
| `js/config/rogueConfig.js` | 修改 | 调整元素亲和祝福的 apply 逻辑；新增灵素分流、万象之源祝福 |
| `js/systems/AutoPlaySystem.js` | 修改 | 适配单一发射器的自动决策 |

### 2.2 数据结构设计

#### 2.2.1 元素类型新增（gameConfig.js）

```javascript
// 在 ELEMENT_TYPES 中新增无属性元素
const ELEMENT_TYPES = {
  basic: {
    id: 'basic',
    name: '无属性',
    icon: '⚪',
    color: '#AAAAAA',
    bgColor: '#F5F5F5',
    description: '纯净的无属性灵力，可转化为任何元素',
  },
  fire: { /* 原有不变 */ },
  water: { /* 原有不变 */ },
  earth: { /* 原有不变 */ },
  air: { /* 原有不变 */ },
  plant: { /* 原有不变 */ },
};
```

#### 2.2.2 元素解锁状态（BoonSystem 新增）

```javascript
class BoonSystem {
  constructor() {
    // ...原有代码...
    
    /**
     * 元素解锁状态
     * @type {Object<string, boolean>}
     * key: 元素类型ID (fire/water/earth/air/plant)
     * value: 是否已解锁
     */
    this._unlockedElements = {};
    
    /**
     * 元素产出概率配置
     * @type {Object<string, number>}
     */
    this._spawnProbabilities = {};
    
    /**
     * 是否已获得亲和祝福（控制无属性元素退出）
     */
    this._hasAnyAffinityBoon = false;
    
    /**
     * 多元素产出祝福激活状态（新增祝福）
     */
    this._multiSpawnBoons = {
      splitFlow: false,    // 灵素分流：2种不同属性元素
      myriadSource: false, // 万象之源：3种不同属性元素
    };
  }
}
```

#### 2.2.3 单一发射器配置

```javascript
// 在 gameConfig.js 中替换 EMITTER_CONFIGS
const EMITTER_CONFIGS = [
  {
    id: 'emitter_unified',
    elementType: 'unified',  // 特殊类型标识
    name: '灵素之源',
    icon: '✨',
    cooldownMs: 2000,
    spawnLevel: 1,
    description: '汇聚天地灵素的源泉，产出已解锁的元素',
  },
];
```

### 2.3 Emitter 类改造

```javascript
// js/entities/Emitter.js — 新增方法

class Emitter {
  constructor(config) {
    // ...原有代码不变...
  }

  /**
   * 执行产出（改造版）
   * 支持概率产出和多元素产出
   * @param {number} currentTime - 当前时间戳
   * @param {Object} spawnContext - 产出上下文
   * @param {string[]} spawnContext.availableTypes - 可产出的元素类型列表
   * @param {Object<string, number>} spawnContext.probabilities - 概率映射
   * @param {Object} spawnContext.multiSpawnFlags - 多元素产出标志
   * @returns {Element|Element[]|null} 产出元素或元素数组
   */
  spawn(currentTime, spawnContext = null) {
    if (!this.isReadyToSpawn(currentTime)) return null;
    
    this.lastSpawnTime = currentTime;
    this._frozenDuration = 0;
    this.totalSpawns++;
    
    if (!spawnContext || !spawnContext.availableTypes || spawnContext.availableTypes.length === 0) {
      return null;
    }
    
    const results = [];
    const { availableTypes, probabilities, multiSpawnFlags } = spawnContext;
    
    // 计算本次点击要产出几组元素
    let groups = 1;
    if (Math.random() < (this.modifiers.dualChance || 0)) groups = 2;  // 双重产出：20%概率2组
    
    for (let g = 0; g < groups; g++) {
      // 计算每组产出几种不同元素
      let typesInGroup = 1;
      if (multiSpawnFlags.myriadSource && availableTypes.length >= 3) {
        typesInGroup = 3;  // 万象之源：3种不同属性元素
      } else if (multiSpawnFlags.splitFlow && availableTypes.length >= 2) {
        typesInGroup = 2;  // 灵素分流：2种不同属性元素
      }
      
      // 从可用元素中按概率选出 typesInGroup 种不同类型
      const selectedTypes = this._pickDistinctTypes(
        availableTypes, probabilities, typesInGroup
      );
      
      for (const type of selectedTypes) {
        let level = this.spawnLevel + this.modifiers.spawnLevelBonus;
        if (Math.random() < this.modifiers.upgradeChance) {
          level += 1;
        }
        level = Math.min(level, ELEMENT_LEVELS.length);
        results.push(new Element(type, level));
      }
    }
    
    if (results.length === 1) return results[0];
    return results;
  }

  /**
   * 从可用元素中按概率选出指定数量的不同类型
   */
  _pickDistinctTypes(types, probs, count) {
    if (types.length <= count) return [...types];
    
    const selected = [];
    const available = [...types];
    
    for (let i = 0; i < count; i++) {
      const totalWeight = available.reduce((sum, t) => sum + (probs[t] || 0), 0);
      let rand = Math.random() * totalWeight;
      
      for (let j = 0; j < available.length; j++) {
        const type = available[j];
        rand -= (probs[type] || 0);
        if (rand <= 0) {
          selected.push(type);
          available.splice(j, 1);
          break;
        }
      }
    }
    
    return selected;
  }
}
```

### 2.4 BoonSystem 新增方法

```javascript
/**
 * 初始化元素解锁状态（新局调用）
 */
initElementUnlocks() {
  this._unlockedElements = {};
  this._spawnProbabilities = {};
  this._hasAnyAffinityBoon = false;
  this._multiSpawnBoons = {
    splitFlow: false,
    myriadSource: false,
  };
  
  // 初始只产出无属性元素（不加入 _unlockedElements，由 getSpawnContext 特殊处理）
}

/**
 * 获取产出上下文（供 Emitter.spawn 使用）
 * @returns {object|null}
 */
getSpawnContext() {
  let availableTypes;
  let probabilities;
  
  if (!this._hasAnyAffinityBoon) {
    // 未获得任何亲和祝福：只产出无属性元素
    availableTypes = ['basic'];
    probabilities = { basic: 1.0 };
  } else {
    // 已获得亲和祝福：产出已解锁的属性元素
    const types = this.getUnlockedTypes();
    if (types.length === 0) return null;
    availableTypes = types;
    probabilities = { ...this._spawnProbabilities };
  }
  
  return {
    availableTypes,
    probabilities,
    multiSpawnFlags: { ...this._multiSpawnBoons },
  };
}

/**
 * 处理元素亲和祝福的获取
 * @param {string} boonId - 祝福ID
 * @returns {boolean} 是否首次获得亲和祝福
 */
handleAffinityBoon(boonId) {
  const affinityMap = {
    'boon_fire_affinity': 'fire',
    'boon_water_affinity': 'water',
    'boon_earth_affinity': 'earth',
    'boon_air_affinity': 'air',
    'boon_plant_affinity': 'plant',
  };
  
  const elementType = affinityMap[boonId];
  if (!elementType) return false;
  
  const isFirstAffinity = !this._hasAnyAffinityBoon;
  
  // 解锁属性元素
  if (!this._unlockedElements[elementType]) {
    this._unlockedElements[elementType] = true;
  }
  
  // 标记已获得亲和祝福（触发无属性退出）
  this._hasAnyAffinityBoon = true;
  
  // 重新计算概率
  this._recalculateProbabilities();
  
  // 如果是首次获得亲和祝福，触发无属性元素转化事件
  if (isFirstAffinity) {
    window.eventBus.emit('element:convert-basic', {
      convertTo: elementType,
    });
  }
  
  window.eventBus.emit('element:unlocked', {
    type: elementType,
    name: ELEMENT_TYPES[elementType]?.name || elementType,
    icon: ELEMENT_TYPES[elementType]?.icon || '?',
    unlockedCount: this.getUnlockedCount(),
    totalTypes: Object.keys(ELEMENT_TYPES).length - 1, // 减去 basic
    isFirstAffinity: isFirstAffinity,
    basicWithdrawn: isFirstAffinity, // 无属性退出
  });
  
  return isFirstAffinity;
}

/**
 * 重新计算所有已解锁属性元素的产出概率
 */
_recalculateProbabilities() {
  const types = this.getUnlockedTypes();
  const count = types.length;
  
  if (count === 0) {
    this._spawnProbabilities = {};
    return;
  }
  
  const distribution = {
    1: [1.0],
    2: [0.6, 0.4],
    3: [0.4, 0.3, 0.3],
    4: [0.3, 0.25, 0.25, 0.2],
    5: [0.2, 0.2, 0.2, 0.2, 0.2],
  };
  
  const weights = distribution[count] || Array(count).fill(1 / count);
  
  this._spawnProbabilities = {};
  for (let i = 0; i < types.length; i++) {
    this._spawnProbabilities[types[i]] = weights[i];
  }
}

/**
 * 获取已解锁的属性元素类型列表
 * @returns {string[]}
 */
getUnlockedTypes() {
  return Object.keys(this._unlockedElements).filter(t => this._unlockedElements[t]);
}

/**
 * 获取已解锁属性元素数量
 * @returns {number}
 */
getUnlockedCount() {
  return this.getUnlockedTypes().length;
}

/**
 * 检查某元素是否已解锁
 */
isElementUnlocked(elementType) {
  return !!this._unlockedElements[elementType];
}

/**
 * 是否已获得亲和祝福
 */
hasAffinityBoon() {
  return this._hasAnyAffinityBoon;
}

/**
 * 处理多元素产出祝福（新增祝福）
 */
handleMultiSpawnBoon(boonId) {
  switch (boonId) {
    case 'boon_split_flow':
      this._multiSpawnBoons.splitFlow = true;
      break;
    case 'boon_myriad_source':
      this._multiSpawnBoons.myriadSource = true;
      break;
  }
}
```

### 2.5 元素亲和祝福改造（rogueConfig.js）

```javascript
// 元素亲和·火：改为解锁逻辑（不再是初始拥有）
{
  id: 'boon_fire_affinity',
  name: '元素亲和·火',
  icon: '🔥',
  rarity: 'common',
  category: 'production',
  description: '解锁火焰元素的产出能力，同时无属性元素停止产出',
  flavor: '"与火元素共鸣"',
  apply: (emitters, boonSystem) => {
    if (boonSystem) {
      boonSystem.handleAffinityBoon('boon_fire_affinity');
    }
  },
},
// 同理修改 water/earth/air/plant 亲和祝福
```

### 2.6 新增祝福（rogueConfig.js）

```javascript
// 在 BOON_POOL 中新增

// ---- 产出类祝福 ----
{
  id: 'boon_split_flow',
  name: '灵素分流',
  icon: '🔀',
  rarity: 'rare',
  category: 'production',
  description: '点击发射器时产出 2 种不同属性元素（需已解锁 ≥ 2 种属性元素）',
  flavor: '"一生二，二生三"',
  apply: (emitters, boonSystem) => {
    if (boonSystem) {
      boonSystem.handleMultiSpawnBoon('boon_split_flow');
    }
  },
},
{
  id: 'boon_myriad_source',
  name: '万象之源',
  icon: '🌌',
  rarity: 'epic',
  category: 'production',
  description: '点击发射器时产出 3 种不同属性元素（需已解锁 ≥ 3 种属性元素）',
  flavor: '"万物归一，一化万象"',
  apply: (emitters, boonSystem) => {
    if (boonSystem) {
      boonSystem.handleMultiSpawnBoon('boon_myriad_source');
    }
  },
},
```

### 2.7 GameEngine 适配

```javascript
// 在 _initRogueLevel 或 startRogueLevel 中

// 初始化元素解锁状态
if (this.boonSystem) {
  this.boonSystem.initElementUnlocks();  // 初始只产出无属性元素
}

// 改造 _onEmitterClick
_onEmitterClick(emitterId) {
  if (!this.state.isPlaying || this.state.isPaused) return;
  if (this._eventCtx.freezeEmitters) {
    window.eventBus.emit('notification', {
      message: '❄ 发射器被冻结，暂时无法使用',
      type: 'warning',
    });
    return;
  }

  const emitter = this.state.emitters.find(e => e.id === emitterId);
  if (!emitter) return;
  
  const now = Date.now();
  if (!emitter.isReadyToSpawn(now)) return;

  if (this.systems.spawn.isBoardFull(this.state.board)) {
    // ...原有守护结界逻辑...
    return;
  }

  // 获取产出上下文
  const spawnContext = this.boonSystem ? this.boonSystem.getSpawnContext() : null;
  if (!spawnContext || spawnContext.availableTypes.length === 0) {
    window.eventBus.emit('notification', {
      message: '⚠ 尚未解锁任何元素类型',
      type: 'warning',
    });
    return;
  }

  // 产出元素（传入上下文）
  const element = emitter.spawn(now, spawnContext);
  if (!element) return;

  // 处理多元素产出（返回数组的情况）
  if (Array.isArray(element)) {
    for (const el of element) {
      this.systems.spawn.placeElementOnBoard(this.state.board, el);
    }
  } else {
    this.systems.spawn.placeElementOnBoard(this.state.board, element);
  }

  // ...后续渲染和事件...
}

/**
 * 无属性元素提交逻辑
 * 无属性元素可提交任意类型订单，但等级需比订单需求高 1 级
 * @param {object} order - 订单对象
 * @returns {boolean} 是否成功提交
 */
_trySubmitWithBasicElement(order) {
  const board = this.state.board;
  const requiredLevel = order.level;
  const targetLevel = requiredLevel + 1;
  
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const el = board[r][c];
      if (el && el.type === 'basic' && el.level === targetLevel) {
        // 找到匹配的无属性元素，用它提交（不限订单类型）
        this.systems.spawn.removeElement(board, el);
        return true;
      }
    }
  }
  return false;
}

/**
 * 转化棋盘上所有无属性元素为指定属性元素
 * 在获得第一个「元素亲和·X」祝福时调用
 * @param {string} targetType - 目标属性元素类型
 */
_convertBasicElements(targetType) {
  const board = this.state.board;
  let convertedCount = 0;
  
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const el = board[r][c];
      if (el && el.type === 'basic') {
        el.type = targetType;
        convertedCount++;
      }
    }
  }
  
  if (convertedCount > 0) {
    this.boardRenderer.renderAll(board);
    window.eventBus.emit('notification', {
      message: `✨ 棋盘上 ${convertedCount} 个无属性元素转化为 ${ELEMENT_TYPES[targetType]?.icon} ${ELEMENT_TYPES[targetType]?.name}`,
      type: 'info',
    });
  }
}
```

### 2.8 OrderSystem 适配

```javascript
// 在 OrderSystem 中新增

/**
 * 设置当前发射器可产出的元素类型列表
 * @param {string[]} emitterTypes - 发射器当前可产出的元素类型列表
 * @param {boolean} hasAffinity - 是否已获得亲和祝福（能否产出属性元素）
 */
setEmitterState(emitterTypes, hasAffinity) {
  this._emitterTypes = emitterTypes || [];
  this._hasAffinity = hasAffinity;
}

/**
 * 从模板中随机选取一个符合条件的订单（改造版）
 *
 * 规则：
 * - 仅产出无属性元素时（hasAffinity=false）：从五种属性元素中随机生成，不设权重偏向
 * - 已产出属性元素时（hasAffinity=true）：按发射器产出类型加权，
 *   至少保留 1 个与发射器对应元素类型的订单，但仍可能生成其他元素类型
 *
 * @param {string[]} excludeIds - 需要排除的订单ID列表
 * @returns {object|null} 订单模板
 */
_pickOrderTemplate(excludeIds = []) {
  const difficulty = this._pickDifficulty();

  if (!this._hasAffinity) {
    // ── 仅产出无属性元素时：从五种属性元素中随机生成 ──
    const candidates = ORDER_TEMPLATES.filter(
      (t) =>
        t.difficulty === difficulty &&
        !excludeIds.includes(`${t.elementType}_${t.level}`)
    );

    if (candidates.length === 0) {
      const fallback = ORDER_TEMPLATES.filter(
        (t) => !excludeIds.includes(`${t.elementType}_${t.level}`)
      );
      return fallback.length > 0
        ? fallback[Math.floor(Math.random() * fallback.length)]
        : null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ── 已产出属性元素时：按发射器产出类型加权 ──
  const allCandidates = ORDER_TEMPLATES.filter(
    (t) =>
      t.difficulty === difficulty &&
      !excludeIds.includes(`${t.elementType}_${t.level}`)
  );

  if (allCandidates.length === 0) {
    const fallback = ORDER_TEMPLATES.filter(
      (t) => !excludeIds.includes(`${t.elementType}_${t.level}`)
    );
    return fallback.length > 0
      ? fallback[Math.floor(Math.random() * fallback.length)]
      : null;
  }

  // 分离：与发射器产出类型匹配的订单 vs 其他订单
  const matched = allCandidates.filter((t) =>
    this._emitterTypes.includes(t.elementType)
  );
  const unmatched = allCandidates.filter(
    (t) => !this._emitterTypes.includes(t.elementType)
  );

  // 权重分配：matched 占 70%，unmatched 占 30%
  const weightedPool = [];
  for (const m of matched) {
    for (let i = 0; i < 7; i++) weightedPool.push(m);
  }
  for (const u of unmatched) {
    for (let i = 0; i < 3; i++) weightedPool.push(u);
  }

  return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

/**
 * 卡关防护：确保至少有一个订单是可完成的
 * 检查棋盘上是否有元素能匹配订单，或有无属性元素高 1 级可代替
 */
ensureFeasibleOrders(board, spawnSystem) {
  const hasFeasible = this.orders.some(order => {
    // 检查直接匹配
    const directMatches = spawnSystem.findElementsByTypeAndLevel(
      board, order.elementType, order.level
    );
    if (directMatches.length > 0) return true;
    
    // 检查无属性元素高 1 级代替（可提交任意类型订单）
    const targetLevel = order.level + 1;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const el = board[r][c];
        if (el && el.type === 'basic' && el.level === targetLevel) {
          return true;
        }
      }
    }
    return false;
  });
  
  if (!hasFeasible) {
    const easyTemplates = ORDER_TEMPLATES.filter(
      t => t.difficulty === 'easy'
    );
    if (easyTemplates.length > 0) {
      const template = easyTemplates[Math.floor(Math.random() * easyTemplates.length)];
      const order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        elementType: template.elementType,
        level: template.level,
        reward: template.reward,
        difficulty: template.difficulty,
        completed: false,
        createdAt: Date.now(),
      };
      this.orders.push(order);
      window.eventBus.emit('orders:updated', [...this.orders]);
    }
  }
}
```

### 2.9 UI 改造

```javascript
// UIManager 中改造发射器按钮创建

createEmitterButtons(emitters, onClickCallback) {
  const container = document.getElementById('emitter-area');
  if (!container) return;
  container.innerHTML = '';
  
  const emitter = emitters[0];
  if (!emitter) return;
  
  const btn = document.createElement('button');
  btn.className = 'unified-emitter-btn';
  btn.id = `emitter-${emitter.id}`;
  btn.innerHTML = `
    <span class="emitter-icon">✨</span>
    <span class="emitter-name">灵素之源</span>
    <span class="emitter-cooldown"></span>
  `;
  btn.addEventListener('click', () => onClickCallback(emitter.id));
  container.appendChild(btn);
  
  // 渲染元素池展示
  this._renderElementPool();
}

/**
 * 渲染元素池展示
 * 显示当前可产出的元素类型及概率
 * 无属性元素退出后不再显示
 */
_renderElementPool() {
  const poolContainer = document.getElementById('element-pool');
  if (!poolContainer) return;
  
  const boonSystem = this.gameEngine.boonSystem;
  if (!boonSystem) return;
  
  const context = boonSystem.getSpawnContext();
  if (!context) {
    poolContainer.innerHTML = '<span class="pool-empty">暂无可用元素</span>';
    return;
  }
  
  const { availableTypes, probabilities } = context;
  
  poolContainer.innerHTML = availableTypes.map(type => {
    const def = ELEMENT_TYPES[type];
    if (!def) return '';
    const prob = ((probabilities[type] || 0) * 100).toFixed(0);
    const isBasic = type === 'basic';
    return `
      <span class="pool-element ${isBasic ? 'pool-basic' : ''}" data-type="${type}">
        <span class="pool-icon">${def.icon}</span>
        <span class="pool-name">${def.name}</span>
        <span class="pool-prob">${prob}%</span>
      </span>
    `;
  }).join('');
}
```

### 2.10 AutoPlaySystem 适配

```javascript
// 在 AutoPlaySystem 中

_tryAutoSpawn() {
  const orders = this.engine.systems.order.getOrders()
    .filter(o => !o.expired);
  
  // 获取产出上下文
  const spawnContext = this.engine.boonSystem?.getSpawnContext();
  if (!spawnContext) return false;

  // 如果只有无属性元素（未获得亲和祝福），不需要按订单需求产出
  if (spawnContext.availableTypes.length === 1 && spawnContext.availableTypes[0] === 'basic') {
    const emitter = this.engine.state.emitters[0];
    if (emitter && emitter.isReadyToSpawn(Date.now())) {
      this.engine._onEmitterClick(emitter.id);
      this._stats.spawns++;
      return true;
    }
    return false;
  }

  // 已解锁属性元素：按订单需求产出
  if (orders.length === 0) return false;

  const demandMap = {};
  for (const order of orders) {
    demandMap[order.elementType] = (demandMap[order.elementType] || 0) + 1;
  }

  const sortedTypes = Object.entries(demandMap)
    .filter(([type]) => spawnContext.availableTypes.includes(type))
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  const emitter = this.engine.state.emitters[0];
  if (emitter && emitter.isReadyToSpawn(Date.now())) {
    this.engine._onEmitterClick(emitter.id);
    this._stats.spawns++;
    return true;
  }

  return false;
}
```

---

## 三、设计合理性分析

### 3.1 设计优点

| 方面 | 说明 |
|---|---|
| **无属性缓冲期** | 获得第一个亲和祝福前，玩家可无压力练习合成，不会因无订单而困惑 |
| **高一级代替机制** | 让残留的无属性元素仍有价值，避免浪费 |
| **渐进式教学** | 无属性→第一种属性→更多属性，三步递进，学习曲线平滑 |
| **祝福价值重塑** | 「元素亲和」从锦上添花变为核心解锁要素，选择权重显著提升 |
| **减少操作疲劳** | 点击单一发射器比在 5 个发射器间切换更轻松 |
| **多元素产出爽感** | 灵素分流/万象之源让单次点击产出多种元素，正反馈强烈 |
| **原有祝福不受影响** | 多元素产出效果放在新增祝福中，不改变已有祝福的平衡 |

### 3.2 潜在风险与缓解措施

| 风险 | 缓解措施 |
|---|---|
| **无属性期内容单调** | 无属性期很短（第一层即可获得亲和祝福），且有合成练习目标 |
| **运气成分过大** | 概率分布偏向早期解锁的元素，保证基础元素稳定产出 |
| **卡关风险** | 订单系统自动适配已解锁属性元素 + 无属性高一级代替 + 卡关防护 |
| **祝福获取随机性** | 建议前 3 层固定出现至少 1 次元素亲和祝福选择 |
| **多元素产出溢出** | 棋盘满时自动销毁最低级元素（守护结界祝福） |

### 3.3 与现有系统的兼容性

| 系统 | 兼容性 | 说明 |
|---|---|---|
| **Boss 战** | ✅ 完全兼容 | Boss 机制不依赖发射器数量 |
| **诅咒系统** | ✅ 完全兼容 | 元素混淆诅咒与概率产出天然兼容 |
| **怒气大招** | ✅ 完全兼容 | 大招不依赖发射器类型 |
| **自动合成** | ✅ 适配 | 自动决策逻辑简化（只有一个发射器） |
| **存档系统** | ✅ 兼容 | 序列化/反序列化需要更新 |

---

## 四、扩展建议

### 4.1 短期扩展（Phase 1）

| 扩展点 | 说明 |
|---|---|
| **元素亲和祝福权重提升** | 在前 3 层固定出现至少 1 次元素亲和祝福选择 |
| **解锁动画** | 解锁新属性元素时播放特效动画，强化正反馈 |
| **无属性退出提示** | 获得第一个亲和祝福时，弹出提示告知无属性元素将停止产出 |
| **元素池 UI 美化** | 已解锁元素以「卡牌」形式展示，带有概率环状图 |

### 4.2 中期扩展（Phase 2）

| 扩展点 | 说明 |
|---|---|
| **元素进化** | 获得同一亲和祝福两次可提升该元素的基础等级（Lv.1→Lv.2） |
| **元素羁绊** | 同时拥有特定组合的亲和祝福获得额外加成（如火+风→燃烧扩散） |
| **稀有元素** | 新增光/暗等稀有元素，只能通过特定祝福组合解锁 |

### 4.3 长期扩展（Phase 3）

| 扩展点 | 说明 |
|---|---|
| **发射器升级** | 局外可升级发射器基础属性（冷却/基础等级/多元素概率） |
| **元素精通** | 每种元素有独立的熟练度系统，使用越多效果越强 |
| **自定义初始元素** | 玩家可选择初始解锁的元素类型（不限于火焰） |

---

## 五、修改文件清单

| 文件 | 修改内容 | 预估改动量 |
|---|---|---|
| `js/config/gameConfig.js` | 新增 basic 元素类型、替换 EMITTER_CONFIGS 为单一发射器 | ~20 行 |
| `js/entities/Emitter.js` | 新增 spawn 上下文参数、_pickDistinctTypes 方法 | ~80 行 |
| `js/systems/BoonSystem.js` | 新增元素解锁状态管理、概率计算、亲和/多元素祝福处理 | ~150 行 |
| `js/core/GameEngine.js` | 适配 _onEmitterClick、无属性提交逻辑、初始化解锁状态 | ~70 行 |
| `js/systems/OrderSystem.js` | 订单生成适配已解锁属性元素、卡关防护 | ~70 行 |
| `js/ui/UIManager.js` | 发射器 UI 改为单一按钮 + 元素池展示 | ~80 行 |
| `js/config/rogueConfig.js` | 调整元素亲和祝福 apply；新增灵素分流、万象之源祝福 | ~50 行 |
| `js/systems/AutoPlaySystem.js` | 适配单一发射器自动决策 | ~30 行 |
| **总计** | | **~550 行** |
