/**
 * ============================================================
 * 肉鸽模式全局配置
 * 所有祝福、诅咒、事件、层数、Boss等数据在此定义。
 * 通过修改此文件即可扩展肉鸽内容，无需改动核心逻辑。
 * ============================================================
 */

// ==================== 祝福稀有度定义 ====================
const BOON_RARITY = {
  common: { label: '普通', color: '#9e9e9e', weight: 50 },
  rare: { label: '稀有', color: '#2196f3', weight: 30 },
  epic: { label: '史诗', color: '#9c27b0', weight: 15 },
  legendary: { label: '传说', color: '#ff9800', weight: 5 },
};

// ==================== 祝福池 ====================
const BOON_POOL = [
  // ---- 产出类祝福 ----
  {
    id: 'boon_accelerate',
    name: '加速齿轮',
    icon: '⚙',
    rarity: 'common',
    category: 'production',
    description: '所有发射器冷却时间减少 20%',
    flavor: '"更快！更强！"',
    apply: (emitters) => {
      emitters.forEach(e => e.modifiers.cooldownMultiplier *= 0.8);
    },
  },
  {
    id: 'boon_dual_spawn',
    name: '双重产出',
    icon: '2️⃣',
    rarity: 'rare',
    category: 'production',
    description: '发射器有 30% 概率一次产出两个元素',
    flavor: '"好事成双"',
    apply: (emitters) => {
      emitters.forEach(e => { e.modifiers.dualChance = 0.3; });
    },
  },
  {
    id: 'boon_advanced_start',
    name: '高级起步',
    icon: '⬆',
    rarity: 'rare',
    category: 'production',
    description: '发射器产出的元素初始等级 +1',
    flavor: '"赢在起跑线上"',
    apply: (emitters) => {
      emitters.forEach(e => { e.modifiers.spawnLevelBonus += 1; });
    },
  },
  {
    id: 'boon_fire_affinity',
    name: '元素亲和·火',
    icon: '🔥',
    rarity: 'common',
    category: 'production',
    description: '火焰发射器冷却减半',
    flavor: '"与火焰共鸣"',
    apply: (emitters) => {
      emitters.filter(e => e.elementType === 'fire').forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
    },
  },
  {
    id: 'boon_water_affinity',
    name: '元素亲和·水',
    icon: '💧',
    rarity: 'common',
    category: 'production',
    description: '水滴发射器冷却减半',
    flavor: '"与水波共舞"',
    apply: (emitters) => {
      emitters.filter(e => e.elementType === 'water').forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
    },
  },
  {
    id: 'boon_earth_affinity',
    name: '元素亲和·土',
    icon: '🪨',
    rarity: 'common',
    category: 'production',
    description: '土块发射器冷却减半',
    flavor: '"与大地的羁绊"',
    apply: (emitters) => {
      emitters.filter(e => e.elementType === 'earth').forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
    },
  },
  {
    id: 'boon_air_affinity',
    name: '元素亲和·风',
    icon: '🌪',
    rarity: 'common',
    category: 'production',
    description: '微风发射器冷却减半',
    flavor: '"随风而行"',
    apply: (emitters) => {
      emitters.filter(e => e.elementType === 'air').forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
    },
  },
  {
    id: 'boon_plant_affinity',
    name: '元素亲和·植物',
    icon: '🌿',
    rarity: 'common',
    category: 'production',
    description: '植物发射器冷却减半',
    flavor: '"自然的馈赠"',
    apply: (emitters) => {
      emitters.filter(e => e.elementType === 'plant').forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
    },
  },
  {
    id: 'boon_endless_spring',
    name: '无尽之泉',
    icon: '♾',
    rarity: 'legendary',
    category: 'production',
    description: '每完成一个订单，所有发射器立即冷却完毕',
    flavor: '"取之不尽，用之不竭"',
    apply: () => {}, // ✅ 已在 GameEngine._onOrderClicked 中特殊处理——提交订单后遍历所有发射器调用 refreshCooldown()
  },
  {
    id: 'boon_variant_spore',
    name: '变异孢子',
    icon: '🍄',
    rarity: 'epic',
    category: 'production',
    description: '发射器有 20% 概率产出高一级的元素',
    flavor: '"变异带来进化"',
    apply: (emitters) => {
      emitters.forEach(e => { e.modifiers.upgradeChance = 0.2; });
    },
  },

  // ---- 合成类祝福 ----
  {
    id: 'boon_combo_master',
    name: '连击大师',
    icon: '💫',
    rarity: 'common',
    category: 'merge',
    description: '连击窗口延长至 5 秒',
    flavor: '"节奏就是一切"',
    apply: () => {}, // ✅ 已在 BoonSystem.getComboWindow() 中处理——返回 5000ms（默认 3000ms）
  },
  {
    id: 'boon_chain_reaction',
    name: '连锁反应',
    icon: '⛓',
    rarity: 'rare',
    category: 'merge',
    description: '合成后有 25% 概率在原地生成一个低一级的同类型元素',
    flavor: '"一石激起千层浪"',
    apply: () => {}, // ✅ 已在 GameEngine._executeMerge 中实现——合成后有 25% 概率在原地生成低一级同类型元素
  },
  {
    id: 'boon_merge_bonus',
    name: '融合增效',
    icon: '✨',
    rarity: 'common',
    category: 'merge',
    description: '每次合成额外获得 2 积分',
    flavor: '"积少成多"',
    apply: () => {}, // ✅ 已在 BoonSystem.getMergeBonus() 中处理——每次合成额外获得 2 积分
  },
  {
    id: 'boon_element_resonance',
    name: '元素共鸣',
    icon: '🌈',
    rarity: 'legendary',
    category: 'merge',
    description: '合成时，棋盘上所有同类型元素获得临时等级加成',
    flavor: '"万物共鸣"',
    apply: () => {}, // ⏳ 待补充——合成时扫描棋盘上所有同类型元素，临时提升其等级（视觉标记），5秒后恢复
  },
  {
    id: 'boon_triple_merge',
    name: '三重奏',
    icon: '3️⃣',
    rarity: 'rare',
    category: 'merge',
    description: '三个同类型同等级元素可合成为高两级元素（替代二合一）',
    flavor: '"三人成虎"',
    apply: () => {}, // ⏳ 待补充——在 _onCellClick 中检测，点击第三个同类型同等级元素时触发三合一
  },
  {
    id: 'boon_exp_accumulate',
    name: '经验累积',
    icon: '📈',
    rarity: 'common',
    category: 'merge',
    description: '每次合成获得该元素等级 ×2 的额外积分',
    flavor: '"每一次合成都有收获"',
    apply: () => {}, // ✅ 已在 BoonSystem.getMergeBonus() 中处理——每次合成获得该元素等级 ×2 的额外积分
  },

  // ---- 订单类祝福 ----
  {
    id: 'boon_rush_reward',
    name: '急单奖励',
    icon: '💰',
    rarity: 'common',
    category: 'order',
    description: '订单积分奖励增加 30%',
    flavor: '"时间就是金钱"',
    apply: () => {}, // ✅ 已在 BoonSystem.getOrderRewardMultiplier() 中处理——订单积分奖励增加 30%
  },
  {
    id: 'boon_free_refresh',
    name: '免费刷新',
    icon: '🔄',
    rarity: 'rare',
    category: 'order',
    description: '刷新订单不消耗积分',
    flavor: '"总有更好的选择"',
    apply: () => {}, // ✅ 已在 BoonSystem.isFreeRefresh() 中处理——刷新订单不消耗积分
  },
  {
    id: 'boon_demand_foresight',
    name: '需求预见',
    icon: '👁',
    rarity: 'common',
    category: 'order',
    description: '始终多显示一个订单',
    flavor: '"未卜先知"',
    apply: () => {}, // ✅ 已在 BoonSystem.getExtraOrderSlots() 中处理——始终多显示一个订单
  },
  {
    id: 'boon_high_price',
    name: '高价收购',
    icon: '💎',
    rarity: 'rare',
    category: 'order',
    description: '每关第一个提交的订单获得 3 倍积分',
    flavor: '"开门红！"',
    apply: () => {}, // ✅ 已在 BoonSystem.getOrderRewardMultiplier() + firstOrderInLevel 中处理——每关首单 3 倍积分
  },

  // ---- 棋盘类祝福 ----
  {
    id: 'boon_expand_bag',
    name: '扩容背包',
    icon: '🎒',
    rarity: 'rare',
    category: 'board',
    description: '棋盘增加一行格子',
    flavor: '"空间就是机会"',
    apply: () => {}, // ⏳ 待补充——在 startRogueLevel 中 boardRows + 1
  },
  {
    id: 'boon_auto_sort',
    name: '自动整理',
    icon: '🧹',
    rarity: 'epic',
    category: 'board',
    description: '每 10 秒自动将可合成的相邻元素移到一起',
    flavor: '"整洁带来效率"',
    apply: () => {}, // ✅ 已在 GameEngine._doAutoSort() 中实现——每 10 秒自动将可合成的相邻元素移到一起
  },
  {
    id: 'boon_guardian_shield',
    name: '守护结界',
    icon: '🛡',
    rarity: 'rare',
    category: 'board',
    description: '棋盘满时自动销毁最低级元素腾出空位（每关 3 次）',
    flavor: '"绝境中的希望"',
    apply: () => {}, // ⏳ 待补充——棋盘满时自动销毁最低级元素腾出空位（每关 3 次），在 SpawnSystem.placeElement 中检测
  },

  // ---- 大招类祝福（解锁对应怒气大招） ----
  {
    id: 'boon_rage_merge_up',
    name: '怒气·全体升级',
    icon: '⬆',
    rarity: 'epic',
    category: 'board',
    description: '解锁怒气大招「全体升级」：棋盘上所有元素等级+1',
    flavor: '"集体的力量"',
    apply: () => {},
  },
  {
    id: 'boon_rage_fill',
    name: '怒气·元素填充',
    icon: '🧩',
    rarity: 'rare',
    category: 'board',
    description: '解锁怒气大招「元素填充」：在空位随机生成基础元素',
    flavor: '"无中生有"',
    apply: () => {},
  },
  {
    id: 'boon_rage_combo',
    name: '怒气·连击风暴',
    icon: '🌀',
    rarity: 'epic',
    category: 'merge',
    description: '解锁怒气大招「连击风暴」：15秒内连击倍率固定 x3',
    flavor: '"风暴将至"',
    apply: () => {},
  },
  {
    id: 'boon_rage_order',
    name: '怒气·订单重置',
    icon: '📋',
    rarity: 'rare',
    category: 'order',
    description: '解锁怒气大招「订单重置」：刷新所有订单为高奖励订单',
    flavor: '"商机无限"',
    apply: () => {},
  },
  {
    id: 'boon_rage_super',
    name: '怒气·超级合成',
    icon: '🔮',
    rarity: 'legendary',
    category: 'merge',
    description: '解锁怒气大招「超级合成」：随机将一对相邻同等级元素合成高两级',
    flavor: '"化不可能为可能"',
    apply: () => {},
  },
];

