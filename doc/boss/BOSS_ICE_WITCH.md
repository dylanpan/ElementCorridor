# 冰霜女巫（Boss：Ice Witch）完整实现文档

## 基本信息

| 属性 | 值 |
|---|---|
| **Boss ID** | `boss_ice_witch` |
| **名称** | 冰霜女巫 |
| **图标** | ❄ |
| **所在层数** | 第 6 层 |
| **特殊规则** | `chill` — 冻结棋盘行 |
| **目标分倍率** | ×2.0 |
| **描述** | 发射器冷却速度降低 50%，但合成积分翻倍 |

---

## 一、配置参数（rogueConfig.js）

```javascript
{
  id: 'boss_ice_witch',
  name: '冰霜女巫',
  icon: '❄',
  floor: 6,
  description: '发射器冷却速度降低 50%，但合成积分翻倍',
  targetScoreMultiplier: 2.0,
  specialRule: 'chill',
  mechanics: {
    freezeInterval: 15500,      // 冻结间隔(ms)
    freezeDuration: 43000,      // 冻结持续时间(ms)
    thawMergeCount: 2,          // 解冻所需连续合成次数
    blizzardThreshold: 2,       // 暴风雪阈值(同时冻结行数)
    blizzardPauseDuration: 8700, // 暴风雪持续期间发射器暂停时间(ms)
  },
}
```

---

## 二、Boss 状态字段（_bossState）

在 `_bossState` 中新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `frozenRows` | `Set<number>` | `new Set()` | 当前被冻结的行索引集合 |
| `_freezeRowTimeouts` | `object` | `{}` | 自动解冻定时器映射，键为行号 |
| `lastFreezeTime` | `number` | `0` | 上次冻结时间戳 |
| `thawMergeCount` | `number` | `0` | 当前行上的连续合成计数 |
| `isBlizzardActive` | `boolean` | `false` | 是否处于暴风雪状态 |
| `blizzardEndTime` | `number` | `0` | 暴风雪结束时间戳 |

---

## 三、核心机制详解

### 机制 1：冻结行（周期性）

**触发时机**：每 `freezeInterval`（15.5 秒）冻结一行

**执行函数**：`_tickIceWitch()` → `_freezeRandomRow(duration)`

**冻结流程**：
1. 遍历棋盘所有行，收集未被冻结的行
2. 如果没有可用行，跳过本次冻结
3. 随机选择一行施加冻结
4. 将该行加入 `frozenRows` Set
5. 通知 `BoardRenderer.frozenRows` 保留冻结样式
6. 更新该行所有格子的渲染
7. 触发 `boss:freeze-row` 事件（UI 播放冻结动画）
8. 设置 `setTimeout` 在 `freezeDuration`（43 秒）后自动解冻

**冻结效果**：
- 冻结行上的元素无法被选中、移动或合成
- 冻结行上的元素不能被订单提交消耗
- 冻结行上的格子保留冻结视觉样式

### 机制 2：合成解冻

**触发时机**：元素合成时（由 `_executeMerge` 调用）

**执行函数**：`_updateThawProgress(row)`

**解冻流程**：
1. 检查合成所在行是否被冻结
2. 如果不是冻结行，返回 `false`
3. 增加 `thawMergeCount` 计数
4. 当 `thawMergeCount >= thawMergeCount`（2 次）时：
   - 从 `frozenRows` 中移除该行
   - 重置 `thawMergeCount = 0`
   - 通知 `BoardRenderer.frozenRows` 移除冻结样式
   - 触发 `boss:thaw-row` 事件（UI 播放碎裂粒子效果）
   - 返回 `true`
5. 未达到解冻次数时返回 `false`

### 机制 3：暴风雪（条件触发）

**触发时机**：同时冻结行数 ≥ `blizzardThreshold`（2 行）

**执行函数**：`_tickIceWitch()` → `_freezeEmitters()`

**暴风雪流程**：
1. 检测 `frozenRows.size >= blizzardThreshold` 且未处于暴风雪中
2. 设置 `isBlizzardActive = true`
3. 记录 `blizzardEndTime = now + blizzardPauseDuration`（8.7 秒）
4. 调用 `_freezeEmitters()` — 暂停所有发射器产出
5. 触发 `boss:blizzard-started` 事件（UI 播放全屏暴风雪遮罩）
6. 发送通知："❄ 冰霜女巫释放了暴风雪！所有发射器暂停 8.7 秒"

**暴风雪结束**：
1. 每帧检测 `now > blizzardEndTime`
2. 设置 `isBlizzardActive = false`
3. 调用 `_unfreezeEmitters()` — 恢复所有发射器产出
4. 清除所有冻结行（强制解冻）
5. 清除所有自动解冻定时器
6. 触发 `boss:blizzard-ended` 事件（UI 移除暴风雪遮罩）
7. 发送通知："❄ 暴风雪结束了！"

### 发射器冻结/解冻

**冻结发射器**（`_freezeEmitters`）：
```javascript
for (const emitter of this.state.emitters) {
  emitter.beginFreeze(now);
}
```

**解冻发射器**（`_unfreezeEmitters`）：
```javascript
for (const emitter of this.state.emitters) {
  emitter.endFreeze(now);
}
```

