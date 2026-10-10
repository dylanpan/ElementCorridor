/**
 * ============================================================
 * 游戏入口文件
 * 负责初始化所有模块并启动游戏。
 * ============================================================
 */

(function () {
  'use strict';

  let gameEngine = null;
  let uiManager = null;
  let boardRenderer = null;

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

    // 设置按钮事件
    setupButtons();

    // 尝试读取存档或开始新游戏
    if (gameEngine.hasSave()) {
      uiManager.showModal(
        '继续游戏',
        '检测到之前的游戏进度，是否继续？<br><small style="color:#888">选择"新游戏"将覆盖旧存档</small>'
      );
      uiManager.setModalButtonCallback(() => {
        gameEngine.load();
      });
      // 添加"新游戏"按钮
      const modalBtn = document.getElementById('modal-btn');
      if (modalBtn) {
        modalBtn.textContent = '继续游戏';
        // 额外添加一个新游戏按钮
        const modalFooter = modalBtn.parentElement;
        const newBtn = document.createElement('button');
        newBtn.className = 'modal-btn secondary';
        newBtn.textContent = '新游戏';
        newBtn.addEventListener('click', () => {
          uiManager.hideModal();
          gameEngine.startLevel(1);
        });
        modalFooter.appendChild(newBtn);
      }
    } else {
      // 直接开始第一关
      gameEngine.startLevel(1);
    }
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
  }

  // DOM 加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();