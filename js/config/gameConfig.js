/**
 * ============================================================
 * 游戏全局配置
 * 通过修改此文件即可扩展游戏内容，无需改动核心逻辑代码。
 * 方便后续迁移至 Godot 引擎时，只需将配置数据转换为 Godot 资源格式。
 * ============================================================
 */

// ==================== 元素类型定义 ====================
// 所有基础元素在此定义，新增元素只需在此添加条目
const ELEMENT_TYPES = {
  fire: {
    id: 'fire',
    name: '火焰',
    icon: '🔥',
    color: '#FF6B35',
    bgColor: '#FFF0E8',
    description: '炽热的火焰元素',
  },
  water: {
    id: 'water',
    name: '水滴',
    icon: '💧',
    color: '#4A90D9',
    bgColor: '#E8F4FF',
    description: '清澈的水滴元素',
  },
  earth: {
    id: 'earth',
    name: '土块',
    icon: '🪨',
    color: '#8B6914',
    bgColor: '#F5EDE0',
    description: '坚实的土块元素',
  },
  air: {
    id: 'air',
    name: '微风',
    icon: '🌪️',
    color: '#7EC8E3',
    bgColor: '#F0FAFF',
    description: '轻盈的微风元素',
  },
  plant: {
    id: 'plant',
    name: '植物',
    icon: '🌿',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    description: '生机勃勃的植物元素',
  },
};

// ==================== 元素等级配置 ====================
// 每个等级对应的视觉样式和分值
const ELEMENT_LEVELS = [
  { level: 1, size: 1, scoreValue: 1, label: '初级', borderClass: 'level-1' },
  { level: 2, size: 1, scoreValue: 3, label: '中级', borderClass: 'level-2' },
  { level: 3, size: 1, scoreValue: 8, label: '高级', borderClass: 'level-3' },
  { level: 4, size: 1, scoreValue: 20, label: '稀有', borderClass: 'level-4' },
  { level: 5, size: 1, scoreValue: 50, label: '史诗', borderClass: 'level-5' },
  { level: 6, size: 1, scoreValue: 120, label: '传说', borderClass: 'level-6' },
];

// ==================== 发射器配置 ====================
// 每个发射器产出特定类型的元素，可配置冷却时间和初始等级
const EMITTER_CONFIGS = [
  {
    id: 'emitter_fire',
    elementType: 'fire',
    name: '火焰发射器',
    icon: '🔥',
    cooldownMs: 2000,
    spawnLevel: 1,
    description: '产出火焰元素（冷却2秒）',
  },
  {
    id: 'emitter_water',
    elementType: 'water',
    name: '水滴发射器',
    icon: '💧',
    cooldownMs: 2000,
    spawnLevel: 1,
    description: '产出水滴元素（冷却2秒）',
  },
  {
    id: 'emitter_earth',
    elementType: 'earth',
    name: '土块发射器',
    icon: '🪨',
    cooldownMs: 2000,
    spawnLevel: 1,
    description: '产出土块元素（冷却2秒）',
  },
  {
    id: 'emitter_air',
    elementType: 'air',
    name: '微风发射器',
    icon: '🌪️',
    cooldownMs: 2500,
    spawnLevel: 1,
    description: '产出微风元素（冷却2.5秒）',
  },
  {
    id: 'emitter_plant',
    elementType: 'plant',
    name: '植物发射器',
    icon: '🌿',
    cooldownMs: 3000,
    spawnLevel: 1,
    description: '产出植物元素（冷却3秒）',
  },
];

// ==================== 订单配置 ====================
// 订单模板：定义可能出现的订单需求，游戏运行时从中随机选取
const ORDER_TEMPLATES = [
  // 初级订单
  { elementType: 'fire', level: 2, reward: 10, difficulty: 'easy' },
  { elementType: 'water', level: 2, reward: 10, difficulty: 'easy' },
  { elementType: 'earth', level: 2, reward: 12, difficulty: 'easy' },
  { elementType: 'air', level: 2, reward: 15, difficulty: 'easy' },
  { elementType: 'plant', level: 2, reward: 18, difficulty: 'easy' },

  // 中级订单
  { elementType: 'fire', level: 3, reward: 30, difficulty: 'medium' },
  { elementType: 'water', level: 3, reward: 30, difficulty: 'medium' },
  { elementType: 'earth', level: 3, reward: 32, difficulty: 'medium' },
  { elementType: 'air', level: 3, reward: 38, difficulty: 'medium' },
  { elementType: 'plant', level: 3, reward: 40, difficulty: 'medium' },

  // 高级订单
  { elementType: 'fire', level: 4, reward: 80, difficulty: 'hard' },
  { elementType: 'water', level: 4, reward: 80, difficulty: 'hard' },
  { elementType: 'earth', level: 4, reward: 85, difficulty: 'hard' },
  { elementType: 'air', level: 4, reward: 90, difficulty: 'hard' },
  { elementType: 'plant', level: 4, reward: 95, difficulty: 'hard' },

  // 稀有订单
  { elementType: 'fire', level: 5, reward: 180, difficulty: 'rare' },
  { elementType: 'water', level: 5, reward: 190, difficulty: 'rare' },
  { elementType: 'earth', level: 5, reward: 195, difficulty: 'rare' },
  { elementType: 'air', level: 5, reward: 210, difficulty: 'rare' },
  { elementType: 'plant', level: 5, reward: 220, difficulty: 'rare' },
];