// ==================== 诅咒池 ====================
const CURSE_POOL = [
  {
    id: 'curse_slow_growth',
    name: '缓慢生长',
    icon: '🐢',
    description: '所有发射器冷却时间 +40%',
    penalty: (emitters) => {
      emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 1.4; });
    },
    compensation: '订单积分 +60%',
    compensator: () => {}, // ✅ 已在 BoonSystem.getOrderRewardMultiplier() 中处理——订单积分 +60%
    /** 分阶段升级配置 */
    stageConfigs: [
      { stage: 1, triggerFloor: 1, desc: '所有发射器冷却时间 +20%', apply: (emitters) => {
        emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 1.2; });
      }},
      { stage: 2, triggerFloor: 3, desc: '冷却惩罚升至 +40%', apply: (emitters) => {
        emitters.forEach(e => { e.modifiers.cooldownMultiplier /= 1.2; });
        emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 1.4; });
      }},
      { stage: 3, triggerFloor: 6, desc: '冷却惩罚升至 +60%，每提交5个订单额外+5%（永久）', apply: (emitters) => {
        emitters.forEach(e => { e.modifiers.cooldownMultiplier /= 1.4; });
        emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 1.6; });
      }, extraEffect: 'permanentGrowth' },
    ],
  },
  {
    id: 'curse_element_confusion',
    name: '元素混淆',
    icon: '🎲',
    description: '发射器随机产出元素类型',
    penalty: (emitters) => {
      const types = Object.keys(ELEMENT_TYPES);
      emitters.forEach(e => { e.modifiers.randomType = true; e._typePool = types; });
    },
    compensation: '棋盘扩大 2 格',
    compensator: () => {}, // ⏳ 待补充——在 startRogueLevel 中 boardCols + 2（或 boardRows + 1）
    /** 分阶段升级配置 */
    stageConfigs: [
      { stage: 1, triggerFloor: 1, desc: '发射器有 30% 概率产出随机类型元素', randomChance: 0.3 },
      { stage: 2, triggerFloor: 4, desc: '随机产出概率升至 60%', randomChance: 0.6 },
      { stage: 3, triggerFloor: 8, desc: '100% 随机产出，每关开始随机交换棋盘上 3 对元素位置', randomChance: 1.0, extraEffect: 'swapElements' },
    ],
  },
  {
    id: 'curse_greed_price',
    name: '贪婪代价',
    icon: '👹',
    description: '每次提交订单额外消耗 1 个随机元素',
    penalty: () => {}, // ⏳ 待补充——在 _onOrderClicked 中，提交订单后消耗一个随机元素
    compensation: '订单积分翻倍',
    compensator: () => {}, // ✅ 已在 BoonSystem.getOrderRewardMultiplier() 中处理——订单积分翻倍
    /** 分阶段升级配置 */
    stageConfigs: [
      { stage: 1, triggerFloor: 1, desc: '每提交 3 个订单消耗 1 个随机元素', orderInterval: 3, minLevel: 1 },
      { stage: 2, triggerFloor: 5, desc: '每提交 2 个订单消耗 1 个随机元素', orderInterval: 2, minLevel: 1 },
      { stage: 3, triggerFloor: 10, desc: '每次提交订单消耗 1 个随机元素，等级 ≥ 2', orderInterval: 1, minLevel: 2 },
    ],
  },
  {
    id: 'curse_fragile_board',
    name: '脆弱棋盘',
    icon: '💔',
    description: '棋盘缩小 4 格',
    penalty: () => {}, // ⏳ 待补充——在 startRogueLevel 中 boardCols = Math.max(4, boardCols - 2); boardRows = Math.max(3, boardRows - 1)
    compensation: '初始获得一个传说祝福',
    compensator: () => {}, // ✅ 已在 BoonSystem.addCurse() 中处理——添加诅咒时直接给予一个传说祝福
    /** 分阶段升级配置 */
    stageConfigs: [
      { stage: 1, triggerFloor: 1, desc: '棋盘减少 2 格', colsReduce: 1, rowsReduce: 0 },
      { stage: 2, triggerFloor: 4, desc: '棋盘再减 2 格，每关随机封锁 1 格', colsReduce: 1, rowsReduce: 0, extraEffect: 'blockCell' },
      { stage: 3, triggerFloor: 8, desc: '每关随机封锁 2 格，持续整关', blockCount: 2, extraEffect: 'blockCell' },
    ],
  },
];

