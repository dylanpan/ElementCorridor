/**
 * ============================================================
 * 事件系统 —— 管理肉鸽模式中的随机事件
 * 根据当前层数从事件池中选取合适的事件，处理事件结果。
 * ============================================================
 */
class EventSystem {
  constructor() {
    this._usedEvents = new Set();
    this._eventHistory = [];
  }

  /** 重置 */
  reset() {
    this._usedEvents.clear();
    this._eventHistory = [];
  }

  /**
   * 根据层数获取一个随机事件
   * @param {number} floor - 当前层数
   * @returns {object|null} 事件对象
   */
  getEventForFloor(floor) {
    let pool;
    if (floor <= 4) pool = EVENT_POOL.early;
    else if (floor <= 9) pool = EVENT_POOL.mid;
    else pool = EVENT_POOL.late;

    const available = pool.filter(e => !this._usedEvents.has(e.id));
    if (available.length === 0) {
      // 如果该分段事件都用完了，回退到全部分段
      const allAvailable = Object.values(EVENT_POOL)
        .flat()
        .filter(e => !this._usedEvents.has(e.id));
      if (allAvailable.length === 0) return null;
      const evt = allAvailable[Math.floor(Math.random() * allAvailable.length)];
      this._usedEvents.add(evt.id);
      return evt;
    }

    const evt = available[Math.floor(Math.random() * available.length)];
    this._usedEvents.add(evt.id);
    return evt;
  }

  /**
   * 执行事件选项的效果
   * @param {object} event - 事件对象
   * @param {number} optionIndex - 选择的选项索引 (0 或 1)
   * @param {object} context - 游戏上下文 { rogueSystem, boonSystem, gameEngine }
   * @returns {object} 执行结果描述
   */
  executeOption(event, optionIndex, context) {
    const option = event.options[optionIndex];
    if (!option) return { message: '无效的选择', success: false };

    const { rogueSystem, boonSystem, gameEngine } = context;
    const result = { message: '', rewards: [], success: true };

    switch (option.effect) {
      case 'boon_rare': {
        const boons = boonSystem.pickRandomBoons(1, 'rare');
        if (boons.length > 0) {
          boonSystem.addBoon(boons[0]);
          result.message = `获得稀有祝福：${boons[0].icon} ${boons[0].name}`;
          result.rewards.push({ type: 'boon', data: boons[0] });
        }
        break;
      }
      case 'nothing':
        result.message = '你继续前行，什么都没有发生。';
        break;

      case 'lose_highest': {
        const board = gameEngine.state.board;
        let highest = null;
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            const el = board[r][c];
            if (el && (!highest || el.level > highest.level)) {
              highest = { element: el, row: r, col: c };
            }
          }
        }
        if (highest) {
          gameEngine.systems.spawn.removeElement(board, highest.element);
          gameEngine.boardRenderer.updateCell(board, highest.row, highest.col);
          result.message = `失去了 ${highest.element.icon} Lv.${highest.element.level} ${highest.element.name}`;
        } else {
          result.message = '棋盘上没有元素可损失，幸运地躲过一劫！';
        }
        break;
      }