// ==================== 关卡配置 ====================
// 每关的目标分数、可用发射器、最大订单数等
const LEVEL_CONFIGS = [
  {
    level: 1,
    targetScore: 100,
    maxOrders: 3,
    boardCols: 6,
    boardRows: 4,
    availableEmitters: ['emitter_fire', 'emitter_water', 'emitter_earth'],
    orderDifficultyWeights: { easy: 30, medium: 45, hard: 15, rare: 10 },
    title: '初识元素',
    description: '掌握基础元素的合成与提交',
  },
  {
    level: 2,
    targetScore: 250,
    maxOrders: 4,
    boardCols: 7,
    boardRows: 4,
    availableEmitters: ['emitter_fire', 'emitter_water', 'emitter_earth', 'emitter_air'],
    orderDifficultyWeights: { easy: 15, medium: 35, hard: 35, rare: 15 },
    title: '风之觉醒',
    description: '引入微风元素，挑战更复杂的合成',
  },
  {
    level: 3,
    targetScore: 500,
    maxOrders: 4,
    boardCols: 7,
    boardRows: 5,
    availableEmitters: ['emitter_fire', 'emitter_water', 'emitter_earth', 'emitter_air', 'emitter_plant'],
    orderDifficultyWeights: { easy: 5, medium: 30, hard: 35, rare: 30 },
    title: '生命绽放',
    description: '全部元素登场，冲击高分通关',
  },
];

// ==================== 游戏通用设置 ====================
const GAME_SETTINGS = {
  mergeAnimationDuration: 300,   // 合成动画时长(ms)
  spawnAnimationDuration: 400,   // 生成动画时长(ms)
  autoSaveInterval: 15000,       // 自动保存间隔(ms)
  maxBoardCells: 48,             // 棋盘最大格子数
  orderRefreshCost: 20,          // 刷新订单消耗积分
  comboBonusMultiplier: 0.5,     // 连击奖励倍率
};
// ==================== 波次模板配置 ====================
// 每关拆分为多个小波次，按难度 tier 分层定义
// type: score(累计分数) / combo(连击次数) / orders(完成订单数) / merge(合成次数)
const WAVE_CONFIGS = {
  // === 早期(关卡1) ===
  early: [
    { type: 'score',  target: 30,  label: '积累 30 分',   reward: 10 },
    { type: 'orders', target: 2,   label: '完成 2 个订单', reward: 15 },
    { type: 'combo',  target: 3,   label: '达成 3 连击',   reward: 20 },
    { type: 'score',  target: 50,  label: '积累 50 分',   reward: 15 },
    { type: 'orders', target: 4,   label: '完成 4 个订单', reward: 25 },
  ],
  // === 中期(关卡2) ===
  mid: [
    { type: 'score',  target: 60,  label: '积累 60 分',   reward: 20 },
    { type: 'combo',  target: 5,   label: '达成 5 连击',   reward: 30 },
    { type: 'orders', target: 3,   label: '完成 3 个订单', reward: 30 },
    { type: 'merge',  target: 8,   label: '合成 8 次',     reward: 35 },
    { type: 'score',  target: 100, label: '积累 100 分',  reward: 40 },
  ],
  // === 后期(关卡3) ===
  late: [
    { type: 'score',  target: 100, label: '积累 100 分',  reward: 40 },
    { type: 'combo',  target: 8,   label: '达成 8 连击',   reward: 55 },
    { type: 'orders', target: 4,   label: '完成 4 个订单', reward: 50 },
    { type: 'merge',  target: 12,  label: '合成 12 次',    reward: 65 },
    { type: 'score',  target: 150, label: '积累 150 分',  reward: 80 },
  ],
};

