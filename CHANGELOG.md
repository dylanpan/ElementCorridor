## v60 (2026-11-01)

### ✨ 新功能
- **无尽模式核心实现**：首次通关后主菜单解锁「♾ 无尽模式」入口，整个无尽模式作为一个独立关卡，不经过普通关卡的路线图选择。
- **难度递增系统**：每 30 秒难度提升一级，订单时间缩短 5%/级（最多 -75%）、发射器冷却 +3%/级（最多 +150%）、高品质订单概率 +2%/级（最多 +60%）。
- **独占系统隔离**：道具系统（自动获取时间停滞/元素风暴等）和危机事件系统（订单洪流/冷却加倍等）仅在无尽模式中触发，普通关卡不触发。
- **记录保存**：最高存活时间和最高积分保存在 localStorage，支持跨会话查看最佳成绩。

### 🔧 技术改进
- **新增 `js/systems/EndlessMode.js`**：完整 EndlessMode 类，包含解锁检查、难度递增、独占系统初始化、记录保存等完整生命周期。
- **GameEngine.js 集成**：7 处集成点——构造函数初始化、startEndlessMode 方法、普通关卡隔离（禁用道具和危机系统）、最终 Boss 击败解锁、游戏结束停止、游戏循环 tick。
- **main.js 入口**：主菜单添加无尽模式按钮（紫色渐变样式），初始隐藏，通关后显示。
- **UIManager.js 状态显示**：无尽模式启动后顶部显示存活时间、难度等级实时更新，难度提升时弹出通知提示。
- **ItemSystem.js 扩展**：新增 `_enabled` 属性和 `setEnabled()` 方法，禁用时隐藏道具栏。

## v59 (2026-11-01)

### ✨ 新功能
- **危机事件系统实现（无尽模式专属）**：在无尽模式中随机触发负面事件，增加挑战性与不可预测性。普通关卡模式不触发。
- **5 种危机事件**：
  - 📦 **订单洪流**：同时出现 2 个额外订单，持续 10 秒
  - 🐢 **冷却加倍**：所有发射器冷却时间 x2，持续 12 秒
  - ⏳ **时间紧缩**：所有订单倒计时减半，持续 10 秒
  - 🌪 **元素混乱**：棋盘上随机 3 个元素互换位置，持续 8 秒
  - 💔 **积分衰减**：提交订单积分减半，持续 10 秒
- **危机事件横幅**：事件触发时屏幕顶部滑入红色横幅，显示事件图标、名称、描述和倒计时。
- **免疫保护机制**：事件结束后 10 秒免疫期，避免连续触发。

### 🔧 技术改进
- **新增 `js/systems/CrisisSystem.js`**：危机事件系统核心类，包含事件定义、触发检查、效果应用/还原、免疫保护等完整生命周期。
- **GameEngine.js 集成**：构造函数初始化 `crisisSystem`；`startRogueLevel` 中调用 `reset()`；游戏循环中调用 `tick()`/`update()`；游戏结束时禁用。
- **UIManager.js 新增危机横幅**：添加 `crisis:started`/`crisis:ended` 事件监听，`_showCrisisBanner` 滑入横幅+倒计时更新，`_hideCrisisBanner` 滑出清理。
- **CSS 新增危机横幅样式**：红色渐变背景、毛玻璃效果、弹性滑入/滑出动画、倒计时数字样式。

## v58 (2026-11-01)

### ✨ 新功能
- **手动干预模式实现**：玩家可随时暂停/恢复自动合成引擎，手动操作时自动暂停自动合成，操作完成后自动恢复（带延迟避免频繁启停）。
- **自动合成变为局外成长天赋**：新增 `auto_merge` 天赋，需消耗 5 升级点数解锁。未解锁时自动合成不启动，玩家只能手动操作。
- **自动合成开关按钮**：游戏顶部新增「⏸ 自动合成」按钮，解锁后显示，点击可随时暂停/恢复自动合成。
- **棋盘呼吸光效**：自动合成运行时，棋盘边缘带有绿色呼吸光效提示，暂停时光效消失。

### 🔧 技术改进
- **AutoPlaySystem.js 重构**：新增 `pause()`/`resume()`/`isPaused()`/`isRunning()`/`restart()` 方法，`start()` 方法增加天赋检查，未解锁时不启动。
- **GameEngine.js 手动操作自动暂停**：`_onCellClick`、`_onEmitterClick`、`_onOrderClicked` 手动操作时自动暂停自动合成，操作完成后延迟恢复。
- **UIManager.js 新增自动合成UI**：新增 `_updateAutoMergeButton`、`_toggleAutoMerge`、`_applyBreathingEffect`、`_removeBreathingEffect` 方法。
- **CSS 新增呼吸光效动画**：`boardBreath` 关键帧动画，`board-breathing` 类控制。

## v57 (2026-11-01)

### ✨ 新功能
- **天赋树合并：旧星尘天赋内容已整合到新升级系统**：将旧 MetaProgress 中的 8 个功能天赋（祝福扩容、初始金币、棋盘扩张、永久加速、更多选择、首次免费、传承祝福、隐藏元素）作为新升级项添加到 UpgradeSystem 中，使用升级点数解锁。
- **升级点数获取频率提升**：生存点数间隔从 30 秒缩短至 21 秒，订单点数门槛从 5 个降至 3 个。
- **升级面板分页显示**：升级面板分为「数值成长」和「功能天赋」两个区域，清晰展示不同类型的升级项。

### ♻️ 重构
- **删除星尘经济体系**：彻底移除 MetaProgress 中的 stardust/trophy/shards 货币系统、TALENT_DEFS 天赋定义、unlockTalent/isTalentUnlocked/getActiveEffects 等方法。
- **MetaProgress 精简为图鉴与统计系统**：仅保留 bestiary（图鉴）和 stats（统计）功能。
- **GameEngine.js 集成新天赋效果**：在 startRogueLevel 中应用 permanentCooldown（永久加速）、extraBoardCells（棋盘扩张）、extraBoonSlots（祝福槽扩展）。
- **RogueSystem.js 初始金币来源切换**：startGold 改为从 upgradeSystem.getActiveEffects() 获取。
- **RogueUIManager.js 初始祝福选择来源切换**：choose_from_4 改为从 upgradeSystem.getActiveEffects() 获取。
- **清理所有文件中的 stardust/trophy 残留引用**：涉及 GameEngine.js、RogueUIManager.js、UIManager.js、style.css。

