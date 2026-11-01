# 开发交付清单

> 每次完成一轮开发实现后，按此清单逐项检查，确保交付质量。

---

## 一、通用流程检查（每轮必检）

### 1.1 语法校验

- [ ] 所有修改过的 `.js` 文件均已执行 `node -c <file>` 语法校验，无报错
- [ ] 新增的 `.js` 文件（如有）已执行 `node -c` 语法校验，无报错
- [ ] HTML/CSS 文件结构检查无误（标签闭合、样式引用路径正确）

### 1.2 版本与文档

- [ ] `index.html` 版本徽章已更新至最新版本号
- [ ] `CHANGELOG.md` 已追加本次变更记录（版本号、日期、变更摘要、涉及文件）
- [ ] `doc/` 目录下相关设计文档标记为已实现（如有）

### 1.3 打包发布

- [ ] 打包命令执行成功：`Compress-Archive -Path "工作区\*" -DestinationPath "<output>\merge-game-vXX.zip" -Force`
- [ ] 压缩包内容验证无误

### 1.4 交付检查

- [ ] 交付物已通过 `present_files` 工具展示给用户
- [ ] 已告知用户需要 `Ctrl+F5` 强制刷新浏览器缓存

---

## 二、设计文档实现检查

### 第一梯队：核心玩法改造

#### 0-DOC_UNIFIED_EMITTER.md —— 单一发射器 + 元素解锁系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增无属性元素类型（basic，⚪） | `gameConfig.js` | ✅ 已完成 |
| 替换 EMITTER_CONFIGS 为单一发射器 | `gameConfig.js` | ✅ 已完成 |
| 单一发射器概率产出逻辑 | `Emitter.js` | ✅ 已完成 |
| 多元素产出逻辑（灵素分流/万象之源） | `Emitter.js` | ✅ 已完成 |
| 元素解锁状态管理 | `BoonSystem.js` | ✅ 已完成 |
| 亲和祝福处理（解锁元素、无属性退出） | `BoonSystem.js` | ✅ 已完成 |
| 无属性元素棋盘转化机制 | `BoonSystem.js` | ✅ 已完成 |
| 适配单一发射器点击 | `GameEngine.js` | ✅ 已完成 |
| 初始化解锁状态 | `GameEngine.js` | ✅ 已完成 |
| 无属性元素提交订单（高 1 级提交任意类型） | `GameEngine.js` | ✅ 已完成 |
| 订单生成适配已解锁属性元素 | `OrderSystem.js` | ✅ 已完成 |
| 订单加权生成（70% 对应类型，30% 其他类型） | `OrderSystem.js` | ✅ 已完成 |
| 卡关防护（无可用订单模板时降级选择） | `OrderSystem.js` | ✅ 已完成 |
| 发射器 UI 改为单一按钮 + 元素池展示 | `UIManager.js` | ✅ 已完成 |
| 元素亲和祝福的 apply 逻辑调整 | `rogueConfig.js` | ✅ 已完成 |
| 新增祝福「灵素分流」（稀有） | `rogueConfig.js` | ✅ 已完成 |
| 新增祝福「万象之源」（史诗） | `rogueConfig.js` | ✅ 已完成 |
| 单一发射器自动决策适配 | `AutoPlaySystem.js` | ✅ 已完成 |
| 无属性元素图标/颜色/样式 | `style.css` | ✅ 已完成 |

#### 1-DOC_AUTO_PLAY.md —— 自动合成引擎

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 AutoPlaySystem 类（构造函数、start/stop） | `AutoPlaySystem.js`（新建） | ✅ 已完成 |
| 决策循环 333ms，重入锁保护 | `AutoPlaySystem.js` | ✅ 已完成 |
| 优先级 1：自动提交匹配订单（按到期时间排序） | `AutoPlaySystem.js` | ✅ 已完成 |
| 优先级 2：自动合成相邻元素（优先合成低等级） | `AutoPlaySystem.js` | ✅ 已完成 |
| 优先级 3：自动点击发射器（优先订单所需类型） | `AutoPlaySystem.js` | ✅ 已完成 |
| 统计数据（submits/merges/spawns/totalDecisions） | `AutoPlaySystem.js` | ✅ 已完成 |
| 运行条件：仅 isPlaying && !isPaused | `AutoPlaySystem.js` | ✅ 已完成 |
| GameEngine 构造函数初始化 autoPlay=null | `GameEngine.js` | ✅ 已完成 |
| startRogueLevel 末尾启动 autoPlay | `GameEngine.js` | ✅ 已完成 |
| _onLevelComplete 中停止 autoPlay | `GameEngine.js` | ✅ 已完成 |
| index.html 加载 AutoPlaySystem.js | `index.html` | ✅ 已完成 |

