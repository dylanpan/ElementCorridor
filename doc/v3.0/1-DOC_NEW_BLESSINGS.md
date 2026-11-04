# 灵素回廊 v3.0 —— 祝福扩展设计方案

## 方案概述

在 v2.0 肉鸽模式的基础上，新增 3 个祝福，丰富产出类和合成类的 Build 流派选择。新增祝福与现有祝福形成联动，拓展策略深度。

---

## 新增祝福一览

| # | 祝福名称 | 效果 | 稀有度 | 分类 |
|---|---------|------|--------|------|
| 1 | 伴生之种 | 发射器产出元素时，有 15% 概率额外产出对应元素类型的附属类型元素 | 稀有 | production |
| 2 | 点金之手 | 合成元素时，额外产出金币，金币数量与合成等级相关 | 史诗 | merge |
| 3 | 超级幸运 | 发射器产出元素时，有 25% 概率产出高一级的元素 | 史诗 | production |

---

## 祝福一：伴生之种

### 基本信息

| 字段 | 值 |
|------|-----|
| ID | `boon_symbiotic_seed` |
| 名称 | 伴生之种 |
| 图标 | 🌱 |
| 稀有度 | 稀有（rare） |
| 分类 | production（产出类） |
| 描述 | 发射器产出元素时，有 15% 概率额外产出对应元素类型的附属类型元素 |
| 风味文本 | "万物相生，生生不息" |

### 效果说明

当发射器产出元素时，有 15% 概率额外在棋盘空位上生成一个「附属类型元素」。附属类型映射关系如下：

| 主元素类型 | 附属类型 | 逻辑依据 |
|-----------|---------|---------|
| fire（🔥火焰） | air（🌪微风） | 火借风势 |
| water（💧水滴） | plant（🌿植物） | 水润万物 |
| earth（🪨土块） | fire（🔥火焰） | 地火共生 |
| air（🌪微风） | water（💧水滴） | 风云化雨 |
| plant（🌿植物） | earth（🪨土块） | 落叶归根 |
| basic（⚪无属性） | 随机抽取一种已解锁属性元素 | 无属性转化 |

**附属类型元素的等级** = 主元素等级（与主元素同级）。

**放置规则**：
- 优先放置在棋盘空位
- 若无空位则不生成（不覆盖已有元素）
- 不触发额外的事件/效果（仅生成元素本身）

### 数值规划

| 参数 | 值 | 说明 |
|------|-----|------|
| 触发概率 | 15% | 每次发射器产出时独立判定 |
| 附属等级 | 同主元素等级 | 与主元素同级 |
| 空位要求 | 必须有空位 | 棋盘满时不触发 |
| 无属性转化 | 随机已解锁属性 | 若未解锁任何属性则仍产出无属性 |

### 联动设计

- **与「元素亲和」系列**：解锁更多属性后，无属性元素的附属产出变为随机已解锁属性，实用性提升
- **与「灵素分流/万象之源」**：多元素产出时，每个产出元素独立判定 15% 概率
- **与「双重产出」**：双重产出和伴生之种独立判定，可同时触发

---

## 祝福二：点金之手

### 基本信息

| 字段 | 值 |
|------|-----|
| ID | `boon_midas_touch` |
| 名称 | 点金之手 |
| 图标 | 💰 |
| 稀有度 | 史诗（epic） |
| 分类 | merge（合成类） |
| 描述 | 合成元素时，额外产出金币，金币数量与合成等级相关 |
| 风味文本 | "点石成金，化凡为宝" |

### 效果说明

每次成功合成元素时，根据合成后元素的等级额外获得金币。金币计算公式：

```
金币 = 合成后等级 × 等级系数
```

| 合成后等级 | 金币产出 | 说明 |
|-----------|---------|------|
| Lv.2 | 2 | 初级合成 |
| Lv.3 | 5 | 中级合成 |
| Lv.4 | 12 | 稀有合成 |
| Lv.5 | 30 | 史诗合成 |
| Lv.6 | 80 | 传说合成 |

**金币用途**：在商店关（shop）中消耗金币购买祝福/道具。

### 数值规划

| 参数 | 值 | 说明 |
|------|-----|------|
| 金币公式 | `floor(等级^2 × 0.5 + 等级 × 0.5)` | 近似值见上表 |
| 触发时机 | 每次合成成功后 | 在元素放置后、连击更新前 |
| 金币显示 | 飘字动画 "+💰 X" | 绿色金币图标 |
| 存储位置 | `this.state.gold` | 与现有金币系统共用 |