// ==================== 随机事件池 ====================
const EVENT_POOL = {
  early: [
    {
      id: 'event_lost_alchemist',
      title: '迷路的炼金术士',
      description: '你在路边遇到一位迷路的炼金术士，他看起来需要帮助……',
      options: [
        { text: '帮助他指路', result: '获得一个随机稀有祝福', effect: 'boon_rare' },
        { text: '无视他离开', result: '无事发生', effect: 'nothing' },
      ],
    },
    {
      id: 'event_element_storm',
      title: '元素风暴',
      description: '一场猛烈的元素风暴正在逼近！',
      options: [
        { text: '躲避风暴', result: '失去棋盘上最高级的元素', effect: 'lose_highest' },
        { text: '利用风暴能量', result: '所有元素等级 +1，但损失 3 个空位', effect: 'storm_boost' },
      ],
    },
    {
      id: 'event_mysterious_merchant',
      title: '神秘商人',
      description: '一个戴着面具的商人向你展示了一件强大的宝物……',
      options: [
        { text: '用 50% 当前积分交换', result: '获得一个传说祝福', effect: 'trade_score_legendary' },
        { text: '用 2 个祝福交换', result: '获得两个新的祝福选择', effect: 'trade_boons' },
      ],
    },
  ],
  mid: [
    {
      id: 'event_ancient_altar',
      title: '古老的祭坛',
      description: '一座散发着神秘光芒的古老祭坛出现在你面前……',
      options: [
        { text: '献祭一个祝福', result: '获得两个新的祝福选择', effect: 'sacrifice_boon' },
        { text: '献祭一半积分', result: '获得一个史诗祝福', effect: 'sacrifice_score' },
      ],
    },
    {
      id: 'event_time_rift',
      title: '时空裂隙',
      description: '前方的空间出现了扭曲的裂隙，似乎通往不同的时间线……',
      options: [
        { text: '跳过关卡', result: '直接进入下一层', effect: 'skip_floor' },
        { text: '探索裂隙', result: '获得随机祝福，但下一关难度 +30%', effect: 'explore_rift' },
      ],
    },
    {
      id: 'event_spirit_trial',
      title: '精灵的考验',
      description: '一只发光的精灵提出要考验你的合成技艺……',
      options: [
        { text: '接受考验', result: '连续合成 5 次成功获得传说祝福', effect: 'trial_legendary' },
        { text: '婉拒', result: '获得一个普通祝福', effect: 'polite_refuse' },
      ],
    },
  ],
  late: [
    {
      id: 'event_dark_bargain',
      title: '黑暗交易',
      description: '一个阴影中的声音低语着诱人的交易……',
      options: [
        { text: '接受交易', result: '获得两个传说祝福，但附加一个诅咒', effect: 'dark_bargain' },
        { text: '拒绝诱惑', result: '获得一个稀有祝福', effect: 'resist' },
      ],
    },
    {
      id: 'event_chaos_forge',
      title: '混沌熔炉',
      description: '一座燃烧着混沌之火的熔炉，据说可以重塑祝福的力量……',
      options: [
        { text: '重塑祝福', result: '随机改变所有祝福的稀有度', effect: 'reforge_boons' },
        { text: '吸收混沌之力', result: '所有发射器永久加速 50%，但订单积分减半', effect: 'chaos_power' },
      ],
    },
  ],
};

