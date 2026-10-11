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
      // 肉鸽模式不显示经典通关弹窗，由肉鸽UI接管
      if (data && data.isRogue) return;
      this.showModal('🎉 恭喜通关！', `你成功完成了第 ${data.level} 关！<br>最终得分：${data.score}`);
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

      // 冷却环 SVG（替代原有的 cooldown-bar）
      const ringContainer = document.createElement('div');
      ringContainer.className = 'cooldown-ring-container';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'cooldown-ring-svg');
      svg.setAttribute('viewBox', '0 0 40 40');

      // 渐变定义
      const defs = document.createElementNS(svgNS, 'defs');
      const gradient = document.createElementNS(svgNS, 'linearGradient');
      gradient.setAttribute('id', `cooldownGradient_${emitter.id}`);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '100%');
      const stop1 = document.createElementNS(svgNS, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', '#2196f3');
      const stop2 = document.createElementNS(svgNS, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', '#4caf50');
      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
      svg.appendChild(defs);

      // 背景圆环
      const bgCircle = document.createElementNS(svgNS, 'circle');
      bgCircle.setAttribute('class', 'cooldown-ring-bg');
      bgCircle.setAttribute('cx', '20');
      bgCircle.setAttribute('cy', '20');
      bgCircle.setAttribute('r', '17');
      svg.appendChild(bgCircle);

      // 进度圆环
      const fillCircle = document.createElementNS(svgNS, 'circle');
      fillCircle.setAttribute('class', 'cooldown-ring-fill');
      fillCircle.setAttribute('cx', '20');
      fillCircle.setAttribute('cy', '20');
      fillCircle.setAttribute('r', '17');
      fillCircle.setAttribute('stroke', `url(#cooldownGradient_${emitter.id})`);
      const circumference = 2 * Math.PI * 17;
      fillCircle.style.strokeDasharray = `${circumference}`;
      fillCircle.style.strokeDashoffset = '0';
      svg.appendChild(fillCircle);

      ringContainer.appendChild(svg);
      btn.appendChild(ringContainer);

      // 点击事件
      btn.addEventListener('click', () => {
        if (onClick) onClick(emitter.id);
      });

      panel.appendChild(btn);
      this.emitterButtons.push({
        element: btn,
        emitterId: emitter.id,
        cooldownFill: null,
        cooldownRing: fillCircle,
        circumference: circumference,
        iconEl: iconSpan,
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

      // 更新冷却环
      if (btnData.cooldownRing) {
        const offset = btnData.circumference * (1 - progress);
        btnData.cooldownRing.style.strokeDashoffset = String(offset);
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
   * 更新连击显示（棋盘上方 + 头部）
   * 合成时数字跳动放大(scale 1→1.3→1)，连击为0时隐藏
   */
  updateCombo(count, multiplier) {
    const comboDisplay = this.elements['board-combo-display'];
    const countText = this.elements['board-combo-count-text'];
    const multiplierText = this.elements['board-combo-multiplier-text'];

    if (!comboDisplay) return;

    if (count >= 1) {
      // 更新文本：count>1 时加火焰图标
      const prefix = count > 1 ? '🔥 ' : '';
      countText.textContent = `${prefix}${count}连击`;
      multiplierText.textContent = `x${multiplier.toFixed(1)}`;

      // 显示面板
      comboDisplay.style.display = 'inline-flex';

      // 移除之前的动画类
      comboDisplay.classList.remove('combo-break');

      // 每次连击更新都触发跳动动画（仅 count > 1 时有视觉冲击）
      if (count > 1) {
        comboDisplay.classList.remove('combo-jump');
        // 强制回流以重新触发动画
        void comboDisplay.offsetWidth;
        comboDisplay.classList.add('combo-jump');
      }
    } else {
      // 连击为0时隐藏
      comboDisplay.style.display = 'none';
    }
  }

  /**
   * 显示 Combo Break 红色闪烁效果
   * 连击中断时触发，闪烁后自动隐藏
   */
  _showComboBreak() {
    const comboDisplay = this.elements['board-combo-display'];
    const countText = this.elements['board-combo-count-text'];
    const multiplierText = this.elements['board-combo-multiplier-text'];

    if (!comboDisplay || comboDisplay.style.display === 'none') return;

    // 切换为 Break 文本
    countText.textContent = '💥 Combo Break!';
    multiplierText.textContent = '';

    // 移除跳动动画，应用 Break 闪烁动画
    comboDisplay.classList.remove('combo-jump');
    comboDisplay.classList.add('combo-break');

    // 动画结束后隐藏
    setTimeout(() => {
      comboDisplay.style.display = 'none';
      comboDisplay.classList.remove('combo-break');
    }, 700);
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
   * @param {number} percent - 25 | 50 | 75 | 100
   */
  showProgressBanner(percent) {
    // 移除旧横幅
    const oldContainer = document.getElementById('progress-banner-container');
    if (oldContainer && oldContainer.parentNode) {
      oldContainer.parentNode.removeChild(oldContainer);
    }

    const bannerData = {
      25: { icon: '🌱', text: '征程起步 · 已完成 25%' },
      50: { icon: '🔥', text: '半程冲刺 · 已完成 50%' },
      75: { icon: '⚡', text: '胜利在望 · 已完成 75%' },
      100: { icon: '🏆', text: '🎉 目标达成 · 100% 完成！' },
    };

    const data = bannerData[percent] || { icon: '📊', text: `进度 ${percent}%` };

    // 创建容器
    const container = document.createElement('div');
    container.id = 'progress-banner-container';
    container.className = 'progress-banner-container';

    const banner = document.createElement('div');
    banner.className = `progress-banner progress-banner-${percent}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'progress-banner-icon';
    iconSpan.textContent = data.icon;
    banner.appendChild(iconSpan);

    const textSpan = document.createElement('span');
    textSpan.className = 'progress-banner-text';
    textSpan.textContent = data.text;
    banner.appendChild(textSpan);

    container.appendChild(banner);
    document.body.appendChild(container);

    // 强制回流后滑入
    void container.offsetWidth;
    container.classList.add('show');

    // 停留1.5秒后滑出
    setTimeout(() => {
      container.classList.remove('show');
      container.classList.add('hide');
      // 动画结束后移除DOM
      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
      }, 500);
    }, 1500);
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
    if (!targetCard) {
      // 找不到卡片时使用订单面板整体位置作为 fallback
      const panel = this.elements['orders-panel'];
      if (!panel) return;
      const panelRect = panel.getBoundingClientRect();
      targetX = panelRect.left + panelRect.width / 2;
      targetY = panelRect.top + panelRect.height / 2;
    } else {
      const targetRect = targetCard.getBoundingClientRect();
      targetX = targetRect.left + targetRect.width / 2;
      targetY = targetRect.top + targetRect.height / 2;
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
}