### 联动设计

- **与「连锁反应」**：连锁反应生成的元素如果再次参与合成，也会触发金币产出
- **与「三重奏」**：三合一合成高两级元素，金币产出按高两级计算
- **与「融合增效/经验累积」**：金币产出与积分加成互不干扰，可同时享受

### 实现要点

```javascript
// 在 GameEngine._executeMerge 中，合成成功后添加：
if (this.boonSystem && this.boonSystem.hasBoon('boon_midas_touch')) {
  const goldAmount = Math.floor(Math.pow(newLevel, 2) * 0.5 + newLevel * 0.5);
  this.state.gold = (this.state.gold || 0) + goldAmount;
  // 飘字动画
  window.eventBus.emit('gold:earned', { amount: goldAmount, row, col });
}
```

---

## 祝福三：超级幸运

### 基本信息

| 字段 | 值 |
|------|-----|
| ID | `boon_super_lucky` |
| 名称 | 超级幸运 |
| 图标 | 🍀 |
| 稀有度 | 史诗（epic） |
| 分类 | production（产出类） |
| 描述 | 发射器产出元素时，有 25% 概率产出高一级的元素 |
| 风味文本 | "幸运女神眷顾着你" |

### 效果说明

当发射器产出元素时，有 25% 概率将产出的元素等级 +1（不超过最高等级 Lv.6）。

**与「变异孢子」的关系**：

| 祝福 | 概率 | 稀有度 | 特点 |
|------|------|--------|------|
| 变异孢子（boon_variant_spore） | 20% | 史诗 | 已有祝福 |
| 超级幸运（boon_super_lucky） | 25% | 史诗 | 新增祝福 |

**叠加规则**：两个祝福同时拥有时，概率加法叠加（20% + 25% = 45%），但判定独立——先判定变异孢子，再判定超级幸运。若两者同时触发，只生效一次（等级 +1）。

### 数值规划

| 参数 | 值 | 说明 |
|------|-----|------|
| 触发概率 | 25% | 每次发射器产出时独立判定 |
| 等级提升 | +1 | 不超过最高等级 Lv.6 |
| 叠加方式 | 与变异孢子加法叠加 | 总概率 45%，但只生效一次 |
| 判定顺序 | 变异孢子 → 超级幸运 | 先判定变异孢子，再判定超级幸运 |

### 联动设计

- **与「变异孢子」**：叠加后总概率达 45%，大幅提升高等级元素产出率
- **与「高级起步」**：高级起步先提升基础等级，超级幸运在此基础上再 +1
- **与「伴生之种」**：若超级幸运触发使等级提升，伴生之种的附属元素也按提升后的等级生成

---

## 祝福池配置（代码实现）

在 `rogueConfig.js` 的 `BOON_POOL` 数组中新增以下条目：

```javascript
{
  id: 'boon_symbiotic_seed',
  name: '伴生之种',
  icon: '🌱',
  rarity: 'rare',
  category: 'production',
  description: '发射器产出元素时，有 15% 概率额外产出对应元素类型的附属类型元素',
  flavor: '"万物相生，生生不息"',
  apply: (emitters, boonSystem) => {
    emitters.forEach(e => { e.modifiers.symbioticChance = 0.15; });
  },
},
{
  id: 'boon_midas_touch',
  name: '点金之手',
  icon: '💰',
  rarity: 'epic',
  category: 'merge',
  description: '合成元素时，额外产出金币，金币数量与合成等级相关',
  flavor: '"点石成金，化凡为宝"',
  apply: () => {}, // 在 GameEngine._executeMerge 中处理
},
{
  id: 'boon_super_lucky',
  name: '超级幸运',
  icon: '🍀',
  rarity: 'epic',
  category: 'production',
  description: '发射器产出元素时，有 25% 概率产出高一级的元素',
  flavor: '"幸运女神眷顾着你"',
  apply: (emitters) => {
    emitters.forEach(e => { e.modifiers.superLuckyChance = 0.25; });
  },
},
```

---

## 实现方案

### 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `js/config/rogueConfig.js` | BOON_POOL 新增 3 个祝福配置 |
| `js/core/GameEngine.js` | _executeMerge 中添加点金之手金币产出逻辑 |
| `js/core/GameEngine.js` | _onEmitterClick 中添加伴生之种附属元素生成逻辑 |
| `js/core/GameEngine.js` | _onEmitterClick 中添加超级幸运等级提升逻辑 |
| `js/systems/BoonSystem.js` | 可选：添加 getGoldBonus 等方法 |

