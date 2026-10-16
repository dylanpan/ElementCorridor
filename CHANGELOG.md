# 修复记录

---

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
