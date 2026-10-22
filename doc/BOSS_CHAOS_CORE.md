# 混沌之核（Boss：Chaos Core）完整实现文档

## 基本信息

| 属性 | 值 |
|---|---|
| **Boss ID** | `boss_chaos_core` |
| **名称** | 混沌之核 |
| **图标** | 🌀 |
| **所在层数** | 第 9 层 |
| **特殊规则** | `chaos_order` — 混沌订单与元素 |
| **目标分倍率** | ×2.2 |
| **描述** | 订单需求每 20 秒全部刷新，已完成不计入进度 |

---

## 一、配置参数（rogueConfig.js）

```javascript
{
  id: 'boss_chaos_core',
  name: '混沌之核',
  icon: '🌀',
  floor: 9,
  description: '订单需求每 20 秒全部刷新，已完成不计入进度',
  targetScoreMultiplier: 2.2,
  specialRule: 'chaos_order',
  mechanics: {
    waveInterval: 30500,          // 混沌波动间隔(ms)
    chaosSpawnInterval: 12000,    // 混沌元素生成间隔(ms)
    chaosIcon: '❓',
    waveLevelRange: 1,            // 混沌波动等级随机变化范围
  },
}
```

---

## 二、Boss 状态字段（_bossState）

在 `_bossState` 中新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `chaosElements` | `object[]` | `[]` | 混沌元素列表，每项 `{row, col, level, icon}` |
| `lastWaveTime` | `number` | `0` | 上次混沌波动时间戳 |
| `lastChaosSpawnTime` | `number` | `0` | 上次混沌元素生成时间戳 |
| `lastRefreshTime` | `number` | `0` | 上次混沌刷新时间戳 |

---

## 三、核心机制详解

### 机制 1：混沌波动（周期性）

**触发时机**：每 `waveInterval`（30.5 秒）触发一次

**执行函数**：`_tickChaosCore()` → `_triggerChaosWave(levelRange)`

**波动流程**：
1. 遍历棋盘上所有非混沌、非阻塞的元素
2. 对每个元素随机改变等级（±1 级，范围 1-8）
3. 对每个元素随机改变类型（从所有元素类型中随机选取）
4. 更新元素的 `typeId` 和 `icon`
5. 更新棋盘格子渲染
6. 触发 `boss:chaos-wave` 事件（UI 播放紫色闪烁）
7. 发送通知："🌊 混沌波动！棋盘上 N 个元素发生了变化"

**波动效果**：
- 棋盘上所有已有元素的类型和等级被随机打乱
- 玩家精心规划的合成路线被破坏
- 混沌元素（`isChaos: true`）不受波动影响

### 机制 2：混沌元素生成（周期性）

**触发时机**：每 `chaosSpawnInterval`（12 秒）生成一个混沌元素

**执行函数**：`_tickChaosCore()` → `_spawnChaosElement()`

**混沌元素属性**：
```javascript
{
  id: `chaos_${Date.now()}_${random}`,
  typeId: 'chaos',
  level: randomLevel,             // 1-3 随机
  icon: '❓',
  isChaos: true,                  // 标记为混沌元素
  serialize: function() { ... },
}
```

**生成流程**：
1. 遍历棋盘，收集所有空格子
2. 如果没有空格子，跳过本次生成
3. 随机选择一个空格子
4. 在该格子放置混沌元素（等级 1-3 随机）
5. 更新棋盘渲染
6. 记录到 `state.chaosElements` 数组
7. 触发 `boss:chaos-spawn` 事件（UI 播放闪烁动画）

**混沌元素特性**：
- 可与任意同等级元素合成（无视类型）
- 合成后生成对应类型的高级元素
- 不受混沌波动影响
- 可作为订单提交的万能元素（匹配任意类型）

### 机制 3：混沌刷新（周期性）

**触发时机**：每 20 秒触发一次

**执行函数**：`_tickChaosCore()` → `_triggerChaosRefresh()`

**刷新流程**：
1. 获取当前订单列表
2. 如果订单列表为空，直接填充新订单
3. 如果订单列表不为空，清空所有订单并重新生成
4. 触发 `boss:chaos-refresh` 事件
5. 发送通知："🔄 混沌刷新！订单需求已全部刷新"

**刷新效果**：
- 所有未完成的订单被清空
- 已提交的订单进度不受影响（分数已计入）
- 生成全新的订单需求

---

## 四、Boss 战流程

### 进入 Boss 战（startRogueLevel）

