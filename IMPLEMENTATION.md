# 元素合成游戏 —— 实现文档

## 项目概述

元素合成是一款基于网页的休闲合成类游戏。玩家通过点击发射器产出基础元素，将两个同类型同等级的元素合成为更高级的元素，最终提交订单需求获取积分，达到目标分数即可通关。

### 核心玩法

- **产出**：点击发射器按钮，在棋盘上生成基础元素
- **合成**：选中一个元素后，点击另一个同类型同等级的元素，两者合成为下一级元素
- **移动**：选中元素后点击空位，可将元素移动到该位置
- **提交订单**：点击订单卡片，从棋盘上提交匹配的元素，获得积分奖励
- **通关**：积分达到关卡目标值即通关，进入下一关

### 技术栈

| 层面 | 技术选型 |
| --- | --- |
| 前端渲染 | 原生 DOM API（CSS Grid + Flexbox） |
| 编程语言 | JavaScript（ES6+ Class 语法） |
| 通信模式 | 事件驱动（EventBus 发布-订阅） |
| 持久化 | localStorage（可替换为后端 API） |
| 样式方案 | CSS 自定义属性 + 响应式设计 |

---

## 工程目录结构

```
merge-game/
├── index.html                      # 游戏入口页面（HTML骨架）
├── IMPLEMENTATION.md               # 本实现文档
├── css/
│   └── style.css                   # 全局样式表（含动画、响应式）
└── js/
    ├── main.js                     # 入口文件（初始化、按钮绑定）
    ├── config/
    │   └── gameConfig.js           # 游戏配置（元素、发射器、订单、关卡）
    ├── core/
    │   ├── EventBus.js             # 事件总线（模块间解耦通信）
    │   └── GameEngine.js           # 核心引擎（状态管理、生命周期）
    ├── entities/
    │   ├── Element.js              # 元素实体（数据模型）
    │   └── Emitter.js              # 发射器实体（冷却管理）
    ├── systems/
    │   ├── MergeSystem.js          # 合成系统（含连击机制）
    │   ├── SpawnSystem.js          # 产出系统（棋盘格子管理）
    │   └── OrderSystem.js          # 订单系统（生成、刷新、提交）
    ├── ui/
    │   ├── BoardRenderer.js        # 棋盘渲染器（DOM交互与动画）
    │   └── UIManager.js            # UI管理器（面板、弹窗、通知）
    └── utils/
        └── StorageManager.js       # 存档管理器（序列化与持久化）
```

---

## 架构设计

### 分层架构

整个游戏采用三层架构设计，各层职责明确，层间通过事件总线通信：

```
┌─────────────────────────────────────────────────────────┐
│                    表现层（UI Layer）                      │
│   BoardRenderer.js  │  UIManager.js                     │
│   （DOM操作、动画播放）  （面板渲染、弹窗通知）                │
├──────────────────────┬──────────────────────────────────┤
│        事件总线（EventBus）：发布-订阅通信                  │
├──────────────────────┴──────────────────────────────────┤
│                    逻辑层（Logic Layer）                    │
│   MergeSystem.js  │  SpawnSystem.js  │  OrderSystem.js  │
│   （合成判定）     │  （棋盘管理）     │  （订单管理）      │
├─────────────────────────────────────────────────────────┤
│                    控制层（Controller Layer）              │
│   GameEngine.js（状态管理、生命周期、交互路由）              │
├─────────────────────────────────────────────────────────┤
│                    数据层（Data Layer）                    │
│   Element.js  │  Emitter.js  │  gameConfig.js           │
│   （实体模型）  │  （实体模型）  │  （静态配置）            │
├─────────────────────────────────────────────────────────┤
│                    持久化层（Persistence Layer）           │
│   StorageManager.js（localStorage 序列化/反序列化）        │
└─────────────────────────────────────────────────────────┘
```

### 设计原则

1. **单一职责**：每个文件只负责一个功能域，如 `MergeSystem` 只处理合成判定，不涉及渲染
2. **依赖倒置**：高层模块（GameEngine）依赖抽象（EventBus），不依赖低层具体实现
3. **开闭原则**：通过修改 `gameConfig.js` 扩展内容，无需改动核心代码
4. **接口隔离**：各系统通过 EventBus 的具名事件通信，不直接调用彼此方法