### 🐛 Bug 修复
- **修复天赋树UI显示代码字段**：`showUpgradePanel` 方法中的 HTML 模板使用了反引号字面量但内部混用 `' + var + '` 拼接语法，导致变量未被解析、直接显示为代码文本。已全部改为纯字符串拼接。
- **修复天赋树「返回」按钮未恢复主菜单**：`showUpgradePanel` 方法未接收 `onClose` 回调参数，返回按钮仅隐藏遮罩层未恢复主菜单内容。已添加 `onClose` 参数并在返回时调用。
- 涉及：UIManager.js

## v56 (2026-11-01)

### 🐛 Bug 修复
- **修复天赋树UI显示代码字段**：`showUpgradePanel` 方法中的 HTML 模板使用了反引号字面量但内部混用 `' + var + '` 拼接语法，导致变量未被解析、直接显示为代码文本。已全部改为纯字符串拼接。
- **修复天赋树「返回」按钮未恢复主菜单**：`showUpgradePanel` 方法未接收 `onClose` 回调参数，返回按钮仅隐藏遮罩层未恢复主菜单内容。已添加 `onClose` 参数并在返回时调用。
- 涉及：UIManager.js

## v55 (2026-11-01)

### ✨ 新功能
- **新增局外成长·天赋树系统（UpgradeSystem）**：每次游戏结束后根据表现获得升级点数，用于永久提升基础属性
  - 新增 `js/systems/UpgradeSystem.js`，包含 5 种升级项：
    - 初始积分（5级，每级+2，每级3点）
    - 订单时间（5级，每级+10%倒计时，每级2点）
    - 发射器速度（5级，每级-8%冷却，每级3点）
    - 积分加成（5级，每级+5%订单积分，每级3点）
    - 道具上限（3级，每级堆叠上限+1，每级4点）
  - 升级点数获取：每存活30秒获得1点，每提交5个订单额外获得1点
  - 支持免费重置所有升级，返还全部已花费点数
  - localStorage 持久化存储
- **主菜单新增「天赋树」入口**：点击可打开升级面板查看和管理升级项
- **GameEngine.js 集成升级系统**：关卡开始时应用初始积分/发射器速度/订单时间加成，订单提交时应用积分加成，游戏结束/通关时发放升级点数
- **OrderSystem.js 支持订单时间加成**：timeMultiplier 倍数影响订单倒计时
- **ItemSystem.js 支持道具容量加成**：extraItemCapacity 增加道具堆叠上限

### 🐛 Bug 修复
- **修复道具【立即完成】加分触发通关结算**：`_useInstantComplete` 中移除了加分逻辑，道具只清除订单不加分，避免意外通关
- **修复道具【双倍积分】特效显示在屏幕中央**：`_showDoubleScoreEffect` 增加 `orderId` 参数，X2 特效定位到对应订单卡片上方；清理了 3 个重复定义的方法
- **修复道具【时间停滞】倒计时未停止**：`order-timers:updated` 事件中检测冻结状态，冻结期间使用 `_savedRemaining` 替代实时计算
- **修复道具【跳过订单】选错订单**：`_useSkipOrder` 中改为按剩余时间升序排列，跳过时间最紧迫的订单
- **修复道具在关卡切换时被清空**：startRogueLevel 每次进入新关卡都调用 itemSystem.init()，而 init() 中执行了 this.items = {} 清空所有道具。已通过 _initialized 标记保护，init() 只在首次调用时执行完整初始化
- **修复道具悬浮提示不显示描述**：模板中使用了 def.desc，但 ITEM_DEFS 中的属性名是 description，已修正
- **修复点击道具【跳过订单】和【立即完成】无反应**：item:use 事件只传了 itemId，但 useItem 方法内部调用 _useSkipOrder/_useInstantComplete 时需要 orderId 作为 target。已修复为无 target 时自动选第一个可用订单
- **修复点击道具【时间停滞】效果错误**：原实现用 expiresAt += 10000 增加了倒计时，实际上加速了订单过期。已重写为真正的冻结机制——保存每个订单的剩余时间到 _savedRemaining，设置 _freezeEndTime，游戏循环中冻结期间跳过超时检测，冻结到期后恢复倒计时
- **修复道具【元素风暴】效果不符合预期**：原实现只重置一次冷却。已改为真正的"10 秒内发射器无冷却"——设置 _stormEndTime，在 _onEmitterClick 中检查风暴激活时跳过 isReadyToSpawn 检查，且产出后立即重置冷却
- **新增双倍积分视觉特效**：提交订单触发双倍积分时，在屏幕中央附近显示 ✖2 放大淡出动画
- **修复元素风暴效果不完整**：三层修复——① `_onEmitterClick` 风暴激活时重置 `lastSpawnTime = 0` 使 spawn 内部检查通过；② `_tryAutoSpawn` 风暴激活时跳过 `isReadyToSpawn` 检查；③ 决策循环风暴期间提升发射器点击优先级（发射器 > 提交 > 合成），避免合成逻辑持续压制发射器
- **修复元素风暴 UI 按钮仍禁用**：`updateEmitters` 中风暴激活时强制按钮就绪（进度条置零、移除禁用状态）
- **修复元素风暴 spawn 内部冷却检查**：`Emitter.spawn()` 风暴激活时跳过 `isReadyToSpawn` 检查，避免产出后又因 `lastSpawnTime` 更新导致下一次循环阻塞

- **修复道具【立即完成】智能选择逻辑**：改为优先选择提交后可通关的订单（取其中分数最高的），否则选择剩余时间最小的订单
- **修复道具【立即完成】未增加积分**：`completeOrderDirect` 只移除订单不加分，已改为移除订单后增加对应积分
- **修复道具【双倍积分】特效未显示**：`item:double-score-effect` 事件的监听器未注册，UIManager 未响应事件。已注册监听器，特效正常显示
- **调整 AutoPlaySystem 优先级**：从「提交 > 合成 > 发射器（饥饿保护）」改为「提交 > 合成 > 饥饿保护 > 发射器」，与用户要求一致

