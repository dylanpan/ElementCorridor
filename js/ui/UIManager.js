/**
 * ============================================================
 * UI管理器 —— 管理所有非棋盘的UI元素
 * 包括：积分显示、发射器按钮、订单面板、关卡信息、弹窗等。
 * 通过事件总线与核心逻辑通信。
 * ============================================================
 */
class UIManager {
  constructor() {
    this.elements = {};
    this.emitterButtons = [];
    this.orderCards = [];
  }

  /**
   * 初始化UI
   */
  init() {
    this._cacheElements();
    this._setupEventListeners();
  }

  /** 缓存常用DOM元素 */
  _cacheElements() {
    const ids = [
      'score-display', 'target-score', 'level-title',
      'level-description', 'combo-display', 'orders-panel',
      'emitters-panel', 'game-overlay', 'game-modal',
      'modal-title', 'modal-body', 'modal-btn',
      'new-game-btn', 'save-btn', 'load-btn',
      'refresh-orders-btn', 'current-level',
    ];
    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  /** 注册事件监听 */
  _setupEventListeners() {
    window.eventBus.on('score:updated', (data) => {
      this.updateScore(data.score, data.targetScore);
    });

    window.eventBus.on('combo:updated', (data) => {
      this.updateCombo(data.count, data.multiplier);
    });

    window.eventBus.on('orders:updated', (orders) => {
      this.renderOrders(orders);
    });

    window.eventBus.on('emitters:updated', (emitters) => {
      this.updateEmitters(emitters);
    });

    window.eventBus.on('level:loaded', (levelConfig) => {
      this.updateLevelInfo(levelConfig);
    });

    window.eventBus.on('game:over', (data) => {
      this.showModal('🎉 恭喜通关！', `你成功完成了第 ${data.level} 关！<br>最终得分：${data.score}`);
    });

    window.eventBus.on('game:failed', (data) => {
      this.showModal('😅 棋盘已满', '棋盘上没有空位了，试试重新开始吧！');
    });

    window.eventBus.on('notification', (data) => {
      this.showNotification(data.message, data.type);
    });
  }

  /**
   * 创建发射器按钮
   * @param {Array<Emitter>} emitters - 发射器实例列表
   * @param {Function} onClick - 点击回调
   */
  createEmitterButtons(emitters, onClick) {
    const panel = this.elements['emitters-panel'];
    if (!panel) return;

    panel.innerHTML = '';
    this.emitterButtons = [];

    for (const emitter of emitters) {
      const btn = document.createElement('button');
      btn.className = 'emitter-btn';
      btn.dataset.emitterId = emitter.id;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'emitter-icon';
      iconSpan.textContent = emitter.icon;
      btn.appendChild(iconSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'emitter-name';
      nameSpan.textContent = emitter.name;
      btn.appendChild(nameSpan);

      const cooldownBar = document.createElement('div');
      cooldownBar.className = 'cooldown-bar';
      cooldownBar.innerHTML = '<div class="cooldown-fill"></div>';
      btn.appendChild(cooldownBar);

      btn.addEventListener('click', () => {
        if (onClick) onClick(emitter.id);
      });

      panel.appendChild(btn);
      this.emitterButtons.push({
        element: btn,
        emitterId: emitter.id,
        cooldownFill: btn.querySelector('.cooldown-fill'),
      });
    }
  }

  /**
   * 更新发射器冷却状态
   */
  updateEmitters(emitters) {
    const now = Date.now();
    for (const btnData of this.emitterButtons) {
      const emitter = emitters.find((e) => e.id === btnData.emitterId);
      if (!emitter) continue;

      const progress = emitter.getCooldownProgress(now);
      btnData.cooldownFill.style.width = `${progress * 100}%`;

      if (progress >= 1) {
        btnData.element.classList.remove('on-cooldown');
        btnData.element.disabled = false;
      } else {
        btnData.element.classList.add('on-cooldown');
        btnData.element.disabled = true;
      }
    }
  }

  /**
   * 渲染订单卡片
   */
  renderOrders(orders) {
    const panel = this.elements['orders-panel'];
    if (!panel) return;

    panel.innerHTML = '';
    this.orderCards = [];

    if (orders.length === 0) {
      panel.innerHTML = '<div class="no-orders">暂无订单</div>';
      return;
    }

    for (const order of orders) {
      const typeConfig = ELEMENT_TYPES[order.elementType];
      const levelConfig = ELEMENT_LEVELS[order.level - 1];

      const card = document.createElement('div');
      card.className = `order-card order-${order.difficulty}`;
      card.dataset.orderId = order.id;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'order-icon';
      iconSpan.textContent = typeConfig?.icon || '❓';
      card.appendChild(iconSpan);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'order-info';

      const nameP = document.createElement('div');
      nameP.className = 'order-name';
      nameP.textContent = `${typeConfig?.name || '未知'} Lv.${order.level}`;
      infoDiv.appendChild(nameP);

      const rewardP = document.createElement('div');
      rewardP.className = 'order-reward';
      rewardP.textContent = `+${order.reward}分`;
      infoDiv.appendChild(rewardP);

      card.appendChild(infoDiv);

      const diffSpan = document.createElement('span');
      diffSpan.className = 'order-difficulty';
      const diffLabels = { easy: '简单', medium: '普通', hard: '困难', rare: '稀有' };
      diffSpan.textContent = diffLabels[order.difficulty] || order.difficulty;
      card.appendChild(diffSpan);

      card.addEventListener('click', () => {
        window.eventBus.emit('ui:order-clicked', order.id);
      });

      panel.appendChild(card);
      this.orderCards.push(card);
    }
  }

  /**
   * 更新积分显示
   */
  updateScore(score, targetScore) {
    const scoreEl = this.elements['score-display'];
    const targetEl = this.elements['target-score'];
    if (scoreEl) scoreEl.textContent = score;
    if (targetEl) targetEl.textContent = targetScore;
  }

  /**
   * 更新连击显示
   */
  updateCombo(count, multiplier) {
    const comboEl = this.elements['combo-display'];
    if (!comboEl) return;

    if (count > 1) {
      comboEl.textContent = `🔥 ${count}连击 x${multiplier.toFixed(1)}`;
      comboEl.classList.add('active');
    } else {
      comboEl.textContent = '';
      comboEl.classList.remove('active');
    }
  }

  /**
   * 更新关卡信息
   */
  updateLevelInfo(levelConfig) {
    const titleEl = this.elements['level-title'];
    const descEl = this.elements['level-description'];
    const levelEl = this.elements['current-level'];
    if (titleEl) titleEl.textContent = `第${levelConfig.level}关 · ${levelConfig.title}`;
    if (descEl) descEl.textContent = levelConfig.description;
    if (levelEl) levelEl.textContent = `第 ${levelConfig.level} 关`;
  }

  /**
   * 显示弹窗
   */
  showModal(title, bodyHtml) {
    const overlay = this.elements['game-overlay'];
    const modalTitle = this.elements['modal-title'];
    const modalBody = this.elements['modal-body'];

    if (overlay) overlay.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = bodyHtml;
  }

  /** 隐藏弹窗 */
  hideModal() {
    const overlay = this.elements['game-overlay'];
    if (overlay) overlay.style.display = 'none';
  }

  /**
   * 显示短暂通知
   */
  showNotification(message, type = 'info') {
    let notif = document.getElementById('notification-toast');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'notification-toast';
      notif.className = 'notification-toast';
      document.body.appendChild(notif);
    }

    notif.textContent = message;
    notif.className = `notification-toast ${type}`;
    notif.classList.add('show');

    setTimeout(() => {
      notif.classList.remove('show');
    }, 2000);
  }

  /** 设置模态框按钮回调 */
  setModalButtonCallback(callback) {
    const btn = this.elements['modal-btn'];
    if (btn) {
      btn.onclick = () => {
        this.hideModal();
        if (callback) callback();
      };
    }
  }
}