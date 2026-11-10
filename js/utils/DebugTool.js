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
  let _debugOverlaysEnabled = false;

  /** 切换 UI 辅助线显示/隐藏 */
  function toggleDebugOverlays() {
    _debugOverlaysEnabled = !_debugOverlaysEnabled;
    document.documentElement.classList.toggle('debug-overlays', _debugOverlaysEnabled);
    return _debugOverlaysEnabled;
  }

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
      <button class="debug-overlay-toggle" title="切换UI辅助线（边框标记）">📐 辅助线</button>
    <span class="debug-close" title="关闭">✕</span>
    `;
    header.querySelector('.debug-close').addEventListener('click', hideDebugPanel);

    // 辅助线开关
    const overlayToggle = header.querySelector('.debug-overlay-toggle');
    overlayToggle.addEventListener('click', () => {
      const enabled = toggleDebugOverlays();
      overlayToggle.textContent = enabled ? '✅ 辅助线' : '📐 辅助线';
      overlayToggle.style.background = enabled ? 'rgba(76,175,80,0.3)' : '';
      overlayToggle.style.borderColor = enabled ? '#4caf50' : '#666';
    });
    // 初始状态同步
    if (_debugOverlaysEnabled) {
      overlayToggle.textContent = '✅ 辅助线';
      overlayToggle.style.background = 'rgba(76,175,80,0.3)';
      overlayToggle.style.borderColor = '#4caf50';
    }

    // 标签栏
    const tabs = document.createElement('div');
    tabs.className = 'debug-tabs';
    tabs.innerHTML = `
      <button class="debug-tab active" data-tab="boons">✨ 祝福 (${BOON_POOL.length})</button>
      <button class="debug-tab" data-tab="curses">💀 诅咒 (${CURSE_POOL.length})</button>
      <button class="debug-tab" data-tab="events">⚡ 事件 (${EMERGENCY_EVENTS.length + Object.values(EVENT_POOL).flat().length + CrisisSystem.EVENTS.length})</button>
      <button class="debug-tab" data-tab="bosses">👑 Boss (${BOSS_CONFIGS.length})</button>
      <button class="debug-tab" data-tab="ultimates">🔥 大招</button>
      <button class="debug-tab" data-tab="items">🎒 道具</button>
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

    // 大招页签：添加怒气值控制区域
    if (tab === 'ultimates') {
      const rageControl = document.createElement('div');
      rageControl.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;margin:4px 0 8px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:8px;';
      rageControl.innerHTML = `
        <span style="font-size:14px;color:#ff9800;white-space:nowrap;">⚡ 怒气值</span>
        <input id="debug-rage-input" type="number" min="1" max="100" value="20"
          style="flex:1;min-width:50px;padding:4px 6px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;font-size:13px;">
        <button id="debug-rage-add-btn" style="padding:4px 12px;border:none;border-radius:4px;background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;cursor:pointer;font-size:13px;font-weight:bold;">+ 增加</button>
        <button id="debug-rage-max-btn" style="padding:4px 12px;border:none;border-radius:4px;background:rgba(255,152,0,0.3);color:#ff9800;cursor:pointer;font-size:12px;">满怒</button>
      `;
      container.appendChild(rageControl);

      // 延迟绑定事件（确保 DOM 已渲染）
      setTimeout(() => {
        const input = document.getElementById('debug-rage-input');
        const addBtn = document.getElementById('debug-rage-add-btn');
        const maxBtn = document.getElementById('debug-rage-max-btn');
        if (addBtn && input) {
          addBtn.addEventListener('click', () => {
            const ge = window.__gameEngine;
            if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
            const amount = parseInt(input.value) || 20;
            ge._addRage(amount);
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addBtn.click();
          });
        }
        if (maxBtn) {
          maxBtn.addEventListener('click', () => {
            const ge = window.__gameEngine;
            if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
            ge._addRage(100);
          });
        }
      }, 50);
    }

    // 道具页签：添加道具控制区域
    if (tab === 'items') {
      const control = document.createElement('div');
      control.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px 10px;margin:4px 0 8px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);border-radius:8px;';
      control.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:14px;color:#4caf50;white-space:nowrap;">🎒 添加道具</span>
          <select id="debug-item-select" style="flex:1;min-width:120px;padding:4px 6px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;font-size:13px;">
            <option value="time_freeze">⏸ 时间停滞</option>
            <option value="instant_complete">✅ 立即完成</option>
            <option value="skip_order">➡ 跳过订单</option>
            <option value="element_storm">🌪 元素风暴</option>
            <option value="double_score">✖2 双倍积分</option>
          </select>
          <input id="debug-item-count" type="number" min="1" max="10" value="1"
            style="width:50px;padding:4px 6px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;font-size:13px;text-align:center;">
          <button id="debug-item-add-btn" style="padding:6px 16px;border:none;border-radius:6px;background:linear-gradient(135deg,#4caf50,#388e3c);color:#fff;cursor:pointer;font-size:13px;font-weight:bold;">+ 添加</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button id="debug-item-clear-btn" style="padding:4px 12px;border:none;border-radius:4px;background:rgba(244,67,54,0.3);color:#f44336;cursor:pointer;font-size:12px;">🗑 清空所有道具</button>
          <span style="color:#888;font-size:11px;">提示：道具数量受 maxStack 限制</span>
        </div>
      `;
      container.appendChild(control);

      setTimeout(() => {
        const select = document.getElementById('debug-item-select');
        const countInput = document.getElementById('debug-item-count');
        const addBtn = document.getElementById('debug-item-add-btn');
        const clearBtn = document.getElementById('debug-item-clear-btn');

        if (addBtn && select && countInput) {
          addBtn.addEventListener('click', () => {
            const ge = window.__gameEngine;
            if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
            if (!ge.itemSystem) { alert('道具系统未初始化'); return; }
            const itemId = select.value;
            const count = parseInt(countInput.value) || 1;
            ge.itemSystem.addItem(itemId, count);
            window.eventBus.emit('notification', {
              message: `🎒 已添加 ${count} 个 ${ItemSystem.ITEM_DEFS[itemId].icon} ${ItemSystem.ITEM_DEFS[itemId].name}`,
              type: 'info',
            });
          });
          countInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addBtn.click();
          });
        }
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            const ge = window.__gameEngine;
            if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
            if (!ge.itemSystem) { alert('道具系统未初始化'); return; }
            ge.itemSystem.items = {};
            window.eventBus.emit('items:updated', {});
            window.eventBus.emit('notification', {
              message: '🗑 已清空所有道具',
              type: 'info',
            });
          });
        }
      }, 50);
    }

    // 祝福页签顶部工具栏
    if (tab === 'boons') {
      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';
      
      const unlockBtn = document.createElement('button');
      unlockBtn.textContent = '🔓 解锁祝福数量上限';
      unlockBtn.style.cssText = 'padding:6px 14px;background:linear-gradient(135deg,#ff7043,#ff5722);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;';
      unlockBtn.title = '将祝福数量上限设置为无上限（仅限本局）';
      unlockBtn.addEventListener('click', () => {
        const bs = window.__boonSystem;
        if (bs) {
          bs.maxBoons = Infinity;
          window.eventBus.emit('notification', {
            message: '🔓 祝福数量上限已解锁为无上限（仅限本局）',
            type: 'info',
          });
        } else {
          alert('祝福系统未初始化');
        }
      });
      toolbar.appendChild(unlockBtn);
      container.appendChild(toolbar);
    }

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
      // 三种事件类型配置
      var eventCategories = [
        {
          id: 'emergency',
          label: '⚡ 紧急事件',
          count: EMERGENCY_EVENTS.length,
          items: EMERGENCY_EVENTS.map(function(e) { return {
            id: e.id, icon: e.icon, name: e.name, desc: e.description,
            rarity: null, category: e.category,
            duration: (e.durationMs / 1000).toFixed(0),
            data: e, type: 'event',
          };}),
        },
        {
          id: 'random',
          label: '🎲 随机事件',
          count: Object.values(EVENT_POOL).flat().length,
          items: (function() {
            var stageLabels = { early: '早期', mid: '中期', late: '后期' };
            var arr = [];
            Object.keys(EVENT_POOL).forEach(function(stage) {
              EVENT_POOL[stage].forEach(function(e) {
                arr.push({
                  id: e.id, icon: '❓', name: e.title, desc: e.description,
                  rarity: null, category: stage,
                  stageLabel: stageLabels[stage] || stage,
                  options: e.options, data: e, type: 'randomevent',
                });
              });
            });
            return arr;
          })(),
        },
        {
          id: 'crisis',
          label: '⚠ 危机事件',
          count: CrisisSystem.EVENTS.length,
          items: CrisisSystem.EVENTS.map(function(e) { return {
            id: e.id, icon: e.icon, name: e.name, desc: e.description,
            duration: (e.duration / 1000).toFixed(0),
            data: e, type: 'crisisevent',
          };}),
        },
      ];
      var accordion = document.createElement('div');
      accordion.className = 'debug-accordion';
      accordion.style.cssText = 'margin-top:4px;';
      eventCategories.forEach(function(cat) {
        var section = document.createElement('div');
        section.className = 'debug-accordion-section';
        var header = document.createElement('div');
        header.className = 'debug-accordion-header';
        header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#ddd;transition:all 0.2s;';
        header.innerHTML = cat.label + ' <span style="font-weight:400;color:#888;font-size:12px;">(' + cat.count + ')</span>';
        header.dataset.catId = cat.id;
        header.addEventListener('mouseenter', function() { this.style.background = 'rgba(255,255,255,0.1)'; });
        header.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,0.06)'; });
        var body = document.createElement('div');
        body.className = 'debug-accordion-body';
        body.style.cssText = 'display:none;';
        var subList = document.createElement('div');
        subList.className = 'debug-list';
        cat.items.forEach(function(subItem) {
          var el = document.createElement('div');
          el.className = 'debug-item';
          el.dataset.searchText = subItem.name + ' ' + subItem.desc + ' ' + subItem.id;
          var catLabel = '';
          if (subItem.type === 'event') {
            catLabel = subItem.category === 'positive' ? '增益' : subItem.category === 'negative' ? '负面' : subItem.category === 'challenge' ? '挑战' : '随机';
          } else if (subItem.type === 'randomevent') {
            catLabel = subItem.stageLabel || '随机';
          } else if (subItem.type === 'crisisevent') {
            catLabel = '危机';
          }
          var extraInfo = '';
          if (subItem.type === 'event' && subItem.duration) {
            extraInfo = '<span class="debug-extra">⏱ ' + subItem.duration + 's</span>';
          }
          if (subItem.type === 'crisisevent' && subItem.duration) {
            extraInfo = '<span class="debug-extra">⏱ ' + subItem.duration + 's</span>';
          }
          el.innerHTML = '<div class="debug-item-icon">' + subItem.icon + '</div>' +
            '<div class="debug-item-info">' +
              '<div class="debug-item-name">' + subItem.name + ' <span class="debug-cat-tag">' + catLabel + '</span></div>' +
              '<div class="debug-item-desc">' + subItem.desc + '</div>' +
              (extraInfo ? '<div class="debug-item-extra">' + extraInfo + '</div>' : '') +
            '</div>' +
            '<button class="debug-add-btn" data-type="' + subItem.type + '" data-id="' + subItem.id + '">+ 触发</button>';
          el.querySelector('.debug-add-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            applyItem(subItem);
          });
          subList.appendChild(el);
        });
        body.appendChild(subList);
        section.appendChild(header);
        section.appendChild(body);
        accordion.appendChild(section);
        header.addEventListener('click', function() {
          var allBodies = accordion.querySelectorAll('.debug-accordion-body');
          var allHeaders = accordion.querySelectorAll('.debug-accordion-header');
          var isOpening = body.style.display !== 'block';
          allBodies.forEach(function(b) { b.style.display = 'none'; });
          allHeaders.forEach(function(h) { h.style.background = 'rgba(255,255,255,0.06)'; h.style.borderColor = 'rgba(255,255,255,0.1)'; });
          if (isOpening) {
            body.style.display = 'block';
            header.style.background = 'rgba(255,255,255,0.12)';
            header.style.borderColor = 'rgba(255,165,0,0.5)';
          }
        });
      });
      var firstBody = accordion.querySelector('.debug-accordion-body');
      var firstHeader = accordion.querySelector('.debug-accordion-header');
      if (firstBody) firstBody.style.display = 'block';
      if (firstHeader) { firstHeader.style.background = 'rgba(255,255,255,0.12)'; firstHeader.style.borderColor = 'rgba(255,165,0,0.5)'; }
      container.appendChild(accordion);
      return;
} else if (tab === 'ultimates') {
      // 从游戏引擎获取全部大招池
      const ge = window.__gameEngine;
      let ultimates = [];
      if (ge && ge._ultimates) {
        ultimates = ge._ultimates;
      }
      items = ultimates.map((u) => ({
        id: u.id,
        icon: u.icon,
        name: u.name,
        desc: u.desc,
        rageCost: u.rageCost,
        cooldown: (u.cooldown / 1000).toFixed(0),
        unlockBoon: u.unlockBoon || null,
        isBase: !u.unlockBoon,
        type: 'ultimate',
      }));
    } else if (tab === 'items') {
      const defs = ItemSystem.ITEM_DEFS;
      items = Object.keys(defs).map((id) => ({
        id: id,
        icon: defs[id].icon,
        name: defs[id].name,
        desc: defs[id].description,
        maxStack: defs[id].maxStack,
        type: 'item',
      }));
    } else if (tab === 'crisisevents') {
      items = CrisisSystem.EVENTS.map((e) => ({
        id: e.id,
        icon: e.icon,
        name: e.name,
        desc: e.description,
        duration: (e.duration / 1000).toFixed(0),
        data: e,
        type: 'crisisevent',
      }));
    } else if (tab === 'bosses') {
      items = BOSS_CONFIGS.map((b) => ({
        id: b.id,
        icon: b.icon,
        name: b.name,
        desc: b.description,
        floor: b.floor,
        specialRule: b.specialRule,
        targetScoreMultiplier: b.targetScoreMultiplier,
        mechanics: b.mechanics,
        data: b,
        type: 'boss',
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
      else if (item.type === 'ultimate') catLabel = '大招';
      else if (item.type === 'boss') catLabel = 'Boss';
      else if (item.type === 'item') catLabel = '道具';
      else if (item.type === 'item') catLabel = '道具';
      else if (item.type === 'item') catLabel = '道具';

      // 额外信息
      let extraInfo = '';
      if (item.type === 'event' && item.duration) {
        extraInfo = `<span class="debug-extra">⏱ ${item.duration}s</span>`;
      }
      if (item.compensation) {
        extraInfo = `<span class="debug-extra">补偿: ${item.compensation}</span>`;
      }
      if (item.type === 'ultimate') {
        if (item.isBase) {
          extraInfo = `
            <span class="debug-extra">⚡ ${item.rageCost} 怒气</span>
            <span class="debug-extra">⏱ 冷却 ${item.cooldown}s</span>
            <span class="debug-extra">✅ 基础大招（默认可用）</span>
          `;
        } else {
          const hasBoon = window.__boonSystem && window.__boonSystem.hasBoon(item.unlockBoon);
          const statusIcon = hasBoon ? '✅' : '🔒';
          extraInfo = `
            <span class="debug-extra">⚡ ${item.rageCost} 怒气</span>
            <span class="debug-extra">⏱ 冷却 ${item.cooldown}s</span>
            <span class="debug-extra">${statusIcon} 需要祝福解锁</span>
          `;
        }
      }
      if (item.type === 'item') {
        extraInfo = `<span class="debug-extra">📦 最大堆叠: ${item.maxStack}</span>`;
      }
      if (item.type === 'item') {
        extraInfo = `<span class="debug-extra">📦 最大堆叠: ${item.maxStack}</span>`;
      }
      if (item.type === 'item') {
        extraInfo = `<span class="debug-extra">📦 最大堆叠: ${item.maxStack}</span>`;
      }
      if (item.type === 'boss') {
        // 构建机制参数列表
        let mechHtml = '';
        const mech = item.mechanics;
        if (mech) {
          const labels = {
            scorchInterval: '灼烧间隔',
            scorchDuration: '灼烧持续',
            spreadChance: '蔓延概率',
            rageThreshold: '愤怒阈值',
            rageCooldownPenalty: '冷却惩罚',
            freezeInterval: '冻结间隔',
            freezeDuration: '冻结持续',
            thawMergeCount: '解冻合成数',
            blizzardThreshold: '暴风雪阈值',
            blizzardPauseDuration: '暴风雪暂停',
            waveInterval: '波动间隔',
            chaosSpawnInterval: '混沌生成间隔',
            chaosIcon: '混沌图标',
            waveLevelRange: '波动范围',
            timeLimit: '时间限制',
            devourInterval: '吞噬间隔',
            orderDelay: '订单延缓',
            unsealInterval: '解封间隔',
            mirrorInterval: '镜像间隔',
            mirrorDuration: '镜像持续',
            scorePerBoonPercent: '祝福加成%',
          };
          Object.keys(mech).forEach((k) => {
            const label = labels[k] || k;
            let val = mech[k];
            if (typeof val === 'number') {
              if (k.includes('Interval') || k.includes('Duration') || k.includes('PauseDuration') || k === 'timeLimit' || k === 'devourInterval' || k === 'orderDelay' || k === 'unsealInterval' || k === 'mirrorInterval' || k === 'mirrorDuration') {
                val = (val / 1000).toFixed(0) + 's';
              } else if (k === 'spreadChance' || k === 'scorePerBoonPercent' || k === 'rageCooldownPenalty') {
                val = (val * 100).toFixed(0) + '%';
              }
            }
            mechHtml += `<span class="debug-extra">${label}: ${val}</span> `;
          });
        }
        extraInfo = `
          <span class="debug-extra">🏛 第 ${item.floor} 层</span>
          <span class="debug-extra">📈 ×${item.targetScoreMultiplier}</span>
          <span class="debug-extra">⚙ ${item.specialRule}</span>
          <div style="margin-top:3px;">${mechHtml}</div>
        `;
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
        ${item.type === 'ultimate' && !item.isBase
          ? `<button class="debug-add-btn debug-add-boon-btn" data-type="add_boon" data-id="${item.unlockBoon}" title="添加对应祝福">+ 祝福</button>`
          : item.type === 'ultimate' && item.isBase
          ? `<button class="debug-add-btn" disabled style="opacity:0.5;cursor:default;">默认可用</button>`
          : `<button class="debug-add-btn" data-type="${item.type}" data-id="${item.id}">+ 添加</button>`
        }
      `;

      // 大招页签的按钮：点击添加对应祝福
      if (item.type === 'ultimate' && !item.isBase) {
        el.querySelector('.debug-add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          // 查找 BOON_POOL 中对应的祝福
          const boon = BOON_POOL.find((b) => b.id === item.unlockBoon);
          if (boon) {
            applyItem({
              type: 'boon',
              id: boon.id,
              icon: boon.icon,
              name: boon.name,
              desc: boon.description,
              rarity: boon.rarity,
              category: boon.category,
              data: boon,
            });
          } else {
            alert(`祝福「${item.unlockBoon}」未在 BOON_POOL 中找到，请先在配置中添加`);
          }
        });
      } else {
        el.querySelector('.debug-add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          applyItem(item);
        });
      }

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

    if (item.type === 'item') {
      const ge = window.__gameEngine;
      if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
      if (!ge.itemSystem) { alert('道具系统未初始化'); return; }
      const def = ItemSystem.ITEM_DEFS[item.id];
      if (!def) return;
      ge.itemSystem.addItem(item.id, 1);
      window.eventBus.emit('notification', {
        message: `🎒 已添加 ${def.icon} ${def.name}`,
        type: 'info',
      });
      return;
    }

    if (item.type === 'item') {
      const ge = window.__gameEngine;
      if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
      if (!ge.itemSystem) { alert('道具系统未初始化'); return; }
      const def = ItemSystem.ITEM_DEFS[item.id];
      if (!def) return;
      ge.itemSystem.addItem(item.id, 1);
      window.eventBus.emit('notification', {
        message: `🎒 已添加 ${def.icon} ${def.name}`,
        type: 'info',
      });
      return;
    }

    if (item.type === 'item') {
      const ge = window.__gameEngine;
      if (!ge || !ge.state.isPlaying) { alert('游戏未在进行中'); return; }
      if (!ge.itemSystem) { alert('道具系统未初始化'); return; }
      const def = ItemSystem.ITEM_DEFS[item.id];
      if (!def) return;
      ge.itemSystem.addItem(item.id, 1);
      window.eventBus.emit('notification', {
        message: `🎒 已添加 ${def.icon} ${def.name}`,
        type: 'info',
      });
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
    } else if (item.type === 'randomevent') {
      // 在调试工具内部显示事件选择，避免触发外部弹窗覆盖调试面板
      const es = window.__eventSystem;
      if (!es) {
        alert('事件系统未初始化（经典模式不支持随机事件）');
        return;
      }
      // 获取调试面板内容区，在其上方插入事件选择区域
      const content = _overlay.querySelector('.debug-content');
      if (!content) return;

      // 移除已有的事件选择区域
      const existing = content.querySelector('.debug-event-chooser');
      if (existing) existing.remove();

      const chooser = document.createElement('div');
      chooser.className = 'debug-event-chooser';
      chooser.style.cssText = `
        background: linear-gradient(135deg, #2d1b00, #1a0f00);
        border: 1px solid #ff980044; border-radius: 10px;
        padding: 14px 16px; margin-bottom: 10px;
        position: relative;
      `;

      let optionsHtml = '';
      item.options.forEach((opt, i) => {
        optionsHtml += `
          <button class="debug-event-opt-btn" data-idx="${i}" style="
            display:block; width:100%; margin:6px 0; padding:8px 12px;
            background:rgba(255,152,0,0.08); border:1px solid #ff980066;
            border-radius:8px; color:#fff; cursor:pointer; font-size:13px;
            text-align:left; transition:all 0.2s;
          " onmouseenter="this.style.background='rgba(255,152,0,0.2)'" onmouseleave="this.style.background='rgba(255,152,0,0.08)'">
            <span style="color:#ff9800;font-weight:bold;">选项${i+1}:</span> ${opt.text}
            <br><span style="color:#aaa;font-size:11px;">→ ${opt.result}</span>
          </button>
        `;
      });

      chooser.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div><span style="font-size:22px;">❓</span> <strong style="color:#ff9800;font-size:15px;">${item.name}</strong></div>
          <button class="debug-event-close-btn" style="
            background:none; border:none; color:#888; cursor:pointer; font-size:18px; line-height:1;
          " title="关闭">✕</button>
        </div>
        <p style="color:#ccc;margin:0 0 10px;font-size:13px;line-height:1.4;">${item.desc}</p>
        <div>${optionsHtml}</div>
      `;

      // 插入到搜索框和列表之间
      const searchBox = content.querySelector('.debug-search');
      if (searchBox) {
        content.insertBefore(chooser, searchBox.nextSibling);
      } else {
        content.insertBefore(chooser, content.firstChild);
      }

      // 绑定选项点击
      chooser.querySelectorAll('.debug-event-opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const context = {
            rogueSystem: ge.rogueSystem,
            boonSystem: bs,
            gameEngine: ge,
          };
          const result = es.executeOption(item.data, idx, context);
          chooser.remove();
          hideDebugPanel();
          window.eventBus.emit('notification', {
            message: `🎲 事件「${item.name}」结果：${result.message}`,
            type: 'info',
          });
        });
      });

      // 绑定关闭按钮
      chooser.querySelector('.debug-event-close-btn').addEventListener('click', () => {
        chooser.remove();
      });
    } else if (item.type === 'boss') {
      // 将当前战斗切换为 Boss 战
      const floor = ge.state.level || (ge.rogueSystem ? ge.rogueSystem.getCurrentFloor() : 1);
      ge._initBossBattle(item.id, floor);
      hideDebugPanel();
      window.eventBus.emit('notification', {
        message: `👑 已切换至 Boss 战「${item.icon} ${item.name}」`,
        type: 'warning',
      });
    } else if (item.type === 'crisisevent') {
      // 触发危机事件
      if (!ge.crisisSystem) {
        alert('危机事件系统未初始化');
        return;
      }
      if (ge.crisisSystem._activeEvent) {
        alert('当前已有活跃危机事件，请等待结束再触发新事件');
        return;
      }
      // 直接触发指定危机事件
      const eventDef = item.data;
      ge.crisisSystem._activeEvent = {
        def: eventDef,
        endTime: Date.now() + eventDef.duration,
      };
      eventDef.apply(ge.crisisSystem);
      window.eventBus.emit('crisis:started', {
        id: eventDef.id,
        name: eventDef.name,
        icon: eventDef.icon,
        description: eventDef.description,
        duration: eventDef.duration,
      });
      window.eventBus.emit('notification', {
        message: `⚠️ 已触发危机事件「${item.icon} ${item.name}」`,
        type: 'warning',
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