// ==================== Boss 配置 ====================
const BOSS_CONFIGS = [
  {
    id: 'boss_lava_giant',
    name: '熔岩巨像',
    icon: '🗿',
    floor: 3,
    description: '每 15 秒棋盘随机一个格子被灼烧无法使用，持续 5 秒',
    targetScoreMultiplier: 1.8,
    specialRule: 'scorch',
    mechanics: {
      /** 灼烧间隔(ms) */
      scorchInterval: 15000,
      /** 灼烧持续时间(ms) */
      scorchDuration: 5000,
      /** 灼烧蔓延概率(每5秒) */
      spreadChance: 0.4,
      /** 愤怒阈值(同时灼烧格子数) */
      rageThreshold: 3,
      /** 愤怒时发射器冷却惩罚倍率 */
      rageCooldownPenalty: 1.3,
    },
  },
  {
    id: 'boss_ice_witch',
    name: '冰霜女巫',
    icon: '❄',
    floor: 6,
    description: '发射器冷却速度降低 50%，但合成积分翻倍',
    targetScoreMultiplier: 2.0,
    specialRule: 'chill',
    mechanics: {
      /** 冻结间隔(ms) */
      freezeInterval: 8500,
      /** 冻结持续时间(ms) */
      freezeDuration: 35000,
      /** 解冻所需连续合成次数 */
      thawMergeCount: 2,
      /** 暴风雪阈值(同时冻结行数) */
      blizzardThreshold: 2,
      /** 暴风雪持续期间发射器暂停时间(ms) */
      blizzardPauseDuration: 7000,
    },
  },
  {
    id: 'boss_chaos_core',
    name: '混沌之核',
    icon: '🌀',
    floor: 9,
    description: '订单需求每 20 秒全部刷新，已完成不计入进度',
    targetScoreMultiplier: 2.2,
    specialRule: 'chaos_order',
    mechanics: {
      /** 混沌波动间隔(ms) */
      waveInterval: 25000,
      /** 混沌元素生成间隔(ms) */
      chaosSpawnInterval: 10000,
      /** 混沌元素图标 */
      chaosIcon: '❓',
      /** 混沌波动等级随机变化范围 */
      waveLevelRange: 1,
    },
  },
  {
    id: 'boss_time_devourer',
    name: '时间吞噬者',
    icon: '⏳',
    floor: 12,
    description: '每关限时 120 秒，倒计时结束后强制失败',
    targetScoreMultiplier: 2.5,
    specialRule: 'timed',
    mechanics: {
      /** 总时限(ms) */
      timeLimit: 120000,
      /** 吞噬间隔(ms) */
      devourInterval: 10000,
      /** 提交订单延缓吞噬时间(ms) */
      orderDelay: 3000,
    },
  },
  {
    id: 'boss_creation_spirit',
    name: '创世之灵',
    icon: '🌟',
    floor: 15,
    description: '所有祝福失效，但棋盘扩大至最大，发射器无冷却',
    targetScoreMultiplier: 3.0,
    specialRule: 'nullify_boons',
    mechanics: {
      /** 祝福解封间隔(ms) */
      unsealInterval: 30000,
      /** 镜像召唤间隔(ms) */
      mirrorInterval: 20000,
      /** 镜像存在时间(ms) */
      mirrorDuration: 6000,
      /** 每个祝福增加的目标分百分比 */
      scorePerBoonPercent: 15,
    },
  },
];