- **修复道具【时间停滞】倒计时提示框位置**：冻结指示器从屏幕顶部改为插入到订单面板（orders-section）前方，避免遮挡祝福区域
- **修复道具【时间停滞】完成订单后覆盖层消失**：`renderOrders` 清空 `panel.innerHTML` 导致冻结覆盖层和卡片样式被移除。在 `orders:updated` 事件处理中增加 `_reapplyFreezeEffects` 调用，渲染后重新应用冻结效果
- **修复道具【元素风暴】通关后延续到下一关**：`startLevel` 中未重置 `_stormEndTime` 和 `_freezeEndTime`，导致风暴效果延续到新关卡。已在 `startLevel` 中重置道具状态
- **修复道具【时间停滞】新刷新订单倒计时未停止**：冻结期间保存了已有订单的剩余时间，但新刷新订单没有 `_savedRemaining`，倒计时仍在减少。已在 UI 更新线程中检测冻结状态，为新订单自动保存剩余时间
- **新增道具【时间停滞】订单栏视觉特效**：冻结期间订单面板显示淡蓝光晕覆盖层，订单卡片添加蓝色发光边框和亮度增强效果
- **修复道具【时间停滞】倒计时跳动问题**：UI 更新线程中重复执行了解冻逻辑，导致解冻后先用旧 expiresAt 计算出错误值再解冻。已移除 UI 更新线程中的重复解冻，仅保留超时检测线程中的解冻逻辑
- **新增道具【时间停滞】视觉特效**：冻结期间显示蓝色光晕边框的"⏸ 时间冻结"指示器，并实时显示剩余冻结时间倒计时
- **修复道具【双倍积分】特效显示在屏幕中央**：`submitOrder` 会刷新 DOM 移除订单卡片，特效函数中 `querySelector` 找不到卡片。已将卡片位置捕获提前到 `submitOrder` 之前，使用缓存位置定位特效
- **修复道具【元素风暴】期间不进行合成和提交**：风暴期间改为同步执行发射器产出，并多次尝试提交和合成（最多各 5 次），确保棋盘不会因只产出不合成而爆满
- **修复道具【时间停滞】倒计时跳动问题**：UI 更新线程中解冻时序晚于剩余时间计算，导致解冻后先用旧的 expiresAt 算出错误值再解冻。已将解冻逻辑提前到 UI 更新线程开头，确保先解冻再计算剩余时间
- **修复道具【时间停滞】缺少视觉特效**：冻结期间无任何视觉反馈，玩家不知道效果持续多久。已新增 freeze 特效——冻结期间订单面板显示蓝色光晕边框和"⏸ 时间冻结"指示器，并显示剩余冻结时间倒计时
- **修复游戏结束后道具未重置**：`destroy()` 方法未重置 `_initialized` 标记，导致新游戏开始时 `init()` 因 `_initialized = true` 而不执行，道具栏为空。已改为 `destroy()` 中重置 `_initialized`、`_freezeEndTime` 和 `_stormEndTime`
- **修复道具【双倍积分】特效显示在屏幕中央**：DOM 刷新后订单卡片元素被移除，`querySelector` 找不到卡片。已在触发事件前记录卡片位置（`getBoundingClientRect`），传递给特效函数直接使用缓存位置
- **修复道具【元素风暴】期间不进行合成和提交**：风暴期间优先级设为"发射器 > 提交 > 合成"，发射器成功后直接 return，压制了合成和提交。已改为风暴期间同步执行发射器产出、合成和提交三项操作- **修复道具【立即完成】智能选择逻辑**：改为优先选择提交后可通关的订单（取其中分数最高的），否则选择剩余时间最小的订单
- **修复道具【立即完成】未增加积分**：`completeOrderDirect` 只移除订单不加分，已改为移除订单后增加对应积分
- **修复道具【双倍积分】特效未显示**：`item:double-score-effect` 事件的监听器未注册，UIManager 未响应事件。已注册监听器，特效正常显示
- **调整 AutoPlaySystem 优先级**：从「提交 > 合成 > 发射器（饥饿保护）」改为「提交 > 合成 > 饥饿保护 > 发射器」，与用户要求一致
- **修复元素风暴期间 AutoPlaySystem 优先级错误**：`_tryAutoSpawn` 在无订单时直接返回 false，导致风暴期间发射器不被点击。已改为风暴模式下跳过"无订单"检查，强制点击发射器
- **修复游戏失败弹窗后自动合成仍在进行**：`_decisionLoop` 在 `isPlaying` 检查后才获取 `_processing` 锁，失败弹窗触发后当前迭代仍继续执行合成操作。已在 `try` 块开头增加 `isPlaying` 二次检查，确保游戏结束后立即停止所有操作
- **修复升级系统效果从未生效**：`startRogueLevel` 中使用了 `this._upgradeEffects` 但构造函数中从未执行 `this._upgradeEffects = this.upgradeSystem.getActiveEffects()`，导致所有升级效果（初始积分/发射器速度/订单时间/积分加成/道具容量）均未生效。已在关卡开始时正确初始化
- **修复初始积分升级未应用**：`startRogueLevel` 中 `this.state.score = 0` 后未应用升级系统的 `initialScore` 加成，已修复为在 `_upgradeEffects` 初始化后累加初始积分
- **修复通关时未发放升级点数**：`_onLevelComplete` 中缺少升级点数发放逻辑，已添加（与 `_onGameOver` 相同的计算方式：每30秒1点+每5个订单1点）

- **修复天赋树「返回」后游戏卡死**：点击天赋树的「返回」按钮只隐藏了遮罩层，未恢复主菜单内容，导致游戏界面停留在空白状态。已修复为返回时自动调用 `showMainMenu` 恢复主菜单弹窗

### 🛠 调试工具增强
- **新增【道具】调试页签**：在 DebugTool 调试面板中添加「🎒 道具」页签，支持在游戏中直接添加任意道具（可选择道具类型和数量）、清空所有道具，方便测试

### 🎨 UI 优化
- **道具栏 UI 重做为祝福风格**：道具图标改为与祝福一致的圆形图标样式，右下角显示数量角标，鼠标悬浮显示道具名称和描述
- **道具栏从右侧面板移到左侧面板**：将 item-section 从 right-panel 移到 left-panel 的 emitters-section 之后，让道具栏高度随有无道具自然变化
- **道具栏显示赠送道具**：修复 items:updated 和 item:granted 监听器嵌套在 notification 回调内导致不执行的问题
- **修复道具栏初始化不显示赠送道具**：ItemSystem.addItem() 发射 items:updated 事件时数据格式为扁平对象，但 UIManager._renderItemBar 期望数组格式。已新增 getItemsAsArray() 方法并修正事件数据格式
- **修复双倍积分无法获得**：新增 Boss 胜利时 30% 概率掉落双倍积分道具
- **修复控制台 Duplicate form field id 警告**：DebugTool.js 中道具页签代码因脚本重复执行被插入了 3 次，已删除多余重复代码块

## v54 (2026-10-31)

