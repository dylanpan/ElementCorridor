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
    this._autoSortTimerId = null;
    this._lastFrameTime = 0;

    // 肉鸽模式引用
    this.rogueSystem = null;
    this.boonSystem = null;
    this.isRogueMode = false;
    this.currentRogueNode = null;

    // 三合一候选（boon_triple_merge）
    this._tripleMergeCandidates = [];

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
   * 开始肉鸽模式的关卡
   * @param {number} targetScore - 本关目标分数
   * @param {object} node - 当前节点信息
   */
  startRogueLevel(targetScore, node) {
    this.isRogueMode = true;
    this.currentRogueNode = node;

    const levelConfig = LEVEL_CONFIGS[0]; // 使用第一关的配置作为基础
    this.state.level = 1;
    this.state.targetScore = targetScore;
    this.state.score = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.levelConfig = levelConfig;

    // 根据节点类型调整难度
    let boardCols = levelConfig.boardCols;
    let boardRows = levelConfig.boardRows;

    if (node.type === 'elite') {
      boardCols = Math.max(4, boardCols - 1);
    }

    // 应用祝福/诅咒对棋盘大小的调整
    if (this.boonSystem) {
      // boon_expand_bag：棋盘增加一行格子
      if (this.boonSystem.hasBoon('boon_expand_bag')) {
        boardRows += 1;
      }
      // curse_fragile_board：棋盘缩小 4 格
      if (this.boonSystem.hasCurse('curse_fragile_board')) {
        boardCols = Math.max(4, boardCols - 2);
        boardRows = Math.max(3, boardRows - 1);
      }
      // curse_element_confusion 补偿：棋盘扩大 2 格
      if (this.boonSystem.hasCurse('curse_element_confusion')) {
        boardCols += 2;
      }
    }

    // 初始化棋盘
    this.state.board = Array.from({ length: boardRows }, () =>
      Array.from({ length: boardCols }, () => null)
    );

    // 初始化产出系统
    this.systems.spawn = new SpawnSystem(boardCols, boardRows);

    // 初始化棋盘渲染
    this.boardRenderer.init(boardCols, boardRows);
    this.boardRenderer.renderAll(this.state.board);

    // 初始化发射器（使用所有可用发射器）
    this.state.emitters = EMITTER_CONFIGS.map((config) => new Emitter(config));

    // 应用祝福到发射器
    if (this.boonSystem) {
      this.boonSystem.applyToEmitters(this.state.emitters);
    }

    // 创建发射器按钮
    this.uiManager.createEmitterButtons(this.state.emitters, (emitterId) => {
      this._onEmitterClick(emitterId);
    });

    // 初始化订单系统（根据层数调整难度）
    const floor = this.rogueSystem ? this.rogueSystem.getCurrentFloor() : 1;
    const diffShift = Math.min(floor * ROGUE_DIFFICULTY.orderDifficultyShift, 0.5);
    const weights = {
      ...levelConfig.orderDifficultyWeights,
    };
    // 向高难度偏移
    if (diffShift > 0) {
      for (const key of Object.keys(weights)) {
        weights[key] = Math.max(0, (weights[key] || 0) - diffShift / 3);
      }
    }
    this.systems.order.init(levelConfig.maxOrders + (this.boonSystem ? this.boonSystem.getExtraOrderSlots() : 0), weights);
    this.systems.order.fillOrders();

    // 重置合成系统连击
    this.systems.merge.resetCombo();
    if (this.boonSystem) {
      this.systems.merge.comboWindow = this.boonSystem.getComboWindow();
    }

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

    // 启动自动整理（如果拥有自动整理祝福）
    this._startAutoSort();
  }

  /** 清空棋盘（休息关、商店购买） */
  clearBoard() {
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        this.state.board[r][c] = null;
      }
    }
    this.boardRenderer.renderAll(this.state.board);
  }
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

  // ==================== 自动整理（祝福效果） ====================

  /** 启动自动整理定时器（每10秒执行一次） */
  _startAutoSort() {
    this._stopAutoSort();
    if (!this.isRogueMode || !this.boonSystem) return;
    if (!this.boonSystem.hasBoon('boon_auto_sort')) return;

    this._autoSortTimerId = setInterval(() => this._doAutoSort(), 10000);
  }

  /** 停止自动整理定时器 */
  _stopAutoSort() {
    if (this._autoSortTimerId) {
      clearInterval(this._autoSortTimerId);
      this._autoSortTimerId = null;
    }
  }

  /** 执行自动整理：将同类型同等级的元素移到相邻位置 */
  _doAutoSort() {
    if (!this.state.isPlaying || !this.state.board) return;

    const board = this.state.board;
    const rows = board.length;
    const cols = board[0].length;

    // 按 (typeId, level) 分组收集所有元素位置
    const groups = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = board[r][c];
        if (el) {
          const key = `${el.typeId}_${el.level}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push({ row: r, col: c, element: el });
        }
      }
    }

    let moved = false;

    // 对每组 >= 2 个的元素，检查是否已有相邻对，没有则尝试聚拢
    for (const key of Object.keys(groups)) {
      const positions = groups[key];
      if (positions.length < 2) continue;

      // 检查是否已经有相邻的可合成对
      let hasAdjacent = false;
      for (let i = 0; i < positions.length && !hasAdjacent; i++) {
        for (let j = i + 1; j < positions.length && !hasAdjacent; j++) {
          const dr = Math.abs(positions[i].row - positions[j].row);
          const dc = Math.abs(positions[i].col - positions[j].col);
          if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            hasAdjacent = true;
          }
        }
      }

      if (!hasAdjacent && positions.length >= 2) {
        // 尝试将第二个元素移到第一个元素旁边的空位
        const first = positions[0];
        const second = positions[1];

        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = first.row + dr;
          const nc = first.col + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc]) {
            if (this.systems.spawn.moveElement(board, second.element, nr, nc)) {
              this.boardRenderer.updateCell(board, second.row, second.col);
              this.boardRenderer.updateCell(board, nr, nc);
              moved = true;
            }
            break;
          }
        }
      }
    }

    if (moved) {
      this.boardRenderer.renderAll(board);
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
      // 肉鸽模式：检查守护结界祝福
      if (this.boonSystem && this.boonSystem.hasBoon('boon_guardian_shield')) {
        if (!this._guardianShieldUses) this._guardianShieldUses = 3;
        if (this._guardianShieldUses > 0) {
          this._guardianShieldUses--;
          // 销毁最低级元素
          let lowest = null, lowestPos = null;
          for (let r = 0; r < this.state.board.length; r++) {
            for (let c = 0; c < this.state.board[r].length; c++) {
              const el = this.state.board[r][c];
              if (el && (!lowest || el.level < lowest.level)) {
                lowest = el;
                lowestPos = { row: r, col: c };
              }
            }
          }
          if (lowestPos) {
            this.systems.spawn.removeElement(this.state.board, lowest);
            this.boardRenderer.updateCell(this.state.board, lowestPos.row, lowestPos.col);
            window.eventBus.emit('notification', {
              message: `🛡 守护结界触发！剩余 ${this._guardianShieldUses} 次`,
              type: 'info',
            });
          }
        } else {
          window.eventBus.emit('game:failed', { isRogue: this.isRogueMode });
          return;
        }
      } else {
        window.eventBus.emit('game:failed', { isRogue: this.isRogueMode });
        return;
      }
    }

    // 产出元素
    const element = emitter.spawn(now);
    if (!element) return;

    // 如果是数组（双重产出），逐个放置
    const elements = Array.isArray(element) ? element : [element];

    for (const el of elements) {
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (!emptyCell) break;
      this.systems.spawn.placeElement(this.state.board, el, emptyCell.row, emptyCell.col);
      this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
      this.boardRenderer.playSpawnAnimation(emptyCell.row, emptyCell.col);
    }

    // 更新发射器UI
    window.eventBus.emit('emitters:updated', this.state.emitters);
  }

  /** 点击棋盘格子 */
  _onCellClick(row, col) {
    if (!this.state.isPlaying || this.state.isPaused) return;

    const clickedElement = this.state.board[row][col];

    // === 三合一模式检测 ===
    if (this._tripleMergeCandidates.length > 0) {
      const firstCandidate = this._tripleMergeCandidates[0].element;
      // 点击空位 / 不同元素 / 已在候选中的格子：退出三合一模式
      if (!clickedElement ||
          clickedElement.typeId !== firstCandidate.typeId ||
          clickedElement.level !== firstCandidate.level ||
          this._tripleMergeCandidates.some(c => c.row === row && c.col === col)) {
        this.boardRenderer.clearTripleCandidates();
        this._tripleMergeCandidates = [];
        if (clickedElement) {
          this.boardRenderer.selectCell(row, col, this.state.board);
        }
        return;
      }
      // 点击了第三个同类型同等级的元素：执行三合一
      this._executeTripleMerge(row, col);
      return;
    }

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
      // 检查是否拥有 boon_triple_merge 祝福
      if (this.boonSystem && this.boonSystem.hasBoon('boon_triple_merge')) {
        // 进入三合一模式：将两个元素标记为候选，等待第三个
        this._tripleMergeCandidates = [
          { row: selected.row, col: selected.col, element: selectedEl },
          { row, col, element: clickedElement },
        ];
        this.boardRenderer.deselectCell();
        this.boardRenderer.setTripleCandidates([
          { row: selected.row, col: selected.col },
          { row, col },
        ]);
        window.eventBus.emit('notification', {
          message: '🎵 三重奏激活！再点击一个同类型同等级元素完成三合一',
          type: 'info',
        });
        return;
      }
      this._executeMerge(result, selected, { row, col });
    } else {
      // 不能合成：切换选中到新元素
      this.boardRenderer.selectCell(row, col, this.state.board);
    }
  }

  /** 执行三合一合成（三个同类型同等级元素合成高一级元素） */
  _executeTripleMerge(thirdRow, thirdCol) {
    const candidates = this._tripleMergeCandidates;
    const thirdElement = this.state.board[thirdRow][thirdCol];
    if (!thirdElement) {
      this._tripleMergeCandidates = [];
      return;
    }

    const consumed = [
      candidates[0].element,
      candidates[1].element,
      thirdElement,
    ];

    const newLevel = consumed[0].level + 1;
    if (newLevel > ELEMENT_LEVELS.length) {
      // 已达到最高等级，无法继续合成
      this.boardRenderer.clearTripleCandidates();
      this._tripleMergeCandidates = [];
      window.eventBus.emit('notification', {
        message: '已达到最高等级，无法继续合成',
        type: 'warning',
      });
      return;
    }

    // 创建合成后的新元素
    const merged = new Element(consumed[0].typeId, newLevel);
    merged.gridRow = thirdRow;
    merged.gridCol = thirdCol;

    // 从棋盘移除三个被消耗的元素
    for (const el of consumed) {
      this.systems.spawn.removeElement(this.state.board, el);
    }

    // 放置合成后的新元素
    this.systems.spawn.placeElement(this.state.board, merged, thirdRow, thirdCol);

    // 更新UI
    this.boardRenderer.clearTripleCandidates();
    for (const c of candidates) {
      this.boardRenderer.updateCell(this.state.board, c.row, c.col);
    }
    this.boardRenderer.updateCell(this.state.board, thirdRow, thirdCol);
    this.boardRenderer.playMergeAnimation(candidates[0].row, candidates[0].col, thirdRow, thirdCol);

    // 清除三合一状态
    this._tripleMergeCandidates = [];

    // 计算积分
    const scoreGain = merged.scoreValue;
    this.state.score += scoreGain;

    // 应用额外积分加成
    if (this.boonSystem) {
      const bonus = this.boonSystem.getMergeBonus(newLevel);
      if (bonus > 0) {
        this.state.score += bonus;
      }
    }

    window.eventBus.emit('score:updated', {
      score: this.state.score,
      targetScore: this.state.targetScore,
    });

    window.eventBus.emit('notification', {
      message: `🎵 三重奏！${consumed[0].icon} ×3 → ${merged.icon} Lv.${merged.level} ${merged.name}`,
      type: 'merge',
    });

    // === 肉鸽祝福：连锁反应 ===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_chain_reaction') && Math.random() < 0.25) {
      const lowerLevel = Math.max(1, newLevel - 1);
      const chainEl = new Element(merged.elementType || merged.typeId, lowerLevel);
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (emptyCell) {
        this.systems.spawn.placeElement(this.state.board, chainEl, emptyCell.row, emptyCell.col);
        this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
        window.eventBus.emit('notification', {
          message: `⛓ 连锁反应！生成了 ${chainEl.icon} Lv.${chainEl.level}`,
          type: 'merge',
        });
      }
    }

    // 检查是否达成目标
    if (this.state.score >= this.state.targetScore) {
      this._checkLevelComplete();
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

    // === 肉鸽祝福：连锁反应 ===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_chain_reaction') && Math.random() < 0.25) {
      const lowerLevel = Math.max(1, merged.level - 1);
      const chainEl = new Element(merged.elementType, lowerLevel);
      const emptyCell = this.systems.spawn.findEmptyCell(this.state.board);
      if (emptyCell) {
        this.systems.spawn.placeElement(this.state.board, chainEl, emptyCell.row, emptyCell.col);
        this.boardRenderer.updateCell(this.state.board, emptyCell.row, emptyCell.col);
        window.eventBus.emit('notification', {
          message: `⛓ 连锁反应！生成了 ${chainEl.icon} Lv.${chainEl.level}`,
          type: 'merge',
        });
      }
    }

    // === 肉鸽祝福：融合增效 / 经验累积 ===
    if (this.boonSystem) {
      const bonus = this.boonSystem.getMergeBonus(merged.level);
      if (bonus > 0) {
        this.state.score += bonus;
        window.eventBus.emit('score:updated', {
          score: this.state.score,
          targetScore: this.state.targetScore,
        });
      }
    }

    // === 肉鸽祝福：元素共鸣（传说级）===
    if (this.boonSystem && this.boonSystem.hasBoon('boon_element_resonance')) {
      this._triggerElementResonance(merged);
    }
  }

  /** 触发元素共鸣：临时提升棋盘上所有同类型元素的视觉等级 */
  _triggerElementResonance(merged) {
    const typeId = merged.typeId || merged.elementType;
    const resonatingCells = [];

    // 扫描棋盘上所有同类型元素
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        const el = this.state.board[r][c];
        if (el && (el.typeId === typeId || el.elementType === typeId)) {
          resonatingCells.push({ row: r, col: c });
        }
      }
    }

    if (resonatingCells.length === 0) return;

    // 设置视觉高亮
    this.boardRenderer.setResonating(resonatingCells);

    window.eventBus.emit('notification', {
      message: `🌈 元素共鸣！${merged.icon} ${merged.name} 的力量在棋盘上回荡`,
      type: 'merge',
    });

    // 5秒后清除共鸣效果
    setTimeout(() => {
      this.boardRenderer.clearResonating();
      // 刷新所有受影响的格子，移除视觉样式
      for (const { row, col } of resonatingCells) {
        this.boardRenderer.updateCell(this.state.board, row, col);
      }
    }, 5000);
  }

  /** 消耗棋盘上一个随机元素（贪婪代价诅咒） */
  _consumeRandomElement() {
    const occupiedCells = [];
    for (let r = 0; r < this.state.board.length; r++) {
      for (let c = 0; c < this.state.board[r].length; c++) {
        if (this.state.board[r][c]) {
          occupiedCells.push({ row: r, col: c });
        }
      }
    }

    if (occupiedCells.length === 0) return;

    const target = occupiedCells[Math.floor(Math.random() * occupiedCells.length)];
    const consumedEl = this.state.board[target.row][target.col];
    this.systems.spawn.removeElement(this.state.board, consumedEl);
    this.boardRenderer.updateCell(this.state.board, target.row, target.col);

    window.eventBus.emit('notification', {
      message: `👹 贪婪代价！消耗了 ${consumedEl.icon} Lv.${consumedEl.level} ${consumedEl.name || ''}`,
      type: 'warning',
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

    // 计算积分奖励（考虑祝福修正）
    let reward = result.reward;
    if (this.boonSystem) {
      reward *= this.boonSystem.getOrderRewardMultiplier();
      this.boonSystem.markFirstOrderSubmitted();

      // 无尽之泉：完成订单后重置所有发射器冷却
      if (this.boonSystem.hasBoon('boon_endless_spring')) {
        this.state.emitters.forEach(e => e.resetCooldown());
        window.eventBus.emit('notification', {
          message: '♾ 无尽之泉！所有发射器已冷却完毕',
          type: 'info',
        });
      }
    }
    reward = Math.floor(reward);
    this.state.score += reward;

    // === 肉鸽诅咒：贪婪代价 ===
    if (this.boonSystem && this.boonSystem.hasCurse('curse_greed_price')) {
      this._consumeRandomElement();
    }

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
    this._stopAutoSort();

    // 肉鸽模式：通过事件系统通知主流程
    if (this.isRogueMode) {
      window.eventBus.emit('game:over', {
        level: this.state.level,
        score: this.state.score,
        targetScore: this.state.targetScore,
        isRogue: true,
      });
      return;
    }

    // 经典模式：检查是否有下一关
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
    this._stopAutoSort();
    this.state.isPlaying = false;
  }
}