#### 2-DOC_MANUAL_INTERVENTION.md —— 手动干预模式

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| AutoPlaySystem 新增 pause/resume 方法 | `AutoPlaySystem.js` | ⏳ 待实现 |
| 暂停按钮 UI（自动合成切换按钮） | `UIManager.js` | ⏳ 待实现 |
| 暂停状态联动（_paused 标志位） | `GameEngine.js` | ⏳ 待实现 |
| 暂停时自动合成停止、手动操作仍可用 | `AutoPlaySystem.js` | ⏳ 待实现 |
| 暂停按钮样式与状态指示 | `style.css` | ⏳ 待实现 |

#### 3-DOC_ORDER_TIMER.md —— 订单倒计时系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| generateOrder 新增 timeLimit/expiresAt/expired 字段 | `OrderSystem.js` | ✅ 已完成 |
| 新增 _getTimeLimit(difficulty) 方法 | `OrderSystem.js` | ✅ 已完成 |
| 新增 removeExpiredOrder(orderId) 方法 | `OrderSystem.js` | ✅ 已完成 |
| 游戏循环中每秒检测超时订单 | `GameEngine.js` | ✅ 已完成 |
| 新增 _deductScoreForExpiredOrder 扣分方法 | `GameEngine.js` | ✅ 已完成 |
| 超时惩罚逻辑（reward × 50%，至少 1 分，最多 3 分） | `GameEngine.js` | ✅ 已完成 |
| 订单卡片添加倒计时进度条 | `UIManager.js` | ✅ 已完成 |
| 监听 order-timers:updated 事件实时更新进度 | `UIManager.js` | ✅ 已完成 |
| 倒计时进度条样式（正常绿色，最后 5 秒红色脉冲） | `style.css` | ✅ 已完成 |

#### 4-DOC_SURVIVAL_SCORE.md —— 生存积分制

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 初始积分改为 10 分（生命值） | `GameEngine.js` | ⏳ 待实现 |
| targetScore 改为 Infinity（移除达标制） | `GameEngine.js` | ⏳ 待实现 |
| 胜负判定改为"积分归零即失败" | `GameEngine.js` | ⏳ 待实现 |
| 积分显示改为生命值样式 | `UIManager.js` | ⏳ 待实现 |
| 游戏结束 UI 调整 | `UIManager.js` | ⏳ 待实现 |

### 第二梯队：功能增强

#### 5-DOC_ORDER_QUALITY.md —— 订单品质系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 订单品质分级逻辑（普通/稀有/史诗/传说） | `OrderSystem.js` | ⏳ 待实现 |
| 品质与倒计时/积分奖励的关联 | `OrderSystem.js` | ⏳ 待实现 |
| 品质 UI 渲染（品质标签、颜色、边框） | `UIManager.js` | ⏳ 待实现 |
| 品质对应的 CSS 样式 | `style.css` | ⏳ 待实现 |

#### 6-DOC_COMBO_REWARD.md —— 连击奖励系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 连击计数逻辑（连续合成/提交） | `GameEngine.js` | ⏳ 待实现 |
| 连击倍率计算（如 x1.0 → x1.5 → x2.0） | `GameEngine.js` | ⏳ 待实现 |
| 超时/失败中断连击 | `GameEngine.js` | ⏳ 待实现 |
| 连击 UI 显示（计数、倍率） | `UIManager.js` | ⏳ 待实现 |
| 连击特效样式 | `style.css` | ⏳ 待实现 |

#### 7-DOC_ITEM_SYSTEM.md —— 道具系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 ItemSystem 类 | `ItemSystem.js`（新建） | ⏳ 待实现 |
| 道具定义（如刷新订单、消除元素、冻结等） | `ItemSystem.js` | ⏳ 待实现 |
| 道具获取/使用逻辑 | `ItemSystem.js` | ⏳ 待实现 |
| 道具栏 UI | `UIManager.js` | ⏳ 待实现 |
| 道具按钮样式 | `style.css` | ⏳ 待实现 |

#### 8-DOC_UPGRADE_SYSTEM.md —— 升级系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 UpgradeSystem 类 | `UpgradeSystem.js`（新建） | ⏳ 待实现 |
| 升级路线定义（发射器、订单、道具等分支） | `UpgradeSystem.js` | ⏳ 待实现 |
| 升级点数获取与消耗 | `UpgradeSystem.js` | ⏳ 待实现 |
| 升级界面 UI | `UIManager.js` | ⏳ 待实现 |
| 升级树样式 | `style.css` | ⏳ 待实现 |

#### 9-DOC_CRISIS_EVENTS.md —— 危机事件系统

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 CrisisSystem 类 | `CrisisSystem.js`（新建） | ⏳ 待实现 |
| 事件定义（元素冻结、棋盘混乱、订单加速等） | `CrisisSystem.js` | ⏳ 待实现 |
| 事件触发逻辑（按时间/概率触发） | `CrisisSystem.js` | ⏳ 待实现 |
| 事件预警与横幅 UI | `UIManager.js` | ⏳ 待实现 |
| 事件特效样式 | `style.css` | ⏳ 待实现 |