### 🐛 Bug 修复
- **修复混沌之核关卡发射器不自动点击**：AutoPlaySystem 决策循环中，混沌波动频繁改变元素类型和等级，不断产生新的可合成元素对，导致合成逻辑持续返回 true 压制了发射器点击。新增饥饿保护机制——连续 3 次只合成不产元素时强制点击一次发射器
- **修复通关后星尘未发放**：RogueUIManager.init() 未接收 metaProgress 参数，导致 this.metaProgress 始终为 undefined，星尘计算和发放代码被完全跳过。已修复 init 方法签名并传入 metaProgress

### 🎮 道具系统（7-DOC_ITEM_SYSTEM.md）
- 新增 5 种可消耗道具：时间停滞(⏸ 冻结订单10秒)、立即完成(✅ 不消耗元素完成订单)、跳过订单(➡ 移除订单不扣分)、元素风暴(🌪 重置所有发射器冷却)、双倍积分(✖2 下次提交积分x2)
- 自动获取机制：每60秒得1个时间停滞、每90秒得1个元素风暴、每5个订单得1个立即完成
- 初始赠送：2个跳过订单、1个元素风暴
- 新增 ItemSystem.js 核心类，管理道具状态、使用逻辑和自动获取定时器
- 新增道具栏 UI（item-section + #item-bar），显示道具图标和数量
- 道具栏支持点击使用，使用时有反馈动画
- 双倍积分道具集成到订单提交流程，提交后自动消耗倍率

### 🎮 连击奖励系统（6-DOC_COMBO_REWARD.md）
- 新增订单提交连击系统：连续成功提交订单（间隔 ≤ 5 秒）触发连击
- 连击倍率：1次=x1.0 / 2次=x1.2 / 3次=x1.5 / 5次=x2.0 / 10次=x3.0
- 连击倍率直接影响订单提交积分收益
- 订单超时中断连击计数
- 棋盘上方新增连击显示区，实时显示连击数和倍率
- 连击跳动动画、Combo Break 红色闪烁特效
- 连击里程碑（5/10/20连击）触发额外横幅特效

### 🎮 调试工具增强
- 调试工具祝福页签新增「解锁祝福数量上限」按钮，点击可将本局祝福上限设为无上限，方便测试

### 🐛 Bug 修复
- 修复最大层数配置错误：FLOOR_GENERATOR.maxFloor 从 12 改为 15，nodesPerFloor 扩展至 15 层，使第 15 层创世之灵 Boss 可正常到达
- 修复失败弹窗同时显示确定按钮和自定义按钮组的问题：失败弹窗中隐藏底部的确定按钮，仅保留「回到主菜单」和「再来一局」两个按钮
- 恢复祝福数量上限为默认值 8（受局外成长影响），之前被误改为 Infinity
- 修复生存模式失败弹窗缺少按钮的问题：现在失败弹窗与胜利弹窗一致，包含「回到主菜单」和「再来一局」两个按钮

### 🐛 Bug 修复
- 修复生存模式积分归零后游戏卡住的问题：showFailureModal 使用了错误的元素 ID（modal-overlay → game-overlay），且 main.js 中多余的 else 分支调用了不存在的 RogueSystem.onNodeFailed 方法
- 祝福数量上限解除：maxBoons 从 8 改为 Infinity

### 🐛 Bug 修复
- 修复【高级起步】祝福等级加成随【元素亲和】祝福获取次数累加的问题：在 applyToEmitters 开头重置 spawnLevelBonus 为 0，确保每次从零开始重新计算
- 修复生存模式积分归零后游戏卡住的问题：showFailureModal 使用了错误的元素 ID（modal-overlay → game-overlay），且 main.js 中多余的 else 分支调用了不存在的 RogueSystem.onNodeFailed 方法
- 祝福数量上限解除：maxBoons 从 8 改为 Infinity

### 🎮 祝福数量上限解除
- 祝福数量上限从 8 改为 Infinity（无上限），仅限制同一祝福不可重复获得

### 🎮 生存积分制（4-DOC_SURVIVAL_SCORE.md）
- 初始积分改为 10 分（生命值），targetScore 改为 Infinity
- 订单超时扣分（reward×50%，至少1分最多3分），积分≤0时游戏结束
- 新增 _onGameOver 方法处理失败流程
- 波次系统适配：生存模式下 score 类型波次自动跳过
- 失败时触发 game:over(survived=false) 事件，显示失败弹窗

### 🐛 Bug 修复
- 加急订单事件剩余时间与订单剩余时间不同步：将订单 expiresAt 从 75s 改为 16s，与事件持续时间（15s）对齐

### 🐛 Bug 修复
- 修复 CSS 占位数值污染导致订单 UI 显示异常（大色块遮挡面板）
- 加急订单事件剩余时间与订单剩余时间不同步：将订单 expiresAt 从 75s 改为 16s，与事件持续时间（15s）对齐

### 🎨 UI 优化
- 恢复订单难度标签显示（简单/普通/困难/稀有）
- 积分后添加品质倍率显示（如 +100 x1.5，倍率用品质色）
- 订单卡片布局改为上下结构（品质标签在上，内容在下）
- 订单倒计时进度条添加移动动画效果（参考发射器 cooldown-bar）

### ♻️ 平衡性调整
- 品质直接决定元素等级和奖励，取代旧难度体系
- 普通=Lv.2/15分、稀有=Lv.3/40分、史诗=Lv.4/90分、传说=Lv.5/200分
- 品质时间倍率：普通x0.8、稀有x1.2、史诗x1.6、传说x2.4

【v52】【2026-10-28】
- 重构：5 个独立发射器合并为单一「灵素之源」，按概率产出已解锁元素
- 修复：无属性元素提交订单成功后因 return 跳过加分/刷新流程，导致无属性元素 3 级无法提交火元素 2 级订单
- 修复：_trySubmitWithBasicElement 中调用了 OrderSystem 不存在的 getOrderById 方法，导致无属性元素提交始终崩溃失效
- 修复：_onOrderClicked 中 result 用 const 声明导致无属性提交成功后赋值报 TypeError，整个点击处理函数崩溃
- 修复：_trySubmitWithBasicElement 只消耗棋盘元素却未移除订单/补充新订单/触发 UI 更新，导致提交后订单仍挂屏幕、玩家以为未生效
- 修复：_trySubmitWithBasicElement 中检查 `el.type === 'basic'`，但 Element 类属性为 `typeId`，导致永远无法匹配到无属性元素
- 新增：无属性元素（basic，⚪）——初始只产出无属性元素，可提交任意类型订单但需高 1 级
- 新增：元素解锁系统——获得「元素亲和·X」祝福后解锁对应属性元素，无属性停止产出
- 新增：棋盘转化机制——获得亲和祝福时，棋盘上已有无属性元素转化为对应属性元素（等级不变）
- 新增：概率分布系统——按已解锁元素数动态分配（1 种 100% → 5 种各 20%）
- 新增：订单生成适配——仅无属性时随机生成，有属性时按产出类型加权（70% 对应，30% 其他）
- 新增：祝福「灵素分流」（稀有）——单次点击产出 2 种不同属性元素
- 新增：祝福「万象之源」（史诗）——单次点击产出 3 种不同属性元素
- 涉及：gameConfig.js、Emitter.js、BoonSystem.js、GameEngine.js、OrderSystem.js、rogueConfig.js、UIManager.js、style.css

