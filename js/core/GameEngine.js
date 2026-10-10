/**
 * ============================================================
 * 游戏引擎 —— 核心控制器
 * 负责游戏状态管理、各系统协调、生命周期控制。
 * 这是整个游戏的"后端"逻辑层，不直接操作DOM。
 * 迁移至Godot时，此模块的逻辑可直接复用为 Godot 的 Autoload/Singleton。
 * ============================================================
 */
class GameEngine {
  constructor() {
    this.state = {
      level: 1,
      score: 0,
      targetScore: 100,
      isPlaying: false,
      isPaused: false,
      board: [],       // 二维数组 [row][col] -> Element | null
      emitters: [],    // Emitter 实例列表
      levelConfig: null,
    };

    this.systems = {
      merge: new MergeSystem(),
      spawn: null,     // SpawnSystem 实例（依赖棋盘尺寸）
      order: new OrderSystem(),
    };

    this.uiManager = null;
    this.boardRenderer = null;
    this._gameLoopId = null;
    this._autoSaveId = null;
    this._lastFrameTime = 0;

    // 绑定事件
    window.eventBus.on('ui:order-clicked', (orderId) => this._onOrderClicked(orderId));
  }

  /**
   * 初始化引擎
   */
  init(uiManager, boardRenderer) {
    this.uiManager = uiManager;
    this.boardRenderer = boardRenderer;
    this.boardRenderer.onCellClick = (row, col) => this._onCellClick(row, col);
  }