### 实现细节

#### 1. 伴生之种（_onEmitterClick 中）

在元素产出并放置到棋盘后，添加以下逻辑：

```javascript
// 伴生之种：15% 概率产出附属类型元素
if (element && this.boonSystem && this.boonSystem.hasBoon('boon_symbiotic_seed')) {
  if (Math.random() < 0.15) {
    const symbioticMap = {
      fire: 'air', water: 'plant', earth: 'fire',
      air: 'water', plant: 'earth',
    };
    let symType = symbioticMap[element.typeId];
    if (!symType && element.typeId === 'basic') {
      // 无属性：随机已解锁属性
      const unlocked = this.boonSystem.getUnlockedTypes();
      symType = unlocked.length > 0
        ? unlocked[Math.floor(Math.random() * unlocked.length)]
        : 'basic';
    }
    if (symType) {
      const symElement = new Element(symType, element.level);
      const pos = this.systems.spawn.findEmptyPosition(this.state.board);
      if (pos) {
        this.systems.spawn.placeElement(this.state.board, symElement, pos.row, pos.col);
        this.boardRenderer.updateCell(this.state.board, pos.row, pos.col);
        this.boardRenderer.playMergeAnimation(element.gridRow, element.gridCol, pos.row, pos.col);
      }
    }
  }
}
```

#### 2. 点金之手（_executeMerge 中）

在合成成功后、连击更新前添加：

```javascript
// 点金之手：合成产出金币
if (this.boonSystem && this.boonSystem.hasBoon('boon_midas_touch')) {
  const goldAmount = Math.floor(Math.pow(newLevel, 2) * 0.5 + newLevel * 0.5);
  this.state.gold = (this.state.gold || 0) + goldAmount;
  window.eventBus.emit('gold:earned', { amount: goldAmount, row: resultRow, col: resultCol });
}
```

#### 3. 超级幸运（_onEmitterClick 中）

在元素产出后、放置前，提升等级：

```javascript
// 超级幸运：25% 概率产出高一级元素
if (this.boonSystem && this.boonSystem.hasBoon('boon_super_lucky')) {
  if (Math.random() < 0.25 && element.level < ELEMENT_LEVELS.length) {
    element.level += 1;
    // 更新元素属性
    const levelConfig = ELEMENT_LEVELS[element.level - 1];
    element.scoreValue = levelConfig.scoreValue;
    element.levelLabel = levelConfig.label;
  }
}
```

---

## 数值平衡说明

### 产出类祝福强度对比

| 祝福 | 稀有度 | 效果 | 等效收益 |
|------|--------|------|---------|
| 加速齿轮 | 普通 | 冷却 -20% | 产出频率 +25% |
| 双重产出 | 稀有 | 30% 双倍 | 产出量 +30% |
| 高级起步 | 稀有 | 等级 +1 | 品质提升 |
| 伴生之种 | 稀有 | 15% 附属 | 产出量 +15%（额外类型） |
| 变异孢子 | 史诗 | 20% 高一级 | 品质提升 |
| **超级幸运** | **史诗** | **25% 高一级** | **品质提升（优于变异孢子）** |
| 无尽之泉 | 传说 | 订单重置冷却 | 特殊机制 |

### 设计理由

- **伴生之种（稀有）**：15% 概率较低，但附属类型增加了元素多样性，与多元素流派形成联动，适合稀有度
- **点金之手（史诗）**：金币系统是商店关的经济基础，高等级合成收益显著，适合史诗稀有度
- **超级幸运（史诗）**：25% 概率高于变异孢子的 20%，但两者叠加不翻倍（只生效一次），鼓励玩家收集两个祝福但收益递减

---

## 附录：附属类型映射完整表

| 主类型 | 附属类型 | 哲学寓意 |
|--------|---------|---------|
| 🔥 火焰 | 🌪 微风 | 火借风势，风助火威 |
| 💧 水滴 | 🌿 植物 | 水润万物，滋养生命 |
| 🪨 土块 | 🔥 火焰 | 地火交融，岩浆涌动 |
| 🌪 微风 | 💧 水滴 | 风云际会，化雨而降 |
| 🌿 植物 | 🪨 土块 | 落叶归根，化为沃土 |
| ⚪ 无属性 | 随机已解锁属性 | 混沌初开，万物衍生 |
