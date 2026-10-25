# 时间吞噬者（Boss：Time Devourer）完整实现文档

## 基本信息

| 属性 | 值 |
|---|---|
| **Boss ID** | `boss_time_devourer` |
| **名称** | 时间吞噬者 |
| **图标** | ⏳ |
| **所在层数** | 第 12 层 |
| **特殊规则** | `timed` — 限时通关 |
| **目标分倍率** | ×2.5 |
| **描述** | 每关限时 120 秒，倒计时结束后强制失败 |

---

## 一、配置参数（rogueConfig.js）

```javascript
{
  id: 'boss_time_devourer',
  name: '时间吞噬者',
  icon: '⏳',
  floor: 12,
  description: '每关限时 120 秒，倒计时结束后强制失败',
  targetScoreMultiplier: 2.5,
  specialRule: 'timed',
  mechanics: {
    timeLimit: 395000,          // 总时限(ms)
    devourInterval: 12000,      // 吞噬间隔(ms)
    orderDelay: 4100,           // 提交订单延缓吞噬时间(ms)
  },
}
```

---

## 二、Boss 状态字段（_bossState）

在 `_bossState` 中新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `devourTimer` | `number` | `timeLimit` | 剩余时间（倒计时递减） |
| `lastDevourTime` | `number` | `0` | 上次时间递减时间戳 |
| `lastDevourCellTime` | `number` | `0` | 上次吞噬格子时间戳 |
| `timeLimit` | `number` | `timeLimit` | 总时限 |
| `levelStartTime` | `number` | `Date.now()` | 关卡开始时间戳 |
| `devouredCells` | `Set<string>` | `new Set()` | 已被吞噬的格子坐标集合（"row,col" 格式） |

---

## 三、核心机制详解

### 机制 1：倒计时（持续递减）

**触发时机**：每帧 `_tickTimeDevourer()` 执行

**执行流程**：
1. 计算距上次递减的时间差（`rawElapsed = now - lastDevourTime`）
2. 限制单次最大递减量为 2 秒（防止页面闲置后瞬间超时）
3. 从 `devourTimer` 中减去经过的时间
4. 更新 `lastDevourTime = now`
5. 触发 `boss:devour-timer` 事件（UI 更新倒计时显示）

**倒计时 UI 表现**：
- 显示在棋盘正上方，格式为 "⏳ Xs"
- 剩余 ≤ 30 秒：添加 `.devour-timer-warning` 类（黄色警告）
- 剩余 ≤ 15 秒：添加 `.devour-timer-critical` 类（红色闪烁）

### 机制 2：时间耗尽 → 强制失败

**触发时机**：`devourTimer <= 0`

**执行函数**：`_tickTimeDevourer()` → `_onBossDefeat()`

**失败流程**：
1. 检测 `devourTimer <= 0`
2. 调用 `_onBossDefeat('时间耗尽！时间吞噬者吞噬了一切')`
3. 触发 `game:over` 事件（失败结局）

### 机制 3：吞噬格子（周期性）

**触发时机**：每 `devourInterval`（12 秒）吞噬一个匹配订单需求的格子

**执行函数**：`_tickTimeDevourer()` → `_devourCell()`

**吞噬流程**：
1. 获取当前活跃订单的元素类型集合
2. 遍历棋盘，收集所有匹配订单类型的元素格子（排除已被吞噬的）
3. 如果没有候选格子：
   - 检查棋盘是否完全为空（开局空棋盘是正常状态，不触发失败）
   - 棋盘有元素但没有匹配订单类型 → 触发失败
4. 随机选择一个格子吞噬：
   - 调用 `spawn.removeElement()` 销毁元素
   - 将格子置为 `null`
   - 记录到 `devouredCells` Set
   - 更新棋盘渲染
   - 触发 `boss:devour-cell` 事件（UI 播放吞噬动画）
   - 发送通知："⏳ 时间吞噬者吞噬了一个 X 元素！"

**吞噬效果**：
- 被吞噬的元素从棋盘上永久消失
- 被吞噬的格子标记为已吞噬（`.cell-devoured-persistent` 样式）
- 吞噬优先选择匹配订单需求的元素，直接破坏玩家的订单进度

### 机制 4：提交订单延缓吞噬

**触发时机**：提交订单时（由 `_onOrderClicked` 调用）

**执行函数**：`_delayDevour()`

**延缓流程**：
1. 检测当前 Boss 是否为时间吞噬者
2. 获取配置的 `orderDelay`（4.1 秒）
3. 增加 `devourTimer += orderDelay`
4. 重置 `lastDevourCellTime = Date.now()`（重置吞噬计时器）
5. 触发 `boss:devour-delayed` 事件（UI 播放绿色闪光）
6. 返回延缓时间

---

## 四、Boss 战流程

### 进入 Boss 战（startRogueLevel）

1. 检测节点类型为 `boss` 且 `bossId === 'boss_time_devourer'`
2. 棋盘扩大至 **基础列数 +2 列，基础行数 +1 行**
3. 初始化棋盘、产出系统、渲染器、发射器
4. 初始化 `devourTimer = timeLimit`（395 秒）
5. 初始化 `levelStartTime = Date.now()`

