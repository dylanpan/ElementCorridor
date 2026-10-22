/**
 * ============================================================
 * 游戏入口文件
 * 负责初始化所有模块并启动游戏。
 * 支持经典模式与肉鸽模式两种玩法。
 * ============================================================
 */

(function () {
  'use strict';

  let gameEngine = null;
  let uiManager = null;
  let boardRenderer = null;
  let rogueSystem = null;
  let boonSystem = null;
  let eventSystem = null;
  let metaProgress = null;
  let rogueUIManager = null;

  /**
   * 初始化游戏
   */
  function initGame() {
    // 创建核心实例
    gameEngine = new GameEngine();
    uiManager = new UIManager();
    boardRenderer = new BoardRenderer('game-board');

    // 初始化UI
    uiManager.init();

    // 将UI注入引擎
    gameEngine.init(uiManager, boardRenderer);

    // 创建肉鸽系统实例
    boonSystem = new BoonSystem();
    eventSystem = new EventSystem();
    metaProgress = new MetaProgress();
    rogueSystem = new RogueSystem();
    rogueUIManager = new RogueUIManager();

    // 初始化肉鸽系统关联
    rogueSystem.init(boonSystem, eventSystem, metaProgress);
    rogueUIManager.init(rogueSystem, boonSystem, eventSystem, gameEngine);

    // 暴露全局引用供调试工具使用
    window.__gameEngine = gameEngine;
    window.gameEngine = gameEngine;
    window.__boonSystem = boonSystem;
    window.__eventSystem = eventSystem;

  // 设置按钮事件
    setupButtons();

    // 注册肉鸽事件
    registerRogueEvents();

    // 监听积分更新 → 更新棋盘上方显示
    window.eventBus.on('score:updated', (data) => {
      updateBoardScoreDisplay(data.score, data.targetScore);
    });

    // 监听评级面板的下一关按钮
    window.eventBus.on('ui:start-level', (level) => {
      gameEngine.startLevel(level);
    });

    // 显示主菜单
    showMainMenu();
  }

  /** 显示主菜单 */
  function showMainMenu() {
    const overlay = document.getElementById('game-overlay');
    const modal = document.getElementById('game-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalBtn = document.getElementById('modal-btn');

    overlay.style.display = 'flex';
    modalTitle.textContent = '🌿 灵素回廊';
    modalBody.innerHTML = `
      <div style="text-align:center; padding:10px 0;">
        <p style="color:#aaa; margin-bottom:20px;">准备好开始冒险了吗？</p>
        <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">

          <button id="menu-rogue-btn" class="menu-mode-btn" style="
            background:linear-gradient(135deg,#ff9800,#e65100); color:#fff;
            border:none; border-radius:12px; padding:18px 24px; cursor:pointer;
            font-size:16px; min-width:160px; transition:all 0.3s;
            box-shadow:0 4px 15px rgba(255,152,0,0.3);
          " onmouseenter="this.style.transform='translateY(-3px)'" onmouseleave="this.style.transform=''">
            <div style="font-size:32px; margin-bottom:6px;">⚔</div>
            <div style="font-weight:bold;">开始游戏</div>
            <div style="font-size:12px; opacity:0.8; margin-top:4px;">爬塔冒险 · 祝福Build</div>
          </button>
        </div>
        <div style="margin-top:16px; display:flex; gap:8px; justify-content:center;">
          <button id="menu-meta-btn" class="small-menu-btn" style="
            background:rgba(255,255,255,0.08); color:#ccc; border:1px solid #555;
            border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px;
          ">🌟 天赋树</button>
          <button id="menu-bestiary-btn" class="small-menu-btn" style="
            background:rgba(255,255,255,0.08); color:#ccc; border:1px solid #555;
            border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px;
          ">📖 图鉴</button>
        </div>
      </div>
    `;

    // 隐藏默认的确定按钮
    modalBtn.style.display = 'none';

    // 绑定菜单事件（延迟确保DOM渲染完成）
    setTimeout(() => {
      const rogueBtn = document.getElementById('menu-rogue-btn');
      const metaBtn = document.getElementById('menu-meta-btn');
      const bestiaryBtn = document.getElementById('menu-bestiary-btn');

      if (rogueBtn) rogueBtn.onclick = startRogueMode;
      if (metaBtn) metaBtn.onclick = showTalentTree;
      if (bestiaryBtn) bestiaryBtn.onclick = showBestiary;
    }, 50);
  }


  /** 启动肉鸽模式 */
  function startRogueMode() {
    hideMenuOverlay();

    // 重置所有肉鸽系统
    boonSystem.reset();
    eventSystem.reset();
    rogueSystem.reset();

    // 注入到引擎
    gameEngine.isRogueMode = true;
    gameEngine.rogueSystem = rogueSystem;
    gameEngine.boonSystem = boonSystem;
    gameEngine._guardianShieldUses = 0;

    // 隐藏经典模式的存档按钮
    document.querySelector('.header-right').style.display = 'none';

    // 先选初始祝福
    rogueUIManager.showInitialBoonSelect(() => {
      // 开始冒险
      rogueSystem.startRun();
      // 显示第一层地图
      window.eventBus.emit('rogue:show-floor-map', {
        floor: rogueSystem.getCurrentFloor(),
        nodes: rogueSystem.state.nodes,
      });
    });
  }

  /** 隐藏菜单遮罩 */
  function hideMenuOverlay() {
    const overlay = document.getElementById('game-overlay');
    overlay.style.display = 'none';
    const modalBtn = document.getElementById('modal-btn');
    modalBtn.style.display = 'inline-block';
  }

  /** 显示天赋树 */
  function showTalentTree() {
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const modalBtn = document.getElementById('modal-btn');

    modalTitle.textContent = '🌟 天赋树 · 局外成长';
    modalBtn.style.display = 'inline-block';
    modalBtn.textContent = '返回';

    const effects = metaProgress.getActiveEffects();
    let talentsHtml = '';
    const defs = MetaProgress.TALENT_DEFS;

    for (const [id, def] of Object.entries(defs)) {
      const unlocked = metaProgress.isTalentUnlocked(id);
      const canUnlock = !unlocked && (
        def.requires.every(r => metaProgress.isTalentUnlocked(r))
      );
      const resourceStr = def.type === 'stardust'
        ? `✨ ${def.cost} 星尘`
        : `🏆 ${def.cost} 奖杯`;
      const hasResource = def.type === 'stardust'
        ? metaProgress.getStardust() >= def.cost
        : metaProgress.getTrophies() >= def.cost;

      talentsHtml += `
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 14px; margin:6px 0;
          background:${unlocked ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.03)'};
          border:1px solid ${unlocked ? '#4caf50' : canUnlock ? '#ffd700' : '#333'};
          border-radius:8px; opacity:${canUnlock || unlocked ? 1 : 0.5};
        ">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">${def.icon}</span>
            <div>
              <div style="color:#fff;font-weight:bold;font-size:14px;">${def.name}</div>
              <div style="color:#aaa;font-size:12px;">${def.description}</div>
            </div>
          </div>
          <div>
            ${unlocked ? '<span style="color:#4caf50;font-weight:bold;">✓ 已解锁</span>'
              : `<button class="talent-unlock-btn" data-id="${id}" style="
                  padding:6px 14px; background:${hasResource ? 'linear-gradient(135deg,#ffd700,#ff9800)' : '#555'};
                  color:${hasResource ? '#000' : '#999'}; border:none; border-radius:6px;
                  cursor:${hasResource ? 'pointer' : 'not-allowed'}; font-size:12px;
                " ${!hasResource ? 'disabled' : ''}>${resourceStr}</button>`}
          </div>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div style="margin-bottom:12px; text-align:center; color:#aaa; font-size:13px;">
        ✨ 星尘: <strong style="color:#ffd700;">${metaProgress.getStardust()}</strong>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        🏆 奖杯: <strong style="color:#ffd700;">${metaProgress.getTrophies()}</strong>
      </div>
      <div style="max-height:55vh; overflow-y:auto; padding-right:4px;">
        ${talentsHtml}
      </div>
    `;

    // 给弹窗容器添加最大高度限制
    const modal = document.getElementById('game-modal');
    if (modal) modal.style.maxHeight = '80vh';

    modalBtn.onclick = () => {
      showMainMenu();
    };

    // 绑定解锁按钮
    setTimeout(() => {
      document.querySelectorAll('.talent-unlock-btn').forEach(btn => {
        btn.onclick = () => {
          const result = metaProgress.unlockTalent(btn.dataset.id);
          if (result.success) {
            showTalentTree(); // 刷新界面
          } else {
            alert(result.reason);
          }
        };
      });
    }, 50);
  }

  /** 显示图鉴 */
  function showBestiary() {
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const modalBtn = document.getElementById('modal-btn');

    modalTitle.textContent = '📖 图鉴收藏';
    modalBtn.style.display = 'inline-block';
    modalBtn.textContent = '返回';

    const progress = metaProgress.getBestiaryProgress();
    const collectedBoons = metaProgress.data.bestiary.boons;
    const collectedCurses = metaProgress.data.bestiary.curses;
    const collectedEvents = metaProgress.data.bestiary.events;
    const collectedBosses = metaProgress.data.bestiary.bosses;

    // 生成祝福列表
    let boonHtml = '';
    BOON_POOL.forEach(b => {
      const found = collectedBoons.includes(b.id);
      boonHtml += `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; margin:2px 0;
          background:${found ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.02)'};
          border-radius:6px; border:1px solid ${found ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)'};
          opacity:${found ? 1 : 0.5};">
          <span style="font-size:18px;">${found ? b.icon : '❓'}</span>
          <span style="flex:1; color:${found ? '#fff' : '#666'}; font-size:13px;">
            ${b.name}
            <span style="color:${BOON_RARITY[b.rarity].color}; font-size:11px; margin-left:4px;">[${BOON_RARITY[b.rarity].label}]</span>
          </span>
          <span style="font-size:11px; color:#888;">${b.category}</span>
          <span style="font-size:16px;">${found ? '✅' : '❌'}</span>
        </div>`;
    });

    // 生成诅咒列表
    let curseHtml = '';
    CURSE_POOL.forEach(c => {
      const found = collectedCurses.includes(c.id);
      curseHtml += `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; margin:2px 0;
          background:${found ? 'rgba(244,67,54,0.08)' : 'rgba(255,255,255,0.02)'};
          border-radius:6px; border:1px solid ${found ? 'rgba(244,67,54,0.25)' : 'rgba(255,255,255,0.05)'};
          opacity:${found ? 1 : 0.5};">
          <span style="font-size:18px;">${found ? c.icon : '❓'}</span>
          <span style="flex:1; color:${found ? '#ff8a80' : '#666'}; font-size:13px;">${c.name}</span>
          <span style="font-size:16px;">${found ? '✅' : '❌'}</span>
        </div>`;
    });

    // 生成事件列表
    let eventHtml = '';
    Object.values(EVENT_POOL).flat().forEach(e => {
      const found = collectedEvents.includes(e.id);
      eventHtml += `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; margin:2px 0;
          background:${found ? 'rgba(33,150,243,0.06)' : 'rgba(255,255,255,0.02)'};
          border-radius:6px; border:1px solid ${found ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)'};
          opacity:${found ? 1 : 0.5};">
          <span style="font-size:14px; width:20px; text-align:center;">${found ? '📜' : '❓'}</span>
          <span style="flex:1; color:${found ? '#90caf9' : '#666'}; font-size:13px;">${e.title}</span>
          <span style="font-size:16px;">${found ? '✅' : '❌'}</span>
        </div>`;
    });

    // 生成Boss列表
    let bossHtml = '';
    BOSS_CONFIGS.forEach(b => {
      const found = collectedBosses.includes(b.id);
      bossHtml += `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; margin:2px 0;
          background:${found ? 'rgba(255,152,0,0.08)' : 'rgba(255,255,255,0.02)'};
          border-radius:6px; border:1px solid ${found ? 'rgba(255,152,0,0.3)' : 'rgba(255,255,255,0.05)'};
          opacity:${found ? 1 : 0.5};">
          <span style="font-size:18px;">${found ? b.icon : '❓'}</span>
          <span style="flex:1; color:${found ? '#ffcc80' : '#666'}; font-size:13px;">${b.name}（第 ${b.floor} 层）</span>
          <span style="font-size:16px;">${found ? '✅' : '❌'}</span>
        </div>`;
    });

    modalBody.innerHTML = `
      <div style="max-height:500px; overflow-y:auto; padding-right:4px;">
        <!-- 总进度 -->
        <div style="text-align:center; margin-bottom:12px; position:sticky; top:0; background:#1a1a2e; z-index:1; padding-bottom:8px;">
          <div style="font-size:36px;">📚</div>
          <div style="color:#aaa; font-size:14px;">
            收集进度: <strong style="color:#ffd700;">${progress.collected} / ${progress.total}</strong>
            (${progress.percent}%)
          </div>
          <div style="background:#333; height:6px; border-radius:3px; margin:8px auto; max-width:300px;">
            <div style="background:linear-gradient(90deg,#ffd700,#ff9800); height:6px; border-radius:3px; width:${progress.percent}%;"></div>
          </div>
        </div>

        <!-- 祝福分类 -->
        <details open>
          <summary style="color:#81c784; font-size:15px; font-weight:bold; cursor:pointer; padding:6px 0;">
            ✨ 祝福（${collectedBoons.length}/${BOON_POOL.length}）
          </summary>
          ${boonHtml}
        </details>

        <!-- 诅咒分类 -->
        <details>
          <summary style="color:#ef9a9a; font-size:15px; font-weight:bold; cursor:pointer; padding:6px 0; margin-top:8px;">
            💀 诅咒（${collectedCurses.length}/${CURSE_POOL.length}）
          </summary>
          ${curseHtml}
        </details>

        <!-- 事件分类 -->
        <details>
          <summary style="color:#90caf9; font-size:15px; font-weight:bold; cursor:pointer; padding:6px 0; margin-top:8px;">
            📜 事件（${collectedEvents.length}/${Object.values(EVENT_POOL).flat().length}）
          </summary>
          ${eventHtml}
        </details>

        <!-- Boss分类 -->
        <details>
          <summary style="color:#ffcc80; font-size:15px; font-weight:bold; cursor:pointer; padding:6px 0; margin-top:8px;">
            👑 Boss（${collectedBosses.length}/${BOSS_CONFIGS.length}）
          </summary>
          ${bossHtml}
        </details>
      </div>
    `;

    modalBtn.onclick = () => {
      showMainMenu();
    };
  }

  /** 显示肉鸽模式左侧面板 */
  function showRogueStatusBar() {
    // 切换左侧面板：隐藏经典关卡信息，显示肉鸽信息
    const classicInfo = document.getElementById('classic-level-info');
    const rogueInfo = document.getElementById('rogue-level-info');
    if (classicInfo) classicInfo.style.display = 'none';
    if (rogueInfo) rogueInfo.style.display = 'flex';
    // 隐藏顶部标题
    const headerLeft = document.querySelector('.header-left');
    if (headerLeft) headerLeft.style.display = 'none';
  }

  /** 隐藏肉鸽模式左侧面板 */
  function hideRogueStatusBar() {
    // 恢复左侧面板：显示经典关卡信息，隐藏肉鸽信息
    const classicInfo = document.getElementById('classic-level-info');
    const rogueInfo = document.getElementById('rogue-level-info');
    if (classicInfo) classicInfo.style.display = 'block';
    if (rogueInfo) rogueInfo.style.display = 'none';
    // 恢复顶部标题
    const headerLeft = document.querySelector('.header-left');
    if (headerLeft) headerLeft.style.display = 'flex';
  }

  /** 更新肉鸽状态栏 */
  function updateRogueStatusBar() {
    const floorNum = document.getElementById('rogue-floor-num');
    const goldDisplay = document.getElementById('rogue-gold');
    const boardBoonArea = document.getElementById('board-boon-area');

    if (floorNum && rogueSystem) {
      floorNum.textContent = rogueSystem.getCurrentFloor();
    }
    if (goldDisplay && rogueSystem) {
      goldDisplay.textContent = rogueSystem.getGold();
    }

    // 更新棋盘上方的祝福区域
    if (boardBoonArea && boonSystem) {
      const boons = boonSystem.getBoonSummary();
      const curses = boonSystem.getCurseSummary();
      const sealedIds = boonSystem.sealedBoons || [];
      let html = '';
      for (const b of boons) {
        const isSealed = sealedIds.includes(b.id);
        const sealedClass = isSealed ? ' rogue-boon-sealed' : '';
        html += `<span class="rogue-boon-icon rogue-boon-${b.rarity}${sealedClass}" data-boon-id="${b.id}">
          ${isSealed ? '<span class="rogue-boon-seal-overlay">🔒</span>' : ''}
          ${b.icon}
          <div class="rogue-item-tooltip">
            <div class="rogue-tooltip-name">${b.icon} ${b.name}</div>
            <div class="rogue-tooltip-desc">${b.description || ''}</div>
            ${isSealed ? '<div class="rogue-tooltip-sealed">🔒 已被封印</div>' : ''}
          </div>
        </span>`;
      }
      for (const c of curses) {
        const stageText = (c.currentStage != null && c.totalStages != null)
          ? `<div class="rogue-tooltip-stage">阶段 ${c.currentStage}/${c.totalStages}</div>`
          : '';
        const compText = c.compensation ? `<div class="rogue-tooltip-comp">补偿：${c.compensation}</div>` : '';
        html += `<span class="rogue-curse-icon">
          ${c.icon}
          <div class="rogue-item-tooltip">
            <div class="rogue-tooltip-name">${c.icon} ${c.name}</div>
            ${stageText}
            <div class="rogue-tooltip-desc">${c.description || '暂无描述'}</div>
            ${compText}
          </div>
        </span>`;
      }
      boardBoonArea.innerHTML = html;

      // 为每个图标绑定 mouseenter/mouseleave，动态检测 tooltip 是否超出视口
      boardBoonArea.querySelectorAll('.rogue-boon-icon, .rogue-curse-icon').forEach(el => {
        el.addEventListener('mouseenter', function() {
          const tip = this.querySelector('.rogue-item-tooltip');
          if (!tip) return;

          // 重置方向（恢复 CSS 默认的向下弹出）
          tip.style.top = '';
          tip.style.bottom = '';

          // 强制重排确保 tooltip 已渲染完成
          void tip.offsetHeight;

          const rect = tip.getBoundingClientRect();
          if (rect.bottom > window.innerHeight) {
            // 超出视口底部 → 改为向上弹出
            tip.style.top = 'auto';
            tip.style.bottom = 'calc(100% + 6px)';
          }
        });

        el.addEventListener('mouseleave', function() {
          const tip = this.querySelector('.rogue-item-tooltip');
          if (!tip) return;
          // 清除所有内联样式，恢复 CSS 控制
          tip.style.bottom = '';
          tip.style.top = '';
        });
      });
    }
  }

  /** 更新棋盘上方的积分显示与进度条 */
  function updateBoardScoreDisplay(score, targetScore) {
    const scoreEl = document.getElementById('board-score-display');
    const targetEl = document.getElementById('board-target-display');
    const progressFill = document.getElementById('board-progress-fill');
    if (scoreEl) scoreEl.textContent = score;
    if (targetEl) targetEl.textContent = targetScore;
    if (progressFill && targetScore > 0) {
      const pct = Math.min(100, Math.round(score / targetScore * 100));
      progressFill.style.width = pct + '%';
    }
  }

  /**
   * 注册肉鸽模式的事件监听
   */
  function registerRogueEvents() {
    window.eventBus.on('rogue:run-started', () => {
      showRogueStatusBar();
      updateRogueStatusBar();

      // 绑定左侧面板的地图按钮
      setTimeout(() => {
        const mapBtn = document.getElementById('rogue-map-btn-side');
        if (mapBtn) {
          mapBtn.onclick = () => {
            const data = rogueUIManager.getFloorMapData();
            window.eventBus.emit('rogue:show-floor-map', data);
          };
        }
        // 绑定层数徽章点击 → 展示历史路线图
        const floorBtn = document.getElementById('rogue-floor-btn');
        if (floorBtn) {
          floorBtn.onclick = () => {
            rogueUIManager.showFloorHistory();
          };
        }
      }, 100);
    });

    window.eventBus.on('rogue:floor-generated', () => {
      updateRogueStatusBar();
    });

    window.eventBus.on('rogue:gold-updated', () => {
      updateRogueStatusBar();
    });

    window.eventBus.on('rogue:boons-updated', () => {
      updateRogueStatusBar();
    });

    window.eventBus.on('rogue:curses-updated', () => {
      updateRogueStatusBar();
    });

    window.eventBus.on('rogue:return-to-menu', () => {
      gameEngine.destroy();
      hideRogueStatusBar();
      showMainMenu();
    });

    window.eventBus.on('rogue:start-new-run', () => {
      startRogueMode();
    });

    // 监听通关/失败
    window.eventBus.on('game:over', (data) => {
      if (gameEngine.isRogueMode && rogueSystem) {
        console.log('[肉鸽] game:over 触发, score:', gameEngine.state.score, 'target:', gameEngine.state.targetScore);
        // 检查是否达到目标分数
        if (gameEngine.state.score >= gameEngine.state.targetScore) {
          // 完成当前节点
          const node = rogueSystem.getCurrentNode();
          if (!node) { console.error('[肉鸽] 当前节点为空，无法推进'); return; }
          console.log('[肉鸽] 完成节点:', node.type);
          
          const goldReward = node.type === 'elite' ? ROGUE_DIFFICULTY.eliteGoldMultiplier * 
            (ROGUE_DIFFICULTY.goldBase + rogueSystem.getCurrentFloor() * ROGUE_DIFFICULTY.goldPerFloor)
            : ROGUE_DIFFICULTY.goldBase + rogueSystem.getCurrentFloor() * ROGUE_DIFFICULTY.goldPerFloor;
          
          rogueSystem.addGold(goldReward);
          rogueSystem.completeNode({ type: node.type, rewards: { gold: goldReward } });

          // 记录Boss战
          if (node.type === 'boss' && node.bossId && metaProgress) {
            metaProgress.recordBoss(node.bossId);
          }

          // 战斗关结束后给祝福奖励（本层结束时）
          const giveCombatReward = () => {
            if (node.type === 'combat' || node.type === 'elite') {
              const count = 1;
              const boons = boonSystem.pickRandomBoons(count, node.type === 'elite' ? 'rare' : null);
              if (boons.length > 0) {
                return new Promise((resolve) => {
                  window.eventBus.emit('rogue:show-boon-select', {
                    boons,
                    title: node.type === 'elite' ? '💀 精英奖励 · 祝福选择' : '⚔ 战斗胜利 · 祝福选择',
                    onPick: (idx) => {
                      boonSystem.addBoon(boons[idx]);
                      if (metaProgress) metaProgress.recordBoon(boons[idx].id);
                      resolve();
                    },
                  });
                });
              }
            }
            return Promise.resolve();
          };

          // 检查是否有下一个节点
          const hasNext = rogueSystem.advanceToNextNode();
          console.log('[肉鸽] advanceToNextNode, hasNext:', hasNext, 'currentNodeIndex:', rogueSystem.state.currentNodeIndex, 'nodes.length:', rogueSystem.state.nodes.length);
          
          if (!hasNext) {
            // 本层结束，先给战斗奖励，再进入下一层
            giveCombatReward().then(() => {
              rogueSystem.nextFloor();
              if (rogueSystem.state.runState === 'won') return;
              setTimeout(() => {
                window.eventBus.emit('rogue:show-floor-map', {
                  floor: rogueSystem.getCurrentFloor(),
                  nodes: rogueSystem.state.nodes,
                });
              }, 500);
            });
          } else {
            // 有下一个节点，根据类型路由
            const nextNode = rogueSystem.getCurrentNode();
            console.log('[肉鸽] 下一个节点:', nextNode ? nextNode.type : null);
            
            if (!nextNode) {
              console.error('[肉鸽] 下一个节点为空');
              return;
            }
            
            const isCombatNode = ['combat', 'elite', 'boss'].includes(nextNode.type);
            console.log('[肉鸽] 路由决策: isCombatNode=', isCombatNode, 'type=', nextNode.type);
            
            if (isCombatNode) {
              // 下一个是战斗节点，直接启动
              setTimeout(() => {
                gameEngine.startRogueLevel(rogueSystem.getTargetScore(), nextNode);
              }, 600);
            } else {
              // 下一个是非战斗节点，通过 UI 管理器展示对应界面
              console.log('[肉鸽] 即将调用 startCurrentNode');
              setTimeout(() => {
                console.log('[肉鸽] 执行 startCurrentNode');
                rogueUIManager.startCurrentNode();
              }, 400);
            }
          }
        }
      }
    });

    // 监听失败
    window.eventBus.on('game:failed', () => {
      if (gameEngine.isRogueMode && rogueSystem) {
        rogueSystem.loseRun();
      }
    });
  }

  /**
   * 设置界面按钮事件
   */
  function setupButtons() {
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        if (confirm('确定要重新开始吗？当前进度将丢失。')) {
          StorageManager.deleteSave();
          gameEngine.startLevel(1);
        }
      });
    }

    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        gameEngine.save();
      });
    }

    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        if (!gameEngine.load()) {
          alert('没有找到存档');
        }
      });
    }

    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    if (refreshOrdersBtn) {
      refreshOrdersBtn.addEventListener('click', () => {
        // 肉鸽模式：检查免费刷新祝福
        if (gameEngine.isRogueMode && boonSystem && boonSystem.isFreeRefresh()) {
          gameEngine.systems.order.refreshOrders(gameEngine.state.score, true);
          window.eventBus.emit('orders:updated', gameEngine.systems.order.getOrders());
          window.eventBus.emit('notification', {
            message: '🔄 免费刷新订单',
            type: 'info',
          });
          return;
        }

        const result = gameEngine.systems.order.refreshOrders(gameEngine.state.score);
        if (!result) {
          window.eventBus.emit('notification', {
            message: `积分不足，刷新需要 ${GAME_SETTINGS.orderRefreshCost} 分`,
            type: 'warning',
          });
        } else {
          gameEngine.state.score -= result.cost;
          window.eventBus.emit('score:updated', {
            score: gameEngine.state.score,
            targetScore: gameEngine.state.targetScore,
          });
          window.eventBus.emit('notification', {
            message: `已刷新订单（消耗 ${result.cost} 分）`,
            type: 'info',
          });
        }
      });
    }

    // ====== 帮助弹窗 ======
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        let overlay = document.getElementById('help-modal-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'help-modal-overlay';
          overlay.innerHTML = `
            <div id="help-modal-box">
              <button class="help-modal-close" id="help-modal-close-btn">✕</button>
              <h3>❓ 操作说明</h3>
              <ul class="help-modal-list">
                <li>点击 <strong>发射器</strong> 产出基础元素</li>
                <li>点击选中棋盘上的元素</li>
                <li>点击另一个 <strong>同类型同等级</strong> 元素进行合成</li>
                <li>点击空位可移动选中的元素</li>
                <li>点击 <strong>订单卡片</strong> 提交匹配的元素获得积分</li>
                <li>达到目标积分即可通关！</li>
              </ul>
            </div>
          `;
          document.body.appendChild(overlay);

          // 关闭按钮
          const closeBtn = overlay.querySelector('#help-modal-close-btn');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              overlay.classList.remove('show');
            });
          }

          // 点击遮罩关闭
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
              overlay.classList.remove('show');
            }
          });
        }
        overlay.classList.add('show');
      });
    }
  }

  // DOM 加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();