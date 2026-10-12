# 元素合成游戏 · 完整实现指南

> 本文档系统梳理了游戏的全部实现逻辑、动画特效、触发时机与架构约定，作为后续扩展的开发准则。所有新功能开发前应查阅本文档，避免逻辑冲突或重复实现。

---

## 一、整体架构

### 1.1 三层架构

```
数据层（config/*.js） → 逻辑层（systems/*.js + core/GameEngine.js） → 表现层（ui/*.js）
```

- **数据层**：纯配置，定义元素、等级、发射器、订单模板、关卡、波次、紧急事件、祝福/诅咒等静态数据
- **逻辑层**：不依赖 DOM，通过 EventBus 事件通知 UI 更新；GameEngine 为总控制器
- **表现层**：操作 DOM/CSS，渲染棋盘、UI面板、粒子特效和动画

### 1.2 通信机制：EventBus

全局单例 `window.eventBus`，发布-订阅模式。各模块之间不直接调用，通过事件解耦。

| 事件名 | 发射方 | 监听方 | 数据载荷 |
|--------|--------|--------|----------|
| `score:updated` | GameEngine | UIManager | `{ score, targetScore }` |
| `combo:updated` | GameEngine | UIManager | `{ count, multiplier }` |
| `combo:break` | GameEngine | UIManager | `{}` |
| `combo:milestone` | GameEngine | UIManager | `{ milestone, isFirstTime }` |
| `order:submitted` | OrderSystem | UIManager | `{ reward, element, order }` |
| `orders:updated` | OrderSystem | UIManager | `[Order]` |
| `emitters:updated` | GameEngine(loop) | UIManager | `[Emitter]` |
| `emitter:clicked` | GameEngine | UIManager | `{ emitterId }` |
| `elements:fly-to-order` | GameEngine | UIManager | `{ orderId, positions, elementIcon }` |
| `level:loaded` | GameEngine | UIManager | `levelConfig` |
| `game:failed` | GameEngine | UIManager | `{ isRogue }` |
| `notification` | 各处 | UIManager | `{ message, type }` |
| `wave:started` | GameEngine | UIManager | `{ waveIndex, totalWaves, wave }` |
| `wave:completed` | GameEngine | UIManager | `{ waveIndex, totalWaves, wave, reward }` |
| `event:started` | GameEngine | UIManager | `{ id, name, icon, description, durationMs, category }` |
| `event:ended` | GameEngine | UIManager | `{ id, name, icon, category }` |
| `event:tick` | GameEngine(loop) | UIManager | `{ remainingMs, totalDurationMs }` |
| `rush-order:tick` | GameEngine(loop) | UIManager | `{ remainingMs, totalDurationMs }` |
| `combo-fever:score-bonus` | GameEngine | UIManager | `{ row, col, score, multiplier }` |
| `rating:calculated` | GameEngine | UIManager | `{ level, score, targetScore, rating, isRogue, nextLevel, isLastLevel }` |
| `rogue:boons-updated` | BoonSystem | RogueUIManager | boonSummary |
| `rogue:curses-updated` | BoonSystem | RogueUIManager | curseSummary |

### 1.3 文件结构

```
merge-game/
├── index.html              # 入口页面
├── css/style.css           # 全部样式 (~2367行)
├── js/
│   ├── core/
│   │   ├── EventBus.js     # 事件总线
│   │   └── GameEngine.js   # 核心引擎 (~1889行)
│   ├── config/
│   │   ├── gameConfig.js   # 基础配置 (~390行)
│   │   └── rogueConfig.js  # 肉鸽配置 (~519行)
│   ├── entities/
│   │   ├── Element.js      # 元素实体
│   │   └── Emitter.js      # 发射器实体 (~138行)
│   ├── systems/
│   │   ├── MergeSystem.js  # 合成系统
│   │   ├── OrderSystem.js  # 订单系统
│   │   ├── SpawnSystem.js  # 产出系统
│   │   ├── BoonSystem.js   # 祝福系统
│   │   ├── EventSystem.js  # 随机事件系统
│   │   └── StorageManager.js # 存档管理
│   └── ui/
│       ├── UIManager.js    # UI管理器 (~1349行)
│       ├── BoardRenderer.js # 棋盘渲染器 (~517行)
│       └── RogueUIManager.js # 肉鸽UI
├── OPTIMIZATION_01_FEEDBACK.md  # 已实现
├── OPTIMIZATION_02_GAMEPLAY.md  # 已实现
└── OPTIMIZATION_03_DEEP.md      # 未实现
```

---

## 二、数据层（Config）

### 2.1 元素类型（ELEMENT_TYPES）

5种基础元素，在 `gameConfig.js` 中定义：