1. 检测节点类型为 `boss` 且 `bossId === 'boss_chaos_core'`
2. 棋盘扩大至 **基础列数 +2 列，基础行数 +1 行**
3. 初始化棋盘、产出系统、渲染器、发射器

### 战斗循环（_tickChaosCore）

每帧执行以下步骤：

```
1. 混沌波动检查
   └─ 距上次波动 ≥ 30.5 秒
      └─ 随机变化所有元素等级和类型

2. 混沌元素生成检查
   └─ 距上次生成 ≥ 12 秒
      └─ 在随机空格子生成混沌元素

3. 混沌刷新检查
   └─ 距上次刷新 ≥ 20 秒
      └─ 清空并重新生成订单
```

### 胜利条件

- 标准条件：`score >= targetScore`
- 目标分计算：基础目标分 × 2.2（targetScoreMultiplier）

### 失败条件

- 无特殊失败条件，按常规关卡失败逻辑处理

---

## 五、UI 与视觉表现

### 技能面板展示

Boss 技能卡片显示三条信息：

| 技能 | 描述 |
|---|---|
| 🌊 混沌波动 | 每 30.5 秒随机变化棋盘元素等级和类型 ±1 |
| ❓ 混沌生成 | 每 012 秒生成混沌元素（可与任意同等级元素合成） |
| 🔄 混沌刷新 | 订单需求每 20 秒全部刷新 |

### CSS 样式

**混沌波动闪烁（`.chaos-wave-flash`）**：
```css
.chaos-wave-flash {
  position: fixed; inset: 0; pointer-events: none; z-index: 997;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(138, 112, 158, 0.4125) 60%, rgba(118, 82, 132, 0.525) 100%);
  opacity: 0; transition: opacity 0.075s ease;
}
.chaos-wave-flash.show { opacity: 1; }
```

**混沌元素闪烁（`.cell-chaos`）**：
```css
.cell-chaos {
  animation: chaosGlow 0.415s ease-in-out 3;
}
@keyframes chaosGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(147, 113, 157, 0.435); }
  50% { box-shadow: 0 0 24px rgba(151, 117, 122, 0.665), 0 0 40px rgba(133, 99, 119, 0.405); }
}
```

---

## 六、代码文件索引

| 文件 | 相关函数/位置 | 说明 |
|---|---|---|
| `js/config/rogueConfig.js` | ~line 519 | Boss 配置定义 |
| `js/core/GameEngine.js` | `_bossState` 初始化 ~line 2260 | chaosElements/lastWaveTime 等字段 |
| `js/core/GameEngine.js` | `_tickChaosCore()` ~line 991 | 主循环调度 |
| `js/core/GameEngine.js` | `_triggerChaosWave()` ~line 3020 | 混沌波动 |
| `js/core/GameEngine.js` | `_spawnChaosElement()` ~line 3070 | 混沌元素生成 |
| `js/core/GameEngine.js` | `_triggerChaosRefresh()` ~line 3130 | 混沌刷新 |
| `js/ui/UIManager.js` | `_onBossChaosWave()` ~line 939 | 混沌波动紫色闪烁 |
| `js/ui/UIManager.js` | `_onBossChaosSpawn()` ~line 953 | 混沌元素闪烁动画 |
| `js/ui/UIManager.js` | Boss 技能面板 ~line 799 | 技能卡片展示 |
| `css/style.css` | ~line 3163 | `.chaos-wave-flash` / `.cell-chaos` 等样式 |

---

## 七、已知问题与设计考量

1. **混沌波动的破坏性**：每 30.5 秒一次的混沌波动会打乱棋盘上所有元素的布局，迫使玩家不断调整策略，无法依赖固定的合成路线
2. **混沌元素的万能性**：混沌元素可以与任意同等级元素合成，是应对混沌波动的关键资源——玩家应优先利用混沌元素稳定合成高级元素
3. **订单刷新的紧迫感**：每 20 秒刷新订单意味着玩家不能囤积订单，必须快速提交，增加了游戏的节奏感
4. **混沌元素与订单的协同**：混沌元素可以匹配任意订单类型，但刷新机制又要求玩家快速决策，形成了"万能牌 vs 时间压力"的博弈
5. **与其他 Boss 的对比**：混沌之核侧重于"信息混乱"（元素类型/等级/订单需求全部不稳定），与熔岩巨像的"空间压制"、冰霜女巫的"操作限制"形成差异化体验
