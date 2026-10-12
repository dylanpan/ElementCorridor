/**
 * ============================================================
 * 调试工具 —— 开发用辅助面板
 * 在游戏界面添加一个调试按钮，点击后弹出面板，
 * 可一键添加祝福、诅咒或触发紧急事件，方便测试。
 * ============================================================
 */
(function () {
  'use strict';

  let _overlay = null;
  let _activeTab = 'boons';

  /** 初始化调试工具 */
  function init() {
    const btn = document.getElementById('debug-btn');
    if (!btn) return;
    btn.addEventListener('click', showDebugPanel);
  }

  /** 显示调试面板 */
  function showDebugPanel() {
    if (_overlay) {
      _overlay.style.display = 'flex';
      return;
    }
    createDebugPanel();
  }

  /** 隐藏调试面板 */
  function hideDebugPanel() {
    if (_overlay) {
      _overlay.style.display = 'none';
    }
  }

  /** 创建调试面板 DOM */
  function createDebugPanel() {
    _overlay = document.createElement('div');
    _overlay.className = 'debug-overlay';
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) hideDebugPanel();
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideDebugPanel();
    });

    const panel = document.createElement('div');
    panel.className = 'debug-panel';

    // 标题栏
    const header = document.createElement('div');
    header.className = 'debug-header';
    header.innerHTML = `
      <span class="debug-title">🔧 调试工具</span>
      <span class="debug-close" title="关闭">✕</span>
    `;
    header.querySelector('.debug-close').addEventListener('click', hideDebugPanel);

    // 标签栏
    const tabs = document.createElement('div');
    tabs.className = 'debug-tabs';
    tabs.innerHTML = `
      <button class="debug-tab active" data-tab="boons">✨ 祝福 (${BOON_POOL.length})</button>
      <button class="debug-tab" data-tab="curses">💀 诅咒 (${CURSE_POOL.length})</button>
      <button class="debug-tab" data-tab="events">⚡ 紧急事件 (${EMERGENCY_EVENTS.length})</button>
    `;

    // 内容区
    const content = document.createElement('div');
    content.className = 'debug-content';

    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(content);
    _overlay.appendChild(panel);
    document.body.appendChild(_overlay);

    // 标签切换
    tabs.querySelectorAll('.debug-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('.debug-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        _activeTab = tab.dataset.tab;
        renderContent(content, _activeTab);
      });
    });

    // 渲染默认标签
    renderContent(content, 'boons');
    _overlay.style.display = 'flex';
  }

  /** 渲染标签内容 */
  function renderContent(container, tab) {
    container.innerHTML = '';
    const searchBox = document.createElement('input');
    searchBox.className = 'debug-search';
    searchBox.type = 'text';
    searchBox.placeholder = '搜索...';
    searchBox.addEventListener('input', () => {
      filterItems(container, searchBox.value);
    });
    container.appendChild(searchBox);

    const list = document.createElement('div');
    list.className = 'debug-list';

    let items = [];
    if (tab === 'boons') {
      items = BOON_POOL.map((b) => ({
        id: b.id,
        icon: b.icon,
        name: b.name,
        desc: b.description,
        rarity: b.rarity,
        category: b.category,
        data: b,
        type: 'boon',
      }));
    } else if (tab === 'curses') {
      items = CURSE_POOL.map((c) => ({
        id: c.id,
        icon: c.icon,
        name: c.name,
        desc: c.description,
        rarity: null,
        category: 'curse',
        compensation: c.compensation || '',
        data: c,
        type: 'curse',
      }));
    } else if (tab === 'events') {
      items = EMERGENCY_EVENTS.map((e) => ({
        id: e.id,
        icon: e.icon,
        name: e.name,
        desc: e.description,
        rarity: null,
        category: e.category,
        duration: (e.durationMs / 1000).toFixed(0),
        data: e,
        type: 'event',
      }));
    }

    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'debug-item';
      el.dataset.searchText = `${item.name} ${item.desc} ${item.id}`;

      // 稀有度颜色标记（仅祝福）
      let rarityBadge = '';
      if (item.rarity && BOON_RARITY[item.rarity]) {
        const r = BOON_RARITY[item.rarity];
        rarityBadge = `<span class="debug-rarity-badge" style="color:${r.color}">[${r.label}]</span>`;
      }

      // 类别标记
      let catLabel = item.category;
      if (item.type === 'curse') catLabel = '诅咒';
      else if (item.type === 'event') catLabel = item.category === 'positive' ? '增益' : item.category === 'negative' ? '负面' : item.category === 'challenge' ? '挑战' : '随机';

      // 额外信息
      let extraInfo = '';
      if (item.type === 'event' && item.duration) {
        extraInfo = `<span class="debug-extra">⏱ ${item.duration}s</span>`;
      }
      if (item.compensation) {
        extraInfo = `<span class="debug-extra">补偿: ${item.compensation}</span>`;
      }

      el.innerHTML = `
        <div class="debug-item-icon">${item.icon}</div>
        <div class="debug-item-info">
          <div class="debug-item-name">
            ${item.name}
            ${rarityBadge}
            <span class="debug-cat-tag">${catLabel}</span>
          </div>
          <div class="debug-item-desc">${item.desc}</div>
          ${extraInfo ? `<div class="debug-item-extra">${extraInfo}</div>` : ''}
        </div>
        <button class="debug-add-btn" data-type="${item.type}" data-id="${item.id}">+ 添加</button>
      `;

      el.querySelector('.debug-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        applyItem(item);
      });

      list.appendChild(el);
    });

    container.appendChild(list);
  }

  /** 过滤列表 */
  function filterItems(container, keyword) {
    if (!keyword.trim()) {
      container.querySelectorAll('.debug-item').forEach((el) => (el.style.display = ''));
      return;
    }
    const kw = keyword.toLowerCase();
    container.querySelectorAll('.debug-item').forEach((el) => {
      const text = (el.dataset.searchText || '').toLowerCase();
      el.style.display = text.includes(kw) ? '' : 'none';
    });
  }

  /** 应用选中的项到当前游戏 */
  function applyItem(item) {
    const ge = window.__gameEngine;
    const bs = window.__boonSystem;
    if (!ge) {
      alert('游戏引擎未初始化，请先开始一局游戏');
      return;
    }

    if (!ge.state.isPlaying) {
      alert('游戏未在进行中，请先开始一局游戏');
      return;
    }

    if (item.type === 'boon') {
      // 确保 boonSystem 存在
      if (!bs) {
        alert('祝福系统未初始化（经典模式不支持祝福）');
        return;
      }
      // 检查是否已有该祝福
      if (bs.hasBoon(item.id)) {
        alert(`祝福「${item.name}」已存在`);
        return;
      }
      bs.addBoon(item.data);
      // 如果是生产类祝福，立即应用到发射器
      if (item.data.category === 'production') {
        bs.applyToEmitters(ge.state.emitters);
      }
      // 特殊处理：扩容背包需要重新设置棋盘大小
      if (item.id === 'boon_expand_bag') {
        // 棋盘增加一行由 startRogueLevel 处理，这里只通知
        window.eventBus.emit('notification', {
          message: '🎒 扩容背包：棋盘增加一行（下次战斗生效）',
          type: 'info',
        });
      }
      // 更新UI
      window.eventBus.emit('rogue:boons-updated', bs.getBoonSummary());
      window.eventBus.emit('notification', {
        message: `✅ 已添加祝福「${item.icon} ${item.name}」`,
        type: 'info',
      });
    } else if (item.type === 'curse') {
      if (!bs) {
        alert('祝福系统未初始化（经典模式不支持诅咒）');
        return;
      }
      if (bs.hasCurse(item.id)) {
        alert(`诅咒「${item.name}」已存在`);
        return;
      }
      bs.addCurse(item.data);
      // 应用惩罚
      if (item.data.penalty) {
        item.data.penalty(ge.state.emitters);
      }
      if (item.data.compensator) {
        item.data.compensator();
      }
      window.eventBus.emit('rogue:curses-updated', bs.getCurseSummary());
      window.eventBus.emit('notification', {
        message: `💀 已添加诅咒「${item.icon} ${item.name}」`,
        type: 'warning',
      });
    } else if (item.type === 'event') {
      // 直接触发紧急事件
      if (ge._activeEvent) {
        alert('当前已有活跃事件，请等待结束再触发新事件');
        return;
      }
      ge._startEvent(item.data);
      window.eventBus.emit('notification', {
        message: `⚡ 已触发事件「${item.icon} ${item.name}」`,
        type: 'info',
      });
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();