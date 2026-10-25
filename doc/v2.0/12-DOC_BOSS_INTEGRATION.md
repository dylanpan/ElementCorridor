# Boss 战整合（生存模式）—— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

将现有的五个 Boss 机制（熔岩巨像、冰霜女巫、混沌之核、时间吞噬者、创世之灵）整合到生存模式中，作为阶段性挑战事件——每存活一定时间触发一波 Boss 攻击，考验玩家的应变能力。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **触发时机** | 每存活 60 秒触发一波 Boss 攻击 |
| **Boss 顺序** | 熔岩巨像 → 冰霜女巫 → 混沌之核 → 时间吞噬者 → 创世之灵 → 循环 |
| **攻击持续** | 每波持续 15 秒 |
| **攻击强度** | 每轮循环 Boss 攻击强度 +20%（时间更长/效果更强） |
| **叠加规则** | 同一时间只会有一个 Boss 攻击生效 |

### 1.3 Boss 攻击效果（生存模式版）

| Boss | 攻击效果 | 持续 | 应对策略 |
|---|---|---|---|
| **熔岩巨像** | 随机 2 个格子被灼烧（不可放置/合成），灼烧蔓延 | 15 秒 | 尽快合成灭火 |
| **冰霜女巫** | 随机 1 行被冻结（元素不可操作） | 15 秒 | 在其他行运营 |
| **混沌之核** | 随机 3 个元素改变等级（±1） | 15 秒 | 重新规划合成路径 |
| **时间吞噬者** | 所有订单倒计时加速 50% | 15 秒 | 使用时间停滞道具 |
| **创世之灵** | 随机封印 1 个发射器（不可用） | 15 秒 | 使用元素风暴恢复 |

### 1.4 设计意图

- **内容复用**：充分利用已有的 Boss 机制，减少开发成本
- **节奏变化**：每 60 秒的 Boss 攻击打破常规运营节奏
- **熟悉感**：玩家在肉鸽模式中已熟悉各 Boss 机制，生存模式中面对时更有策略感

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/core/GameEngine.js` —— Boss 攻击触发与效果应用
- `js/ui/UIManager.js` —— Boss 攻击预警与横幅

### 2.2 Boss 攻击配置

```javascript
// 在 GameEngine 中
static SURVIVAL_BOSSES = [
  {
    id: 'boss_lava_giant',
    name: '熔岩巨像',
    icon: '🌋',
    apply: (engine) => {
      // 灼烧 2 个随机空格
      const emptyCells = [];
      for (let r = 0; r < engine.state.board.length; r++) {
        for (let c = 0; c < engine.state.board[r].length; c++) {
          if (!engine.state.board[r][c]) {
            emptyCells.push({ row: r, col: c });
          }
        }
      }
      const targets = emptyCells.sort(() => Math.random() - 0.5).slice(0, 2);
      for (const cell of targets) {
        engine._bossState.scorchedCells.push({
          row: cell.row, col: cell.col,
          burnUntil: Date.now() + 15000,
        });
      }
      engine.boardRenderer.refreshScorchedCells(engine._bossState.scorchedCells);
    },
    revert: (engine) => {
      engine._bossState.scorchedCells = [];
      engine.boardRenderer.refreshScorchedCells([]);
    },
  },
  {
    id: 'boss_ice_witch',
    name: '冰霜女巫',
    icon: '❄',
    apply: (engine) => {
      // 冻结随机 1 行
      const row = Math.floor(Math.random() * engine.state.board.length);
      engine._bossState.frozenRows.add(row);
      engine.boardRenderer.refreshFrozenRows(engine._bossState.frozenRows);
    },
    revert: (engine) => {
      engine._bossState.frozenRows.clear();
      engine.boardRenderer.refreshFrozenRows(new Set());
    },
  },
  {
    id: 'boss_chaos_core',
    name: '混沌之核',
    icon: '❓',
    apply: (engine) => {
      // 随机改变 3 个元素等级
      const elements = [];
      for (let r = 0; r < engine.state.board.length; r++) {
        for (let c = 0; c < engine.state.board[r].length; c++) {
          const el = engine.state.board[r][c];
          if (el && !el._blocked) elements.push({ row: r, col: c, el });
        }
      }
      const targets = elements.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const t of targets) {
        t.el.level = Math.max(1, t.el.level + (Math.random() > 0.5 ? 1 : -1));
      }
      engine.boardRenderer.renderAll(engine.state.board);
    },
    revert: () => {},
  },
  {
    id: 'boss_time_devourer',
    name: '时间吞噬者',
    icon: '⏳',
    apply: (engine) => {
      // 订单倒计时加速 50%
      engine._bossState.timeAcceleration = 1.5;
    },
    revert: (engine) => {
      engine._bossState.timeAcceleration = 1;
    },
  },
  {
    id: 'boss_creation_spirit',
    name: '创世之灵',
    icon: '✨',
    apply: (engine) => {
      // 随机封印 1 个发射器
      const emitters = engine.state.emitters.filter(e => !e._sealed);
      if (emitters.length > 0) {
        const target = emitters[Math.floor(Math.random() * emitters.length)];
        target._sealed = true;
        engine._bossState.sealedEmitterId = target.id;
        window.eventBus.emit('emitters:updated', engine.state.emitters);
      }
    },
    revert: (engine) => {
      if (engine._bossState.sealedEmitterId) {
        const emitter = engine.state.emitters.find(
          e => e.id === engine._bossState.sealedEmitterId
        );
        if (emitter) emitter._sealed = false;
        engine._bossState.sealedEmitterId = null;
        window.eventBus.emit('emitters:updated', engine.state.emitters);
      }
    },
  },
];

/**
 * 触发 Boss 攻击波
 */
_triggerSurvivalBossWave() {
  const cycleIndex = this._survivalBossCycle % GameEngine.SURVIVAL_BOSSES.length;
  const bossDef = GameEngine.SURVIVAL_BOSSES[cycleIndex];
  const cycleNum = Math.floor(this._survivalBossCycle / GameEngine.SURVIVAL_BOSSES.length);

  this._survivalBossCycle++;
  this._activeBossAttack = {
    def: bossDef,
    endTime: Date.now() + 15000 + (cycleNum * 3000), // 每轮 +3 秒
    cycle: cycleNum,
  };

  // 应用效果
  bossDef.apply(this);

  // 发出事件
  window.eventBus.emit('boss-attack:started', {
    id: bossDef.id,
    name: bossDef.name,
    icon: bossDef.icon,
    duration: this._activeBossAttack.endTime - Date.now(),
    cycle: cycleNum,
  });
}
```