| ID | 名称 | 图标 | 颜色 | 背景色 |
|----|------|------|------|--------|
| fire | 火焰 | 🔥 | #FF6B35 | #FFF0E8 |
| water | 水滴 | 💧 | #4A90D9 | #E8F4FF |
| earth | 土块 | 🪨 | #8B6914 | #F5EDE0 |
| air | 微风 | 🌪 | #7EC8E3 | #F0FAFF |
| plant | 植物 | 🌿 | #4CAF50 | #E8F5E9 |

### 2.2 元素等级（ELEMENT_LEVELS）

6个等级，每个等级对应分值、边框颜色 CSS class：

| 等级 | 标签 | 分值 | borderClass |
|------|------|------|-------------|
| 1 | 初级 | 1 | level-1 (#9e9e9e) |
| 2 | 中级 | 3 | level-2 (#4caf50) |
| 3 | 高级 | 8 | level-3 (#2196f3) |
| 4 | 稀有 | 20 | level-4 (#9c27b0) |
| 5 | 史诗 | 50 | level-5 (#ff9800) |
| 6 | 传说 | 120 | level-6 (#f44336) |

### 2.3 发射器配置（EMITTER_CONFIGS）

5个发射器，各产出特定类型元素：

| ID | 元素类型 | 冷却时间 | 初始等级 |
|----|----------|----------|----------|
| emitter_fire | fire | 2000ms | 1 |
| emitter_water | water | 2000ms | 1 |
| emitter_earth | earth | 2000ms | 1 |
| emitter_air | air | 2500ms | 1 |
| emitter_plant | plant | 3000ms | 1 |

### 2.4 订单模板（ORDER_TEMPLATES）

按难度分4档，每档5个元素类型各一个：

| 难度 | 等级要求 | 奖励范围 | 权重用途 |
|------|----------|----------|----------|
| easy | Lv.2 | 10~18 | 关卡1高权重 |
| medium | Lv.3 | 30~40 | 关卡2主力 |
| hard | Lv.4 | 80~95 | 关卡3主力 |
| rare | Lv.5 | 180~220 | 后期高难 |

### 2.5 关卡配置（LEVEL_CONFIGS）

3个经典关卡：

| 关卡 | 目标分 | 最大订单 | 棋盘尺寸 | 可用发射器 |
|------|--------|----------|----------|------------|
| 1 | 100 | 3 | 6×4 | 火水土 |
| 2 | 250 | 4 | 7×4 | 火水土风 |
| 3 | 500 | 4 | 7×5 | 火水土风植物 |

### 2.6 波次模板（WAVE_CONFIGS）

按难度 tier 分层，每关从对应 tier 取波次列表：

| Tier | 适用关卡 | 波次数量 | 波次类型 |
|------|----------|----------|----------|
| early | 关卡1 | 5 | score/orders/combo |
| mid | 关卡2 | 5 | score/combo/orders/merge |
| late | 关卡3 | 5 | score/combo/orders/merge |

波次类型：`score`（累计分数）、`orders`（完成订单数）、`combo`（连击次数）、`merge`（合成次数）

### 2.7 紧急事件列表（EMERGENCY_EVENTS）

7个事件，按类别分 positive/challenge/negative/random：

| ID | 名称 | 图标 | 时长 | 冷却 | 权重 | 类别 |
|----|------|------|------|------|------|------|
| double_points | 双倍积分 | 💎 | 12s | 60s | 18 | positive |
| speed_up | 加速生产 | ⚡ | 15s | 45s | 16 | positive |
| order_rush | 加急订单 | 📋 | 15s | 50s | 14 | challenge |
| element_flood | 元素洪流 | 🌊 | 10s | 55s | 12 | negative |
| freeze | 冻结 | ❄ | 8s | 50s | 13 | negative |
| combo_fever | 连击狂热 | 🔥 | 12s | 40s | 17 | positive |
| mystery_box | 神秘宝箱 | 🎁 | 5s | 35s | 10 | random |

### 2.8 评级阈值（RATING_THRESHOLDS）

| 评级 | 条件 | 星尘倍率 |
|------|------|----------|
| S | 4维度平均 ≥ 4.75 | ×1.67 |
| A | 平均 ≥ 3.75 | ×1.33 |
| B | 平均 ≥ 2.75 | ×1.0 |
| C | 平均 ≥ 1.75 | ×0.67 |
| D | 其余 | ×0.33 |

### 2.9 通用设置（GAME_SETTINGS）

| 参数 | 值 | 说明 |
|------|-----|------|
| mergeAnimationDuration | 300ms | 合成动画时长 |
| spawnAnimationDuration | 400ms | 生成动画时长 |
| autoSaveInterval | 15000ms | 自动保存间隔 |
| maxBoardCells | 48 | 棋盘最大格子数 |
| orderRefreshCost | 20 | 刷新订单消耗积分 |
| comboBonusMultiplier | 0.5 | 连击奖励倍率 |

---

## 三、核心引擎（GameEngine）

### 3.1 生命周期

```
init(uiManager, boardRenderer)
  ↓
startLevel(level) / startRogueLevel(targetScore, node)
  ├─ 初始化棋盘、发射器、订单系统
  ├─ 启动游戏循环 (_startGameLoop)
  ├─ 启动自动存档 (_startAutoSave)
  ├─ 初始化波次 (_initWaves)
  └─ 启动自动整理 (_startAutoSort)
  ↓
[游戏进行中]
  ├─ _onCellClick(row, col)        ← 点击棋盘格子
  ├─ _onEmitterClick(emitterId)    ← 点击发射器按钮
  └─ _onOrderClicked(orderId)      ← 点击订单卡片
  ↓
_onLevelComplete()
  ├─ 停止循环/存档/自动整理
  ├─ 清理紧急事件
  ├─ 计算评级 (_calculateRating)
  └─ 发射 rating:calculated 事件
```

### 3.2 游戏循环

使用 `requestAnimationFrame` 驱动，约每秒更新4次（每200ms）：

- 更新发射器冷却状态 → `emitters:updated`
- 检查紧急事件触发（每3秒）→ `_checkEmergencyEvents()`
- 活跃事件 tick（每100ms）→ `event:tick` / `rush-order:tick`

### 3.3 棋盘交互流程

#### 普通模式（无三重奏祝福）

```
点击空位 → 无操作
点击有元素的格子 → 选中该格子（高亮）
再次点击同一格子 → 取消选中
点击另一格子（空位）→ 移动元素到空位
点击另一格子（有元素）→ 尝试合成
  ├─ 可合成 → _executeMerge() → 移除两个旧元素，放置新元素
  └─ 不可合成 → 切换选中到新格子
```

#### 三重奏模式（拥有 boon_triple_merge 祝福）

```
点击第一个元素 → 选中
点击第二个同类型同等级元素 → 进入三合一等待模式
  ├─ 两个候选格子金色高亮（triple-candidate）
  └─ 通知提示"再点击一个同类型同等级元素"
点击第三个同类型同等级元素 → _executeTripleMerge()
  ├─ 三个元素合成为高两级的新元素
  └─ 清除候选高亮
点击不同元素/空位/已在候选中的格子 → 退出三合一模式
```

### 3.4 合成执行（_executeMerge）

1. 从棋盘移除被消耗的两个元素
2. 在目标位置放置合成后的新元素
3. 播放合成动画（playMergeAnimation）+ 特效（playMergeEffect）
4. 更新连击计数 → `combo:updated`
5. 检查连击里程碑（5/10/20）→ `combo:milestone`
6. 设置连击超时（COMBO_WINDOW_MS 内无新合成则触发 Combo Break）
7. 应用祝福效果：
   - 连锁反应（25%概率生成低一级同类型元素）
   - 融合增效（+2积分）/ 经验累积（等级×2积分）
8. 连击狂热事件中 → `combo-fever:score-bonus`
9. 元素共鸣祝福 → `_triggerElementResonance()`
10. 更新评分数据、记录合成次数、检查波次进度
11. 合成后有机会触发紧急事件

### 3.5 三合一执行（_executeTripleMerge）

与普通合成类似，但：
- 消耗3个元素而非2个
- 新等级 = 原等级 + 2（比二合一结果高一级）
- 达到最高等级时无法继续合成
- 积分计算同样应用紧急事件倍率

### 3.6 发射器点击（_onEmitterClick）

1. 检查冻结状态（冻结中禁止使用）
2. 检查冷却就绪
3. 检查棋盘满：
   - 有守护结界祝福 → 销毁最低级元素腾出空位（每关3次）
   - 无守护结界 → 发射 `game:failed`
4. 执行产出（考虑双重产出、升级几率、随机类型等修饰器）
5. 逐个放置元素到空位，播放生成动画
6. 更新发射器UI

### 3.7 订单提交（_onOrderClicked）

1. 快照当前棋盘所有非空格子位置（用于飞入动画定位）
2. 调用 `OrderSystem.submitOrder()` 查找匹配元素并移除
3. 计算积分奖励（应用祝福倍率 + 紧急事件倍率）
4. 贪婪代价诅咒 → 额外消耗一个随机元素
5. 找出被消耗元素的位置 → 触发飞入动画
6. 无尽之泉祝福 → 重置所有发射器冷却
7. 更新评分数据、记录订单数、检查波次进度
8. 提交后有机会触发紧急事件

### 3.8 通关处理（_onLevelComplete）

- 停止所有定时器（游戏循环、自动存档、自动整理）
- 清理活跃紧急事件
- 计算四维度评级
- 经典模式：发射 `rating:calculated`（由评级面板接管）
- 肉鸽模式：额外发射 `game:over`（由肉鸽系统接管）

---

## 四、子系统详解

### 4.1 合成系统（MergeSystem）

纯逻辑层，核心方法：

| 方法 | 功能 |
|------|------|
| `tryMerge(a, b, currentTime)` | 尝试合成两个元素，返回合并结果或 null |
| `resetCombo()` | 重置连击计数 |
| `getComboInfo()` | 获取当前连击信息 |

连击规则：
- 默认窗口 3000ms（有连击大师祝福则为 5000ms）
- 窗口内连续合成 → comboCount 递增
- 连击倍率 = 1 + (comboCount - 1) × 0.5
- 窗口外合成 → comboCount 重置为 1

### 4.2 订单系统（OrderSystem）

| 方法 | 功能 |
|------|------|
| `init(maxOrders, weights)` | 初始化订单容量和难度权重 |
| `generateOrder()` | 按权重生成一个新订单 |
| `fillOrders()` | 填充到最大数量 |
| `submitOrder(id, grid, spawn)` | 提交订单，匹配并移除棋盘元素 |
| `refreshOrders(score, free)` | 刷新所有订单 |
| `addRushOrder(order)` | 添加加急订单（临时） |
| `removeRushOrder(id)` | 移除加急订单 |

### 4.3 祝福系统（BoonSystem）

管理本局内的祝福与诅咒，通过 EventBus 通知 UI。

| 方法 | 功能 |
|------|------|
| `addBoon(config, replaceIndex?)` | 添加祝福（超出上限需指定替换索引） |
| `addCurse(config)` | 添加诅咒（脆弱棋盘自动补偿传说祝福） |
| `applyToEmitters(emitters)` | 应用所有生产类祝福和诅咒惩罚到发射器 |
| `getOrderRewardMultiplier()` | 计算订单积分倍率 |
| `getMergeBonus(level)` | 计算合成额外积分加成 |
| `getComboWindow()` | 获取连击窗口时间 |
| `isFreeRefresh()` | 是否免费刷新订单 |
| `getExtraOrderSlots()` | 获取额外订单槽位数 |
| `pickRandomBoons(count, forceRarity?)` | 随机选取祝福候选 |
| `pickRandomCurse()` | 随机选取一个诅咒 |

#### 祝福列表（22个）

**生产类（9个）：**
- 加速齿轮（common）：所有发射器冷却 -20%
- 双重产出（rare）：30%概率一次产出两个元素
- 高级起步（rare）：产出初始等级 +1
- 元素亲和·火/水/土/风/植物（common×5）：对应发射器冷却减半
- 无尽之泉（legendary）：每完成一个订单，所有发射器立即冷却完毕
- 变异孢子（epic）：20%概率产出高一级的元素

**合成类（5个）：**
- 连击大师（common）：连击窗口延长至5秒
- 连锁反应（rare）：25%概率在原地生成低一级同类型元素
- 融合增效（common）：每次合成额外获得2积分
- 元素共鸣（legendary）：合成时棋盘上所有同类型元素获得临时等级加成（5秒）
- 三重奏（rare）：三个同类型同等级元素可合成为高两级元素（替代二合一）
- 经验累积（common）：每次合成获得该元素等级×2的额外积分

**订单类（4个）：**
- 急单奖励（common）：订单积分奖励 +30%
- 免费刷新（rare）：刷新订单不消耗积分
- 需求预见（common）：始终多显示一个订单
- 高价收购（rare）：每关第一个提交的订单获得3倍积分

**棋盘类（3个）：**
- 扩容背包（rare）：棋盘增加一行格子
- 自动整理（epic）：每10秒自动将可合成的相邻元素移到一起
- 守护结界（rare）：棋盘满时自动销毁最低级元素腾出空位（每关3次）

#### 诅咒列表（4个）

| ID | 名称 | 惩罚 | 补偿 |
|----|------|------|------|
| curse_slow_growth | 缓慢生长 | 所有发射器冷却 +40% | 订单积分 +60% |
| curse_element_confusion | 元素混淆 | 发射器随机产出元素类型 | 棋盘扩大2格 |
| curse_greed_price | 贪婪代价 | 每次提交订单额外消耗1个随机元素 | 订单积分翻倍 |
| curse_fragile_board | 脆弱棋盘 | 棋盘缩小4格 | 初始获得一个传说祝福 |

### 4.4 波次系统

#### 数据结构

```javascript
_waves = [{ type, target, label, reward }]  // 当前关卡的波次列表
_currentWaveIndex                            // 当前波次索引
_totalOrdersCompleted                        // 本关累计完成订单数
_totalMergesCount                            // 本关累计合成次数
```

#### 波次推进流程

```
_initWaves(level) → 根据关卡选择 tier，深拷贝模板
  ↓
_checkWaveProgress() → 每次合成/提交订单后调用
  ├─ 检查当前波次目标是否达成
  └─ 达成 → _advanceToNextWave()
      ├─ 应用波次奖励（加分）
      ├─ 发射 wave:completed
      ├─ 推进索引
      └─ 所有波次完成 → 检查是否达标通关
```

#### 独立分数检查

`_checkScoreComplete()` 在每次分数更新后独立调用，不受波次进度限制——玩家可在中间波次已达目标分时直接通关。

### 4.5 紧急事件系统

#### 数据结构

```javascript
_activeEvent          // 当前活跃的事件对象
_eventTimerId         // 事件结束定时器ID
_eventCooldowns       // { eventId → 下次可触发时间戳 }
_eventCtx             // 运行时上下文对象
_floodTimerId         // 元素洪流定时器ID
_lastEventCheckTime   // 上次检查事件的时间戳
_lastTickTime         // 上次发射tick的时间戳
```

#### 事件上下文（_eventCtx）

```javascript
{
  scoreMultiplier: 1,          // 双倍积分事件修改
  emitterSpeedMultiplier: 1,   // 加速生产事件修改
  freezeEmitters: false,       // 冻结事件修改
  comboMultiplier: 1,          // 连击狂热事件修改
  floodActive: false,          // 元素洪流事件修改
  floodInterval: 0,
  spawnRushOrder: false,       // 加急订单事件修改
  removeRushOrder: null,       // 清理回调
  triggerMysteryReward: false, // 神秘宝箱事件修改
}
```

#### 触发时机

- 游戏循环中每3秒自动检查
- 每次合成后调用 `_checkEmergencyEvents()`
- 每次订单提交后调用
- 连击中断时调用

#### 触发判定

1. 已有活跃事件或未开始游戏 → 不触发
2. 距上次检查不足5秒 → 跳过
3. 收集不在冷却中的事件
4. 肉鸽模式：祝福/诅咒影响概率修正
5. 按权重随机选取一个事件
6. 基础触发率 35%（受概率修正影响）

#### 事件生命周期

```
_startEvent(event)
  ├─ 记录冷却时间
  ├─ 调用 event.apply(ctx)
  ├─ 特殊处理（冻结发射器、启动洪流定时器、生成加急订单、神秘宝箱奖励）
  ├─ 发射 event:started
  └─ 设置结束定时器
      ↓ durationMs 后
_endActiveEvent()
  ├─ 调用 event.cleanup(ctx)
  ├─ 移除加急订单
  ├─ 解冻发射器 / 停止洪流定时器
  └─ 发射 event:ended
```

### 4.6 评级系统

#### 四维度计算

| 维度 | 计算方式 | S条件 | A条件 | B条件 |
|------|----------|-------|-------|-------|
| 速度 | 用时/预期时间比 | ≤0.5 | ≤0.8 | ≤1.2 |
| 连击 | 最高连击数 | ≥10 | ≥6 | ≥4 |
| 效率 | 总分/总操作数 | ≥15 | ≥10 | ≥6 |
| 合成 | 最高合成等级 | ≥6(Lv.6) | ≥5(Lv.5) | ≥4(Lv.4) |

#### 综合评级

4维度字母映射分数（S=5, A=4, B=3, C=2, D=1），取平均值：

| 平均分 | 综合评级 | 标题 |
|--------|----------|------|
| ≥4.75 | S | 🌟 完美通关 |
| ≥3.75 | A | 🏆 优秀 |
| ≥2.75 | B | 👍 良好 |
| ≥1.75 | C | 👌 合格 |
| <1.75 | D | 💪 继续努力 |

---

## 五、表现层（UI）

### 5.1 UIManager 职责

管理所有非棋盘的UI元素，通过 EventBus 监听事件驱动更新。

#### 核心组件

| 组件 | 创建方式 | 更新方式 |
|------|----------|----------|
| 发射器按钮 | `createEmitterButtons()` | `updateEmitters()` 每200ms |
| 订单卡片 | `renderOrders()` | 监听 `orders:updated` |
| 积分显示 | HTML静态 | 监听 `score:updated` |
| 波次横幅 | `showWaveBanner()` | 监听 `wave:started` |
| 事件横幅 | `showEventBanner()` | 监听 `event:started` |
| 评级面板 | `showRatingPanel()` | 监听 `rating:calculated` |
| 通知Toast | `showNotification()` | 监听 `notification` |

#### 发射器按钮结构

```html
<button class="emitter-btn">
  <span class="emitter-icon">🔥</span>
  <span class="emitter-name">火焰发射器</span>
  <div class="emitter-cooldown-bar" style="width:0%"></div>  <!-- 冷却进度条 -->
  <span class="cooldown-timer-text">3s</span>                <!-- 倒计时数字 -->
</button>
```

冷却进度条：整个按钮作为背景，从左到右填充，颜色随进度变化（红→橙→绿）。

#### 订单卡片结构

```html
<div class="order-card order-easy">
  <span class="order-icon">🔥</span>
  <div class="order-info">
    <div class="order-name">火焰 Lv.2</div>
    <div class="order-reward">+10分</div>
  </div>
  <span class="order-difficulty">简单</span>
  <!-- 加急订单额外 -->
  <div class="rush-order-bar-container">
    <div class="rush-order-bar" id="rush-bar-xxx"></div>
    <span class="rush-order-timer" id="rush-timer-xxx">15s</span>
  </div>
</div>
```

### 5.2 BoardRenderer 职责

负责棋盘的DOM渲染、交互事件和粒子系统。

#### 粒子系统

基于 Canvas 2D 的覆盖层，不依赖外部库：

```javascript
_particles = [{
  x, y, vx, vy, color, size, life, maxLife
}]
```

- 每帧更新位置（带衰减和重力）
- 生命归零后移除
- 圆形粒子 + 发光效果（半透明大圆叠加）

#### 格子状态管理

| 状态 | CSS类 | 视觉效果 |
|------|-------|----------|
| 选中 | `.selected` | 金色边框 + 光晕 + 放大 |
| 三合一候选 | `.triple-candidate` | 金色轮廓脉冲动画 |
| 元素共鸣 | `.resonating` | 动态光晕 + 🌈角标 |
| 合成动画 | `.merge-animate` | 缩放脉冲 |
| 生成动画 | `.spawn-animate` | 下落弹跳 |
| 提交动画 | `.submit-animate` | 缩小飞走 |
| 洪流水波纹 | `.flood-ripple` | 水波纹扩散 |

### 5.3 横幅队列系统

确保多个横幅依次显示，不冲突：

```javascript
_bannerQueue = []      // 队列
_isBannerShowing       // 锁

_enqueueBanner(text, subtext, typeClass, duration)
  → 入队 → _processBannerQueue()

_processBannerQueue()
  → 锁空闲且有队列 → 取出第一个 → _showBanner()

_showBanner(text, subtext, typeClass, duration)
  → 创建DOM → 入场动画 → duration后滑出 → 解锁 → 处理下一个
```

共用此队列的横幅类型：
- 连击横幅（combo-banner）
- Combo Break 横幅（combo-break-banner）
- 进度横幅（progress-banner-25/50/75/100）

---

## 六、视觉特效与动画全集

### 6.1 合成特效

| 合成等级 | 特效组合 | 实现位置 |
|----------|----------|----------|
| Lv.2~3 | 粒子爆散（10+等级×5个）+ 缩放脉冲 | BoardRenderer.playMergeEffect |
| Lv.4（稀有） | 粒子 + 全屏白色闪光 | BoardRenderer._createFlashOverlay('flash-white') |
| Lv.5（史诗） | 粒子 + 全屏金色闪烁 + 屏幕震动(5px, 0.25s) | BoardRenderer._applyScreenShake |
| Lv.6（传说） | 粒子 + 双重闪光(白→金) + 强震(12px, 0.4s) + 暂停慢放遮罩 | BoardRenderer._createTimeFreeze |

### 6.2 粒子颜色（按元素类型）

| 元素 | 主色 | 粒子数量基数 |
|------|------|-------------|
| fire | #FF6B35, #FF4500 | 10 + 等级×5 |
| water | #4A90D9, #00BFFF | 同上 |
| earth | #8B6914, #D2691E | 同上 |
| air | #7EC8E3, #E0FFFF | 同上 |
| plant | #4CAF50, #32CD32 | 同上 |

### 6.3 连击相关特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 每次合成（连击≥2） | 顶部横幅 "🔥 N连击 xM.M" | UIManager.updateCombo → _enqueueBanner |
| 连击中断 | 红色横幅 "💥 Combo Break!" + 抖动 | UIManager._showComboBreak |
| 首次5连击 | 棋盘边框绿光脉冲(0.8s) | UIManager.showMilestoneEffect |
| 首次10连击 | 棋盘蓝色火焰环绕(3s) + 40个火焰粒子 | UIManager._spawnFlameParticles |
| 首次20连击 | 全屏金色闪光(5s) + 闪电脉冲 | UIManager._spawnLightningFlash |

### 6.4 订单相关特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 订单提交 | 元素从棋盘沿贝塞尔弧线飞向订单面板(0.3s/个) | UIManager.playFlyToOrder |
| 普通订单(<50分) | 白色数字向上飘移(1s) | UIManager.showBounceScore |
| 大额订单(50~100分) | 金色数字放大+旋转(1s) | 同上 |
| 巨额订单(>100分) | 金色数字+6个星形粒子扩散(1.2s) | UIManager._createStarParticles |
| 进度25%/50%/75%/100% | 顶部横幅滑入(停留1.5s) | UIManager.showProgressBanner |

### 6.5 发射器特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 点击发射器 | 按压动画(scale 0.92→1.04→1, 0.25s) + 图标闪烁 | UIManager._onEmitterClicked |
| 冷却中 | 进度条从左到右填充 + 右侧倒计时数字 | UIManager.updateEmitters |
| 就绪 | 呼吸光晕动画(2s循环) | CSS .emitter-btn-ready |
| 冻结事件 | 蓝色渐变背景 + ❄图标旋转 + 图标颤抖 + 冰晶粒子 | UIManager.applyFreezeEffect |
| 加速事件 | 蓝色渐变背景 + ⚡图标闪烁旋转 + 图标弹跳 | UIManager.applySpeedUpEffect |

### 6.6 紧急事件特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 事件开始 | 棋盘下方居中横幅滑入（含名称、描述、倒计时） | UIManager.showEventBanner |
| 事件tick | 倒计时数字更新（最后3秒加速闪烁变红） | UIManager.updateEventTimer |
| 事件结束 | 横幅滑出消失 | UIManager.hideEventBanner |
| 元素洪流填充 | 水波纹扩散 + 蓝色水花粒子飞散 | BoardRenderer.playFloodEffect |
| 连击狂热合成 | "🔥 x3"火焰标签 + "+XX"积分数字 + 8个火焰色粒子爆散 | UIManager.showComboFeverScoreEffect |
| 加急订单倒计时 | 粉色进度条收缩 + 秒数显示（最后3秒变红脉冲） | UIManager.updateRushOrderTimers |
| 加急订单结束 | 卡片缩小消失动画(0.35s) | UIManager.removeRushOrderCards |

### 6.7 波次特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 波次开始 | 顶部横幅滑入（波次编号、目标、奖励），3秒后滑出 | UIManager.showWaveBanner |
| 波次完成 | Toast通知 + 最后一波特殊提示 | UIManager.showWaveCompletionEffect |
| 波次进度 | 积分下方进度条实时更新 | UIManager.updateWaveProgress |

### 6.8 评级结算特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 评级面板弹出 | 弹窗入场动画(modalIn) | CSS @keyframes modalIn |
| 综合评级字母 | 弹性缩放弹出(gradeReveal) + 彩色文字阴影 | CSS .rating-overall-grade |
| S评级 | 金色粒子浮动背景 | CSS .rating-panel 伪元素 |
| 维度进度条 | 宽度过渡动画(0.8s) | CSS .rating-dim-fill |

### 6.9 其他特效

| 触发条件 | 特效 | 实现位置 |
|----------|------|----------|
| 元素生成 | 下落弹跳(spawnDrop, 0.4s) | CSS @keyframes spawnDrop |
| 元素共鸣激活 | 动态光晕 + 🌈角标弹跳 + 等级标签✨标记 | BoardRenderer.updateCell |
| 三合一候选 | 金色边框脉冲动画 | CSS .triple-candidate |
| 通知Toast | 底部弹出(0.4s过渡)，2秒后消失 | UIManager.showNotification |
| 弹窗 | 背景模糊遮罩 + 缩放入场 | CSS .game-overlay + .game-modal |

---

## 七、肉鸽模式

### 7.1 层数生成（FLOOR_GENERATOR）

- 最大层数：12
- 每层节点数：[2,2,3,2,3,3,2,3,3,3,3,3]
- 节点类型：combat / elite / boon / shop / event / rest
- Boss层（第3/6/9/12层）：固定为 rest + boss 两个节点

### 7.2 Boss配置

| Boss | 所在层 | 特殊规则 |
|------|--------|----------|
| 熔岩巨像 | 3 | 每15秒随机灼烧一个格子（5秒不可用） |
| 冰霜女巫 | 6 | 发射器冷却速度降低50%，合成积分翻倍 |
| 混沌之核 | 9 | 订单需求每20秒全部刷新 |
| 时间吞噬者 | 12 | 限时90秒，倒计时结束强制失败 |
| 创世之灵 | 15 | 所有祝福失效，棋盘扩大至最大，发射器无冷却 |

### 7.3 随机事件（EVENT_POOL）

按层数分 early/mid/late 三档，每个事件提供2个选项：

| 事件 | 出现阶段 | 选项A | 选项B |
|------|----------|-------|-------|
| 迷路的炼金术士 | early | 获得随机稀有祝福 | 无事发生 |
| 元素风暴 | early | 失去最高级元素 | 所有元素+1级，损失3空位 |
| 神秘商人 | early | 用50%积分换传说祝福 | 用2祝福换2新祝福 |
| 古老的祭坛 | mid | 献祭祝福换2新祝福 | 献祭一半积分换史诗祝福 |
| 时空裂隙 | mid | 跳过关卡 | 获得祝福但下关难度+30% |
| 精灵的考验 | mid | 连续合成5次获传说祝福 | 获得普通祝福 |
| 黑暗交易 | late | 获2传说祝福+1诅咒 | 获得稀有祝福 |
| 混沌熔炉 | late | 随机改变所有祝福稀有度 | 永久加速50%，订单积分减半 |

### 7.4 祝福稀有度权重

| 稀有度 | 权重 | 颜色 |
|--------|------|------|
| common（普通） | 50 | #9e9e9e |
| rare（稀有） | 30 | #2196f3 |
| epic（史诗） | 15 | #9c27b0 |
| legendary（传说） | 5 | #ff9800 |

### 7.5 肉鸽模式启动流程

```
startRogueLevel(targetScore, node)
  ├─ 设置 isRogueMode = true
  ├─ 根据节点类型调整棋盘尺寸（elite减1列）
  ├─ 应用祝福/诅咒对棋盘大小的调整
  ├─ 初始化棋盘、发射器、订单系统（带难度偏移）
  ├─ 应用祝福到发射器
  ├─ 启动游戏循环/自动存档/波次/自动整理
  └─ 隐藏弹窗
```

---

## 八、存档系统

### 序列化内容

```javascript
{
  version: 1,
  timestamp: Date.now(),
  level, score, targetScore,
  board: [[Element.serialize()]],
  emitters: [Emitter.serialize()],
  mergeSystem: MergeSystem.serialize(),
  orderSystem: OrderSystem.serialize(),
  levelConfig,
}
```

### 存档时机

- 自动保存：每15秒（游戏进行中）
- 手动保存：调用 `GameEngine.save()`

---

## 九、开发准则与约束

### 9.1 架构约束

1. **三层分离**：数据层不依赖逻辑层，逻辑层不依赖表现层，表现层通过 EventBus 接收通知
2. **配置驱动**：新增元素/等级/发射器/订单/波次/事件/祝福/诅咒只需修改 config 文件，无需改动核心逻辑
3. **EventBus 通信**：模块间禁止直接调用，必须通过事件解耦

### 9.2 命名规范

- 事件名：`领域:动作` 格式（如 `score:updated`, `wave:started`）
- 私有方法：以下划线开头（如 `_checkWaveProgress`）
- 配置ID：蛇形命名（如 `boon_triple_merge`, `curse_slow_growth`）
- CSS类：连字符格式（如 `emitter-cooldown-bar`, `triple-candidate`）

### 9.3 特效开发规范

1. 粒子系统统一使用 BoardRenderer 的 Canvas 覆盖层
2. DOM动画优先使用 CSS keyframes（性能更好）
3. 需要 JS 驱动的复杂动画（如贝塞尔弧线飞行）使用 requestAnimationFrame
4. 所有临时 DOM 元素必须在动画结束后清理（setTimeout 移除）
5. 横幅类消息必须走横幅队列系统，避免重叠冲突

### 9.4 紧急事件开发规范

1. 新增事件需在 `EMERGENCY_EVENTS` 中定义完整的 apply/cleanup 回调
2. 事件上下文 `_eventCtx` 用于传递状态，apply 写入、cleanup 恢复
3. 特殊逻辑（如冻结发射器、洪流定时器）在 `_startEvent` 中单独处理
4. 事件结束时必须在 `_endActiveEvent` 中彻底清理所有副作用
5. 加急订单的清理回调存储在 `_eventCtx.removeRushOrder` 中

### 9.5 祝福/诅咒开发规范

1. 祝福的 apply 回调仅在 `applyToEmitters()` 中调用（仅生产类祝福）
2. 非生产类祝福通过 BoonSystem 的查询方法（hasBoon/hasCurse）在 GameEngine 中条件判断
3. 诅咒的 penalty 在 `applyToEmitters()` 中调用，compensator 也在其中调用
4. 诅咒补偿逻辑（如脆弱棋盘送传说祝福）在 `addCurse()` 中处理
5. 祝福/诅咒对订单积分的影响统一在 `getOrderRewardMultiplier()` 中计算

### 9.6 波次系统开发规范

1. 波次模板在 `WAVE_CONFIGS` 中按 tier 定义
2. 新增波次类型需在 `_checkWaveProgress()` 的 switch 中添加判断分支
3. 波次奖励目前仅支持加分，如需其他奖励类型需扩展 `_advanceToNextWave()`
4. `_checkScoreComplete()` 独立于波次系统运行，确保分数达标即可通关

### 9.7 已知注意事项

1. **isRogueMode 污染**：经典模式 `startLevel()` 开头必须重置 `this.isRogueMode = false`
2. **横幅队列方法完整性**：`_enqueueBanner` / `_processBannerQueue` / `_showBanner` 三个方法必须同时存在
3. **CSS 重复定义**：`.emitter-btn.on-cooldown` 只保留一份定义
4. **`_lastTickTime` 初始化**：构造函数中必须初始化为 0，否则 event:tick 永不发射
5. **三合一与二合一互斥**：拥有三重奏祝福时，`_onCellClick` 中先检测三合一模式，不进 `tryMerge`
6. **结算弹窗**：经典模式只保留评级面板，不发射 `game:over`（防止双重弹窗）
7. **语法检查**：UIManager.js 的正则花括号检查会误报模板字面量 `${}`，以逐行逐字符扫描为准