# 熔岩巨像（Boss：Lava Giant）完整实现文档

## 基本信息

| 属性 | 值 |
|---|---|
| **Boss ID** | `boss_lava_giant` |
| **名称** | 熔岩巨像 |
| **图标** | 🗿 |
| **所在层数** | 第 3 层 |
| **特殊规则** | `scorch` — 灼烧棋盘格子 |
| **目标分倍率** | ×1.8 |
| **描述** | 每 15 秒棋盘随机一个格子被灼烧无法使用，持续 5 秒 |

---

## 一、配置参数（rogueConfig.js）

```javascript
{
  id: 'boss_lava_giant',
  name: '熔岩巨像',
  icon: '🗿',
  floor: 3,
  description: '每 15 秒棋盘随机一个格子被灼烧无法使用，持续 5 秒',
  targetScoreMultiplier: 1.8,
  specialRule: 'scorch',
  mechanics: {
    scorchInterval: 15000,      // 灼烧间隔(ms)
    scorchDuration: 7500,       // 灼烧持续时间(ms)
    spreadChance: 0.65,         // 灼烧蔓延概率
    rageThreshold: 3,           // 愤怒阈值(同时灼烧格子数)
    rageCooldownPenalty: 1.75,  // 愤怒时发射器冷却惩罚倍率
  },
}
```

---

## 二、Boss 状态字段（_bossState）

在 `_bossState` 中新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `scorchedCells` | `object[]` | `[]` | 活跃灼烧格子列表，每项 `{row, col, elementBurnAt, fireExpireAt}` |
| `lastScorchTime` | `number` | `0` | 上次灼烧时间戳 |
| `lastSpreadTime` | `number` | `0` | 上次蔓延时间戳 |
| `isRageActive` | `boolean` | `false` | 是否处于愤怒状态 |

---

## 三、核心机制详解

### 机制 1：灼烧格子（周期性）

**触发时机**：每 `scorchInterval`（15 秒）自动灼烧一个随机格子

**执行函数**：`_tickLavaGiant()` → `_applyScorch(duration)`

**灼烧流程**：
1. 遍历棋盘，收集所有未被灼烧的格子
2. 如果没有可用格子，跳过本次灼烧
3. 随机选择一个格子施加灼烧
4. 如果该格子有元素，记录烧毁时间（`elementBurnAt = now + duration`）
5. 记录火焰熄灭时间（`fireExpireAt = now + duration * 2`）
6. 触发 `boss:scorch-cell` 事件（UI 播放火焰动画）

**灼烧效果**：
- 格子无法放置新元素
- 格子上的元素在 `scorchDuration` 后自动销毁
- 火焰在 `scorchDuration * 2` 后自行熄灭

### 机制 2：灼烧蔓延（概率触发）

**触发时机**：每 3 秒检测一次，有 `spreadChance`（65%）概率触发

**执行函数**：`_tickLavaGiant()` → `_spreadScorch(duration)`

**蔓延流程**：
1. 收集所有被灼烧格子的相邻格子（上下左右）
2. 从相邻格子中随机选择一个
3. 对该格子施加灼烧（同 `_applyScorch` 逻辑）

### 机制 3：元素烧毁

**触发时机**：每帧 `_tickLavaGiant()` 执行时

**执行流程**：
1. 遍历 `scorchedCells` 列表
2. 检查每个格子是否有元素且 `elementBurnAt` 已到期
3. 到期则调用 `spawn.removeElement()` 销毁元素
4. 更新棋盘渲染

### 机制 4：愤怒状态

**触发时机**：同时灼烧格子数 ≥ `rageThreshold`（3 格）

**执行流程**：
1. 检测 `scorchedCells.length >= rageThreshold`
2. 进入愤怒状态 → 设置所有发射器 `cooldownMultiplier = rageCooldownPenalty`（1.75 倍冷却惩罚）
3. 触发 `boss:rage-activated` 事件（UI 播放红色脉冲 + 发射器火焰特效）
4. 发送通知："🔥 熔岩巨像进入愤怒状态！发射器冷却增加 75%"
5. 当灼烧格子数降至阈值以下时解除愤怒 → 恢复 `cooldownMultiplier = 1.0`
6. 触发 `boss:rage-deactivated` 事件

### 机制 5：合成灭火

**触发时机**：元素合成时（由 `_executeMerge` 调用）

**执行函数**：`_extinguishOnMerge(row, col)`

**灭火流程**：
1. 检查合成位置是否在 `scorchedCells` 中
2. 如果是，从列表中移除该格子
3. 触发 `boss:extinguish-cell` 事件（UI 播放灭火粒子效果）
4. 返回 `true` 表示成功灭火

---

## 四、Boss 战流程

### 进入 Boss 战（startRogueLevel）

1. 检测节点类型为 `boss` 且 `bossId === 'boss_lava_giant'`
2. 棋盘扩大至 **基础列数 +2 列，基础行数 +1 行**
3. 初始化棋盘、产出系统、渲染器、发射器

### 战斗循环（_tickLavaGiant）

每帧执行以下步骤：