【v51】【2026-10-22】
- 清理：移除所有 [DEBUG] 调试日志代码

【v50】【2026-10-22】
- 增强：镜像召唤间隔从 32 秒缩短至 12 秒，镜像出现更频繁
- 增强：镜像存在时间从 3.8 秒延长至 10 秒，镜像在场时间更长，威胁性显著提升

【v49】【2026-10-22】
- 平衡：解封间隔从 8 秒延长至 17 秒，降低祝福解封频率
- 平衡：解封持续时间从 10 秒延长至 13.5 秒，让每次解封更有收益感
- 平衡：镜像召唤间隔从 21 秒延长至 33 秒，减少镜像干扰
- 平衡：镜像存在时间从 5.5 秒缩短至 3.8 秒，降低镜像持续干扰时长

【v48】【2026-10-22】
- 移除：封印效果中的「发射器无冷却」机制——封印祝福时不再设置 cooldownMultiplier = 0，发射器正常运作
- 移除：所有提示文本中"发射器无冷却"的相关说明

【v47】【2026-10-22】
- 修复：解封替换时所有祝福短暂全部显示为封印导致的闪烁问题——替换临时解封祝福时跳过中间的全封印事件，直接切换
- 调整：unsealDuration 从 10000ms 改为 13000ms，给予玩家更充裕的受益时间

【v46】【2026-10-22】
- 修复：`_reSealBoon` 方法定义缺失导致临时解封到期时报错 `TypeError: this._reSealBoon is not a function`
- 修复：加速齿轮解封后发射器不冷却的根因——封印时 `cooldownMultiplier = 0`，解封时 `0 * 0.8 = 0` 导致冷却始终为零。修复：解封前先还原基础修饰器，再应用祝福效果

【v45】【2026-10-22】
- 重构：创世之灵祝福解封机制从「永久解封」改为「随机临时解封」——每次从被封印的祝福中随机选择一个临时解封，持续 10 秒后自动重新封印
- 新增：`_reSealBoon()` 方法——临时解封到期后还原发射器修饰器并重新封印祝福
- 优化：`_tickCreationSpirit` 增加到期检查逻辑，每帧检测当前临时解封的祝福是否到期
- 调整：创世之灵配置参数——unsealInterval 从 30000ms 改为 8000ms（更频繁的解封尝试），新增 unsealDuration: 10000ms（临时解封持续时间），scorePerBoonPercent 从 15 改为 18（补偿更短的持续时间）

【v44】【2026-10-22】
- 修复：创世之灵封印后祝福效果依然生效的根因——封印时仅设置了 `cooldownMultiplier = 0`，但祝福还修改了 `spawnLevelBonus`、`dualChance`、`upgradeChance` 等属性，这些未被还原。修复：在 `_initLevel` 中保存发射器初始修饰器快照，封印时通过 `Object.assign` 还原所有修饰器再设无冷却
- 修复：解封祝福后立即又被封印的根因——`_sealBoonsHandler` 的条件 `laterBoons.length !== sealedBoons.length` 在解封后因长度变化而触发，导致所有祝福重新封印。修复：条件改为 `sealedBoons.length === 0`，仅在初始封印时触发
- 修复：解封祝福后效果未恢复——在 `_unsealNextBoon` 中找到对应祝福对象并重新调用 `boonObj.apply(emitters)` 应用效果

【v43】【2026-10-22】
- 修复：创世之灵封印逻辑根因——`_initBossBattle` 中使用了不存在的 `getCurrentBoons()` 方法（应为 `getBoomSummary()`），导致 `allBoons` 始终为空数组，封印逻辑从未生效
- 修复：封印逻辑只执行一次（在祝福加载之前），后续祝福逐个加载后不再重新封印——添加 `rogue:boons-updated` 事件监听器，在祝福加载完成后自动重新执行封印

【v42】【2026-10-22】
- 修复：创世之灵封印/解封视觉特效未生效——封印时未触发祝福区域重新渲染，封印样式从未应用到图标；解封时先操作旧 DOM 再触发渲染，class 操作被 innerHTML 覆盖丢失
- 优化：封印/解封方法改为先触发 `rogue:boons-updated` 渲染再添加特效，确保样式与动画正确叠加

【v41】【2026-10-22】
- 修复：UIManager.js 中 boon-seal-chain-effect 的 appendChild 参数含有拼写错误的多余单词，导致 SyntaxError: missing ) after argument list，进而引发 main.js 中 UIManager 类未定义
- 流程改进：每次代码修改后增加 `node -c` 语法校验环节，确保所有 JS 文件无语法错误后再打包

【v40】【2026-10-22】
- 修复：serialize() 方法中 el.serialize 未兼容普通对象——创世之灵镜像元素是普通对象，没有 serialize 方法，导致序列化时报错 "el.serialize is not a function"

【v39】【2026-10-21】
- 新增：创世之灵祝福封印视觉特效——封印时祝福图标变为灰暗遮罩 + 锁链图标 + 斜纹背景 + 全屏暗色闪烁
- 新增：创世之灵祝福解封视觉特效增强——封印破碎动画（缩放+爆炸粒子）+ 全屏金色闪光
- 新增：封印状态 tooltip 显示"🔒 已被封印"提示
- 新增：封印/解封 CSS 动画——封印脉冲、锁链摆动、解封破碎、爆炸消散

【v38】【2026-10-21】
- 修复：创世之灵镜像过期后未从棋盘清除（仅过滤了 state.mirrors 数组，未清除 board 元素）
- 修复：创世之灵镜像 CSS 动画时长与元素生命周期不一致（2s vs 6s），改为无限循环闪烁 + 持续金色边框
- 新增：创世之灵解封祝福时动态增加目标分（scorePerBoonPercent = 15%）
- 优化：UIManager 镜像样式改为事件驱动，与游戏引擎清理逻辑同步

【v37】【2026-10-21】
- 优化：时间吞噬者吞噬倒计时从固定定位改为跟随 DOM 流，精确位于祝福栏正下方、棋盘正上方居中显示

