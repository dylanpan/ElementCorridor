# 订单品质系统 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

为订单引入品质分级机制，不同品质的订单在倒计时、积分奖励和出现概率上各有差异，丰富玩家的策略选择空间。

### 1.2 核心规则

| 品质 | 颜色标识 | 倒计时 | 积分倍率 | 出现概率 | 说明 |
|---|---|---|---|---|---|
| **普通（Common）** | 灰色 | 20 秒 | x1.0 | 45% | 基础订单，容易完成 |
| **稀有（Rare）** | 蓝色 | 30 秒 | x1.5 | 30% | 中等难度，奖励尚可 |
| **史诗（Epic）** | 紫色 | 40 秒 | x2.5 | 18% | 较难完成，奖励丰厚 |
| **传说（Legendary）** | 金色 | 60 秒 | x5.0 | 7% | 极难完成，巨额奖励 |

### 1.3 设计意图

- **风险回报权衡**：高品质订单时间更长但奖励更高，玩家需判断是否有足够时间合成高级元素
- **视觉层次感**：不同颜色的订单边框让玩家一眼识别优先级
- **运气成分**：高品质订单的低概率出现带来惊喜感，类似「抽到好牌」

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 自动合成引擎 | 优先处理即将超时的订单，无论品质 |
| 连击奖励 | 高品质订单配合连击可获得巨额积分 |
| 生存积分制 | 高风险高回报——传说订单超时扣分也更痛 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/OrderSystem.js` —— 品质逻辑
- `js/ui/UIManager.js` —— 品质 UI 渲染
- `css/style.css` —— 品质颜色样式

### 2.2 品质配置

```javascript
// 在 OrderSystem 中
static QUALITY_CONFIG = {
  common: {
    label: '普通',
    color: '#9e9e9e',
    timeMultiplier: 0.8,    // 基础时间 x0.8
    rewardMultiplier: 1.0,
    weight: 45,              // 出现权重
    icon: '⬜',
  },
  rare: {
    label: '稀有',
    color: '#42a5f5',
    timeMultiplier: 1.2,
    rewardMultiplier: 1.5,
    weight: 30,
    icon: '🔵',
  },
  epic: {
    label: '史诗',
    color: '#ab47bc',
    timeMultiplier: 1.6,
    rewardMultiplier: 2.5,
    weight: 18,
    icon: '🟣',
  },
  legendary: {
    label: '传说',
    color: '#ffd700',
    timeMultiplier: 2.4,
    rewardMultiplier: 5.0,
    weight: 7,
    icon: '👑',
  },
};
```

### 2.3 品质抽取

```javascript
/**
 * 根据权重随机抽取品质
 * @returns {string} 品质名称
 */
_pickQuality() {
  const configs = OrderSystem.QUALITY_CONFIG;
  const entries = Object.entries(configs);
  const totalWeight = entries.reduce((sum, [, cfg]) => sum + cfg.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const [quality, cfg] of entries) {
    rand -= cfg.weight;
    if (rand <= 0) return quality;
  }
  return 'common';
}
```

### 2.4 订单生成时应用品质

```javascript
generateOrder() {
  const template = this._pickOrderTemplate(excludeIds);
  if (!template) return null;

  const quality = this._pickQuality();
  const qualityCfg = OrderSystem.QUALITY_CONFIG[quality];
  const baseTime = this._getBaseTimeLimit(template.difficultyapsed);

  const order = {
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    elementType: template.elementType,
    level: template.level,
    reward: Math.floor(template.reward * qualityCfg.rewardMultiplier),
    difficulty: template.difficulty,
    quality: quality,
    completed: false,
    createdAt: Date.now(),
    timeLimit: Math.floor(baseTime * qualityCfg.timeMultiplier),
    expiresAt: Date.now() + Math.floor(baseTime * qualityCfg.timeMultiplier),
    expired: false,
  };
  return order;
}
```

### 2.5 UI 渲染

```javascript
// 在 renderOrders 中
const qualityCfg = OrderSystem.QUALITY_CONFIG[order.quality];
card.style.borderColor = qualityCfg.color;
card.style.boxShadow = `0 0 8px ${qualityCfg.color}40`;

// 品质标签
const qualityBadge = document.createElement('span');
qualityBadge.className = 'order-quality-badge';
qualityBadge.textContent = `${qualityCfg.icon} ${qualityCfg.label}`;
qualityBadge.style.color = qualityCfg.color;
card.insertBefore(qualityBadge, card.firstChild);
```

### 2.6 CSS 样式

```css
.order-quality-badge {
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0,0,0,0.3);
  display: inline-block;
  margin-bottom: 4px;
}

/* 品质边框颜色 */
.order-card.common  { border-color: #9e9e9e; }
.order-card.rare    { border-color: #42a5f5; }
.order-card.epic    { border-color: #ab47bc; }
.order-card.legendary { border-color: #ffd700; }
```