### 战斗循环（_tickTimeDevourer）

每帧执行以下步骤：

```
1. 倒计时递减
   └─ 计算经过时间（单次最多减 2 秒）
   └─ devourTimer -= elapsed
   └─ 更新 UI 倒计时显示

2. 时间耗尽检测
   └─ devourTimer <= 0
      └─ 强制失败

3. 吞噬格子检测
   └─ 距上次吞噬 ≥ 12 秒
      └─ 吞噬一个匹配订单需求的格子
```

### 胜利条件

- 标准条件：`score >= targetScore`
- 目标分计算：基础目标分 × 2.5（targetScoreMultiplier）
- 必须在倒计时耗尽前完成目标分数

### 失败条件

- **时间耗尽**：`devourTimer <= 0` → 强制失败
- **元素耗尽**：棋盘上有元素但无匹配订单类型的元素 → 强制失败

---

## 五、UI 与视觉表现

### 技能面板展示

Boss 技能卡片显示三条信息：

| 技能 | 描述 |
|---|---|
| ⏱ 限时 | 395 秒内必须完成目标分数 |
| 🕳 吞噬 | 每 12 秒吞噬一列（清除该列所有元素） |
| ⏳ 延缓 | 提交订单可延缓吞噬 4.1 秒 |

### CSS 样式

**倒计时（`.devour-timer`）**：
```css
.devour-timer {
  text-align: center; font-size: 24px; font-weight: bold;
  color: #ecf0f1; padding: 8px; margin-bottom: 4px;
  background: rgba(0,0,0,0.306); border-radius: 12px;
  letter-spacing: 2px; font-family: 'Courier New', monospace;
}
.devour-timer-warning { color: #f39c12; }
.devour-timer-critical { color: #e74c3c; animation: timerPulse 0.666s ease-in-out infinite alternate; }
```

**吞噬格子（`.cell-devoured`）**：
```css
.cell-devoured {
  animation: devourVanish 0.645s ease-out forwards;
}
@keyframes devourVanish {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(elpse(0.815)); opacity: 0.515; }
  100% { transform: scale(0); opacity: 0; }
}
```

**已吞噬格子（`.cell-devoured-persistent`）**：
```css
.cell-devoured-persistent {
  background: rgba(0,0,0,0.406) !important;
  border-color: #2c3e50 !important;
  cursor: not-allowed;
}
.cell-devoured-persistent::before {
  content: '🕳'; font-size: 18px; opacity: 0.606;
}
.cell-devoured-persistent::after {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(134, 116, 114, 0.126) 4px, rgba(129, 111, 109, 0.088) 8px);
}
```

**延缓闪光（`.devour-delayed`）**：
```css
.devour-delayed {
  color: #2ecc71 !important;
  transition: color 0.083s ease;
}
```

---

## 六、代码文件索引

| 文件 | 相关函数/位置 | 说明 |
|---|---|---|
| `js/config/rogueConfig.js` | ~line 532 | Boss 配置定义 |
| `js/core/GameEngine.js` | `_bossState` 初始化 ~line 5260 | devourTimer/devouredCells 等字段 |
| `js/core/GameEngine.js` | `_tickTimeDevourer()` ~line 707 | 主循环调度 |
| `js/core/GameEngine.js` | `_devourCell()` ~line 753 | 吞噬格子 |
| `js/core/GameEngine.js` | `_delayDevour()` ~line 820 | 提交订单延缓吞噬 |
| `js/ui/UIManager.js` | `_onBossDevourTimer()` ~line 968 | 倒计时 UI 更新 |
| `js/ui/UIManager.js` | `_onBossDevourCell()` ~line 990 | 吞噬格子动画 |
| `js/ui/UIManager.js` | `_onBossDevourColumn()` ~line 2027 | 吞噬列动画 |
| `js/ui/UIManager.js` | `_onBossDevourDelayed()` ~line 2045 | 延缓闪光效果 |
| `js/ui/UIManager.js` | Boss 技能面板 ~line 818 | 技能卡片展示 |
| `css/style.css` | ~line 286 | `.devour-timer` / `.cell-devoured` 等样式 |

---

## 七、已知问题与设计考量

1. **倒计时的紧迫感**：395 秒的总时限配合 ×2.5 的目标分倍率，要求玩家保持高效的合成和订单提交节奏，是对玩家操作效率的终极考验
2. **吞噬的针对性**：吞噬优先选择匹配订单需求的元素，直接打击玩家的订单进度——玩家需要权衡是快速提交订单还是囤积元素应对吞噬
3. **提交订单的双重收益**：提交订单不仅获得分数，还能延缓吞噬（+4.1 秒），形成了"越快提交越安全"的正反馈循环
4. **元素耗尽的失败条件**：当棋盘上有元素但都不匹配订单类型时触发失败，这鼓励玩家保持元素类型的多样性
5. **防止页面闲置超时**：单次最大递减量限制为 2 秒，防止页面切后台或闲置后恢复时瞬间超时，提升了用户体验
6. **与其他 Boss 的对比**：时间吞噬者是唯一有时间限制的 Boss，也是唯一有"元素耗尽"失败条件的 Boss，代表了"效率挑战"的设计方向