### 前后端逻辑划分

| 类别 | 归属 | 说明 |
| --- | --- | --- |
| 游戏状态管理 | 逻辑层 | `GameEngine.state` 维护全部运行时状态 |
| 合成算法 | 逻辑层 | `MergeSystem.tryMerge()` 纯函数式判定 |
| 棋盘数据操作 | 逻辑层 | `SpawnSystem` 管理二维数组增删改查 |
| 订单生成算法 | 逻辑层 | `OrderSystem` 按权重随机选取模板 |
| 序列化协议 | 逻辑层 | 各实体和系统的 `serialize()/deserialize()` |
| DOM 渲染 | 表现层 | `BoardRenderer` 操作 DOM 更新棋盘 |
| 用户交互事件 | 表现层 | 点击、选中、动画等 UI 反馈 |
| 数据持久化 | 持久化层 | `StorageManager` 封装存储细节 |

迁移至 Godot 时，逻辑层代码可直接复用为 GDScript / C#，仅需重写表现层。

---

## 模块详解

### 配置模块（gameConfig.js）

所有可扩展的游戏内容集中在此文件中，包含五个配置区块：

#### ELEMENT_TYPES —— 元素类型定义

```javascript
const ELEMENT_TYPES = {
  fire: {
    id: 'fire',          // 唯一标识
    name: '火焰',         // 显示名称
    icon: '🔥',          // 图标（Emoji或字符）
    color: '#FF6B35',    // 主题色
    bgColor: '#FFF0E8',  // 背景色
    description: '炽热的火焰元素',
  },
  // ... 更多元素
};
```

新增元素只需在对象中添加一个键值对。

#### ELEMENT_LEVELS —— 元素等级配置

定义 1-6 级的视觉样式和分值：

| 等级 | 标签 | 分值 | 边框颜色 |
| --- | --- | --- | --- |
| 1 | 初级 | 1 | #9e9e9e |
| 2 | 中级 | 3 | #4caf50 |
| 3 | 高级 | 8 | #2196f3 |
| 4 | 稀有 | 20 | #9c27b0 |
| 5 | 史诗 | 50 | #ff9800 |
| 6 | 传说 | 120 | #f44336 |

#### EMITTER_CONFIGS —— 发射器配置

每个发射器配置项包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 唯一标识 |
| elementType | string | 产出的元素类型ID |
| name | string | 显示名称 |
| icon | string | 图标 |
| cooldownMs | number | 冷却时间（毫秒） |
| spawnLevel | number | 产出元素的初始等级 |
| description | string | 描述文本 |

#### ORDER_TEMPLATES —— 订单模板

订单模板按难度分为四档（easy / medium / hard / rare），每档对应不同的积分奖励。游戏运行时根据当前关卡的难度权重随机选取。

#### LEVEL_CONFIGS —— 关卡配置

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| level | number | 关卡编号 |
| targetScore | number | 通关目标分数 |
| maxOrders | number | 最大同时订单数 |
| boardCols / boardRows | number | 棋盘列数和行数 |
| availableEmitters | string[] | 可用发射器ID列表 |
| orderDifficultyWeights | object | 订单难度权重分布 |
| title / description | string | 关卡标题和描述 |

#### GAME_SETTINGS —— 通用设置

包括动画时长、自动存档间隔、刷新订单消耗、连击倍率等全局参数。

---

### 核心模块

#### EventBus（事件总线）

发布-订阅模式的实现，提供四个方法：

- `on(event, callback, context)` — 注册监听器
- `once(event, callback, context)` — 一次性监听
- `off(event, listenerId)` — 取消注册
- `emit(event, ...args)` — 触发事件

**事件列表**：