  /**
   * 开始新游戏 / 加载关卡
   * @param {number} level - 关卡编号
   */
  startLevel(level) {
    const levelConfig = LEVEL_CONFIGS.find((c) => c.level === level);
    if (!levelConfig) {
      console.error(`关卡 ${level} 不存在`);
      return;
    }

    this.state.level = level;
    this.state.targetScore = levelConfig.targetScore;
    this.state.score = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.levelConfig = levelConfig;

    // 初始化棋盘
    const { boardCols, boardRows } = levelConfig;
    this.state.board = Array.from({ length: boardRows }, () =>
      Array.from({ length: boardCols }, () => null)
    );

    // 初始化产出系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);

    // 初始化棋盘渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 初始化发射器
    this.state.emitters = levelConfig.availableEmitters.map((id) => {
      const config = EMITTER_CONFIGS.find((c) => c.id === id);
      return config ? new Emitter(config) : null;
    }).filter(Boolean);

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 初始化订单系统
    this.systems.order.init(levelConfig.maxOrders, levelConfig.orderDifficultyWeights);
    this.systems.order.fillOrders();

    // 重置合成系统连击
    this.systems.merge.resetCombo();

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });
    window.eventBus.emit('level:loaded', levelConfig);

    // 启动游戏循环
    this._startGameLoop();

    // 启动自动存档
    this._startAutoSave();

    // 隐藏弹窗
    this.uiManager.hideModal();
  }

  /** 启动游戏循环（用于更新发射器冷却等） */
  _startGameLoop() {
    if (this._gameLoopId) cancelAnimationFrame(this._gameLoopId);
    this._lastFrameTime = performance.now();

    const loop = (timestamp) => {
      if (!this.state.isPlaying || this.state.isPaused) {
        this._gameLoopId = requestAnimationFrame(loop);
        return;
      }

      // 更新发射器状态（约每秒更新4次，减少性能开销）
      if (timestamp - this._lastFrameTime > 250) {
        window.eventBus.emit('emitters:updated', this.state.emitters);
        this._lastFrameTime = timestamp;
      }

      this._gameLoopId = requestAnimationFrame(loop);
    };

    this._gameLoopId = requestAnimationFrame(loop);
  }

  /** 停止游戏循环 */
  _stopGameLoop() {
    if (this._gameLoopId) {
      cancelAnimationFrame(this._gameLoopId);
      this._gameLoopId = null;
    }
  }

  /** 启动自动存档 */
  _startAutoSave() {
    this._stopAutoSave();
    this._autoSaveId = setInterval(() => {
      if (this.state.isPlaying) {
        StorageManager.save(this.serialize());
      }
    }, GAME_SETTINGS.autoSaveInterval);
  }

  /** 停止自动存档 */
  _stopAutoSave() {
    if (this._autoSaveId) {
      clearInterval(this._autoSaveId);
      this._autoSaveId = null;
    }
  }

  // ==================== 交互处理 ====================

  /** 点击发射器 */
  _onEmitterClick(emitterId) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    const emitter = this.state.emitters.find((e) => e.id === emitterId);
    if (!emitter) return;

    const now = Date.now();
    if (!emitter.isReadyToSpawn(now)) return;

    // 检查棋盘是否已满
    if (this.systems.spawn.isBoardFull(this.state.board)) {
      window.eventBus.emit('game:failed', {});
      return;
    }

    // 产出元素
    const element = emitter.spawn(now);
    if (!element) return;

    // 放置到棋盘
    const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
    if (!emptyCell) {
      window.eventBus.emit('game:failed', {});
      return;
    }

    this.systems.spawn.placeElement(this.state.board, element, emptyCell.row, emptyCell.col);
    this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
    this.boardRenderer.playSpawnAnimation(emptyCell.row, emptyCell.col);

    // 更新发射器UI
    window.eventBus.emit('emitters:updated', this.state.emitters);
  }

  /** 点击棋盘格子 */
  _onCellClick(row, col) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    const clickedElement = this.state.board[row][col];
    const selected = this.boardRenderer.selectedCell;

    if (!selected) {
      // 没有选中任何元素：选中点击的元素
      if (clickedElement) {
        this.boardRenderer.selectCell(row, col, this.state.board);
      }
      return;
    }

    // 已有选中的元素
    const selectedEl = this.state.board[selected.row][selected.col];

    if (!selectedEl) {
      // 选中的格子空了（可能被移走了），取消选中
      this.boardRenderer.deselectCell();
      return;
    }

    if (selected.row === row && selected.col === col) {
      // 点击同一个格子：取消选中
      this.boardRenderer.deselectCell();
      return;
    }

    if (!clickedElement) {
      // 点击空位：移动元素
      const success = this.systems.spawn.moveElement(
        this.state.board, selectedEl, row, col
      );
      if (success) {
        this.boardRenderer.updateCell(this.state.board, selected.row, selected.col);
        this.boardRenderer.updateCell(this.state.board, row, col);
        this.boardRenderer.deselectCell();
      }
      return;
    }

    // 点击了另一个元素：尝试合成
    const result = this.systems.merge.tryMerge(selectedEl, clickedElement, Date.now());
    if (result) {
      this._executeMerge(result, selected, { row, col });
    } else {
      // 不能合成：切换选中到新元素
      this.boardRenderer.selectCell(row, col, this.state.board);
    }
  }

  /** 执行合成操作 */
  _executeMerge(result, fromPos, toPos) {
    const { merged, consumed, comboCount, comboMultiplier } = result;

    // 从棋盘移除被消耗的两个元素
    for (const el of consumed) {
      this.systems.spawn.removeElement(this.state.board, el);
    }

    // 放置合成后的新元素（放在目标位置）
    this.systems.spawn.placeElement(this.state.board, merged, toPos.row, toPos.col);

    // 更新UI
    this.boardRenderer.updateCell(this.state.board, fromPos.row, fromPos.col);
    this.boardRenderer.updateCell(this.state.board, toPos.row, toPos.col);
    this.boardRenderer.playMergeAnimation(fromPos.row, fromPos.col, toPos.row, toPos.col);
    this.boardRenderer.deselectCell();

    // 更新连击显示
    window.eventBus.emit('combo:updated', {
      count: comboCount,
      multiplier: comboMultiplier,
    });

    // 通知合成事件
    window.eventBus.emit('notification', {
      message: `合成 ${merged.icon} Lv.${merged.level} ${merged.name}`,
      type: 'merge',
    });
  }

  /** 点击订单 */
  _onOrderClicked(orderId) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    const result = this.systems.order.submitOrder(
      orderId, this.state.board, this.systems.spawn
    );

    if (!result) {
      window.eventBus.emit('notification', {
        message: '棋盘上没有匹配的元素',
        type: 'warning',
      });
      return;
    }

    // 增加积分
    const reward = Math.floor(result.reward);
    this.state.score += reward;

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });

    // 刷新棋盘
    this.boardRenderer.renderAll(this.state.board);

    // 检查是否通关
    if (this.state.score >= this.state.targetScore) {
      this._onLevelComplete();
    }
  }

  /** 通关处理 */
  _onLevelComplete() {
    this.state.isPlaying = false;
    this._stopGameLoop();
    this._stopAutoSave();

    // 检查是否有下一关
    const nextLevel = this.state.level + 1;
    const hasNextLevel = LEVEL_CONFIGS.some((c) => c.level === nextLevel);

    if (hasNextLevel) {
      this.uiManager.setModalButtonCallback(() => {
        this.startLevel(nextLevel);
      });
      window.eventBus.emit('game:over', {
        level: this.state.level,
        score: this.state.score,
        nextLevel,
      });
    } else {
      this.uiManager.setModalButtonCallback(() => {
        this.startLevel(1);
      });
      this.uiManager.showModal('🏆 恭喜通关全部关卡！', '你已经完成了所有关卡！<br>点击按钮重新开始。');
    }
  }

  // ==================== 存档管理 ====================

  /** 序列化完整游戏状态 */
  serialize() {
    return {
      version: 1,
      timestamp: Date.now(),
      level: this.state.level,
      score: this.state.score,
      targetScore: this.state.targetScore,
      board: this.state.board.map((row) =>
        row.map((el) => (el ? el.serialize() : null))
      ),
      emitters: this.state.emitters.map((e) => e.serialize()),
      mergeSystem: this.systems.merge.serialize(),
      orderSystem: this.systems.order.serialize(),
      levelConfig: this.state.levelConfig,
    };
  }

  /** 从存档恢复 */
  loadFromSave(saveData) {
    if (!saveData || !saveData.version) return false;

    const levelConfig = saveData.levelConfig || LEVEL_CONFIGS[0];
    const { boardCols, boardRows } = levelConfig;

    this.state.level = saveData.level;
    this.state.score = saveData.score;
    this.state.targetScore = saveData.targetScore;
    this.state.isPlaying = true;
    this.state.levelConfig = levelConfig;

    // 恢复棋盘
    this.state.board = saveData.board.map((row) =>
      row.map((data) => (data ? Element.deserialize(data) : null))
    );

    // 初始化系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);
    this.systems.merge = MergeSystem.deserialize(saveData.mergeSystem);
    this.systems.order = OrderSystem.deserialize(saveData.orderSystem);

    // 恢复发射器
    this.state.emitters = saveData.emitters.map((data) => Emitter.deserialize(data)).filter(Boolean);

    // 渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 更新UI
    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });
    window.eventBus.emit('level:loaded', levelConfig);
    window.eventBus.emit('orders:updated', this.systems.order.getOrders());

    // 启动循环和存档
    this._startGameLoop();
    this._startAutoSave();
    this.uiManager.hideModal();

    return true;
  }

  /** 手动保存 */
  save() {
    const success = StorageManager.save(this.serialize());
    if (success) {
      window.eventBus.emit('notification', {
        message: '游戏已保存',
        type: 'info',
      });
    }
    return success;
  }

  /** 手动读取存档 */
  load() {
    const data = StorageManager.load();
    if (!data) {
      window.eventBus.emit('notification', {
        message: '没有找到存档',
        type: 'warning',
      });
      return false;
    }
    return this.loadFromSave(data);
  }

  /** 检查是否有存档 */
  hasSave() {
    return StorageManager.hasSave();
  }

  /** 销毁引擎 */
  destroy() {
    this._stopGameLoop();
    this._stopAutoSave();
    this.state.isPlaying = false;
  }
}