【v36】【2026-10-21】
- 优化：时间吞噬者吞噬倒计时从屏幕右上角移至棋盘正上方居中显示

【v35】【2026-10-21】
- 修复：连锁反应祝福生成问号元素而非同类型低级元素（`_performMerge` 中使用 `merged.elementType`，但 Element 类仅有 `typeId` 属性，传入 undefined 导致生成默认问号元素）

【v34】【2026-10-21】
- 修复：元素共鸣触发后等级显示异常（实际等级提升 + 显示额外+1 导致双重叠加，移除 BoardRenderer 中多余的等级+1 逻辑）

【v33】【2026-10-20】
- 修复：发射器点击后不产出元素（findEmptyCell 反复返回被吞噬格子导致30次重试全部失败，改为手动扫描棋盘跳过被吞噬格子）
- 修复：开局时棋盘为空被误判为"所有元素已被吞噬"触发失败（增加棋盘空判断，开局空棋盘不触发失败）
- 修复：元素洪流将元素放置到被吞噬的格子中（findEmptyCell 改为手动扫描跳过被吞噬格子）
- 修复：元素共鸣触发后满足订单的元素无法提交（共鸣效果从视觉等级+1改为实际等级+1，保存原始等级并在到期后恢复）
- 修正：时间吞噬者描述文本 "90 秒" → "120 秒"，与实际配置一致
- 调整：吞噬间隔从 12 秒缩短至 10 秒

【v32】【2026-10-20】
- 重构：时间吞噬者【吞噬】技能从「列吞噬」改为「格子吞噬」
  - 被吞噬对象从整列改为单个格子
  - 吞噬随机选择包含订单需求元素类型的格子
  - 每次吞噬只吞噬一个格子中的元素
  - 吞噬间隔调整为 9 秒（原 12 秒）
- 新增：被吞噬格子显示为黑洞效果（暗色渐变 + 紫色边框 + 脉冲漩涡动画），持续保持直至游戏结束
- 新增：被吞噬的格子被封锁，无法放置元素（点击发射器跳过被吞噬格子寻找空位）
- 新增：提交订单延缓倒计时同时延缓下一次吞噬的到来（重置 lastDevourCellTime）
- 新增：积分未达到目标前，所有匹配订单需求的元素被吞噬后触发游戏失败
- 移除：旧的 _devourColumn() 方法及相关 CSS 动画

【v31】【2026-10-17】
- 修复：时间吞噬者倒计时结束后未弹出游戏结束（限制单次最大递减量2000ms，防止页面闲置后瞬间超时）
- 修复：列吞噬只在开局触发一次后永不再触发（lastDevourTime 被倒计时与吞噬间隔共用，分离为独立变量 lastDevourColumnTime）
- 修复：UI层 _onBossDefeated 缺少弹窗按钮回调，点击确定无反应
- 修复：_onBossDefeat 中 this.rogueSystem.onNodeFailed 类型检查缺失导致报错
- 清理：移除诊断日志

【v30】【2026-10-16】
- 修复：混沌元素缺少 serialize() 方法导致的控制台报错（Uncaught TypeError: el.serialize is not a function）
- 修复：混沌元素之间不能合成（为 _executeTripleMerge 添加类型检查，混沌元素先转化为候选类型再匹配）
- 修改：混沌元素合成产物规则从「含另一方类型」改为「不含另一方类型」
- 修改：混沌 + 混沌不能合成（之前为产物从全类型随机选）
- 优化：混沌元素合成走独立路径，绕过 tryMerge 的类型严格检查

# 修复记录

---

## 【v29】【2026-10-16】

- **[Bug修复]** `_onCellClick()` 三合一分支 — 在 `Element.canMerge()` 前增加混沌元素处理，先调用 `_convertChaosElements()` 再检查合成条件，修复三重奏祝福下混沌元素无法与同等级元素合成的问题

---

## 【v28】【2026-10-16】

- **[Bug修复]** `_triggerChaosWave()` — 重写为遍历棋盘元素，随机改变等级和类型（原实现错误地修改了订单等级，与左侧技能描述不符）
- **[Bug修复]** `_spawnChaosElement()` — 补全混沌元素对象的 `gridRow`/`gridCol` 属性，修复混沌元素移动变复制的问题
- **[Bug修复]** `_convertChaosElements()` — 重构逻辑：混沌元素合成时随机类型范围包含另一方类型（原实现提前转为随机基础类型导致只能与特定元素合成）
- **[功能新增]** `_triggerChaosRefresh()` — 新增混沌刷新技能：每 20 秒清空并重新生成订单
- **[功能新增]** `_tickChaosCore()` — 在循环中新增混沌刷新技能调用
- **[功能新增]** `_bossState` — 初始化补全 `lastRefreshTime: 0`
- **[UI更新]** 混沌之核技能描述更新：混沌波动改为「随机变化棋盘元素等级和类型」；混沌生成增加「可与任意同等级元素合成」说明；刷新技能更名为「混沌刷新」
- **[UI更新]** `index.html` — 版本号更新为 v28

---

## 【v27】【2026-10-16】

- **[Bug修复]** `_executeTripleMerge()` — 三重奏合成后未调用解冻逻辑（`_isRowFrozen` / `_updateThawProgress`），导致祝福「三重奏」下合成无法解除冻结状态
- **[Bug修复]** `index.html` — 版本号更新为 v27


## 【v27】【2026-10-16】

- **[Bug修复]** `_executeTripleMerge()` — 三重奏合成后未调用解冻逻辑（`_isRowFrozen` / `_updateThawProgress`），导致祝福「三重奏」下合成无法解除冻结状态


## 【v26】【2026-10-16】

- **[Bug修复]** `_executeTripleMerge()` — 三重奏合成后未调用 `_extinguishOnMerge()` 灭火逻辑，导致祝福「三重奏」下合成无法扑灭燃烧状态


## 【v25】【2026-10-16】

- **[平衡调整]** 蔓延间隔从 5 秒缩短至 3 秒，概率从 40% 提升至 55%，加快蔓延节奏
- **[功能补充]** 愤怒解除时新增通知提示「熔岩巨像愤怒状态已解除！发射器冷却恢复正常」


## 【v24】【2026-10-16】

- **[Bug修复]** Boss 启动初始化 `_bossState` 新增 `lastSpreadTime: 0` 字段，修复因字段缺失（值为 undefined）导致 `now - undefined` 为 `NaN`、蔓延条件永远不成立的问题
- **[Bug修复]** `index.html` — 版本号从 v19 更新为 v24（之前所有修改均未更新显示版本号）


## 【v23】【2026-10-16】