// ==================== 紧急事件列表 ====================
// 战斗中随机触发，持续时间 10~20 秒，同类型有冷却限制
const EMERGENCY_EVENTS = [
  {
    id: 'double_points',
    name: '双倍积分',
    icon: '💎',
    description: '所有合成和订单提交获得的积分翻倍',
    durationMs: 12000,
    cooldownMs: 60000,
    weight: 18,
    category: 'positive',
    apply(ctx) {
      ctx.scoreMultiplier = 2;
    },
    cleanup(ctx) {
      ctx.scoreMultiplier = 1;
    },
  },
  {
    id: 'speed_up',
    name: '加速生产',
    icon: '⚡',
    description: '所有发射器冷却时间减半',
    durationMs: 15000,
    cooldownMs: 45000,
    weight: 16,
    category: 'positive',
    apply(ctx) {
      ctx.emitterSpeedMultiplier = 0.5;
    },
    cleanup(ctx) {
      ctx.emitterSpeedMultiplier = 1;
    },
  },
  {
    id: 'order_rush',
    name: '加急订单',
    icon: '📋',
    description: '立即刷新一个高额奖励的额外订单，限时完成',
    durationMs: 15000,
    cooldownMs: 50000,
    weight: 14,
    category: 'challenge',
    apply(ctx) {
      ctx.spawnRushOrder = true;
    },
    cleanup(ctx) {
      ctx.removeRushOrder?.();
    },
  },
  {
    id: 'element_flood',
    name: '元素洪流',
    icon: '🌊',
    description: '棋盘快速填充低级元素，考验清理能力',
    durationMs: 10000,
    cooldownMs: 55000,
    weight: 12,
    category: 'negative',
    apply(ctx) {
      ctx.floodActive = true;
      ctx.floodInterval = 800; // 每0.8秒填充一个
    },
    cleanup(ctx) {
      ctx.floodActive = false;
    },
  },
  {
    id: 'freeze',
    name: '冻结',
    icon: '❄️',
    description: '所有发射器暂停工作',
    durationMs: 8000,
    cooldownMs: 50000,
    weight: 13,
    category: 'negative',
    apply(ctx) {
      ctx.freezeEmitters = true;
    },
    cleanup(ctx) {
      ctx.freezeEmitters = false;
    },
  },
  {
    id: 'combo_fever',
    name: '连击狂热',
    icon: '🔥',
    description: '连击奖励倍率提升至 3 倍',
    durationMs: 12000,
    cooldownMs: 40000,
    weight: 17,
    category: 'positive',
    apply(ctx) {
      ctx.comboMultiplier = 3;
    },
    cleanup(ctx) {
      ctx.comboMultiplier = 1;
    },
  },
  {
    id: 'mystery_box',
    name: '神秘宝箱',
    icon: '🎁',
    description: '随机获得一份奖励：加分 / 消除一行 / 升级一个随机元素',
    durationMs: 5000,
    cooldownMs: 35000,
    weight: 10,
    category: 'random',
    apply(ctx) {
      ctx.triggerMysteryReward = true;
    },
    cleanup(ctx) {
      ctx.triggerMysteryReward = false;
    },
  },
];

// ==================== 评级阈值配置 ====================
// 每关结束后按多维度综合评级
const RATING_THRESHOLDS = {
  S: {
    minScorePercent: 95,       // 目标分数完成度 ≥ 95%
    maxComboRequired: 8,       // 最高连击 ≥ 8
    maxTimeSeconds: Infinity,  // 不限制时间
    label: 'S',
    title: '🌟 完美通关',
    color: '#FFD700',
    stars: 3,
  },
  A: {
    minScorePercent: 85,
    maxComboRequired: 6,
    maxTimeSeconds: Infinity,
    label: 'A',
    title: '🏆 优秀',
    color: '#FF9800',
    stars: 3,
  },
  B: {
    minScorePercent: 70,
    maxComboRequired: 4,
    maxTimeSeconds: Infinity,
    label: 'B',
    title: '👍 良好',
    color: '#4CAF50',
    stars: 2,
  },
  C: {
    minScorePercent: 50,
    maxComboRequired: 2,
    maxTimeSeconds: Infinity,
    label: 'C',
    title: '👌 合格',
    color: '#2196F3',
    stars: 1,
  },
  D: {
    minScorePercent: 0,
    maxComboRequired: 0,
    maxTimeSeconds: Infinity,
    label: 'D',
    title: '💪 继续努力',
    color: '#9E9E9E',
    stars: 0,
  },
};
