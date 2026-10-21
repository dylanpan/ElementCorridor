# 创世之灵（Boss：Creation Spirit）完整实现文档

## 基本信息

| 属性 | 值 |
|---|---|
| **Boss ID** | `boss_creation_spirit` |
| **名称** | 创世之灵 |
| **图标** | 🌟 |
| **所在层数** | 第 15 层（最终 Boss） |
| **特殊规则** | `nullify_boons` — 封印所有祝福 |
| **目标分倍率** | ×3.0 |
| **描述** | 所有祝福失效，但棋盘扩大至最大，发射器无冷却 |

---

## 一、配置参数（rogueConfig.js）

```javascript
{
  id: 'boss_creation_spirit',
  name: '创世之灵',
  icon: '🌟',
  floor: 15,
  description: '所有祝福失效，但棋盘扩大至最大，发射器无冷却',
  targetScoreMultiplier: 3.0,
  specialRule: 'nullify_boons',
  mechanics: {
    unsealInterval: 30000,      // 祝福解封间隔(ms)
    mirrorInterval: 20000,       // 镜像召唤间隔(ms)
    mirrorDuration: 6000,       // 镜像存在时间(ms)
    scorePerBoonPercent: 15,    // 每个祝福增加的目标分百分比
  },
}
```

---

## 二、Boss 状态字段（_bossState）

在 `_bossState` 中新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `sealedBoons` | `string[]` | `[]` | 被封存的祝福 ID 列表 |
| `unsealOrder` | `string[]` | `[]` | 解封顺序（初始为 sealedBoons 的副本） |
| `lastUnsealTime` | `number` | `0` | 上次解封的时间戳 |
| `mirrors` | `object[]` | `[]` | 活跃镜像列表，每项 `{row, col, expireAt}` |
| `lastMirrorTime` | `number` | `0` | 上次召唤镜像的时间戳 |

---

## 三、核心机制详解

### 机制 1：祝福封印（开局触发）

**触发时机**：进入 Boss 战时（`_initBossBattle`）

**执行流程**：
1. 通过 `boonSystem.getCurrentBoons()` 获取玩家当前拥有的所有祝福
2. 将所有祝福 ID 存入 `_bossState.sealedBoons`
3. 将 `sealedBoons` 的副本设为 `unsealOrder`（解封顺序）
4. 同步通知 `boonSystem.sealedBoons = this._bossState.sealedBoons`
5. 设置所有发射器的 `cooldownMultiplier = 0`（无冷却）

**封印对游戏的影响**：
- `BoonSystem.hasBoon(boonId)` 方法会检查 `sealedBoons`：若该祝福在封印列表中，返回 `false`
- 即所有祝福的效果全部失效，仿佛从未拥有过
- 发射器无冷却作为补偿

### 机制 2：祝福解封（周期性）

**触发时机**：每 `unsealInterval`（30 秒）自动解封一个祝福

**执行函数**：`_tickCreationSpirit()` → `_unsealNextBoon()`

**解封流程**：
1. 检查 `unsealOrder.length > 0` 且距上次解封超过 `unsealInterval`
2. 从 `unsealOrder.shift()` 取出下一个要解封的祝福 ID
3. 从 `sealedBoons` 中移除该 ID
4. 触发 `boss:boon-unsealed` 事件（UI 播放全屏闪光效果）
5. 发送通知消息："🌟 一个祝福被解封了！"

**UI 表现**：
- 全屏径向渐变闪光动画（`.boon-unseal-flash`）
- 金色光芒从中心向外扩散，持续约 0.2 秒

### 机制 3：镜像召唤（周期性）

**触发时机**：每 `mirrorInterval`（20 秒）召唤一个镜像

**执行函数**：`_tickCreationSpirit()` → `_summonMirror(duration)`

**镜像元素属性**：
```javascript
{
  id: `mirror_${Date.now()}_${random}`,
  level: maxLevel,               // 棋盘上最高等级元素的等级
  icon: maxIcon,                 // 棋盘上最高等级元素的图标
  isMirror: true,                // 标记为镜像
  expireAt: Date.now() + duration, // 过期时间（6秒后）
}
```

**召唤流程**：
1. 遍历棋盘，收集所有空格子
2. 如果没有空格子，跳过本次召唤
3. 随机选择一个空格子
4. 遍历棋盘找到最高等级的元素，复制其等级和图标
5. 在该格子放置镜像元素
6. 更新棋盘渲染
7. 记录到 `state.mirrors` 数组
8. 触发 `boss:mirror-summoned` 事件（UI 播放闪烁动画）

**镜像持续时间**：`mirrorDuration` = 6 秒（6000ms）

**过期清理**：每次 `_tickCreationSpirit` 调用时，过滤掉已过期的镜像

**UI 表现**：
- 镜像格子添加 `.cell-mirror` CSS 类
- 金色 shimmer 闪烁动画（0.5s 循环，重复 4 次 = 2 秒总时长）
- 实际 2 秒后移除动画样式，但元素本身仍在棋盘上直到 6 秒过期

### 机制 4：镜像交互限制

**点击规则**（`_onCellClick`）：
- 点击镜像元素 → 直接 `return`（不可选中、不可操作）
- 已选中普通元素，点击镜像 → 不切换选中（镜像不可作为合成目标）
- 已选中镜像元素 → `deselectCell()` 并 `return`（取消选中）