### 第三梯队：扩展模式

#### 10-DOC_LEADERBOARD.md —— 排行榜

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 LeaderboardSystem 类 | `LeaderboardSystem.js`（新建） | ⏳ 待实现 |
| 本地排行榜存储逻辑 | `LeaderboardSystem.js` | ⏳ 待实现 |
| 排行榜 UI | `UIManager.js` | ⏳ 待实现 |
| 排行榜样式 | `style.css` | ⏳ 待实现 |

#### 11-DOC_ENDLESS_MODE.md —— 无尽模式

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 EndlessMode 类 | `EndlessMode.js`（新建） | ⏳ 待实现 |
| 无尽模式启动与状态管理 | `GameEngine.js` | ⏳ 待实现 |
| 难度递增曲线 | `EndlessMode.js` | ⏳ 待实现 |
| 无尽模式 UI | `UIManager.js` | ⏳ 待实现 |
| 与 Boss 战的联动 | 见 12-DOC | ⏳ 待实现 |

#### 12-DOC_BOSS_INTEGRATION.md —— Boss 整合到无尽模式

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| Boss 战作为无尽模式子系统 | `EndlessMode.js` | ⏳ 待实现 |
| Boss 触发条件（每 N 波出现） | `EndlessMode.js` | ⏳ 待实现 |
| Boss 战与难度递增并行叠加 | `EndlessMode.js` | ⏳ 待实现 |
| Boss 战 UI 适配 | `UIManager.js` | ⏳ 待实现 |

#### 13-DOC_BUILD_SYSTEM.md —— 建筑流派

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 BuildSystem 类 | `BuildSystem.js`（新建） | ⏳ 待实现 |
| 流派定义（元素流派/合成流派/道具流派等） | `BuildSystem.js` | ⏳ 待实现 |
| 流派效果应用 | `GameEngine.js` | ⏳ 待实现 |
| 流派选择/切换 UI | `UIManager.js` | ⏳ 待实现 |
| 流派样式 | `style.css` | ⏳ 待实现 |

#### 14-DOC_DAILY_CHALLENGE.md —— 每日挑战

| 检查项 | 涉及文件 | 完成状态 |
|---|---|---|
| 新增 DailyChallenge 类 | `DailyChallenge.js`（新建） | ⏳ 待实现 |
| 每日挑战生成逻辑 | `DailyChallenge.js` | ⏳ 待实现 |
| 确定性随机数生成器 | `SeededRandom.js` | ⏳ 待实现 |
| 每日挑战 UI | `UIManager.js` | ⏳ 待实现 |

---

## 三、当前版本完成状态汇总

### v53（当前最新版本）

| 文档 | 功能摘要 | 涉及文件数 | 完成度 |
|---|---|---|---|
| 0-DOC_UNIFIED_EMITTER | 单一发射器 + 元素解锁系统 | 8 个源文件 + CSS + HTML | 100% |
| 1-DOC_AUTO_PLAY | 自动合成引擎 | 1 个新建 + 1 个修改 | 100% |
| 3-DOC_ORDER_TIMER | 订单倒计时系统 | 4 个文件 | 100% |
| 其余 12 份文档 | 手动干预 / 生存积分 / 订单品质 / 连击奖励 / 道具 / 升级 / 危机事件 / 排行榜 / 无尽模式 / Boss 整合 / 建筑流派 / 每日挑战 | 待实现 | 0% |

### 下一轮开发优先级

| 优先级 | 文档 | 原因 |
|---|---|---|
| 高 | 2-DOC_MANUAL_INTERVENTION | 自动合成引擎已完成，需手动暂停/恢复能力 |
| 高 | 4-DOC_SURVIVAL_SCORE | 核心胜负判定逻辑变更 |
| 中 | 5-DOC_ORDER_QUALITY | 订单系统增强，依赖倒计时系统 |
| 中 | 6-DOC_COMBO_REWARD | 游戏体验增强，依赖生存积分 |
| 中 | 7-DOC_ITEM_SYSTEM | 道具系统，提升策略深度 |
| 中 | 8-DOC_UPGRADE_SYSTEM | 长期成长系统 |
| 中 | 9-DOC_CRISIS_EVENTS | 动态事件，增加变化性 |
| 低 | 10-DOC_LEADERBOARD | 扩展功能，依赖生存积分 |
| 低 | 11-DOC_ENDLESS_MODE | 扩展模式，需核心玩法稳定 |
| 低 | 12-DOC_BOSS_INTEGRATION | 无尽模式子系统 |
| 低 | 13-DOC_BUILD_SYSTEM | 扩展玩法 |
| 低 | 14-DOC_DAILY_CHALLENGE | 扩展玩法 |