```
1. 灼烧格子检查
   └─ 距上次灼烧 ≥ 15 秒
      └─ 灼烧一个随机格子（持续 7.5 秒）

2. 元素烧毁检查
   └─ 遍历灼烧格子，检查元素是否到期烧毁

3. 清理已熄灭的火焰
   └─ 过滤 fireExpireAt > now 的格子

4. 愤怒状态检测
   └─ 灼烧格子数 ≥ 3 → 进入愤怒（冷却 ×1.75）
   └─ 灼烧格子数 < 3 → 解除愤怒

5. 灼烧蔓延检测
   └─ 有灼烧格子 + 距上次蔓延 ≥ 3 秒 + 65% 概率
      └─ 蔓延到相邻格子

6. 刷新燃烧视觉效果
```

### 胜利条件

- 标准条件：`score >= targetScore`
- 目标分计算：基础目标分 × 1.8（targetScoreMultiplier）

### 失败条件

- 无特殊失败条件，按常规关卡失败逻辑处理

---

## 五、UI 与视觉表现

### 技能面板展示

Boss 技能卡片显示四条信息：

| 技能 | 描述 |
|---|---|
| 🔥 灼烧 | 每 15 秒灼烧一个随机格子，持续 7.5 秒 |
| 🔥 蔓延 | 灼烧有 65% 概率蔓延到相邻格子 |
| ⚡ 愤怒 | ≥3 格同时灼烧时进入愤怒，发射器冷却 ×1.75 |
| 💧 灭火 | 合成可熄灭灼烧格子 |

### CSS 样式

**灼烧格子（`.cell-scorched`）**：
```css
.cell-scorched {
  animation: scorchFlicker 0.5s ease-in-out infinite alternate;
}
@keyframes scorchFlicker {
  0% { box-shadow: inset 0 0 12px rgba(255, 136, 0, 0.6), 0 0 4px rgba(255, 68, 0, 0.4); }
  100% { box-shadow: inset 0 0 26px rgba(231, 76, 66, 0.82), 0 0 16px rgba(243, 156, 62, 0.64); }
}
```

**愤怒脉冲（`.boss-rage-pulse`）**：
```css
.boss-rage-pulse {
  position: fixed; inset: 0; pointer-events: none; z-index: 999;
  border: 8px solid transparent; border-image: none;
  transition: opacity 0.5s ease;
}
.boss-rage-pulse.show {
  border-color: #e74c3c; box-shadow: inset 0 0 96px rgba(224, 63, 73, 0.35);
}
```

**愤怒 HUD（`.boss-hud-rage`）**：
```css
.boss-hud-rage { animation: ragePulse 0.77s ease-in-out infinite alternate; }
@keyframes ragePulse {
  0% { box-shadow: 0 0 12px rgba(197, 48, 81, 0.5); }
  100% { box-shadow: 0 0 32px rgba(253, 93, 103, 0.85); }
}
```

---

## 六、代码文件索引

| 文件 | 相关函数/位置 | 说明 |
|---|---|---|
| `js/config/rogueConfig.js` | ~line 493 | Boss 配置定义 |
| `js/core/GameEngine.js` | `_bossState` 初始化 ~line 2260 | scorchedCells/lastScorchTime 等字段 |
| `js/core/GameEngine.js` | `_tickLavaGiant()` ~line 1493 | 主循环调度 |
| `js/core/GameEngine.js` | `_applyScorch()` ~line 1599 | 灼烧格子 |
| `js/core/GameEngine.js` | `_spreadScorch()` ~line 1639 | 灼烧蔓延 |
| `js/core/GameEngine.js` | `_extinguishOnMerge()` ~line 1679 | 合成灭火 |
| `js/core/GameEngine.js` | `_isCellScorched()` ~line 1693 | 检查格子是否被灼烧 |
| `js/core/GameEngine.js` | `getEmitterCooldownMultiplier()` ~line 2699 | 愤怒状态冷却惩罚 |
| `js/ui/UIManager.js` | `_onBossScorchCell()` ~line 817 | 灼烧 UI 动画 |
| `js/ui/UIManager.js` | `_onBossExtinguishCell()` ~line 832 | 灭火粒子效果 |
| `js/ui/UIManager.js` | `_onBossRageActivated()` ~line 845 | 愤怒红色脉冲 |
| `js/ui/UIManager.js` | `_onBossRageDeactivated()` ~line 865 | 愤怒解除 |
| `js/ui/UIManager.js` | Boss 技能面板 ~line 760 | 技能卡片展示 |
| `css/style.css` | ~line 3227 | `.cell-scorched` / `.boss-rage-pulse` 等样式 |

---

## 七、已知问题与设计考量

1. **灼烧与棋盘扩大的平衡**：灼烧机制限制了可用格子数，与棋盘扩大形成对抗——玩家需要利用更大的棋盘空间来规避灼烧带来的损失
2. **合成灭火的策略性**：玩家可以通过在灼烧格子上合成来灭火，这鼓励玩家主动在危险区域进行操作
3. **愤怒状态的惩罚力度**：冷却惩罚 1.75 倍意味着发射器产出效率降低约 43%，迫使玩家尽快减少灼烧格子数
4. **蔓延概率的随机性**：65% 的蔓延概率使得灼烧扩散具有一定的不确定性，增加了每局游戏的差异性
