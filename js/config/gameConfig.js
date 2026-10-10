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
    orderDifficultyWeights: { easy: 70, medium: 30, hard: 0, rare: 0 },
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
    orderDifficultyWeights: { easy: 40, medium: 45, hard: 15, rare: 0 },
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
    orderDifficultyWeights: { easy: 20, medium: 40, hard: 30, rare: 10 },
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