| 事件名 | 载荷 | 触发时机 |
| --- | --- | --- |
| `score:updated` | `{ score, targetScore }` | 积分变化 |
| `combo:updated` | `{ count, multiplier }` | 连击变化 |
| `orders:updated` | `Order[]` | 订单列表变化 |
| `emitters:updated` | `Emitter[]` | 发射器冷却状态更新 |
| `level:loaded` | `LevelConfig` | 关卡加载完成 |
| `game:over` | `{ level, score, nextLevel }` | 通关 |
| `game:failed` | `{}` | 棋盘满失败 |
| `notification` | `{ message, type }` | 通知消息 |
| `ui:order-clicked` | `orderId` | 用户点击订单 |
| `order:submitted` | `{ reward, element, order }` | 订单提交成功 |
| `orders:refreshed` | `{ cost, newOrders }` | 订单刷新完成 |

#### GameEngine（游戏引擎）

核心控制器，负责：

- **状态管理**：维护 `state` 对象（level、score、board、emitters 等）
- **生命周期**：`startLevel()` → 初始化 → `_startGameLoop()` → `_onLevelComplete()`
- **交互路由**：接收用户操作，调用对应系统处理，通知UI更新
- **存档管理**：`serialize()` / `loadFromSave()` 完整状态序列化

关键方法：

| 方法 | 说明 |
| --- | --- |
| `init(uiManager, boardRenderer)` | 注入UI依赖 |
| `startLevel(level)` | 开始指定关卡 |
| `_onEmitterClick(emitterId)` | 处理发射器点击 |
| `_onCellClick(row, col)` | 处理棋盘格子点击（选中/移动/合成） |
| `_executeMerge(result, fromPos, toPos)` | 执行合成操作 |
| `_onOrderClicked(orderId)` | 处理订单提交 |
| `save()` / `load()` | 手动存/读档 |

---

### 实体模块

#### Element（元素实体）

纯数据类，包含类型和等级两个核心属性。提供静态方法：

- `Element.canMerge(a, b)` — 判断两个元素能否合成
- `Element.getMergedLevel(a, b)` — 计算合成后的等级
- `serialize()` / `deserialize(data)` — 序列化与反序列化

#### Emitter（发射器实体）

管理冷却状态和产出逻辑：

- `isReadyToSpawn(currentTime)` — 检查是否就绪
- `spawn(currentTime)` — 执行产出，返回新的 Element 实例
- `getCooldownProgress(currentTime)` — 获取冷却进度（0~1）

---

### 系统模块

#### MergeSystem（合成系统）

- `tryMerge(a, b, currentTime)` — 尝试合成两个元素，成功返回合并结果和连击信息
- 连击机制：3秒内连续合成触发连击，每次连击增加 0.5 倍积分加成
- `resetCombo()` — 重置连击计数

#### SpawnSystem（产出系统）

棋盘格子的增删改查操作：

- `findEmptyCell(grid)` — 寻找第一个空位
- `isBoardFull(grid)` — 检查棋盘是否已满
- `findElementsByTypeAndLevel(grid, typeId, level)` — 按类型和等级搜索元素
- `placeElement(grid, element, row, col)` — 放置元素
- `removeElement(grid, element)` — 移除元素
- `moveElement(grid, element, toRow, toCol)` — 移动元素

#### OrderSystem（订单系统）

- `init(maxOrders, difficultyWeights)` — 初始化订单参数
- `fillOrders()` — 填充订单到最大数量
- `generateOrder()` — 按难度权重随机生成一个订单
- `submitOrder(orderId, grid, spawnSystem)` — 提交订单，验证并扣除元素
- `refreshOrders(score)` — 消耗积分刷新所有订单

---

### UI模块

#### BoardRenderer（棋盘渲染器）

与 DOM 耦合最紧密的模块，负责：

- `init(cols, rows)` — 创建棋盘网格
- `updateCell(grid, row, col)` — 更新单个格子的显示
- `renderAll(grid)` — 全量刷新棋盘
- `selectCell(row, col, grid)` / `deselectCell()` — 选中/取消选中
- `playMergeAnimation(fromRow, fromCol, toRow, toCol, callback)` — 合成动画
- `playSpawnAnimation(row, col, callback)` — 生成动画
- `playSubmitAnimation(row, col, callback)` — 提交动画

#### UIManager（UI管理器）

管理所有非棋盘的UI元素：