- **[平衡调整]** _tickLavaGiant() — 蔓延逻辑增加 5 秒时间间隔控制（新增 lastSpreadTime），修复原来每帧都在以 40% 概率尝试蔓延导致蔓延过快的问题
- **[代码修复]** _bossState 初始化 — 新增 lastSpreadTime: 0 字段


## 【v22】【2026-10-16】

- **[新特效]** style.css — 新增 .emitter-raging CSS 样式：发射器愤怒火焰特效，含红色渐变背景、🔥 图标动画、闪烁光晕、冷却条变色、粒子上升效果
- **[新功能]** UIManager.js — 新增 applyRageEffect() 方法，控制发射器愤怒火焰特效的添加/移除
- **[功能更新]** _onBossRageActivated() — 触发时自动给所有发射器添加火焰特效
- **[功能更新]** _onBossRageDeactivated() — 解除时自动移除发射器火焰特效


## 【v21】【2026-10-16】

- **[Bug修复]** BoardRenderer.js — 新增 refreshScorchedCells() 方法统一刷新燃烧视觉样式，解决元素移动/产出到燃烧格子后缺少燃烧动画的问题
- **[代码重构]** GameEngine._tickLavaGiant() — 每次 tick 末尾调用 refreshScorchedCells 同步火焰特效
- **[代码重构]** GameEngine._onEmitterClick() — spawn 到燃烧格子后刷新视觉效果
- **[代码重构]** GameEngine._onCellClick() — 移动元素到燃烧格子后刷新视觉效果
- **[代码重构]** GameEngine._executeMerge() — 合成灭火后刷新视觉效果


## 【v20】【2026-10-16】

- **[机制重构]** 熔岩巨像灼烧系统 — 重新设计灼烧格子规则：① 燃烧空格可放入元素；② 元素不会立即烧毁，5秒后烧毁；③ 移动元素时燃烧状态跟随；④ 合成可扑灭燃烧；⑤ 空燃烧格10秒自行熄灭；⑥ 保持40%概率蔓延
- **[代码重构]** GameEngine.js — scorchedCells 数据结构从 {row,col,expireAt} 改为 {row,col,elementBurnAt,fireExpireAt}
- **[代码重构]** _tickLavaGiant() — 新增元素烧毁检查 + 火焰自然熄灭清理逻辑
- **[代码重构]** _applyScorch/_spreadScorch() — 不再立即摧毁元素，改为设置 elementBurnAt 倒计时
- **[功能更新]** _onCellClick() — 简化灼烧交互块，仅拦截空燃烧格+无选中场景；允许选中/移动/合成燃烧格上的元素
- **[功能更新]** _onEmitterClick() — 允许将新元素放到燃烧格子，设置元素烧毁倒计时
- **[功能更新]** 元素移动逻辑 — 从燃烧格移动元素时，燃烧状态跟随到新位置
- **[Bug修复]** UIManager._onBossScorchCell() — 火焰特效持续时间改为 duration*2，匹配自行熄灭时间


## 【v19】【2026-10-15】

- **[Bug修复]** BoardRenderer.js — 修复冻结行中新放入元素无冻结动画的问题：新增 frozenRows 集合跟踪被冻结的行，updateCell 渲染元素后保留 cell-frozen 样式
- **[Bug修复]** GameEngine.js — 在冻结/解冻/暴风雪结束时同步通知 BoardRenderer 更新 frozenRows
- **[Bug修复]** UIManager.js — 暴风雪开始/结束时正确调用 applyFreezeEffect 显示/隐藏发射器冰冻特效
- **[性能优化]** GameEngine._startGameLoop() — 冷却动画更新间隔从 200ms（5FPS）降低至 33ms（~30FPS），消除进度条卡顿感
- **[Bug修复]** GameEngine._onEmitterClick() — 熔岩巨像战中，发射器产出的元素不再放到正在燃烧的格子中


## 【v19】【2026-10-15】

- **[Bug修复]** BoardRenderer.js — 修复冻结行中新放入元素无冻结动画的问题：新增 frozenRows 集合跟踪被冻结的行，updateCell 渲染元素后保留 cell-frozen 样式
- **[Bug修复]** GameEngine.js — 在冻结/解冻/暴风雪结束时同步通知 BoardRenderer 更新 frozenRows
- **[Bug修复]** UIManager.js — 暴风雪开始/结束时正确调用 applyFreezeEffect 显示/隐藏发射器冰冻特效
- **[性能优化]** GameEngine._startGameLoop() — 冷却动画更新间隔从 200ms（5FPS）降低至 33ms（~30FPS），消除进度条卡顿感


## 【v19】【2026-10-15】

- **[Bug修复]** `BoardRenderer.js` — 修复冻结行中新放入元素无冻结动画的问题：
  - 新增 `frozenRows` 集合跟踪被冻结的行
  - `updateCell()` 在渲染元素后检查该行是否被冻结，保留 `cell-frozen` 样式
- **[Bug修复]** `GameEngine.js` — 在冻结/解冻时同步通知 BoardRenderer 更新 frozenRows
- **[Bug修复]** `UIManager.js` — 暴风雪开始/结束时正确调用 `applyFreezeEffect()` 显示/隐藏发射器冰冻特效



## 【v18】【2026-10-15】

- **[Bug修复]** `GameEngine.js` — 修正冻结行交互语义：
  - 删除 `_onCellClick()` 中「点击冻结行→直接return」的完全拦截
  - 利用原有的「选中冻结行元素→取消选中」逻辑实现：
    - 冻结行元素只能作为被合成的目标（被动方），不能主动合成别人
    - 两个冻结行元素之间无法互相合成
    - 非冻结行元素可以主动合成到冻结行（触发解冻进度）
    - 无选中时可点击冻结行元素查看信息
- **[Bug修复]** `UIManager.js` — `playFlyToOrder()` 中 `targetX`/`targetY` 添加 `let` 声明，修复 `ReferenceError` 报错




## 【v17】【2026-10-15】

- **[Bug修复]** `GameEngine.js` — 完全重写 `_onCellClick()` 冻结行交互逻辑：
  - 允许直接选中冻结行中的元素（规则3）
  - 允许非冻结行 ↔ 冻结行之间的合成（规则2、4），触发解冻进度
  - 仅阻止「选中冻结行元素→点击非冻结行空位」的移出操作（规则1）
  - 新增详细 `[FROZEN_CLICK]` 控制台日志，便于定位交互问题


## 【v16】【2026-10-15】

