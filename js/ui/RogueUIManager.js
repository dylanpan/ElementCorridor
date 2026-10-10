/**
 * ============================================================
 * 肉鸽模式专属 UI 管理器
 * 负责路线选择、祝福三选一、事件弹窗、商店界面等。
 * 这是唯一耦合 DOM 的肉鸽模块，迁移 Godot 时需重写。
 * ============================================================
 */
class RogueUIManager {
  constructor() {
    this.container = null;
    this.rogueSystem = null;
    this.boonSystem = null;
    this.eventSystem = null;
    this.gameEngine = null;
    this._overlayStack = [];
    this._visible = false;
  }

  /** 初始化 */
  init(rogueSystem, boonSystem, eventSystem, gameEngine) {
    this.rogueSystem = rogueSystem;
    this.boonSystem = boonSystem;
    this.eventSystem = eventSystem;
    this.gameEngine = gameEngine;

    this._createContainer();
    this._registerEvents();
  }

  /** 创建容器 */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'rogue-ui-container';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 900;
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(this.container);
  }

  /** 注册事件监听 */
  _registerEvents() {
    window.eventBus.on('rogue:show-boon-select', (data) => this.showBoonSelection(data));
    window.eventBus.on('rogue:show-event', (data) => this.showEventDialog(data));
    window.eventBus.on('rogue:show-shop', () => this.showShop());
    window.eventBus.on('rogue:show-floor-map', (data) => this.showFloorMap(data));
    window.eventBus.on('rogue:run-ended', (data) => this.showRunResult(data));
    window.eventBus.on('rogue:hide-all', () => this.hideAll());
  }

  /** 显示覆盖层 */
  _showOverlay(element) {
    this._overlayStack.push(element);
    this.container.appendChild(element);
    this._visible = true;
  }

  /** 关闭最上层 */
  closeTopOverlay() {
    if (this._overlayStack.length === 0) return;
    const el = this._overlayStack.pop();
    if (el.parentNode) el.parentNode.removeChild(el);
    this._visible = this._overlayStack.length > 0;
  }

  /** 关闭所有 */
  hideAll() {
    while (this._overlayStack.length > 0) {
      const el = this._overlayStack.pop();
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this._visible = false;
  }

  /** 是否正在显示弹窗 */
  isVisible() { return this._visible; }

  // ==================== 祝福三选一 ====================

  /**
   * 显示祝福三选一界面
   * @param {object} data - { boons: [], onPick: function, title: string }
   */
  showBoonSelection(data) {
    const overlay = this._createOverlay();

    const card = document.createElement('div');
    card.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-radius: 16px; padding: 30px; max-width: 700px; width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    card.innerHTML = `
      <h2 style="color:#ffd700; margin:0 0 8px; font-size:22px;">${data.title || '选择祝福'}</h2>
      <p style="color:#aaa; margin:0 0 20px; font-size:14px;">选择一个祝福来强化你的能力</p>
      <div id="boon-cards" style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;"></div>
    `;

    const cardsContainer = card.querySelector('#boon-cards');

    data.boons.forEach((boon, index) => {
      const rarityColors = { common: '#9e9e9e', rare: '#2196f3', epic: '#9c27b0', legendary: '#ff9800' };
      const rarityLabels = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
      const color = rarityColors[boon.rarity] || '#9e9e9e';

      const boonCard = document.createElement('div');
      boonCard.style.cssText = `
        background: rgba(255,255,255,0.05); border: 2px solid ${color};
        border-radius: 12px; padding: 18px 15px; width: 180px; cursor: pointer;
        transition: all 0.3s ease; position: relative;
      `;
      boonCard.onmouseenter = () => { boonCard.style.transform = 'translateY(-5px)'; boonCard.style.boxShadow = `0 8px 25px ${color}44`; };
      boonCard.onmouseleave = () => { boonCard.style.transform = ''; boonCard.style.boxShadow = ''; };

      boonCard.innerHTML = `
        <div style="font-size:36px; margin-bottom:8px;">${boon.icon}</div>
        <span style="position:absolute;top:8px;right:8px;background:${color};color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;">${rarityLabels[boon.rarity]}</span>
        <div style="color:#fff; font-size:16px; font-weight:bold; margin-bottom:6px;">${boon.name}</div>
        <div style="color:#ccc; font-size:13px; line-height:1.4; min-height:40px;">${boon.description}</div>
        <div style="color:#888; font-size:11px; margin-top:8px; font-style:italic;">"${boon.flavor}"</div>
      `;

      boonCard.onclick = () => {
        const idx = index;
        // 先关闭当前祝福选择弹窗，再异步执行回调
        this.closeTopOverlay();
        if (data.onPick) setTimeout(() => data.onPick(idx), 150);
      };

      cardsContainer.appendChild(boonCard);
    });

    overlay.appendChild(card);
    this._showOverlay(overlay);
  }

  // ==================== 事件弹窗 ====================

  /**
   * 显示随机事件
   */
  showEventDialog(data) {
    const overlay = this._createOverlay();
    const event = data.event;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #2d1b00 0%, #1a0f00 100%);
      border-radius: 16px; padding: 28px; max-width: 550px; width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center;
      border: 1px solid #ff980044;
    `;

    let optionsHtml = '';
    event.options.forEach((opt, i) => {
      optionsHtml += `
        <button class="event-option-btn" data-index="${i}" style="
          display:block; width:100%; margin:8px 0; padding:12px 16px;
          background:rgba(255,152,0,0.08); border:1px solid #ff980066;
          border-radius:10px; color:#fff; cursor:pointer; font-size:14px;
          transition:all 0.3s; text-align:left;
        " onmouseenter="this.style.background='rgba(255,152,0,0.2)'" onmouseleave="this.style.background='rgba(255,152,0,0.08)'">
          <span style="color:#ff9800;font-weight:bold;">选项${i+1}:</span> ${opt.text}
          <br><span style="color:#aaa;font-size:12px;">→ ${opt.result}</span>
        </button>
      `;
    });

    dialog.innerHTML = `
      <div style="font-size:40px; margin-bottom:8px;">❓</div>
      <h2 style="color:#ff9800; margin:0 0 6px; font-size:20px;">${event.title}</h2>
      <p style="color:#ccc; margin:0 0 20px; font-size:14px; line-height:1.5;">${event.description}</p>
      <div>${optionsHtml}</div>
    `;

    overlay.appendChild(dialog);
    this._showOverlay(overlay);

    // 绑定选项点击
    dialog.querySelectorAll('.event-option-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index);
        this.closeTopOverlay();
        if (data.onChoose) setTimeout(() => data.onChoose(idx), 150);
      };
    });
  }

  // ==================== 商店界面 ====================

  showShop() {
    const overlay = this._createOverlay();
    const gold = this.rogueSystem.getGold();

    const shopItems = this._generateShopItems();

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #1a2a1a 0%, #0d1f0d 100%);
      border-radius: 16px; padding: 24px; max-width: 600px; width: 92%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center;
      border: 1px solid #4caf5066;
    `;

    let itemsHtml = '';
    shopItems.forEach((item, i) => {
      itemsHtml += `
        <div class="shop-item" data-index="${i}" style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; margin:8px 0; background:rgba(76,175,80,0.06);
          border:1px solid ${item.canAfford ? '#4caf5066' : '#555'};
          border-radius:10px; cursor:${item.canAfford ? 'pointer' : 'not-allowed'};
          opacity:${item.canAfford ? 1 : 0.5}; transition:all 0.3s;
        ">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:28px;">${item.icon}</span>
            <div style="text-align:left;">
              <div style="color:#fff;font-weight:bold;">${item.name}</div>
              <div style="color:#aaa;font-size:12px;">${item.description}</div>
            </div>
          </div>
          <div style="color:#ffd700;font-weight:bold;white-space:nowrap;">🪙 ${item.price}</div>
        </div>
      `;
    });

    dialog.innerHTML = `
      <h2 style="color:#4caf50; margin:0 0 4px; font-size:20px;">🏪 商店</h2>
      <p style="color:#aaa; margin:0 0 16px; font-size:14px;">当前金币: <span style="color:#ffd700;font-weight:bold;">🪙 ${gold}</span></p>
      <div>${itemsHtml}</div>
      <button id="shop-leave-btn" style="
        margin-top:16px; padding:10px 32px; background:#666; color:#fff;
        border:none; border-radius:8px; cursor:pointer; font-size:14px;
      ">离开商店</button>
    `;

    overlay.appendChild(dialog);
    this._showOverlay(overlay);

    // 绑定购买
    dialog.querySelectorAll('.shop-item').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.index);
        const item = shopItems[idx];
        if (!item.canAfford) return;
        this.closeTopOverlay();
        if (item.onBuy) setTimeout(() => item.onBuy(), 150);
      };
    });

    dialog.querySelector('#shop-leave-btn').onclick = () => {
      this.closeTopOverlay();
      this._afterNodeComplete({ type: 'shop' });
    };
  }

  /** 生成商店商品列表 */
  _generateShopItems() {
    const gold = this.rogueSystem.getGold();
    const items = [];

    // 商品1: 随机祝福
    const boons = this.boonSystem.pickRandomBoons(1);
    if (boons.length > 0) {
      const price = boons[0].rarity === 'legendary' ? 120 :
                    boons[0].rarity === 'epic' ? 70 :
                    boons[0].rarity === 'rare' ? 35 : 20;
      items.push({
        icon: boons[0].icon,
        name: boons[0].name,
        description: `${boons[0].description} (${boons[0].rarity})`,
        price,
        canAfford: gold >= price,
        onBuy: () => {
          this.rogueSystem.spendGold(price);
          this.boonSystem.addBoon(boons[0]);
          this._afterNodeComplete({ type: 'shop', rewards: { gold: -price } });
        },
      });
    }

    // 商品2: 金币换积分
    items.push({
      icon: '💎',
      name: '积分注入',
      description: '消耗 30 金币获得 50 积分',
      price: 30,
      canAfford: gold >= 30,
      onBuy: () => {
        this.rogueSystem.spendGold(30);
        this.gameEngine.state.score += 50;
        window.eventBus.emit('score:updated', {
          score: this.gameEngine.state.score,
          targetScore: this.gameEngine.state.targetScore,
        });
        this._afterNodeComplete({ type: 'shop', rewards: { gold: -30 } });
      },
    });

    // 商品3: 清空棋盘
    items.push({
      icon: '🧹',
      name: '棋盘清理',
      description: '消耗 20 金币清空棋盘上所有元素',
      price: 20,
      canAfford: gold >= 20,
      onBuy: () => {
        this.rogueSystem.spendGold(20);
        this.gameEngine.clearBoard();
        this._afterNodeComplete({ type: 'shop', rewards: { gold: -20 } });
      },
    });

    return items;
  }

  // ==================== 路线选择 ====================

  showFloorMap(data) {
    const overlay = this._createOverlay();
    const { floor, nodes, isHistory } = data;
    // 判断是否正在战斗中（战斗中查看地图时只返回，不触发开始挑战）
    const isInBattle = !isHistory && this.gameEngine && this.gameEngine.state && this.gameEngine.state.isPlaying;

    const typeIcons = {
      combat: '⚔️', elite: '💀', boon: '✨', shop: '🏪',
      event: '❓', rest: '🏕️', boss: '👑',
    };
    const typeNames = {
      combat: '战斗', elite: '精英战', boon: '祝福', shop: '商店',
      event: '事件', rest: '休息', boss: 'Boss战',
    };

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px; padding: 24px; max-width: 500px; width: 88%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    let nodesHtml = '';
    nodes.forEach((node, i) => {
      const isCurrent = i === this.rogueSystem.state.currentNodeIndex;
      const isPast = i < this.rogueSystem.state.currentNodeIndex;
      nodesHtml += `
        <div style="
          display:inline-flex; flex-direction:column; align-items:center;
          margin:8px; padding:12px 16px;
          background:${isPast ? 'rgba(76,175,80,0.15)' : isCurrent ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)'};
          border:2px solid ${isPast ? '#4caf50' : isCurrent ? '#ffd700' : 'rgba(255,255,255,0.1)'};
          border-radius:12px; min-width:80px;
          opacity:${isPast ? 0.7 : 1};
        ">
          <span style="font-size:28px;">${typeIcons[node.type] || '⬜'}</span>
          <span style="color:#fff;font-size:13px;margin-top:4px;">${typeNames[node.type] || node.type}</span>
          ${node.bossId ? `<span style="color:#ff9800;font-size:11px;">${BOSS_CONFIGS.find(b=>b.id===node.bossId)?.name||''}</span>` : ''}
        </div>
      `;
    });

    dialog.innerHTML = `
      <h2 style="color:#ffd700; margin:0 0 4px; font-size:18px;">第 ${floor} 层 · 路线图</h2>
      <p style="color:#aaa; margin:0 0 16px; font-size:13px;">目标分数: ${this.rogueSystem.getTargetScore()} 分</p>
      <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px;">${nodesHtml}</div>
      <button id="floor-start-btn" style="
        margin-top:16px; padding:10px 48px; background:linear-gradient(135deg,#ffd700,#ff9800);
        color:#000; border:none; border-radius:8px; cursor:pointer; font-size:15px; font-weight:bold;
      ">${isHistory ? '返回' : isInBattle ? '返回' : '开始挑战'}</button>
    `;

    overlay.appendChild(dialog);
    this._showOverlay(overlay);

    dialog.querySelector('#floor-start-btn').onclick = () => {
      this.closeTopOverlay();
      if (!isHistory && !isInBattle) {
        this._startCurrentNode();
      }
      // 历史模式或战斗中查看地图时，点击"返回"只关闭弹窗
    };
  }

  /** 展示历史路线图列表（已通关的层） */
  showFloorHistory() {
    const history = this.rogueSystem.getFloorHistory();
    const overlay = this._createOverlay();

    const typeIcons = {
      combat: '⚔', elite: '💀', boon: '✨', shop: '🏪',
      event: '❓', rest: '🏕', boss: '👑',
    };

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px; max-width: 520px; width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
      display: flex; flex-direction: column; max-height: 75vh;
    `;

    // === 标题区（固定） ===
    const header = document.createElement('div');
    header.style.cssText = 'padding: 24px 24px 8px; flex-shrink: 0;';
    header.innerHTML = `<h2 style="color:#ffd700; margin:0; font-size:18px;">📜 历史路线</h2>`;

    // === 列表区（可滚动） ===
    const listArea = document.createElement('div');
    listArea.style.cssText = 'padding: 4px 18px 4px 22px; overflow-y: auto; flex: 1; min-height: 60px;';

    if (history.length === 0) {
      listArea.innerHTML = `<p style="color:#aaa; margin:20px 0;">还没有通关的层数记录</p>`;
    } else {
      let itemsHtml = `<p style="color:#aaa; margin:0 0 10px; font-size:13px;">点击某层查看完整路线图</p>`;
      history.forEach((floorData, idx) => {
        const floorNum = floorData.floor;
        const nodeCount = floorData.nodes.length;
        const icons = floorData.nodes.map(n => typeIcons[n.type] || '⬜').join(' ');
        itemsHtml += `
          <div class="history-floor-item" data-floor-idx="${idx}" style="
            background:rgba(255,255,255,0.05); border-radius:10px; padding:12px 14px; margin-bottom:8px;
            cursor:pointer; border:1px solid rgba(255,255,255,0.1);
            transition:background 0.2s; text-align:left;
          " onmouseover="this.style.background='rgba(76,175,80,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#ffd700;font-weight:bold;font-size:15px;">🏰 第 ${floorNum} 层</span>
              <span style="color:#888;font-size:11px;">${nodeCount} 个节点 · ${floorData.targetScore} 分</span>
            </div>
            <div style="margin-top:5px;font-size:18px;letter-spacing:3px;">${icons}</div>
          </div>
        `;
      });
      listArea.innerHTML = itemsHtml;
    }

    // === 底部按钮区（固定） ===
    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 8px 24px 20px; flex-shrink: 0;';
    footer.innerHTML = `<button id="history-close-btn" style="
      padding:8px 36px; background:rgba(255,255,255,0.08);
      color:#ccc; border:1px solid rgba(255,255,255,0.15); border-radius:8px;
      cursor:pointer; font-size:14px;
    ">关闭</button>`;

    dialog.appendChild(header);
    dialog.appendChild(listArea);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    this._showOverlay(overlay);

    // 绑定历史层点击事件
    history.forEach((floorData, idx) => {
      const item = listArea.querySelector(`[data-floor-idx="${idx}"]`);
      if (item) {
        item.onclick = () => {
          this.closeTopOverlay();
          setTimeout(() => {
            this.showFloorMap({
              floor: floorData.floor,
              nodes: floorData.nodes,
              targetScore: floorData.targetScore,
              isHistory: true,
            });
          }, 150);
        };
      }
    });

    dialog.querySelector('#history-close-btn').onclick = () => this.closeTopOverlay();
  }

  /** 开始当前节点（公开方法，供外部调用） */
  startCurrentNode() {
    this._startCurrentNode();
  }

  /** 获取当前层路线图数据 */
  getFloorMapData() {
    return {
      floor: this.rogueSystem.getCurrentFloor(),
      nodes: this.rogueSystem.state.nodes,
    };
  }

  /** 开始当前节点 */
  _startCurrentNode() {
    const node = this.rogueSystem.getCurrentNode();
    if (!node) return;

    switch (node.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        this.gameEngine.startRogueLevel(this.rogueSystem.getTargetScore(), node);
        break;
      case 'boon': {
        const count = (this.metaProgress && this.metaProgress.isTalentUnlocked('choose_from_4')) ? 4 : 3;
        const boons = this.boonSystem.pickRandomBoons(count);
        if (boons.length > 0) {
          window.eventBus.emit('rogue:show-boon-select', {
            boons,
            title: '✨ 祝福之选',
            onPick: (idx) => {
              this.boonSystem.addBoon(boons[idx]);
              if (this.metaProgress) this.metaProgress.recordBoon(boons[idx].id);
              this._afterNodeComplete({ type: 'boon', rewards: { boon: boons[idx] } });
            },
          });
        } else {
          this._afterNodeComplete({ type: 'boon' });
        }
        break;
      }
      case 'event': {
        const evt = this.eventSystem.getEventForFloor(this.rogueSystem.getCurrentFloor());
        if (evt) {
          window.eventBus.emit('rogue:show-event', {
            event: evt,
            onChoose: (optionIdx) => {
              const context = {
                rogueSystem: this.rogueSystem,
                boonSystem: this.boonSystem,
                gameEngine: this.gameEngine,
              };
              const result = this.eventSystem.executeOption(evt, optionIdx, context);
              if (this.metaProgress) this.metaProgress.recordEvent(evt.id);
              this._showEventResult(result.message);
              this._afterNodeComplete({ type: 'event', result });
            },
          });
        } else {
          this._afterNodeComplete({ type: 'event' });
        }
        break;
      }
      case 'rest': {
        // 休息关：清空棋盘
        this.gameEngine.clearBoard();
        this._showToast('🏕️ 休息完毕，棋盘已清空！');
        this._afterNodeComplete({ type: 'rest' });
        break;
      }
      case 'shop':
        window.eventBus.emit('rogue:show-shop');
        break;
      default:
        this._afterNodeComplete({ type: node.type });
    }
  }

  /** 节点完成后的处理 */
  _afterNodeComplete(result) {
    this.rogueSystem.completeNode(result);

    // 检查是否还有下一个节点
    const hasNext = this.rogueSystem.advanceToNextNode();
    if (!hasNext) {
      // 本层结束，进入下一层
      this.rogueSystem.nextFloor();
      if (this.rogueSystem.state.runState === 'won') return; // 通关了

      // 显示下一层地图
      setTimeout(() => {
        window.eventBus.emit('rogue:show-floor-map', {
          floor: this.rogueSystem.getCurrentFloor(),
          nodes: this.rogueSystem.state.nodes,
        });
      }, 300);
    } else {
      // 继续当前层的下一个节点
      setTimeout(() => this._startCurrentNode(), 200);
    }
  }

  /** 显示事件结果 */
  _showEventResult(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.85); color:#fff; padding:20px 30px;
      border-radius:12px; z-index:999; font-size:15px; text-align:center;
      max-width:400px; border:1px solid #ff980066;
      animation:fadeInOut 2s forwards;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2500);
  }

  /** 显示简短提示 */
  _showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed; bottom:30%; left:50%; transform:translateX(-50%);
      background:rgba(0,0,0,0.85); color:#fff; padding:12px 24px;
      border-radius:10px; z-index:999; font-size:14px;
      animation:fadeInOut 2s forwards;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2200);
  }

  // ==================== 结算界面 ====================

  showRunResult(data) {
    const overlay = this._createOverlay();
    const { won, state } = data;
    const floorReached = state.currentFloor;
    const boonsCount = state.boons.length;

    // 计算星尘奖励
    let stardustReward = 0;
    if (this.metaProgress) {
      stardustReward = this.metaProgress.calculateStardustReward(floorReached, won, boonsCount);
      this.metaProgress.addStardust(stardustReward);
      this.metaProgress.recordRun(won, floorReached, this.gameEngine ? this.gameEngine.state.score : 0);
    }

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, ${won ? '#1a2a1a' : '#2a1a1a'} 0%, ${won ? '#0d1f0d' : '#1f0d0d'} 100%);
      border-radius: 16px; padding: 30px; max-width: 450px; width: 88%;
      box-shadow: 0 10px 60px rgba(0,0,0,0.7); text-align: center;
      border: 2px solid ${won ? '#ffd700' : '#f44336'};
    `;

    dialog.innerHTML = `
      <div style="font-size:60px; margin-bottom:10px;">${won ? '🏆' : '💀'}</div>
      <h2 style="color:${won ? '#ffd700' : '#f44336'}; margin:0 0 16px; font-size:24px;">
        ${won ? '恭喜通关！' : '冒险结束'}
      </h2>
      <div style="text-align:left; display:inline-block; color:#ccc; font-size:14px; line-height:2;">
        <div>📊 到达层数: <strong style="color:#fff;">第 ${Math.min(floorReached, FLOOR_GENERATOR.maxFloor)} 层</strong></div>
        <div>🎯 最终得分: <strong style="color:#fff;">${this.gameEngine ? this.gameEngine.state.score : 0}</strong></div>
        <div>🔮 收集祝福: <strong style="color:#fff;">${boonsCount} 个</strong></div>
        <div>✨ 获得星尘: <strong style="color:#ffd700;">+${stardustReward}</strong></div>
      </div>
      <div style="margin-top:20px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        <button id="result-back-btn" style="
          padding:10px 32px; background:#666; color:#fff;
          border:none; border-radius:8px; cursor:pointer; font-size:14px;
        ">返回主菜单</button>
        <button id="result-retry-btn" style="
          padding:10px 32px; background:linear-gradient(135deg,#ffd700,#ff9800);
          color:#000; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:bold;
        ">再来一局</button>
      </div>
    `;

    overlay.appendChild(dialog);
    this._showOverlay(overlay);

    dialog.querySelector('#result-back-btn').onclick = () => {
      this.hideAll();
      window.eventBus.emit('rogue:return-to-menu');
    };

    dialog.querySelector('#result-retry-btn').onclick = () => {
      this.hideAll();
      window.eventBus.emit('rogue:start-new-run');
    };
  }

  // ==================== 初始祝福选择 ====================

  showInitialBoonSelect(onComplete) {
    const count = (this.metaProgress && this.metaProgress.isTalentUnlocked('choose_from_4')) ? 4 : 3;
    const boons = this.boonSystem.pickRandomBoons(count);

    window.eventBus.emit('rogue:show-boon-select', {
      boons,
      title: '🌟 选择初始祝福',
      onPick: (idx) => {
        this.boonSystem.addBoon(boons[idx]);
        if (this.metaProgress) this.metaProgress.recordBoon(boons[idx].id);
        if (onComplete) onComplete(boons[idx]);
      },
    });
  }

  // ==================== 工具方法 ====================

  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.65); display: flex; align-items: center;
      justify-content: center; z-index: 950; pointer-events: auto;
      backdrop-filter: blur(3px);
    `;
    return overlay;
  }
}

// 添加动画关键帧
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%,-50%) scale(0.9); }
    15% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
    75% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
  }
`;
document.head.appendChild(styleSheet);