- `createEmitterButtons(emitters, onClick)` — 创建发射器按钮
- `updateEmitters(emitters)` — 更新冷却条
- `renderOrders(orders)` — 渲染订单卡片
- `updateScore(score, targetScore)` — 更新积分显示
- `updateCombo(count, multiplier)` — 更新连击显示
- `showModal(title, bodyHtml)` / `hideModal()` — 弹窗管理
- `showNotification(message, type)` — Toast 通知

---

### 工具模块

#### StorageManager（存档管理器）

封装 localStorage 操作：

- `save(gameState)` — 保存游戏状态
- `load()` — 读取存档
- `hasSave()` — 检查是否存在存档
- `deleteSave()` — 删除存档
- `exportSave(gameState)` — 导出为 JSON 字符串
- `importSave(jsonString)` — 从 JSON 导入

---

## 配置扩展指南

### 新增元素类型

在 `gameConfig.js` 的 `ELEMENT_TYPES` 中添加条目：

```javascript
lightning: {
  id: 'lightning',
  name: '闪电',
  icon: '⚡',
  color: '#7B68EE',
  bgColor: '#F0E8FF',
  description: '狂暴的闪电元素',
},
```

### 新增发射器

在 `EMITTER_CONFIGS` 中添加配置：

```javascript
{
  id: 'emitter_lightning',
  elementType: 'lightning',
  name: '闪电发射器',
  icon: '⚡',
  cooldownMs: 3500,
  spawnLevel: 1,
  description: '产出闪电元素（冷却3.5秒）',
},
```

### 新增订单模板

在 `ORDER_TEMPLATES` 中添加：

```javascript
{ elementType: 'lightning', level: 3, reward: 45, difficulty: 'medium' },
```

### 新增关卡

在 `LEVEL_CONFIGS` 中添加关卡配置，确保 `availableEmitters` 引用的发射器 ID 已在 `EMITTER_CONFIGS` 中定义。

---

## 游戏流程

```
启动游戏
    │
    ├─ 检测到存档 → 弹窗询问「继续游戏 / 新游戏」
    │
    └─ 无存档 → startLevel(1)
                    │
                    ├─ 读取 LEVEL_CONFIGS[0]
                    ├─ 初始化棋盘（boardCols × boardRows）
                    ├─ 创建发射器实例
                    ├─ 生成初始订单
                    ├─ 启动游戏循环（requestAnimationFrame）
                    └─ 启动自动存档（setInterval）
                            │
                            └─ [玩家循环操作]
                                    │
                                    ├─ 点击发射器 → spawn → 放置到棋盘空位
                                    ├─ 点击元素A → 选中高亮
                                    │       └─ 点击元素B（同类型同等级）
                                    │               └─ tryMerge → 合成动画 → 连击判定
                                    ├─ 点击元素 → 点击空位 → moveElement
                                    └─ 点击订单卡片
                                            ├─ 匹配成功 → 扣除元素 → 加分 → 补充新订单
                                            │       └─ score >= targetScore → 通关弹窗
                                            │               ├─ 有下一关 → 进入下一关
                                            │               └─ 无下一关 → 全部通关
                                            └─ 匹配失败 → 提示"没有匹配的元素"
```

---

## 数据流

以一次完整的"产出→合成→提交"流程为例：