// ==================== 层数生成配置 ====================
const FLOOR_GENERATOR = {
  maxFloor: 12,
  nodesPerFloor: [2, 2, 3, 2, 3, 3, 2, 3, 3, 3, 3, 3],
  nodeTypes: ['combat', 'elite', 'boon', 'shop', 'event', 'rest'],
  
  /** 根据层数生成节点序列 */
  generateFloor(floorNumber) {
    const nodeCount = this.nodesPerFloor[Math.min(floorNumber - 1, this.nodesPerFloor.length - 1)] || 3;
    const isBossFloor = BOSS_CONFIGS.some(b => b.floor === floorNumber);
    
    if (isBossFloor) {
      return [{ type: 'rest' }, { type: 'boss', bossId: BOSS_CONFIGS.find(b => b.floor === floorNumber).id }];
    }
    
    const nodes = [];
    const typesPool = [...this.nodeTypes];
    
    // 第一节点总是战斗
    nodes.push({ type: 'combat' });
    
    for (let i = 1; i < nodeCount; i++) {
      const available = this._getAvailableTypes(floorNumber, i);
      const type = available[Math.floor(Math.random() * available.length)];
      nodes.push({ type });
    }
    
    return nodes;
  },
  
  _getAvailableTypes(floor, nodeIndex) {
    const weights = {
      combat: 35,
      elite: floor >= 3 ? 15 : 0,
      boon: 20,
      shop: 15,
      event: 10,
      rest: 5,
    };
    // 越往后精英越多
    if (floor > 6) { weights.elite += 10; weights.combat -= 10; }
    return weightedPick(weights);
  },
};

/** 按权重随机选取 */
function weightedPick(weightMap) {
  const entries = Object.entries(weightMap).filter(([, w]) => w > 0);
  if (entries.length === 0) return ['combat'];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return [key];
  }
  return ['combat'];
}

// ==================== 难度曲线 ====================
const ROGUE_DIFFICULTY = {
  baseScore: 80,
  scoreMultiplierPerFloor: 1.18,
  orderDifficultyShift: 0.08,
  goldBase: 10,
  goldPerFloor: 3,
  eliteGoldMultiplier: 2,
  maxBoons: 8,
};