- **[功能修复]** `GameEngine.js` — 重写 `_onCellClick()` 冻结行交互逻辑：允许选中冻结行元素、允许从非冻结行合成到冻结行触发解冻、禁止从冻结行移出元素到非冻结行
- **[Bug修复]** `UIManager.js` — `playFlyToOrder()` 中 `targetX`/`targetY` 添加 `var` 声明，修复 `ReferenceError: targetX is not defined` 报错


## 【v15】【2026-10-15】

- **[功能修复]** `Emitter.js` — `isReadyToSpawn()` 新增活跃冻结检查，暴风雪期间返回 false，阻止发射器产出
- **[功能修复]** `Emitter.js` — `getCooldownProgress()` 新增活跃冻结处理，暴风雪期间冷却条进度停滞在冻结开始时的状态
- **[功能修复]** `GameEngine.js` — `_onCellClick()` 修改冻结行检查逻辑：禁止选中冻结行中的元素，但允许已有非冻结行选中时点击冻结行以触发「合成解冻」
- **[功能修复]** `GameEngine.js` — `_onEmitterClick()` 新增暴风雪冻结检测，点击被冻结的发射器时给出提示


## 【v14】【2026-10-15】

- **[核心修复]** `GameEngine.js` — `_freezeRandomRow()` 增加 `board[row]` 越界检查，防止随机选择的行索引超出 board 数组范围导致报错崩溃
- **[核心修复]** `GameEngine.js` — `_freezeRandomRow()` 中 `setTimeout` 改用 `var self = this` 引用方式，修复回调中 `this` 指向丢失导致的 `Cannot convert undefined or null to object` 错误
- **[核心修复]** `GameEngine.js` — `_onEmitterClick()` 在原有 `emitters:updated` 事件后，延迟 32ms 再强制发送一次刷新事件，解决浏览器渲染合并导致冷却动画不实时更新的问题
- **[调整]** `rogueConfig.js` — 冰霜女巫配置重平衡：freezeInterval=8500ms, freezeDuration=35000ms, blizzardPauseDuration=7000ms，使循环节奏更合理
- **[日志]** `GameEngine.js` — `_onEmitterClick()` 增加强制刷新冷却条的 console.log 日志


## 【v13】【2026-10-15】

- **[核心修复]** `GameEngine.js` — `_initBossBattle()` 末尾增加完整游戏循环检查：当循环未运行或被暂停时强制重启，并重置 `_lastFrameTime` 与 `_bossState.lastTickTime`，确保 Boss tick 立即开始运转
  > **根因**：调试工具直接调用 `_initBossBattle()` 切换 Boss，跳过了正常关卡入口中启动游戏循环的逻辑；即使循环已在运行，Boss 战过程中也可能因其他状态变更导致循环暂停
- **[核心修复]** `GameEngine.js` — `_tickIceWitch()` 暴风雪结束逻辑中新增 `state.lastFreezeTime = now` 重置，防止暴风雪结束后立即再次触发冻结，保证冻结→暴风雪的完整循环持续执行
- **[优化]** `GameEngine.js` — 调整冰霜女巫配置默认值：freezeInterval=16666ms、freezeDuration=33333ms、blizzardPauseDuration=6666ms，使冻结与暴风雪节奏更清晰可观察
- **[日志]** `GameEngine.js` — `_tickIceWitch()` 每个 tick 打印时间戳、距上次冻结间隔、当前冻结行数、暴风雪状态等详细日志
- **[日志]** `GameEngine.js` — `_freezeRandomRow()` 打印每次冻结的行号和总冻结行数
- **[日志]** `GameEngine.js` — `_freezeEmitters()` / `_unfreezeEmitters()` 打印冻结/解冻操作记录

## 【v12】【2026-10-15】

- **[修复]** `GameEngine.js` — `_initBossBattle()` 尾部添加 `if (!this._gameLoopId)` 判断，当游戏循环未运行时自动调用 `_startGameLoop()` 启动

## 【v11】【2026-10-15】

- **[修复]** `Emitter.js` — `spawn()` 方法中增加 `this._frozenDuration = 0` 重置，防止跨周期累积
- **[调整]** `rogueConfig.js` — 冰霜女巫配置调整：freezeInterval: 20000→8000ms, freezeDuration: 8000→17000ms

---

## 版本对照

| 版本 | 日期 | 涉及文件 | 主要策略 |
|---|---|---|---|
| v11 | 2026-10-15 | Emitter.js, rogueConfig.js | 简单修补 |
| v12 | 2026-10-15 | GameEngine.js | 游戏循环启动检查 |
| v13 | 2026-10-15 | GameEngine.js | 深入排查 + 日志辅助定位 |

【v53】【2026-10-31】
- 新增：自动合成引擎（AutoPlaySystem），实现游戏核心操作自动化闭环
  - 决策频率 333ms，优先级：提交订单 > 合成元素 > 点击发射器
  - 自动提交：按 expiresAt 排序优先提交即将超时订单
  - 自动合成：全棋盘任意位置匹配低等级元素
  - 自动点击：优先点击订单所需元素类型的发射器
  - 三重奏祝福下找 3 个元素分三步完成
- 修复：自动合成引擎调用 _clickEmitter 方法名错误（应为 _onEmitterClick）
- 修复：订单没有倒计时进度条（UIManager 缺少 HTML + 事件监听）
- 修复：fillOrders 批量生成时所有订单 expiresAt 在同一毫秒，排序无效（添加 350ms 偏移量）
- 修复：三重奏祝福下自动合成卡死（检测到 3 个元素时走三合一模式）
- 修复：自动提交未利用无属性元素提交能力（无精确匹配时检查高 1 级 basic 元素）
- 修复：结算评分弹窗自动关闭（game:over 事件 setTimeout 自动调度下一关，startRogueLevel 调用 hideModal）
- 修复：结算卡住不显示弹窗（hasNext: false 时 giveCombatReward 立即执行覆盖评分弹窗）
- 修复：元素亲和祝福无效（applyToEmitters 与 initElementUnlocks 调用顺序颠倒）
- 修复：冰霜女巫冻结状态残留（BoardRenderer.init 未清空 frozenRows）
- 新增：订单品质系统（普通/稀有/史诗/传说，按权重随机抽取，影响时间和奖励倍率）
- 修复：加速生产紧急事件未影响发射器（emitterSpeedMultiplier 未应用到 modifiers.cooldownMultiplier）
- 修复：加急订单显示 NaN 倒计时（展开模板后缺少 timeLimit/expiresAt 等字段）
- 涉及：AutoPlaySystem.js、GameEngine.js、OrderSystem.js、UIManager.js、style.css、main.js、BoardRenderer.js、index.html