      case 'storm_boost': {
        const board = gameEngine.state.board;
        let removedCount = 0;
        // 移除最后3个非空格子
        for (let r = board.length - 1; r >= 0 && removedCount < 3; r--) {
          for (let c = board[r].length - 1; c >= 0 && removedCount < 3; c--) {
            if (board[r][c]) {
              gameEngine.systems.spawn.removeElement(board, board[r][c]);
              gameEngine.boardRenderer.updateCell(board, r, c);
              removedCount++;
            }
          }
        }
        // 所有剩余元素等级+1
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[r].length; c++) {
            const el = board[r][c];
            if (el && el.level < ELEMENT_LEVELS.length) {
              el.level += 1;
              const lc = ELEMENT_LEVELS[el.level - 1];
              el.scoreValue = lc.scoreValue;
              el.levelLabel = lc.label;
              gameEngine.boardRenderer.updateCell(board, r, c);
            }
          }
        }
        result.message = `损失了 ${removedCount} 个格子，但所有剩余元素等级 +1！`;
        break;
      }

      case 'trade_score_legendary': {
        const cost = Math.floor(gameEngine.state.score * 0.5);
        gameEngine.state.score -= cost;
        const boons = boonSystem.pickRandomBoons(1, 'legendary');
        if (boons.length > 0) {
          boonSystem.addBoon(boons[0]);
          result.message = `消耗了 ${cost} 积分，获得传说祝福：${boons[0].icon} ${boons[0].name}`;
          result.rewards.push({ type: 'boon', data: boons[0] });
        }
        window.eventBus.emit('score:updated', {
          score: gameEngine.state.score,
          targetScore: gameEngine.state.targetScore,
        });
        break;
      }

      case 'trade_boons': {
        if (boonSystem.boons.length < 2) {
          result.message = '你没有足够的祝福进行交换……';
          result.success = false;
          break;
        }
        // 移除最后两个祝福
        boonSystem.boons.splice(boonSystem.boons.length - 2, 2);
        const newBoons = boonSystem.pickRandomBoons(2);
        for (const b of newBoons) boonSystem.addBoon(b);
        result.message = `用两个祝福换来了：${newBoons.map(b => b.icon + b.name).join('、')}`;
        break;
      }

      case 'sacrifice_boon': {
        if (boonSystem.boons.length < 1) {
          result.message = '你没有祝福可以献祭……';
          result.success = false;
          break;
        }
        boonSystem.boons.pop();
        const newBoons = boonSystem.pickRandomBoons(2);
        for (const b of newBoons) boonSystem.addBoon(b);
        result.message = `献祭了一个祝福，获得了两个新的：${newBoons.map(b => b.icon + b.name).join('、')}`;
        break;
      }

      case 'sacrifice_score': {
        const cost = Math.floor(gameEngine.state.score * 0.5);
        gameEngine.state.score -= cost;
        const boons = boonSystem.pickRandomBoons(1, 'epic');
        if (boons.length > 0) {
          boonSystem.addBoon(boons[0]);
          result.message = `消耗了 ${cost} 积分，获得史诗祝福：${boons[0].icon} ${boons[0].name}`;
        }
        window.eventBus.emit('score:updated', {
          score: gameEngine.state.score,
          targetScore: gameEngine.state.targetScore,
        });
        break;
      }

      case 'skip_floor':
        rogueSystem.skipToNextFloor();
        result.message = '你穿越了时空裂隙，直接进入了下一层！';
        break;

      case 'explore_rift': {
        const boons = boonSystem.pickRandomBoons(1);
        if (boons.length > 0) {
          boonSystem.addBoon(boons[0]);
          result.message = `探索裂隙获得了 ${boons[0].icon} ${boons[0].name}，但下一关将更加艰难！`;
          result.rewards.push({ type: 'boon', data: boons[0] });
        }
        rogueSystem.nextDifficultyBoost = 1.3;
        break;
      }

      case 'trial_legendary': {
        // 简化处理：直接给予传说祝福
        const boons = boonSystem.pickRandomBoons(1, 'legendary');
        if (boons.length > 0) {
          boonSystem.addBoon(boons[0]);
          result.message = `你成功通过了精灵的考验！获得传说祝福：${boons[0].icon} ${boons[0].name}`;
          result.rewards.push({ type: 'boon', data: boons[0] });
        }
        break;
      }

      case 'polite_refuse':
        result.message = '精灵微笑着离开了，留下了一个普通的祝福作为礼物。';
        const commonBoons = boonSystem.pickRandomBoons(1, 'common');
        if (commonBoons.length > 0) {
          boonSystem.addBoon(commonBoons[0]);
          result.rewards.push({ type: 'boon', data: commonBoons[0] });
        }
        break;

      case 'dark_bargain': {
        const legendaries = boonSystem.pickRandomBoons(2, 'legendary');
        for (const b of legendaries) boonSystem.addBoon(b);
        const curse = boonSystem.pickRandomCurse();
        boonSystem.addCurse(curse);
        result.message = `获得了两个传说祝福，但也被施加了诅咒：${curse.icon} ${curse.name}`;
        result.rewards.push({ type: 'curse', data: curse });
        break;
      }

      case 'resist': {
        const rareBoons = boonSystem.pickRandomBoons(1, 'rare');
        if (rareBoons.length > 0) {
          boonSystem.addBoon(rareBoons[0]);
          result.message = `你抵抗住了诱惑，获得稀有祝福：${rareBoons[0].icon} ${rareBoons[0].name}`;
        }
        break;
      }

      case 'reforge_boons': {
        // 随机改变所有祝福的稀有度
        for (let i = 0; i < boonSystem.boons.length; i++) {
          const rarities = ['common', 'rare', 'epic', 'legendary'];
          const newRarity = rarities[Math.floor(Math.random() * rarities.length)];
          // 找同ID不同稀有度的祝福替换
          const replacement = BOON_POOL.find(
            b => b.category === boonSystem.boons[i].category && b.rarity === newRarity
          );
          if (replacement) {
            boonSystem.boons[i] = { ...replacement };
          }
        }
        result.message = '所有祝福被混沌熔炉重塑，稀有度发生了变化！';
        break;
      }

      case 'chaos_power': {
        const emitters = gameEngine.state.emitters;
        emitters.forEach(e => { e.modifiers.cooldownMultiplier *= 0.5; });
        // 订单积分减半通过一个临时标记实现
        rogueSystem.orderPenalty = 0.5;
        result.message = '发射器速度翻倍，但订单积分减半！';
        break;
      }

      default:
        result.message = '你做出了选择，继续前进……';
    }

    this._eventHistory.push({
      eventId: event.id,
      chosenOption: optionIndex,
      result: result.message,
    });

    return result;
  }

  /** 获取事件历史 */
  getHistory() {
    return [...this._eventHistory];
  }

  /** 序列化 */
  serialize() {
    return {
      usedEvents: [...this._usedEvents],
      history: this._eventHistory,
    };
  }

  /** 反序列化 */
  deserialize(data) {
    this._usedEvents = new Set(data.usedEvents || []);
    this._eventHistory = data.history || [];
  }
}