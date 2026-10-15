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
    // 进度横幅阈值跟踪（避免重复触发）
    this._lastProgressPercent = 0;
    // 横幅队列系统：确保多个横幅依次显示，不冲突
    this._bannerQueue = [];
    this._isBannerShowing = false;
    // 怒气/大招系统状态
    this._rageValue = 0;
    this._ultimates = []; // 从 GameEngine 同步
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
      'level-description', 'orders-panel',
      'emitters-panel', 'game-overlay', 'game-modal',
      'modal-title', 'modal-body', 'modal-btn',
      'new-game-btn', 'save-btn', 'load-btn',
      'refresh-orders-btn', 'current-level',
      'board-combo-display', 'board-combo-count-text',
      'board-combo-multiplier-text',
    ];
    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  /** 注册事件监听 */
  _setupEventListeners() {
    window.eventBus.on('score:updated', (data) => {
      this.updateScore(data.score, data.targetScore);
      // 检查进度阈值，触发进度横幅
      this._checkProgressThreshold(data.score, data.targetScore);
    });

    window.eventBus.on('combo:updated', (data) => {
      this.updateCombo(data.count, data.multiplier);
    });

    window.eventBus.on('combo:break', () => {
      this._showComboBreak();
    });

    window.eventBus.on('order:submitted', (data) => {
      // 兼容两种格式：OrderSystem 格式 { reward, element, order } 和自定义格式 { orderId, reward }
      const orderId = data.orderId || (data.order && data.order.id);
      const reward = data.reward;
      if (orderId != null) {
        this.showBounceScore(orderId, reward);
      }
    });

    window.eventBus.on('emitter:clicked', (data) => {
      this._onEmitterClicked(data.emitterId);
    });

    window.eventBus.on('elements:fly-to-order', (data) => {
      this.playFlyToOrder(data.orderId, data.positions, data.elementIcon);
    });

    window.eventBus.on('combo:milestone', (data) => {
      this.showMilestoneEffect(data.milestone, data.isFirstTime);
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
      // 仅处理肉鸽模式的 game:over（由 RogueUIManager 接管）
      // 经典模式已由 rating:complete 事件通过评级面板处理
    });

    window.eventBus.on('game:failed', (data) => {
      // 肉鸽模式不显示经典失败弹窗，由肉鸽UI接管
      if (data && data.isRogue) return;
      this.showModal('😅 棋盘已满', '棋盘上没有空位了，试试重新开始吧！');
      this.setModalButtonCallback(() => {
        window.location.reload();
      });
    });

    window.eventBus.on('notification', (data) => {
      this.showNotification(data.message, data.type);
    });

    // === 波次系统事件 ===
    window.eventBus.on('wave:started', (data) => {
      this.showWaveBanner(data);
      this.updateWaveProgress(data);
    });
    window.eventBus.on('wave:completed', (data) => {
      this.showWaveCompletionEffect(data);
    });
    window.eventBus.on('wave:progress', (data) => {
      this.updateWaveProgress(data);
    });

    // === 紧急事件系统事件 ===
    window.eventBus.on('event:started', (data) => {
      this.showEventBanner(data);
      // 冻结事件：给发射器添加冰冻特效
      if (data.id === 'freeze') {
        this.applyFreezeEffect(true);
      }
      // 加速生产：给发射器添加加速特效
      if (data.id === 'speed_up') {
        this.applySpeedUpEffect(true);
      }
    });
    window.eventBus.on('event:ended', (data) => {
      this.hideEventBanner(data);
      // 冻结事件结束：移除冰冻特效
      if (data.id === 'freeze') {
        this.applyFreezeEffect(false);
      }
      // 加速生产结束：移除加速特效
      if (data.id === 'speed_up') {
        this.applySpeedUpEffect(false);
      }
      // 加急订单结束：添加消失动画
      if (data.id === 'order_rush') {
        this.removeRushOrderCards();
      }
    });
    window.eventBus.on('event:tick', (data) => {
      this.updateEventTimer(data);
    });
    // 加急订单倒计时 tick
    window.eventBus.on('rush-order:tick', (data) => {
      this.updateRushOrderTimers(data);
    });
    // 连击狂热：合成积分增长补充特效
    window.eventBus.on('combo-fever:score-bonus', (data) => {
      this.showComboFeverScoreEffect(data);
    });

    // === 评级系统事件 ===
    window.eventBus.on('rating:calculated', (data) => {
      this.showRatingPanel(data);
    });

    // === 怒气/大招系统事件 ===
    window.eventBus.on('rage:updated', (data) => {
      this.updateRageBar(data.value, data.max);
    });
    window.eventBus.on('ultimate:used', (data) => {
      this._onUltimateUsed(data);
    });

    // === Boss 战事件 ===
    window.eventBus.on('boss:init', (data) => {
      this._onBossInit(data);
    });
    window.eventBus.on('boss:scorch-cell', (data) => {
      this._onBossScorchCell(data);
    });
    window.eventBus.on('boss:extinguish-cell', (data) => {
      this._onBossExtinguishCell(data);
    });
    window.eventBus.on('boss:rage-activated', () => {
      this._onBossRageActivated();
    });
    window.eventBus.on('boss:rage-deactivated', () => {
      this._onBossRageDeactivated();
    });
    window.eventBus.on('boss:freeze-row', (data) => {
      this._onBossFreezeRow(data);
    });
    window.eventBus.on('boss:thaw-row', (data) => {
      this._onBossThawRow(data);
    });
    window.eventBus.on('boss:blizzard-started', (data) => {
      this._onBossBlizzardStarted(data);
    });
    window.eventBus.on('boss:blizzard-ended', () => {
      this._onBossBlizzardEnded();
    });
    window.eventBus.on('boss:chaos-wave', (data) => {
      this._onBossChaosWave(data);
    });
    window.eventBus.on('boss:chaos-spawn', (data) => {
      this._onBossChaosSpawn(data);
    });
    window.eventBus.on('boss:devour-timer', (data) => {
      this._onBossDevourTimer(data);
    });
    window.eventBus.on('boss:devour-column', (data) => {
      this._onBossDevourColumn(data);
    });
    window.eventBus.on('boss:devour-delayed', (data) => {
      this._onBossDevourDelayed(data);
    });
    window.eventBus.on('boss:mirror-summoned', (data) => {
      this._onBossMirrorSummoned(data);
    });
    window.eventBus.on('boss:boon-unsealed', (data) => {
      this._onBossBoonUnsealed(data);
    });
    window.eventBus.on('boss:victory', (data) => {
      this._onBossVictory(data);
    });
    window.eventBus.on('boss:defeated', (data) => {
      this._onBossDefeated(data);
    });

    // 按钮回调已由 showRatingPanel 直接处理，无需独立事件
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

      // 图标
      const iconSpan = document.createElement('span');
      iconSpan.className = 'emitter-icon';
      iconSpan.textContent = emitter.icon;
      btn.appendChild(iconSpan);

      // 名称
      const nameSpan = document.createElement('span');
      nameSpan.className = 'emitter-name';
      nameSpan.textContent = emitter.name;
      btn.appendChild(nameSpan);

      // 冷却进度条（整个按钮作为背景，从左到右填充）
      const cooldownBar = document.createElement('div');
      cooldownBar.className = 'emitter-cooldown-bar';
      cooldownBar.style.width = '0%';
      btn.appendChild(cooldownBar);

      // 倒计时数字文本
      const timerText = document.createElement('span');
      timerText.className = 'cooldown-timer-text';
      timerText.textContent = '';
      btn.appendChild(timerText);

      // 点击事件
      btn.addEventListener('click', () => {
        if (onClick) onClick(emitter.id);
      });

      panel.appendChild(btn);
      this.emitterButtons.push({
        element: btn,
        emitterId: emitter.id,
        cooldownFill: null,
        cooldownBar: cooldownBar,
        iconEl: iconSpan,
        timerText: timerText,
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

      // 更新冷却进度条（整个按钮背景，从左到右）
      if (btnData.cooldownBar) {
        const pct = Math.round(progress * 100);

        // 刚进入冷却时（progress < 0.01），临时移除过渡动画，
        // 避免 CSS transition 导致进度条从 100% 平滑收缩到 0% 的视觉延迟
        if (progress < 0.01) {
          btnData.cooldownBar.style.transition = 'none';
          btnData.cooldownBar.style.width = `${pct}%`;
          void btnData.cooldownBar.offsetWidth;
          btnData.cooldownBar.style.transition = 'width 0.15s linear, background 0.25s ease';
        } else {
          btnData.cooldownBar.style.width = `${pct}%`;
        }

        // 颜色随进度变化：红色→橙色→绿色
        if (progress < 0.33) {
          btnData.cooldownBar.style.background = 'linear-gradient(90deg, #ef5350, #ff7043)';
        } else if (progress < 0.66) {
          btnData.cooldownBar.style.background = 'linear-gradient(90deg, #ff7043, #ffa726)';
        } else {
          btnData.cooldownBar.style.background = 'linear-gradient(90deg, #66bb6a, #43a047)';
        }
      }

      // 更新倒计时数字
      if (btnData.timerText) {
        if (progress < 1) {
          const remainingMs = emitter.getActualCooldown() * (1 - progress);
          const remainingSec = Math.ceil(remainingMs / 1000);
          btnData.timerText.textContent = remainingSec > 0 ? `${remainingSec}s` : '';
          btnData.timerText.style.display = 'block';
        } else {
          btnData.timerText.textContent = '';
          btnData.timerText.style.display = 'none';
        }
      }

      if (progress >= 1) {
        btnData.element.classList.remove('on-cooldown');
        btnData.element.disabled = false;
        // 就绪时添加呼吸动画
        btnData.element.classList.add('emitter-btn-ready');
      } else {
        btnData.element.classList.add('on-cooldown');
        btnData.element.disabled = true;
        btnData.element.classList.remove('emitter-btn-ready');
      }
    }
  }

  /**
   * 发射器点击反馈：按压动画 + 图标闪烁
   */
  _onEmitterClicked(emitterId) {
    const btnData = this.emitterButtons.find((b) => b.emitterId === emitterId);
    if (!btnData) return;

    const btn = btnData.element;

    // 立即重置冷却进度条（移除过渡动画，避免从100%平滑收缩的视觉延迟）
    if (btnData.cooldownBar) {
      btnData.cooldownBar.style.transition = 'none';
      btnData.cooldownBar.style.width = '0%';
      void btnData.cooldownBar.offsetWidth; // 强制重排
      btnData.cooldownBar.style.transition = 'width 0.15s linear, background 0.25s ease';
    }

    // 按压动画
    btn.classList.remove('emitter-btn-press');
    void btn.offsetWidth;
    btn.classList.add('emitter-btn-press');

    // 图标闪烁
    if (btnData.iconEl) {
      btnData.iconEl.classList.remove('emitter-icon-flash');
      void btnData.iconEl.offsetWidth;
      btnData.iconEl.classList.add('emitter-icon-flash');
    }

    // 移除呼吸动画（进入冷却）
    btn.classList.remove('emitter-btn-ready');

    // 动画结束后清理
    setTimeout(() => {
      btn.classList.remove('emitter-btn-press');
      if (btnData.iconEl) {
        btnData.iconEl.classList.remove('emitter-icon-flash');
      }
    }, 400);
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

      // 加急订单：添加倒计时进度条
      if (order.isRush) {
        const rushBarContainer = document.createElement('div');
        rushBarContainer.className = 'rush-order-bar-container';
        
        const rushBar = document.createElement('div');
        rushBar.className = 'rush-order-bar';
        rushBar.id = `rush-bar-${order.id}`;
        rushBarContainer.appendChild(rushBar);
        
        const rushTimer = document.createElement('span');
        rushTimer.className = 'rush-order-timer';
        rushTimer.id = `rush-timer-${order.id}`;
        rushTimer.textContent = '';
        rushBarContainer.appendChild(rushTimer);
        
        card.appendChild(rushBarContainer);
        card.classList.add('order-card-rush');
      }

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
   * 更新连击显示（改为横幅形式，从顶部滑入）
   * 合成时显示连击横幅，连击为0时不显示
   */
  updateCombo(count, multiplier) {
    if (count >= 2) {
      // 连击≥2时显示横幅
      this._enqueueBanner(`🔥 ${count}连击`, `x${multiplier.toFixed(1)}`, 'combo-banner', 1200);
    }
    // count=0或1时不显示横幅（首次合成不弹）
  }

  /**
   * 显示 Combo Break 红色闪烁效果（改为横幅形式）
   * 连击中断时触发
   */
  _showComboBreak() {
    this._enqueueBanner('💥 Combo Break!', '', 'combo-break-banner', 1000);
  }

  /**
   * 显示订单提交弹跳积分数字
   * @param {string} orderId - 订单ID，用于定位卡片位置
   * @param {number} reward - 获得的积分
   */
  showBounceScore(orderId, reward) {
    // 找到对应的订单卡片元素
    let targetCard = null;
    for (const card of this.orderCards) {
      if (card.dataset.orderId === String(orderId)) {
        targetCard = card;
        break;
      }
    }

    let centerX, centerY;
    if (targetCard) {
      const rect = targetCard.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    } else {
      // fallback: 订单面板已被刷新，使用面板整体位置
      const panel = this.elements['orders-panel'];
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    }

    // 创建弹跳数字容器
    const el = document.createElement('div');
    el.className = 'bounce-score';
    el.textContent = `+${reward}`;

    // 根据奖励值决定动画类型
    let typeClass;
    if (reward > 100) {
      typeClass = 'bounce-score-epic';
    } else if (reward >= 50) {
      typeClass = 'bounce-score-large';
    } else {
      typeClass = 'bounce-score-normal';
    }
    el.classList.add(typeClass);

    // 定位到订单位置
    el.style.left = `${centerX}px`;
    el.style.top = `${centerY}px`;
    el.style.transform = 'translate(-50%, -50%)';

    document.body.appendChild(el);

    // 巨额订单附加星形粒子
    if (reward > 100) {
      this._createStarParticles(el);
    }

    // 动画结束后移除DOM
    const duration = reward > 100 ? 1200 : 1000;
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, duration);
  }

  /**
   * 为巨额订单创建星形粒子效果
   */
  _createStarParticles(container) {
    const stars = ['⭐', '✨', '🌟', '💫'];
    for (let i = 0; i < 6; i++) {
      const particle = document.createElement('span');
      particle.className = 'bounce-star-particle';
      particle.textContent = stars[i % stars.length];
      // 随机方向扩散
      const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5;
      const dist = 30 + Math.random() * 40;
      particle.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      container.appendChild(particle);
    }
  }

  /**
   * 检查进度阈值并触发进度横幅
   */
  _checkProgressThreshold(score, targetScore) {
    if (!targetScore || targetScore <= 0) return;
    const currentPercent = Math.min((score / targetScore) * 100, 100);

    // 定义阈值：25%, 50%, 75%, 100%
    const thresholds = [25, 50, 75, 100];

    for (const threshold of thresholds) {
      // 当前跨过了该阈值，且上次还没跨过（避免重复触发）
      if (currentPercent >= threshold && this._lastProgressPercent < threshold) {
        this.showProgressBanner(threshold);
        break; // 一次只触发一个横幅（最高优先级的那个）
      }
    }

    this._lastProgressPercent = currentPercent;
  }

  /**
   * 显示进度横幅：从顶部滑入，停留1.5秒后滑出
   * 通过横幅队列管理，避免与连击横幅冲突
   * @param {number} percent - 25 | 50 | 75 | 100
   */
  showProgressBanner(percent) {
    const bannerData = {
      25: { icon: '🌱', text: '征程起步 · 已完成 25%' },
      50: { icon: '🔥', text: '半程冲刺 · 已完成 50%' },
      75: { icon: '⚡', text: '胜利在望 · 已完成 75%' },
      100: { icon: '🏆', text: '🎉 目标达成 · 100% 完成！' },
    };
    const data = bannerData[percent] || { icon: '📊', text: `进度 ${percent}%` };
    this._enqueueBanner(data.text, data.icon, `progress-banner-${percent}`, 1500);
  }

  /**
   * 元素飞入订单动画：从棋盘位置沿弧线飞向订单位置，消散为光点
   * @param {string} orderId - 订单ID
   * @param {Array<{row:number,col:number}>} positions - 棋盘上被消耗元素的位置
   * @param {string} icon - 元素图标
   */
  playFlyToOrder(orderId, positions, icon) {
    if (!positions || positions.length === 0) return;

    // 找到目标订单卡片位置
    let targetCard = null;
    for (const card of this.orderCards) {
      if (card.dataset.orderId === String(orderId)) {
        targetCard = card;
        break;
      }
    }
    let targetX, targetY;
    if (!targetCard) {
      // 找不到卡片时使用订单面板整体位置作为 fallback
      const panel = this.elements['orders-panel'];
      if (!panel) return;
      const panelRect = panel.getBoundingClientRect();
      targetX = panelRect.left + panelRect.width / 2;
      targetY = panelRect.top + panelRect.height / 2;
    } else {
      const targetRect = targetCard.getBoundingClientRect();
      let targetX = targetRect.left + targetRect.width / 2;
      let targetY = targetRect.top + targetRect.height / 2;
    }

    // 逐个飞入（每个间隔0.15秒）
    positions.forEach((pos, index) => {
      setTimeout(() => {
        this._createFlyingElement(pos, targetX, targetY, icon);
      }, index * 150);
    });
  }

  /**
   * 创建单个飞行元素
   */
  _createFlyingElement(pos, targetX, targetY, icon) {
    // 找到棋盘格子的屏幕位置
    const boardContainer = document.getElementById('game-board');
    if (!boardContainer) return;
    const boardRect = boardContainer.getBoundingClientRect();

    // 估算格子中心位置：从 DOM 获取实际格子尺寸
    const firstCell = boardContainer.querySelector('.board-cell');
    let cellWidth = 60;
    if (firstCell) {
      const cellRect = firstCell.getBoundingClientRect();
      cellWidth = cellRect.width;
    }
    const startX = boardRect.left + (pos.col + 0.5) * cellWidth;
    const startY = boardRect.top + (pos.row + 0.5) * cellWidth;

    // 创建飞行元素
    const el = document.createElement('div');
    el.className = 'fly-element';
    el.textContent = icon || '✦';
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;

    document.body.appendChild(el);

    // 弧线飞行：使用 CSS keyframe 通过 JS 控制 transform
    const dx = targetX - startX;
    const dy = targetY - startY;
    const midX = dx * 0.3;
    const midY = dy * 0.4 - 80; // 向上弧线

    const duration = 300; // 0.3秒

    // 使用 requestAnimationFrame 驱动贝塞尔曲线
    const startTime = performance.now();
    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      // 二次贝塞尔: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * midX + t * t * dx;
      const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * midY + t * t * dy;

      el.style.transform = `translate(${x}px, ${y}px) scale(${1 - t * 0.5})`;
      el.style.opacity = Math.max(0, 1 - t * 0.6);

      // 尾部光点轨迹
      if (t < 0.8 && t > 0.05) {
        const trail = document.createElement('div');
        trail.className = 'fly-element-trail';
        trail.style.left = `${startX + x}px`;
        trail.style.top = `${startY + y}px`;
        trail.style.background = 'rgba(255, 215, 0, 0.4)';
        trail.style.opacity = String(Math.max(0, 0.5 - t));
        document.body.appendChild(trail);
        setTimeout(() => {
          if (trail.parentNode) trail.parentNode.removeChild(trail);
        }, 400);
      }

      if (t >= 1) {
        // 到达后消散为光点
        el.classList.add('fly-element-dissolve');
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 500);
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
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

  /**
   * 显示连击里程碑特效
   * @param {number} milestone - 5 | 10 | 20
   * @param {boolean} isFirstTime - 是否首次达到（首次触发完整效果）
   */
  showMilestoneEffect(milestone, isFirstTime) {
    const milestoneConfigs = {
      5: {
        text: '🔥 5连击！节奏不错',
        className: 'board-border-glow',
        duration: 800,
      },
      10: {
        text: '⚡ 10连击！合成大师',
        className: 'board-border-flame',
        duration: 3000,
        hasFlameParticles: true,
      },
      20: {
        text: '🌟 20连击！！传说级操作',
        className: 'board-border-lightning',
        duration: 5000,
        hasFlash: true,
      },
    };

    const config = milestoneConfigs[milestone];
    if (!config) return;

    // 始终显示文字提示（通过通知系统）
    window.eventBus.emit('notification', {
      message: config.text,
      type: 'milestone',
    });

    if (!isFirstTime) return; // 非首次只显示文字

    // === 首次完整特效 ===

    // 找到棋盘容器
    const boardContainer = document.getElementById('game-board');
    if (!boardContainer) return;

    // 应用边框动画
    boardContainer.classList.remove(config.className);
    void boardContainer.offsetWidth;
    boardContainer.classList.add(config.className);

    // 清理动画类
    setTimeout(() => {
      boardContainer.classList.remove(config.className);
    }, config.duration + 100);

    // 10连击：蓝色火焰粒子
    if (config.hasFlameParticles && isFirstTime) {
      this._spawnFlameParticles(boardContainer, config.duration);
    }

    // 20连击：全屏金色闪光
    if (config.hasFlash && isFirstTime) {
      this._spawnLightningFlash(config.duration);
    }
  }

  /** 生成蓝色火焰粒子环绕棋盘边框 */
  _spawnFlameParticles(container, duration) {
    const particleLayer = document.createElement('div');
    particleLayer.className = 'flame-particles-container';
    container.appendChild(particleLayer);

    const colors = ['#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#1e88e5'];
    const sides = ['top', 'right', 'bottom', 'left'];

    for (let i = 0; i < 40; i++) {
      const particle = document.createElement('div');
      particle.className = 'flame-particle';
      const side = sides[i % 4];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 6px ${color}`;

      // 沿边框分布
      const rect = container.getBoundingClientRect();
      switch (side) {
        case 'top':
          particle.style.left = `${(i / 10) * 90 + 5}%`;
          particle.style.top = '-4px';
          break;
        case 'right':
          particle.style.right = '-4px';
          particle.style.top = `${(i / 12) * 85 + 5}%`;
          break;
        case 'bottom':
          particle.style.left = `${(i / 9) * 88 + 5}%`;
          particle.style.bottom = '-4px';
          break;
        case 'left':
          particle.style.left = '-4px';
          particle.style.top = `${(i / 11) * 83 + 8}%`;
          break;
      }

      // 随机延迟
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particle.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;

      particleLayer.appendChild(particle);
    }

    // 持续时间结束后移除粒子层
    setTimeout(() => {
      if (particleLayer.parentNode) {
        particleLayer.parentNode.removeChild(particleLayer);
      }
    }, duration + 500);
  }

  /** 生成全屏闪电闪光 */
  _spawnLightningFlash(duration) {
    const flash = document.createElement('div');
    flash.className = 'lightning-flash';
    document.body.appendChild(flash);

    setTimeout(() => {
      if (flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
    }, duration + 200);
  }

  // ==================== 波次系统 UI ====================

  /**
   * 显示波次开始横幅
   * @param {object} data - { waveIndex, totalWaves, config: { type, target, label, reward } }
   */
  showWaveBanner(data) {
    const oldContainer = document.getElementById('wave-banner-container');
    if (oldContainer && oldContainer.parentNode) {
      oldContainer.parentNode.removeChild(oldContainer);
    }

    const waveNum = data.waveIndex + 1;
    const total = data.totalWaves;
    const config = data.config || {};
    const reward = config.reward || {};

    // 构建奖励文本
    let rewardText = '';
    if (reward.points) rewardText += `+${reward.points}分`;
    if (reward.speedBoost) rewardText += ` · 加速${reward.speedBoost}s`;
    if (reward.extraSlot) rewardText += ` · +${reward.extraSlot}槽位`;

    const container = document.createElement('div');
    container.id = 'wave-banner-container';
    container.className = 'wave-banner-container';

    const banner = document.createElement('div');
    banner.className = `wave-banner wave-banner-${config.type || 'normal'}`;

    banner.innerHTML = `
      <div class="wave-banner-header">
        <span class="wave-banner-icon">🌊</span>
        <span class="wave-banner-title">第 ${waveNum}/${total} 波</span>
      </div>
      <div class="wave-banner-label">${config.label || ''}</div>
      <div class="wave-banner-target">目标：${config.target || ''}</div>
      ${rewardText ? `<div class="wave-banner-reward">奖励：${rewardText}</div>` : ''}
    `;

    container.appendChild(banner);
    document.body.appendChild(container);

    void container.offsetWidth;
    container.classList.add('show');

    // 3秒后自动滑出
    setTimeout(() => {
      container.classList.remove('show');
      container.classList.add('hide');
      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
      }, 500);
    }, 3000);
  }

  /**
   * 更新波次进度条
   * @param {object} data - { waveIndex, totalWaves, progress, current, target, config }
   */
  updateWaveProgress(data) {
    let bar = document.getElementById('wave-progress-bar');
    let label = document.getElementById('wave-progress-label');

    if (!bar) {
      // 创建波次进度条容器（放在积分显示下方）
      const scoreDisplay = this.elements['score-display'];
      if (!scoreDisplay) return;
      const parent = scoreDisplay.closest('.score-section') || scoreDisplay.parentElement;
      if (!parent) return;

      const container = document.createElement('div');
      container.id = 'wave-progress-container';
      container.className = 'wave-progress-container';

      label = document.createElement('div');
      label.id = 'wave-progress-label';
      label.className = 'wave-progress-label';
      container.appendChild(label);

      const track = document.createElement('div');
      track.className = 'wave-progress-track';

      bar = document.createElement('div');
      bar.id = 'wave-progress-bar';
      bar.className = 'wave-progress-fill';
      track.appendChild(bar);

      container.appendChild(track);
      parent.appendChild(container);
    }

    const waveNum = data.waveIndex + 1;
    const total = data.totalWaves;
    const pct = Math.min((data.progress || 0), 100);

    bar.style.width = `${pct}%`;
    label.textContent = `🌊 第 ${waveNum}/${total} 波 · ${data.current || 0}/${data.target || 0} (${Math.round(pct)}%)`;
  }

  /**
   * 显示波次完成特效
   * @param {object} data - { waveIndex, totalWaves, config, reward }
   */
  showWaveCompletionEffect(data) {
    const waveNum = data.waveIndex + 1;
    const total = data.totalWaves;
    const reward = data.reward || {};

    let rewardText = '';
    if (reward.points) rewardText += `+${reward.points}分`;
    if (reward.speedBoost) rewardText += ` · 加速${reward.speedBoost}s`;
    if (reward.extraSlot) rewardText += ` · +${reward.extraSlot}槽位`;

    window.eventBus.emit('notification', {
      message: `✅ 第 ${waveNum}/${total} 波完成！${rewardText ? '奖励：' + rewardText : ''}`,
      type: 'success',
    });

    // 最后一波完成时特殊提示
    if (data.waveIndex === total - 1) {
      window.eventBus.emit('notification', {
        message: '🏁 所有波次已完成！继续冲击最高分！',
        type: 'milestone',
      });
    }
  }

  // ==================== 紧急事件系统 UI ====================

  /**
   * 显示紧急事件横幅（滑入 + 倒计时闪烁）
   * @param {object} data - { eventId, eventKey, config: { name, icon, description, duration } }
   */
  showEventBanner(data) {
    const oldContainer = document.getElementById('event-banner-container');
    if (oldContainer && oldContainer.parentNode) {
      oldContainer.parentNode.removeChild(oldContainer);
    }

    // 直接从 data 读取事件字段（GameEngine 发射时放在顶层）
    const eventName = data.name || '未知事件';
    const eventIcon = data.icon || '⚠';
    const eventDesc = data.description || '';
    const eventKey = data.id || 'unknown';
    const duration = Math.max(1, Math.ceil((data.durationMs || 10000) / 1000));

    const container = document.createElement('div');
    container.id = 'event-banner-container';
    container.className = 'event-banner-container';

    const banner = document.createElement('div');
    banner.className = `event-banner event-banner-${eventKey}`;

    banner.innerHTML = `
      <div class="event-banner-header">
        <span class="event-banner-icon">${eventIcon}</span>
        <span class="event-banner-name">${eventName}</span>
      </div>
      <div class="event-banner-desc">${eventDesc}</div>
      <div class="event-banner-timer">
        <span class="event-timer-icon">⏱</span>
        <span id="event-countdown-text" class="event-countdown-text">${duration}s</span>
      </div>
    `;

    container.appendChild(banner);
    document.body.appendChild(container);

    void container.offsetWidth;
    container.classList.add('show');

    // 倒计时闪烁效果
    const timerEl = document.getElementById('event-countdown-text');
    if (timerEl) {
      timerEl.classList.add('countdown-flash');
    }
  }
  hideEventBanner() {
    const container = document.getElementById('event-banner-container');
    if (!container) return;

    container.classList.remove('show');
    container.classList.add('hide');

    setTimeout(() => {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 500);
  }

  /**
   * 应用/移除发射器冰冻特效
   * @param {boolean} active - true=冻结，false=解冻
   */
  applyFreezeEffect(active) {
    for (const btnData of this.emitterButtons) {
      if (active) {
        btnData.element.classList.add('emitter-frozen');
      } else {
        btnData.element.classList.remove('emitter-frozen');
      }
    }
  }

  /**
   * 更新加急订单倒计时进度条
   * @param {object} data - { remainingMs, totalDurationMs }
   */
  updateRushOrderTimers(data) {
    const progress = Math.max(0, Math.min(1, data.remainingMs / data.totalDurationMs));
    const remainingSec = Math.ceil(data.remainingMs / 1000);
    
    // 遍历所有订单卡片，更新加急订单的进度条
    for (const card of this.orderCards) {
      const bar = card.querySelector('.rush-order-bar');
      const timer = card.querySelector('.rush-order-timer');
      if (bar && timer) {
        bar.style.width = `${progress * 100}%`;
        timer.textContent = `${remainingSec}s`;
        // 最后3秒变红
        if (remainingSec <= 3) {
          bar.classList.add('rush-order-bar-urgent');
        } else {
          bar.classList.remove('rush-order-bar-urgent');
        }
      }
    }
  }

  /**
   * 应用/移除发射器加速特效
   * @param {boolean} active - true=加速，false=恢复
   */
  applySpeedUpEffect(active) {
    for (const btnData of this.emitterButtons) {
      if (active) {
        btnData.element.classList.add('emitter-speed-up');
      } else {
        btnData.element.classList.remove('emitter-speed-up');
      }
    }
  }

  /**
   * 显示连击狂热积分增长特效（合成位置火焰爆发）
   * @param {object} data - { row, col, score, multiplier }
   */
  showComboFeverScoreEffect(data) {
    const cell = document.querySelector(`[data-row="${data.row}"][data-col="${data.col}"] .element-icon`);
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // 创建 "🔥 x3" 标签
    const label = document.createElement('div');
    label.className = 'combo-fever-label';
    label.textContent = `🔥 x${data.multiplier}`;
    label.style.left = `${cx}px`;
    label.style.top = `${cy - 10}px`;
    document.body.appendChild(label);

    // 创建额外积分数字
    const bonusEl = document.createElement('div');
    bonusEl.className = 'combo-fever-bonus';
    const bonusScore = Math.floor(data.score * (data.multiplier - 1));
    bonusEl.textContent = `+${bonusScore}`;
    bonusEl.style.left = `${cx}px`;
    bonusEl.style.top = `${cy + 20}px`;
    document.body.appendChild(bonusEl);

    // 创建火焰粒子
    const colors = ['#ff4500', '#ff6347', '#ff8c00', '#ffd700'];
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.className = 'combo-fever-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 35;
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty('--fx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--fy', `${Math.sin(angle) * dist}px`);
      particle.style.background = colors[i % colors.length];
      particle.style.animationDelay = `${i * 0.04}s`;
      document.body.appendChild(particle);
      setTimeout(() => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      }, 800);
    }

    // 动画结束后移除DOM
    setTimeout(() => {
      if (label.parentNode) label.parentNode.removeChild(label);
      if (bonusEl.parentNode) bonusEl.parentNode.removeChild(bonusEl);
    }, 1000);
  }

  // ==================== 横幅队列系统 ====================

  /**
   * 将横幅加入队列，依次显示
   * @param {string} text - 主文本
   * @param {string} subtext - 副文本
   * @param {string} typeClass - CSS类名
   * @param {number} duration - 显示时长(ms)
   */
  _enqueueBanner(text, subtext, typeClass, duration) {
    this._bannerQueue.push({ text, subtext, typeClass, duration });
    this._processBannerQueue();
  }

  /** 处理横幅队列：一次只显示一个 */
  _processBannerQueue() {
    if (this._isBannerShowing || this._bannerQueue.length === 0) return;
    this._isBannerShowing = true;
    const item = this._bannerQueue.shift();
    this._showBanner(item.text, item.subtext, item.typeClass, item.duration);
  }

  /**
   * 实际渲染横幅
   */
  _showBanner(text, subtext, typeClass, duration) {
    // 移除旧横幅
    const oldContainer = document.getElementById('game-banner-container');
    if (oldContainer && oldContainer.parentNode) {
      oldContainer.parentNode.removeChild(oldContainer);
    }

    const container = document.createElement('div');
    container.id = 'game-banner-container';
    container.className = 'game-banner-container';

    const banner = document.createElement('div');
    banner.className = `game-banner ${typeClass}`;

    let html = `<span class="banner-text">${text}</span>`;
    if (subtext) {
      html += `<span class="banner-subtext">${subtext}</span>`;
    }
    banner.innerHTML = html;
    container.appendChild(banner);
    document.body.appendChild(container);

    // 触发入场动画
    void container.offsetWidth;
    container.classList.add('show');

    // 定时隐藏
    setTimeout(() => {
      container.classList.remove('show');
      container.classList.add('hide');
      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
        this._isBannerShowing = false;
        this._processBannerQueue();
      }, 400);
    }, duration);
  }

  /**
   * 加急订单结束：添加消失动画并移除
   */
  removeRushOrderCards() {
    for (const card of this.orderCards) {
      if (card.classList.contains('order-card-rush')) {
        card.classList.add('order-card-disappear');
        // 动画结束后移除卡片
        setTimeout(() => {
          if (card.parentNode) {
            card.parentNode.removeChild(card);
          }
        }, 400);
      }
    }
  }

  /**
   * 更新事件倒计时
   * @param {object} data - { remainingMs, totalDurationMs }
   */
  updateEventTimer(data) {
    const timerEl = document.getElementById('event-countdown-text');
    if (!timerEl) return;

    const remainingSec = Math.max(0, Math.ceil(data.remainingMs / 1000));
    timerEl.textContent = `${remainingSec}s`;

    // 最后3秒加速闪烁
    if (remainingSec <= 3) {
      timerEl.classList.add('countdown-urgent');
    }
  }

  // ==================== 评级结算面板 ====================

  /**
   * 显示评级结算面板
   * @param {object} data - { level, score, targetScore, rating: { dimensions: {...}, overall: {...}, stats: {...}, stardustMultiplier } }
   */
  showRatingPanel(data) {
    const overlay = this.elements['game-overlay'];
    const modalTitle = this.elements['modal-title'];
    const modalBody = this.elements['modal-body'];

    if (!overlay || !modalBody) return;

    const rating = data.rating || {};
    const dims = rating.dimensions || {};
    const overall = rating.overall || {};
    const stats = rating.stats || {};
    const multiplier = rating.stardustMultiplier || 0;

    // 维度评级映射
    const dimConfigs = [
      { key: 'speed', icon: '⚡', label: '速度', desc: '通关用时' },
      { key: 'combo', icon: '🔥', label: '连击', desc: '最高连击' },
      { key: 'efficiency', icon: '🎯', label: '效率', desc: '每操作得分' },
      { key: 'merge', icon: '💎', label: '合成', desc: '最高合成等级' },
    ];

    // 综合评级颜色映射
    const gradeColors = {
      S: '#ffd700',
      A: '#4caf50',
      B: '#2196f3',
      C: '#ff9800',
      D: '#9e9e9e',
    };

    const overallColor = gradeColors[overall.grade] || '#fff';
    const gradeEmojis = { S: '🌟', A: '👏', B: '👍', C: '💪', D: '📈' };
    const emoji = gradeEmojis[overall.grade] || '🎮';

    // 构建维度卡片HTML
    let dimsHtml = '';
    for (const cfg of dimConfigs) {
      const dim = dims[cfg.key] || {};
      const color = gradeColors[dim.grade] || '#888';
      dimsHtml += `
        <div class="rating-dim-card">
          <div class="rating-dim-header">
            <span class="rating-dim-icon">${cfg.icon}</span>
            <span class="rating-dim-label">${cfg.label}</span>
            <span class="rating-dim-desc">${cfg.desc}</span>
          </div>
          <div class="rating-dim-value" style="color:${color}">
            <span class="rating-dim-grade">${dim.grade || '-'}</span>
            <span class="rating-dim-subtitle">${dim.label || ''}</span>
          </div>
          <div class="rating-dim-bar">
            <div class="rating-dim-fill" style="width:${dim.score || 0}%;background:${color}"></div>
          </div>
        </div>`;
    }

    modalTitle.textContent = `${emoji} 关卡结算 · 第 ${data.level} 关`;

    modalBody.innerHTML = `
      <div class="rating-panel">
        <!-- 综合评级 -->
        <div class="rating-overall" style="border-color:${overallColor}">
          <div class="rating-overall-grade" style="color:${overallColor}">${overall.grade || '-'}</div>
          <div class="rating-overall-title">${overall.title || ''}</div>
          <div class="rating-overall-score">得分：${data.score} / ${data.targetScore}</div>
          <div class="rating-stardust-multiplier">
            星尘倍率：<span style="color:${overallColor};font-weight:bold">x${multiplier.toFixed(2)}</span>
          </div>
        </div>

        <!-- 四维度 -->
        <div class="rating-dimensions">
          ${dimsHtml}
        </div>

        <!-- 统计数据 -->
        <div class="rating-stats">
          <span>操作次数：${stats.operationCount || 0}</span>
          <span>最高连击：${stats.highestCombo || 0}</span>
          <span>最高合成：Lv.${stats.maxMergeLevel || 0}</span>
          <span>完成订单：${stats.ordersCompleted || 0}</span>
          <span>合成次数：${stats.mergesCount || 0}</span>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    // 根据是否有下一关设置按钮回调
    if (data.isRogue) {
      // 肉鸽模式：按钮只关闭弹窗，由 game:over 事件让肉鸽系统接管后续
      this.setModalButtonCallback(() => {});
    } else if (data.isLastLevel) {
      this.setModalButtonCallback(() => {
        window.location.reload();
      });
    } else if (data.nextLevel) {
      const nextLv = data.nextLevel;
      this.setModalButtonCallback(() => {
        window.eventBus.emit('ui:start-level', nextLv);
      });
    }
  }

  // ==================== 怒气/大招系统 UI ====================

  /**
   * 创建怒气条（右侧面板内横向进度条 + 大招卡片列表）
   * @param {Array} ultimates - 大招池定义
   */
  createRageBar(ultimates) {
    console.log('[UIManager] createRageBar called, ultimates count:', ultimates ? ultimates.length : 0);
    this._ultimates = ultimates || [];

    // 显示右侧面板中的 rage-section
    const section = document.getElementById('rage-section');
    if (section) section.style.display = 'block';

    // 渲染大招卡片列表
    this._renderUltimateList();
  }

  /**
   * 渲染大招卡片列表（嵌入右侧面板，按可释放状态排序）
   */
  _renderUltimateList() {
    const container = document.getElementById('ultimate-inline-list');
    if (!container) return;

    container.innerHTML = '';

    if (!this._ultimates || this._ultimates.length === 0) {
      container.innerHTML = '<div class="ultimate-empty-hint">暂无可用大招</div>';
      return;
    }

    const now = Date.now();

    // 按可释放状态排序：可释放（怒气足够+未锁定+不在冷却）排最上面
    const sorted = [...this._ultimates].sort((a, b) => {
      const aLocked = a.unlockBoon && !window.gameEngine?.boonSystem?.hasBoon(a.unlockBoon);
      const bLocked = b.unlockBoon && !window.gameEngine?.boonSystem?.hasBoon(b.unlockBoon);
      const aOnCd = !aLocked && (now - (a.lastUsedTime || 0)) < a.cooldown;
      const bOnCd = !bLocked && (now - (b.lastUsedTime || 0)) < b.cooldown;
      const aReady = !aLocked && !aOnCd && this._rageValue >= a.rageCost;
      const bReady = !bLocked && !bOnCd && this._rageValue >= b.rageCost;

      if (aReady !== bReady) return aReady ? -1 : 1;
      return 0;
    });

    for (const ult of sorted) {
      const card = document.createElement('div');
      card.className = 'ultimate-card';
      card.dataset.ultId = ult.id;

      const isLocked = ult.unlockBoon && !window.gameEngine?.boonSystem?.hasBoon(ult.unlockBoon);
      if (isLocked) card.classList.add('ultimate-card-locked');

      const hasRage = this._rageValue >= ult.rageCost;
      if (!hasRage && !isLocked) card.classList.add('ultimate-card-no-rage');

      const elapsed = now - (ult.lastUsedTime || 0);
      const isOnCooldown = !isLocked && elapsed < ult.cooldown;
      const cooldownPct = isOnCooldown ? Math.round((elapsed / ult.cooldown) * 100) : 100;

      if (isOnCooldown) card.classList.add('ultimate-card-on-cd');

      card.innerHTML = `
        <div class="ultimate-cooldown-bar">
          <div class="ultimate-cooldown-fill" style="width:${cooldownPct}%"></div>
        </div>
        <div class="ultimate-card-row">
          <span class="ultimate-card-icon">${ult.icon}</span>
          <span class="ultimate-card-name">${ult.name}</span>
        </div>
        <div class="ultimate-card-info">
          <div class="ultimate-card-desc">${ult.desc}</div>
          <div class="ultimate-card-cost">
            ${isLocked ? '🔒 未解锁' : isOnCooldown ? `⏳ 冷却中 ${Math.ceil((ult.cooldown - elapsed) / 1000)}s` : `⚡ ${ult.rageCost} 怒气`}
          </div>
        </div>
      `;

      if (!isLocked && !isOnCooldown) {
        card.addEventListener('click', () => {
          if (window.gameEngine && window.gameEngine.useUltimate) {
            window.gameEngine.useUltimate(ult.id);
          }
        });
      }

      container.appendChild(card);
    }

    // 启动冷却定时更新（如果尚未启动）
    if (!this._ultimateCdInterval) {
      this._ultimateCdInterval = setInterval(() => {
        this._updateUltimateCooldowns();
      }, 200);
    }
  }

  /**
   * 更新怒气条（横向进度条）
   * @param {number} value - 当前怒气值
   * @param {number} max - 最大值
   */
  updateRageBar(value, max) {
    this._rageValue = value;
    const fill = document.getElementById('rage-bar-h-fill');
    const display = document.getElementById('rage-value-h-display');

    if (!fill || !display) return;

    const pct = Math.min((value / max) * 100, 100);
    fill.style.width = `${pct}%`;

    // 颜色随怒气变化：蓝→紫→红→金
    if (pct < 30) {
      fill.style.background = 'linear-gradient(90deg, #2196f3, #42a5f5)';
    } else if (pct < 60) {
      fill.style.background = 'linear-gradient(90deg, #9c27b0, #ab47bc)';
    } else if (pct < 80) {
      fill.style.background = 'linear-gradient(90deg, #f44336, #ef5350)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #ff9800, #ffd700)';
      fill.classList.add('rage-bar-pulsing');
    }

    if (pct < 80) {
      fill.classList.remove('rage-bar-pulsing');
    }

    display.textContent = `${Math.floor(value)}/${max}`;

    // 刷新大招列表状态
    this._renderUltimateList();
  }

  /** 更新大招冷却进度条（内联列表版） */
  _updateUltimateCooldowns() {
    const container = document.getElementById('ultimate-inline-list');
    if (!container || !window.gameEngine) return;
    const now = Date.now();
    const cards = container.querySelectorAll('.ultimate-card');
    for (const card of cards) {
      const ultId = card.dataset.ultId;
      const ult = window.gameEngine._ultimates.find(u => u.id === ultId);
      if (!ult) continue;

      const isLocked = ult.unlockBoon && !window.gameEngine?.boonSystem?.hasBoon(ult.unlockBoon);
      if (isLocked) continue;

      const elapsed = now - (ult.lastUsedTime || 0);
      const isOnCooldown = elapsed < ult.cooldown;

      // 更新进度条
      const fill = card.querySelector('.ultimate-cooldown-fill');
      if (fill) {
        const pct = isOnCooldown ? Math.round((elapsed / ult.cooldown) * 100) : 100;
        fill.style.width = `${pct}%`;
        fill.style.background = isOnCooldown ? 'linear-gradient(90deg, #ef5350, #ff7043)' : 'linear-gradient(90deg, #66bb6a, #43a047)';
      }

      // 更新状态文字和点击行为
      const costEl = card.querySelector('.ultimate-card-cost');
      if (costEl) {
        if (isOnCooldown) {
          costEl.textContent = `⏳ 冷却中 ${Math.ceil((ult.cooldown - elapsed) / 1000)}s`;
          card.classList.add('ultimate-card-on-cd');
          card.style.cursor = 'not-allowed';
        } else {
          const hasRage = this._rageValue >= ult.rageCost;
          costEl.textContent = `⚡ ${ult.rageCost} 怒气`;
          card.classList.remove('ultimate-card-on-cd');
          card.style.cursor = '';
          if (hasRage) {
            card.classList.remove('ultimate-card-no-rage');
          } else {
            card.classList.add('ultimate-card-no-rage');
          }
        }
      }
    }
  }

  /** 大招释放反馈 */
  _onUltimateUsed(data) {
    // 创建全屏文字特效
    const textEl = document.createElement('div');
    textEl.className = 'ultimate-text-effect';
    textEl.textContent = `${data.icon} ${data.name}`;
    document.body.appendChild(textEl);

    void textEl.offsetWidth;
    textEl.classList.add('show');

    setTimeout(() => {
      textEl.classList.remove('show');
      textEl.classList.add('hide');
      setTimeout(() => {
        if (textEl.parentNode) textEl.parentNode.removeChild(textEl);
      }, 600);
    }, 1500);
  }

  // ==================== 诅咒系统 UI ====================

  /**
   * 诅咒升级时触发暗红色闪烁和通知
   * @param {Array} upgraded - 升级了的诅咒列表 [{ curseId, stage, desc }]
   */
  _onCurseUpgraded(upgraded) {
    if (!upgraded || upgraded.length === 0) return;

    // 屏幕边缘暗红色闪烁
    this._showCurseUpgradeFlash();

    // 逐个显示诅咒升级通知
    for (const item of upgraded) {
      window.eventBus.emit('notification', {
        message: `⚠ 诅咒升级！${item.desc}`,
        type: 'warning',
      });
    }
  }

  /** 诅咒升级暗红色闪烁特效 */
  _showCurseUpgradeFlash() {
    const flash = document.createElement('div');
    flash.className = 'curse-upgrade-flash';
    document.body.appendChild(flash);

    void flash.offsetWidth;
    flash.classList.add('show');

    setTimeout(() => {
      flash.classList.remove('show');
      setTimeout(() => {
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      }, 300);
    }, 800);
  }

  // ==================== Boss 战视觉特效 ====================

  /** Boss 出现：创建 Boss HUD + 左侧技能面板 */
  _onBossInit(data) {
    // 移除旧 Boss HUD
    const oldHud = document.getElementById('boss-hud');
    if (oldHud && oldHud.parentNode) oldHud.parentNode.removeChild(oldHud);

    const hud = document.createElement('div');
    hud.id = 'boss-hud';
    hud.className = 'boss-hud';

    hud.innerHTML = `
      <div class="boss-hud-icon">${data.icon}</div>
      <div class="boss-hud-info">
        <div class="boss-hud-name">${data.name}</div>
        <div class="boss-hud-desc">${data.description}</div>
      </div>
    `;

    document.body.appendChild(hud);

    // 入场动画
    void hud.offsetWidth;
    hud.classList.add('boss-hud-enter');

    // 更新左侧 Boss 技能面板
    this.updateBossSkillsPanel(data);
  }

  /** 更新左侧 Boss 技能信息面板 */
  updateBossSkillsPanel(data) {
    const section = document.getElementById('boss-info-section');
    const panel = document.getElementById('boss-skills-panel');
    if (!section || !panel) return;

    section.style.display = 'block';

    let skillsHtml = '';

    switch (data.id) {
      case 'boss_lava_giant': {
        const m = data.mechanics;
        skillsHtml = `
          <div class="boss-skill-card">
            <div class="boss-skill-header"><span class="boss-skill-icon">🗿</span><span class="boss-skill-title">熔岩巨像 · 灼烧</span></div>
            <div class="boss-skill-body">
              <div class="boss-skill-item">🔥 灼烧：每 ${(m.scorchInterval / 1000).toFixed(0)} 秒灼烧一个随机格子，持续 ${(m.scorchDuration / 1000).toFixed(0)} 秒</div>
              <div class="boss-skill-item">🔥 蔓延：灼烧有 ${Math.round(m.spreadChance * 100)}% 概率蔓延到相邻格子</div>
              <div class="boss-skill-item">⚡ 愤怒：≥${m.rageThreshold} 格同时灼烧时进入愤怒，发射器冷却 ×${m.rageCooldownPenalty}</div>
              <div class="boss-skill-item">💧 灭火：合成可熄灭灼烧格子</div>
            </div>
          </div>`;
        break;
      }
      case 'boss_ice_witch': {
        const m = data.mechanics;
        skillsHtml = `
          <div class="boss-skill-card">
            <div class="boss-skill-header"><span class="boss-skill-icon">❄</span><span class="boss-skill-title">冰霜女巫 · 冻结</span></div>
            <div class="boss-skill-body">
              <div class="boss-skill-item">❄ 冻结：每 ${(m.freezeInterval / 1000).toFixed(0)} 秒冻结一行，持续 ${(m.freezeDuration / 1000).toFixed(0)} 秒</div>
              <div class="boss-skill-item">💧 解冻：在被冻结行上连续合成 ${m.thawMergeCount} 次可解冻该行</div>
              <div class="boss-skill-item">🌪 暴风雪：≥${m.blizzardThreshold} 行被冻结时触发暴风雪，所有发射器暂停 ${(m.blizzardPauseDuration / 1000).toFixed(0)} 秒</div>
            </div>
          </div>`;
        break;
      }
      case 'boss_chaos_core': {
        const m = data.mechanics;
        skillsHtml = `
          <div class="boss-skill-card">
            <div class="boss-skill-header"><span class="boss-skill-icon">🌀</span><span class="boss-skill-title">混沌之核 · 混沌</span></div>
            <div class="boss-skill-body">
              <div class="boss-skill-item">🌊 混沌波动：每 ${(m.waveInterval / 1000).toFixed(0)} 秒随机变化棋盘元素等级 ±${m.waveLevelRange}</div>
              <div class="boss-skill-item">❓ 混沌生成：每 ${(m.chaosSpawnInterval / 1000).toFixed(0)} 秒生成混沌元素</div>
              <div class="boss-skill-item">📋 刷新：订单需求每 20 秒全部刷新</div>
            </div>
          </div>`;
        break;
      }
      case 'boss_time_devourer': {
        const m = data.mechanics;
        skillsHtml = `
          <div class="boss-skill-card">
            <div class="boss-skill-header"><span class="boss-skill-icon">⏳</span><span class="boss-skill-title">时间吞噬者 · 限时</span></div>
            <div class="boss-skill-body">
              <div class="boss-skill-item">⏱ 限时：${(m.timeLimit / 1000).toFixed(0)} 秒内必须完成目标分数</div>
              <div class="boss-skill-item">🕳 吞噬：每 ${(m.devourInterval / 1000).toFixed(0)} 秒吞噬一列（清除该列所有元素）</div>
              <div class="boss-skill-item">⏳ 延缓：提交订单可延缓吞噬 ${(m.orderDelay / 1000).toFixed(0)} 秒</div>
            </div>
          </div>`;
        break;
      }
      case 'boss_creation_spirit': {
        const m = data.mechanics;
        skillsHtml = `
          <div class="boss-skill-card">
            <div class="boss-skill-header"><span class="boss-skill-icon">🌟</span><span class="boss-skill-title">创世之灵 · 封印</span></div>
            <div class="boss-skill-body">
              <div class="boss-skill-item">🛡 封印：所有祝福失效，但棋盘扩大至最大，发射器无冷却</div>
              <div class="boss-skill-item">🔓 解封：每 ${(m.unsealInterval / 1000).toFixed(0)} 秒解封一个祝福</div>
              <div class="boss-skill-item">👻 镜像：每 ${(m.mirrorInterval / 1000).toFixed(0)} 秒召唤镜像，持续 ${(m.mirrorDuration / 1000).toFixed(0)} 秒</div>
            </div>
          </div>`;
        break;
      }
      default:
        skillsHtml = `<div class="boss-skill-item">${data.description}</div>`;
    }

    panel.innerHTML = skillsHtml;
  }

  /** 熔岩巨像：灼烧格子 */
  _onBossScorchCell(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${data.col}"]`);
    if (!cellEl) return;

    cellEl.classList.add('cell-scorched');
    // data.duration ms 后自动移除
    setTimeout(() => {
      cellEl.classList.remove('cell-scorched');
    }, data.duration);
  }

  /** 熔岩巨像：灭火 */
  _onBossExtinguishCell(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${data.col}"]`);
    if (!cellEl) return;

    cellEl.classList.remove('cell-scorched');
    // 灭火粒子效果
    this._spawnParticles(data.row, data.col, '#ff6600', 8);
  }

  /** 熔岩巨像：愤怒激活 */
  _onBossRageActivated() {
    const hud = document.getElementById('boss-hud');
    if (hud) {
      hud.classList.add('boss-hud-rage');
    }
    // 屏幕边缘红色脉冲
    const pulse = document.createElement('div');
    pulse.className = 'boss-rage-pulse';
    document.body.appendChild(pulse);
    void pulse.offsetWidth;
    pulse.classList.add('show');
    setTimeout(() => {
      pulse.classList.remove('show');
      setTimeout(() => { if (pulse.parentNode) pulse.parentNode.removeChild(pulse); }, 500);
    }, 1500);
  }

  /** 熔岩巨像：愤怒解除 */
  _onBossRageDeactivated() {
    const hud = document.getElementById('boss-hud');
    if (hud) {
      hud.classList.remove('boss-hud-rage');
    }
  }

  /** 冰霜女巫：冻结行 */
  _onBossFreezeRow(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    for (let c = 0; c < 10; c++) {
      const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${c}"]`);
      if (cellEl) {
        cellEl.classList.add('cell-frozen');
      }
    }
  }

  /** 冰霜女巫：解冻行 */
  _onBossThawRow(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    for (let c = 0; c < 10; c++) {
      const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${c}"]`);
      if (cellEl) {
        cellEl.classList.remove('cell-frozen');
        // 解冻碎裂特效
        this._spawnParticles(data.row, c, '#88ccff', 4);
      }
    }
  }

  /** 冰霜女巫：暴风雪开始 */
  _onBossBlizzardStarted(data) {
    const overlay = document.createElement('div');
    overlay.className = 'blizzard-overlay';
    overlay.id = 'blizzard-overlay';
    document.body.appendChild(overlay);

    void overlay.offsetWidth;
    overlay.classList.add('show');

    // data.duration ms 后自动移除
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    }, data.duration || 8000);
  }

  /** 冰霜女巫：暴风雪结束 */
  _onBossBlizzardEnded() {
    const overlay = document.getElementById('blizzard-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }
  }

  /** 混沌之核：混沌波动 */
  _onBossChaosWave() {
    // 屏幕紫色闪烁
    const flash = document.createElement('div');
    flash.className = 'chaos-wave-flash';
    document.body.appendChild(flash);
    void flash.offsetWidth;
    flash.classList.add('show');
    setTimeout(() => {
      flash.classList.remove('show');
      setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 400);
    }, 1000);
  }

  /** 混沌之核：混沌元素生成 */
  _onBossChaosSpawn(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${data.col}"]`);
    if (!cellEl) return;

    cellEl.classList.add('cell-chaos');
    // 闪烁动画
    setTimeout(() => {
      cellEl.classList.remove('cell-chaos');
    }, 2000);
  }

  /** 时间吞噬者：吞噬倒计时更新 */
  _onBossDevourTimer(data) {
    let timerEl = document.getElementById('devour-timer');
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.id = 'devour-timer';
      timerEl.className = 'devour-timer';
      document.body.appendChild(timerEl);
    }

    const remainingSec = Math.ceil(data.remaining / 1000);
    timerEl.textContent = `⏳ ${remainingSec}s`;

    // 低于30秒变红闪烁
    if (remainingSec <= 15) {
      timerEl.classList.add('devour-timer-critical');
    } else if (remainingSec <= 30) {
      timerEl.classList.add('devour-timer-warning');
      timerEl.classList.remove('devour-timer-critical');
    } else {
      timerEl.classList.remove('devour-timer-warning', 'devour-timer-critical');
    }
  }

  /** 时间吞噬者：吞噬列 */
  _onBossDevourColumn(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    for (let r = 0; r < 10; r++) {
      const cellEl = boardEl.querySelector(`[data-row="${r}"][data-col="${data.col}"]`);
      if (cellEl) {
        cellEl.classList.add('cell-devoured');
        setTimeout(() => {
          cellEl.classList.remove('cell-devoured');
        }, 1500);
      }
    }
  }

  /** 时间吞噬者：延缓吞噬 */
  _onBossDevourDelayed(data) {
    const timerEl = document.getElementById('devour-timer');
    if (!timerEl) return;

    timerEl.classList.add('devour-delayed');
    setTimeout(() => {
      timerEl.classList.remove('devour-delayed');
    }, 1000);
  }

  /** 创世之灵：镜像召唤 */
  _onBossMirrorSummoned(data) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    const cellEl = boardEl.querySelector(`[data-row="${data.row}"][data-col="${data.col}"]`);
    if (!cellEl) return;

    cellEl.classList.add('cell-mirror');
    setTimeout(() => {
      cellEl.classList.remove('cell-mirror');
    }, 2500);
  }

  /** 创世之灵：祝福解封 */
  _onBossBoonUnsealed() {
    const flash = document.createElement('div');
    flash.className = 'boon-unseal-flash';
    document.body.appendChild(flash);
    void flash.offsetWidth;
    flash.classList.add('show');
    setTimeout(() => {
      flash.classList.remove('show');
      setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 500);
    }, 1200);
  }

  /** Boss 胜利 */
  _onBossVictory(data) {
    // 移除 Boss HUD
    const hud = document.getElementById('boss-hud');
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);

    // 移除倒计时
    const timer = document.getElementById('devour-timer');
    if (timer && timer.parentNode) timer.parentNode.removeChild(timer);

    // 隐藏左侧 Boss 技能面板
    this._hideBossInfo();

    // 全屏金光绽放
    const victoryEffect = document.createElement('div');
    victoryEffect.className = 'boss-victory-effect';
    document.body.appendChild(victoryEffect);
    void victoryEffect.offsetWidth;
    victoryEffect.classList.add('show');
    setTimeout(() => {
      victoryEffect.classList.remove('show');
      setTimeout(() => {
        if (victoryEffect.parentNode) victoryEffect.parentNode.removeChild(victoryEffect);
      }, 1200);
    }, 2500);
  }

  /** Boss 失败 */
  _onBossDefeated(data) {
    // 移除 Boss HUD
    const hud = document.getElementById('boss-hud');
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);

    // 移除倒计时
    const timer = document.getElementById('devour-timer');
    if (timer && timer.parentNode) timer.parentNode.removeChild(timer);

    // 隐藏左侧 Boss 技能面板
    this._hideBossInfo();

    const flash = document.createElement('div');
    flash.className = 'boss-defeated-flash';
    document.body.appendChild(flash);
    void flash.offsetWidth;
    flash.classList.add('show');
    setTimeout(() => {
      flash.classList.remove('show');
      setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 500);
    }, 1500);
  }

  /** 隐藏所有 Boss 相关 UI */
  _hideBossInfo() {
    const section = document.getElementById('boss-info-section');
    if (section) section.style.display = 'none';
    const panel = document.getElementById('boss-skills-panel');
    if (panel) panel.innerHTML = '';
  }

  /** 生成粒子特效（通用辅助） */
  _spawnParticles(row, col, color, count) {
    const boardEl = document.getElementById('game-board');
    if (!boardEl) return;

    const cellEl = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cellEl) return;

    const rect = cellEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < (count || 6); i++) {
      const particle = document.createElement('div');
      particle.className = 'boss-particle';
      particle.style.cssText = `
        left: ${cx}px;
        top: ${cy}px;
        background: ${color || '#ffffff'};
        --dx: ${(Math.random() - 0.5) * 80}px;
        --dy: ${(Math.random() - 0.5) * 80}px;
        --dr: ${Math.random() * 360}deg;
      `;
      document.body.appendChild(particle);
      void particle.offsetWidth;
      particle.classList.add('show');
      setTimeout(() => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      }, 700);
    }
  }
}