发射器 `beginFreeze` 会记录冻结开始时间，`isReadyToSpawn` 在冻结状态下返回 `false`，`getCooldownProgress` 返回冻结开始时的进度值。

---

## 四、Boss 战流程

### 进入 Boss 战（startRogueLevel）

1. 检测节点类型为 `boss` 且 `bossId === 'boss_ice_witch'`
2. 棋盘扩大至 **基础列数 +2 列，基础行数 +1 行**
3. 初始化棋盘、产出系统、渲染器、发射器

### 战斗循环（_tickIceWitch）

每帧执行以下步骤：

```
1. 暴风雪结束恢复
   └─ 暴风雪活跃且已到期
      └─ 解冻所有发射器 + 清除所有冻结行 + 清除定时器

2. 冻结行检查
   └─ 距上次冻结 ≥ 15.5 秒
      └─ 冻结一行（持续 43 秒）

3. 暴风雪触发检测
   └─ 冻结行数 ≥ 2 且未处于暴风雪
      └─ 触发暴风雪（暂停所有发射器 8.7 秒）
```

### 胜利条件

- 标准条件：`score >= targetScore`
- 目标分计算：基础目标分 × 2.0（targetScoreMultiplier）
- 合成积分翻倍作为补偿（由 `BoonSystem.getMergeBonus()` 实现）

### 失败条件

- 无特殊失败条件，按常规关卡失败逻辑处理

---

## 五、UI 与视觉表现

### 技能面板展示

Boss 技能卡片显示三条信息：

| 技能 | 描述 |
|---|---|
| ❄ 冻结 | 每 15.5 秒冻结一行，持续 043 秒 |
| 💧 解冻 | 在被冻结行上连续合成 2 次可解冻该行 |
| 🌪 暴风雪 | ≥2 行被冻结时触发暴风雪，所有发射器暂停 8.7 秒 |

### CSS 样式

**冻结格子（`.cell-frozen`）**：
```css
.cell-frozen {
  animation: freezeGlow 1.2s ease-in-out infinite alternate;
}
@keyframes freezeGlow {
  0% { box-shadow: inset 0 0 8px rgba(108, 194, 191, 0.375); }
  100% { box-shadow: inset 0 0 24px rgba(106, 182, 177, 0.625), 0 0 16px rgba(127, 166, 164, 0.3125); }
}
```

**暴风雪遮罩（`.blizzard-overlay`）**：
```css
.blizzard-overlay {
  position: fixed; inset: 0; pointer-events: none; z-index: 998;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(148, 193, 174, 0.275) 60%, rgba(131, 171, 162, 0.425) 100%);
  opacity: 0; transition: opacity 0.675s ease;
}
.blizzard-overlay.show { opacity: 1; }
```

---

## 六、代码文件索引

| 文件 | 相关函数/位置 | 说明 |
|---|---|---|
| `js/config/rogueConfig.js` | ~line 506 | Boss 配置定义 |
| `js/core/GameEngine.js` | `_bossState` 初始化 ~line 2260 | frozenRows/_freezeRowTimeouts 等字段 |
| `js/core/GameEngine.js` | `_tickIceWitch()` ~line 767 | 主循环调度 |
| `js/core/GameEngine.js` | `_freezeRandomRow()` ~line 2850 | 冻结行 |
| `js/core/GameEngine.js` | `_updateThawProgress()` ~line 2880 | 合成解冻进度 |
| `js/core/GameEngine.js` | `_isRowFrozen()` ~line 2890 | 检查行是否被冻结 |
| `js/core/GameEngine.js` | `_freezeEmitters()` / `_unfreezeEmitters()` | 发射器暂停/恢复 |
| `js/entities/Emitter.js` | `beginFreeze()` / `endFreeze()` | 发射器冻结状态管理 |
| `js/ui/UIManager.js` | `_onBossFreezeRow()` ~line 875 | 冻结行 UI 动画 |
| `js/ui/UIManager.js` | `_onBossThawRow()` ~line 888 | 解冻碎裂粒子效果 |
| `js/ui/UIManager.js` | `_onBossBlizzardStarted()` ~line 903 | 暴风雪遮罩 |
| `js/ui/UIManager.js` | `_onBossBlizzardEnded()` ~line 924 | 暴风雪结束 |
| `js/ui/UIManager.js` | Boss 技能面板 ~line 780 | 技能卡片展示 |
| `css/style.css` | ~line 3241 | `.cell-frozen` / `.blizzard-overlay` 等样式 |

---

## 七、已知问题与设计考量

1. **冻结与合成的对抗**：冻结行阻止了玩家在该行上进行合成操作，而解冻又需要在该行上合成——这迫使玩家在其他行合成元素后移动到冻结行上操作，增加了操作复杂度
2. **暴风雪的惩罚性**：暴风雪暂停所有发射器，意味着玩家在暴风雪期间无法获得新元素，只能依靠棋盘上已有的元素进行操作
3. **合成积分翻倍的补偿**：作为冻结机制的补偿，合成积分翻倍，鼓励玩家在有限的可用行上追求高质量的合成
4. **连续合成解冻的策略**：需要连续 2 次合成才能解冻一行，这意味着玩家需要提前储备可合成的元素对，增加了策略规划的需求