```
1. 用户点击「火焰发射器」
   ↓
2. GameEngine._onEmitterClick('emitter_fire')
   ↓
3. Emitter.spawn(Date.now()) → 创建 Element('fire', 1)
   ↓
4. SpawnSystem.findEmptyCell(board) → { row: 0, col: 0 }
   ↓
5. SpawnSystem.placeElement(board, element, 0, 0)
   ↓
6. BoardRenderer.updateCell(board, 0, 0) → DOM更新
   ↓
7. BoardRenderer.playSpawnAnimation(0, 0) → 动画播放
   ↓
8. eventBus.emit('emitters:updated', emitters) → 冷却条更新

9. 用户点击棋盘上的火焰元素(0,0)，再点击另一个火焰元素(1,0)
   ↓
10. GameEngine._onCellClick(1, 0)
    ↓
11. MergeSystem.tryMerge(elementA, elementB, Date.now())
    ↓ 成功
12. SpawnSystem.removeElement(board, elementA)
    SpawnSystem.removeElement(board, elementB)
    SpawnSystem.placeElement(board, mergedElement, 1, 0)
    ↓
13. BoardRenderer.playMergeAnimation(0, 0, 1, 0)
    BoardRenderer.updateCell(...) × 2
    ↓
14. eventBus.emit('combo:updated', { count: 1, multiplier: 1 })
    eventBus.emit('notification', { message: '合成 Lv.2 火焰', type: 'merge' })

15. 用户点击需要 Lv.2 火焰的订单卡片
    ↓
16. GameEngine._onOrderClicked(orderId)
    ↓
17. OrderSystem.submitOrder(orderId, board, spawnSystem)
    → SpawnSystem.findElementsByTypeAndLevel(board, 'fire', 2)
    → SpawnSystem.removeElement(board, matchedElement)
    → this.score += reward
    ↓
18. eventBus.emit('score:updated', { score: newScore, targetScore })
    BoardRenderer.renderAll(board)
    ↓
19. score >= targetScore ? 通关 : 继续
```

---

## 存档格式

存档为 JSON 格式，包含以下结构：

```json
{
  "version": 1,
  "timestamp": 1696848000000,
  "level": 2,
  "score": 150,
  "targetScore": 250,
  "board": [
    [null, {"typeId": "fire", "level": 2, "gridRow": 0, "gridCol": 1}, ...],
    ...
  ],
  "emitters": [
    {"id": "emitter_fire", "lastSpawnTime": 1696847999000, "totalSpawns": 12},
    ...
  ],
  "mergeSystem": {
    "comboCount": 0,
    "lastMergeTime": 0
  },
  "orderSystem": {
    "orders": [...],
    "maxOrders": 4,
    "difficultyWeights": {...},
    "completedOrders": 5
  },
  "levelConfig": {...}
}
```

---

## Godot 迁移指南

### 映射关系

| 当前模块 | Godot 对应方案 |
| --- | --- |
| `GameEngine` | Autoload Singleton（全局游戏管理器） |
| `EventBus` | Godot Signal 系统 |
| `Element` / `Emitter` | Resource（资源文件） |
| `MergeSystem` / `SpawnSystem` / `OrderSystem` | Node 或 Singleton 中的方法 |
| `BoardRenderer` | GridContainer + TextureRect 场景 |
| `UIManager` | Control 节点树 + Theme |
| `StorageManager` | FileAccess + ConfigFile |
| `gameConfig.js` | .tres 资源文件或 JSON 导入 |

### 迁移步骤建议

1. **配置层**：将 `gameConfig.js` 导出为 JSON，Godot 中通过 `ResourceLoader` 加载
2. **实体层**：将 `Element` 和 `Emitter` 改写为 Godot Resource，使用 `@export var` 暴露属性
3. **逻辑层**：将三个 System 类的方法移植为 GDScript 或 C# 的静态函数，放在 Autoload 中
4. **控制层**：`GameEngine` 改写为 Autoload Singleton，使用 Signal 替代 EventBus
5. **表现层**：完全重写——用 Godot 的 Control 节点搭建 UI，用 TextureRect + Tween 实现动画

---

## 开发指南

### 本地运行

直接用浏览器打开 `index.html` 即可运行，无需构建工具或服务器。

### 添加新功能示例

**示例：添加一个"加速道具"功能**

1. 在 `gameConfig.js` 的 `GAME_SETTINGS` 中添加道具配置
2. 新建 `js/systems/PowerUpSystem.js`，实现道具逻辑
3. 在 `GameEngine.systems` 中注册新系统
4. 在 `UIManager` 中添加道具按钮的渲染方法
5. 通过 `eventBus` 连接系统和UI

### 调试技巧

- 打开浏览器开发者工具，在 Console 中可访问 `window.eventBus` 查看事件流
- `StorageManager.deleteSave()` 可清除存档重新开始
- 调整 `GAME_SETTINGS` 中的数值可快速测试不同难度的游戏体验