**合成系统**：镜像元素不会被 `tryMerge` 匹配（因为 `isMirror: true`，且合成系统只匹配同类型同等级的基础元素）

**订单系统**：镜像元素不会被 `submitOrder` 匹配消耗（因为 `isMirror: true`，且订单系统按 `typeId` 和 `level` 匹配基础元素）

---

## 四、Boss 战流程

### 进入 Boss 战（startRogueLevel）

1. 检测节点类型为 `boss` 且 `bossId === 'boss_creation_spirit'`
2. 棋盘扩大至 **10列 × 8行**（其他 Boss 仅 +2列/+1行）
3. 初始化棋盘、产出系统、渲染器、发射器

### 战斗循环（_tickCreationSpirit）

每帧执行以下步骤：

```
1. 祝福解封检查
   └─ 距上次解封 ≥ 30 秒 且 还有未解封祝福
      └─ 解封下一个祝福

2. 镜像召唤检查
   └─ 距上次召唤 ≥ 20 秒
      └─ 在随机空格子召唤镜像（持续 6 秒）

3. 清理过期镜像
   └─ 过滤 state.mirrors 中 expireAt > now 的条目
```

### 胜利条件

- 标准条件：`score >= targetScore`
- 没有特殊的 Boss 专属胜利条件（与普通关卡相同）
- 目标分计算：基础目标分 × 3.0（targetScoreMultiplier）
- 解封祝福不会动态调整目标分（`scorePerBoonPercent` 配置存在但当前代码未使用）

### 失败条件

- 没有时间限制（不同于时间吞噬者）
- 没有格子封锁机制（不同于熔岩巨像/时间吞噬者）
- 没有特殊失败条件，按常规关卡失败逻辑处理

---

## 五、UI 与视觉表现

### 技能面板展示

Boss 技能卡片显示三条信息：

| 技能 | 描述 |
|---|---|
| 🛡 封印 | 所有祝福失效，但棋盘扩大至最大，发射器无冷却 |
| 🔓 解封 | 每 30 秒解封一个祝福 |
| 👻 镜像 | 每 20 秒召唤镜像，持续 6 秒 |

### CSS 样式

**镜像格子（`.cell-mirror`）**：
```css
.cell-mirror {
  animation: mirrorShimmer 0.5s ease-in-out 4;
}
@keyframes mirrorShimmer {
  0%, 100% { box-shadow: 0 0 8px rgba(212, 172, 61, 0.45); }
  50% { box-shadow: 0 0 28px rgba(247, 208, 83, 0.71), 0 0 44px rgba(237, 195, 70, 0.38); }
}
```

**祝福解封闪光（`.boon-unseal-flash`）**：
```css
.boon-unseal-flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 996;
  opacity: 0;
  background: radial-gradient(...);
  transition: opacity 0.2s ease;
}
```

---

## 六、代码文件索引

| 文件 | 相关函数/位置 | 说明 |
|---|---|---|
| `js/config/rogueConfig.js` | ~line 575 | Boss 配置定义 |
| `js/core/GameEngine.js` | `startRogueLevel()` ~line 540 | 棋盘扩大逻辑 |
| `js/core/GameEngine.js` | `_initBossBattle()` ~line 2390 | 封印祝福、发射器无冷却 |
| `js/core/GameEngine.js` | `_bossState` 初始化 ~line 3260 | sealedBoons/mirrors 等字段 |
| `js/core/GameEngine.js` | `_tickCreationSpirit()` ~line 3306 | 主循环调度 |
| `js/core/GameEngine.js` | `_unsealNextBoon()` ~line 3330 | 解封祝福 |
| `js/core/GameEngine.js` | `_summonMirror()` ~line 3350 | 召唤镜像 |
| `js/core/GameEngine.js` | `_isMirrorElement()` ~line 3410 | 镜像判断 |
| `js/core/GameEngine.js` | `_onCellClick()` ~line 470 | 镜像交互限制 |
| `js/systems/BoonSystem.js` | `hasBoon()` ~line 141 | 封印状态下的祝福检查 |
| `js/ui/UIManager.js` | `_onBossMirrorSummoned()` ~line 2031 | 镜像 UI 动画 |
| `js/ui/UIManager.js` | `_onBossBoonUnsealed()` ~line 2045 | 解封闪光效果 |
| `js/ui/UIManager.js` | Boss 技能面板 ~line 1788 | 技能卡片展示 |
| `css/style.css` | ~line 3374 | `.cell-mirror` / `.boon-unseal-flash` 样式 |

---

## 七、已知问题与未实现功能（v38 已修复）

1. ~~**`scorePerBoonPercent` 未使用**：配置中定义了每个祝福增加 15% 目标分，但当前代码未实现此逻辑~~ ✅ **v38 已实现**
2. ~~**镜像动画时长不一致**：镜像是 6 秒过期，但 CSS 动画只播放 2 秒（0.5s × 4 次），剩余 4 秒无视觉提示~~ ✅ **v38 已修复**
3. ~~**镜像过期后未从棋盘清除**：`_tickCreationSpirit` 中清理过期镜像时，仅过滤了 `state.mirrors` 数组，未清除 `board[r][c]` 中的元素，也未更新渲染~~ ✅ **v38 已修复**
4. **无 Boss 专属失败条件**：没有类似时间吞噬者的倒计时失败机制 — 设计如此，无需修改
5. **无 Boss 专属胜利动画**：胜利时走通用 `_onBossVictory` 逻辑 — 已有全屏金光绽放效果，可接受
