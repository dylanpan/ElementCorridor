/**
 * ============================================================
 * 棋盘渲染器 —— 负责游戏棋盘的DOM渲染和交互事件
 * 这是与DOM耦合最紧密的模块，迁移至Godot时需重写为Godot场景。
 * ============================================================
 */
class BoardRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`棋盘容器 #${containerId} 不存在`);
    }
    this.cols = 0;
    this.rows = 0;
    this.cells = [];
    this.selectedCell = null; // { row, col }
    this._tripleSelectedCells = []; // [{ row, col }] — 三合一候选格子
    this._resonatingCells = []; // [{ row, col }] — 元素共鸣高亮格子
    this.onCellClick = null;   // 回调: (row, col) => void
    this._animatingCells = new Set();

    // === 粒子系统 ===
    this._particles = [];
    this._particleCanvas = null;
    this._particleCtx = null;
    this._particleAnimId = null;
    this._initParticleCanvas();
  }

  /**
   * 初始化粒子 Canvas 覆盖层
   */
  _initParticleCanvas() {
    this._particleCanvas = document.createElement('canvas');
    this._particleCanvas.className = 'particle-canvas';
    this._particleCanvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    this.container.style.position = 'relative';
    this.container.appendChild(this._particleCanvas);
    this._particleCtx = this._particleCanvas.getContext('2d');
  }

  /**
   * 调整 Canvas 尺寸匹配容器
   */
  _resizeParticleCanvas() {
    const rect = this.container.getBoundingClientRect();
    this._particleCanvas.width = rect.width;
    this._particleCanvas.height = rect.height;
  }

  /**
   * 启动粒子渲染循环
   */
  _startParticleLoop() {
    if (this._particleAnimId) return;
    const loop = () => {
      this._updateAndRenderParticles();
      if (this._particles.length > 0) {
        this._particleAnimId = requestAnimationFrame(loop);
      } else {
        this._particleAnimId = null;
        // 清空画布
        if (this._particleCtx) {
          this._particleCtx.clearRect(0, 0, this._particleCanvas.width, this._particleCanvas.height);
        }
      }
    };
    this._particleAnimId = requestAnimationFrame(loop);
  }

  /**
   * 更新并渲染所有粒子
   */
  _updateAndRenderParticles() {
    const ctx = this._particleCtx;
    if (!ctx) return;

    // 确保 Canvas 尺寸正确
    if (this._particleCanvas.width === 0 || this._particleCanvas.height === 0) {
      this._resizeParticleCanvas();
    }

    ctx.clearRect(0, 0, this._particleCanvas.width, this._particleCanvas.height);

    const toRemove = [];
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.life -= 1;
      if (p.life <= 0) {
        toRemove.push(i);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vy += 0.15; // 轻微重力

      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * (0.5 + 0.5 * (p.life / p.maxLife));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      // 圆形粒子
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();

      // 发光效果
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 从后往前移除（保持索引正确）
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this._particles.splice(toRemove[i], 1);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 生成合成粒子爆散
   * @param {number} cellRow - 棋盘行
   * @param {number} cellCol - 棋盘列
   * @param {string} color - 粒子颜色
   * @param {number} count - 粒子数量
   */
  _emitMergeParticles(cellRow, cellCol, color, count) {
    const cell = this.cells[cellRow]?.[cellCol];
    if (!cell) return;

    this._resizeParticleCanvas();

    const rect = cell.getBoundingClientRect();
    const canvasRect = this._particleCanvas.getBoundingClientRect();
    const cx = rect.left - canvasRect.left + rect.width / 2;
    const cy = rect.top - canvasRect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const size = 3 + Math.random() * 5;
      const life = 18 + Math.floor(Math.random() * 15); // ~0.55秒 (60fps)

      this._particles.push({
        x: cx + (Math.random() - 0.5) * 6,
        y: cy + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        size: size,
        life: life,
        maxLife: life,
      });
    }

    this._startParticleLoop();
  }

  /**
   * 播放合成特效（粒子爆散 + 等级触发特效）
   * @param {number} row - 合成位置行
   * @param {number} col - 合成位置列
   * @param {number} level - 合成后的等级
   * @param {string} elementType - 元素类型ID
   */
  playMergeEffect(row, col, level, elementType) {
    const typeConfig = ELEMENT_TYPES[elementType];
    const color = typeConfig?.color || '#ffffff';

    // 基础粒子数量随等级增加
    const baseCount = 10 + level * 5;

    // === Lv.2~3: 基础粒子 + 缩放脉冲 ===
    if (level <= 3) {
      this._emitMergeParticles(row, col, color, baseCount);
      // 缩放脉冲：通过 cell class 动画实现
      const cell = this.cells[row]?.[col];
      if (cell) {
        cell.classList.remove('merge-pulse');
        void cell.offsetWidth;
        cell.classList.add('merge-pulse');
        setTimeout(() => cell.classList.remove('merge-pulse'), 400);
      }
      return;
    }

    // === Lv.4(稀有): 粒子 + 屏幕边缘白色闪光 ===
    if (level === 4) {
      this._emitMergeParticles(row, col, color, baseCount + 5);
      this._createFlashOverlay('flash-white');
      return;
    }

    // === Lv.5(史诗): 粒子 + 全屏金色闪烁 + 屏幕震动 ===
    if (level === 5) {
      this._emitMergeParticles(row, col, color, baseCount + 10);
      this._createFlashOverlay('flash-gold');
      this._applyScreenShake();
      return;
    }

    // === Lv.6(传说): 粒子 + 双重闪光 + 强震 + 暂停慢放 ===
    if (level >= 6) {
      this._emitMergeParticles(row, col, color, baseCount + 25);
      // 先白色闪光再金色闪光（双重爆发）
      this._createFlashOverlay('flash-white');
      setTimeout(() => {
        this._createFlashOverlay('flash-gold');
      }, 120);
      this._applyScreenShake(12, 0.4);
      this._createTimeFreeze();
      return;
    }
  }

  /**
   * 创建全屏闪光 overlay
   */
  _createFlashOverlay(className) {
    const overlay = document.createElement('div');
    overlay.className = `flash-overlay ${className}`;
    document.body.appendChild(overlay);
    // 动画结束后移除
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 500);
  }

  /**
   * 应用屏幕震动
   */
  _applyScreenShake(intensity = 5, duration = 0.25) {
    const gameMain = document.getElementById('game-main');
    if (!gameMain) return;
    gameMain.style.setProperty('--shake-intensity', `${intensity}px`);
    gameMain.style.setProperty('--shake-duration', `${duration}s`);
    gameMain.classList.add('screen-shake');
    setTimeout(() => {
      gameMain.classList.remove('screen-shake');
      gameMain.style.removeProperty('--shake-intensity');
      gameMain.style.removeProperty('--shake-duration');
    }, duration * 1000);
  }

  /**
   * 创建暂停慢放遮罩（传说 Lv.6）
   */
  _createTimeFreeze() {
    const overlay = document.createElement('div');
    overlay.className = 'time-freeze-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 700);
  }

  /**
   * 初始化棋盘网格
   */
  init(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.selectedCell = null;
    this._animatingCells.clear();
    this.container.innerHTML = '';
    this.cells = [];

    this.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let r = 0; r < rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener('click', () => {
          if (this.onCellClick) this.onCellClick(r, c);
        });
        this.container.appendChild(cell);
        this.cells[r][c] = cell;
      }
    }
  }

  /**
   * 更新单个格子的显示
   */
  updateCell(grid, row, col) {
    const cell = this.cells[row]?.[col];
    if (!cell) return;

    const element = grid[row][col];
    // 清除旧内容
    cell.innerHTML = '';

    if (element) {
      // 检查是否有元素共鸣等级加成
      const hasBoost = element._resonanceBoost;
      const displayLevel = hasBoost ? Math.min(element.level + 1, ELEMENT_LEVELS.length) : element.level;
      const levelConfig = ELEMENT_LEVELS[displayLevel - 1];
      const typeConfig = ELEMENT_TYPES[element.typeId];

      cell.className = `board-cell has-element ${levelConfig?.borderClass || ''}`;

      const elDiv = document.createElement('div');
      elDiv.className = 'element-icon';
      elDiv.textContent = element.icon;
      if (hasBoost) {
        elDiv.style.textShadow = `0 0 8px ${typeConfig?.color || '#ffd700'}, 0 0 16px rgba(255,215,0,0.4)`;
      }
      cell.appendChild(elDiv);

      const levelBadge = document.createElement('div');
      levelBadge.className = 'element-level';
      levelBadge.textContent = hasBoost ? `Lv.${displayLevel}✨` : `Lv.${element.level}`;
      levelBadge.style.color = typeConfig?.color || '#999';
      if (hasBoost) {
        levelBadge.style.fontWeight = 'bold';
        levelBadge.style.textShadow = `0 0 6px ${typeConfig?.color || '#ffd700'}`;
      }
      cell.appendChild(levelBadge);

      // 选中状态
      if (this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col) {
        cell.classList.add('selected');
      }
      // 三合一候选状态
      if (this._tripleSelectedCells.some(c => c.row === row && c.col === col)) {
        cell.classList.add('triple-candidate');
      }
      // 元素共鸣状态
      if (element._resonanceBoost) {
        cell.classList.add('resonating');
        // 使用提升后等级的颜色动态设置光晕
        const boostColor = getComputedStyle(document.documentElement)
          .getPropertyValue(`--level-${displayLevel}-border`).trim() || '#ffd700';
        cell.style.boxShadow =
          `inset 0 0 16px ${boostColor}55, 0 0 20px ${boostColor}40, 0 0 45px ${boostColor}20`;
        cell.style.borderColor = boostColor;
      } else {
        cell.style.boxShadow = '';
        cell.style.borderColor = '';
      }
    } else {
      cell.className = 'board-cell empty';
      cell.style.boxShadow = '';
      cell.style.borderColor = '';
    }
  }

  /**
   * 全量刷新棋盘
   */
  renderAll(grid) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.updateCell(grid, r, c);
      }
    }
  }

  /**
   * 选中某个格子
   */
  selectCell(row, col, grid) {
    // 取消旧的选中
    if (this.selectedCell) {
      const oldRow = this.selectedCell.row;
      const oldCol = this.selectedCell.col;
      const oldCell = this.cells[oldRow]?.[oldCol];
      if (oldCell) oldCell.classList.remove('selected');
    }

    this.selectedCell = { row, col };

    // 高亮新选中
    if (grid[row] && grid[row][col]) {
      const cell = this.cells[row][col];
      if (cell) cell.classList.add('selected');
    } else {
      this.selectedCell = null;
    }
  }

  /** 取消选中 */
  deselectCell() {
    if (this.selectedCell) {
      const cell = this.cells[this.selectedCell.row]?.[this.selectedCell.col];
      if (cell) cell.classList.remove('selected');
      this.selectedCell = null;
    }
  }

  /**
   * 设置三合一候选格子（高亮多个格子）
   * @param {Array<{row: number, col: number}>} candidates - 候选位置列表
   */
  setTripleCandidates(candidates) {
    this.clearTripleCandidates();
    for (const { row, col } of candidates) {
      const cell = this.cells[row]?.[col];
      if (cell) {
        cell.classList.add('triple-candidate');
        this._tripleSelectedCells.push({ row, col });
      }
    }
  }

  /** 清除三合一候选高亮 */
  clearTripleCandidates() {
    for (const { row, col } of this._tripleSelectedCells) {
      const cell = this.cells[row]?.[col];
      if (cell) cell.classList.remove('triple-candidate');
    }
    this._tripleSelectedCells = [];
  }

  /**
   * 设置元素共鸣高亮（棋盘上所有同类型元素获得临时视觉特效）
   * @param {Array<{row: number, col: number}>} cells - 要高亮的格子列表
   */
  setResonating(cells) {
    this.clearResonating();
    for (const { row, col } of cells) {
      const cell = this.cells[row]?.[col];
      if (cell) {
        cell.classList.add('resonating');
        this._resonatingCells.push({ row, col });
      }
    }
  }

  /** 清除元素共鸣高亮 */
  clearResonating() {
    for (const { row, col } of this._resonatingCells) {
      const cell = this.cells[row]?.[col];
      if (cell) cell.classList.remove('resonating');
    }
    this._resonatingCells = [];
  }

  /**
   * 播放合成动画
   */
  playMergeAnimation(fromRow, fromCol, toRow, toCol, callback) {
    const fromCell = this.cells[fromRow]?.[fromCol];
    const toCell = this.cells[toRow]?.[toCol];
    if (!fromCell || !toCell) {
      if (callback) callback();
      return;
    }

    const key = `${fromRow}_${fromCol}_${toRow}_${toCol}`;
    if (this._animatingCells.has(key)) {
      if (callback) callback();
      return;
    }
    this._animatingCells.add(key);

    toCell.classList.add('merge-animate');
    setTimeout(() => {
      toCell.classList.remove('merge-animate');
      this._animatingCells.delete(key);
      if (callback) callback();
    }, GAME_SETTINGS.mergeAnimationDuration);
  }

  /**
   * 播放生成动画
   */
  playSpawnAnimation(row, col, callback) {
    const cell = this.cells[row]?.[col];
    if (!cell) {
      if (callback) callback();
      return;
    }

    cell.classList.add('spawn-animate');
    setTimeout(() => {
      cell.classList.remove('spawn-animate');
      if (callback) callback();
    }, GAME_SETTINGS.spawnAnimationDuration);
  }

  /**
   * 播放提交动画（元素飞向订单面板）
   */
  playSubmitAnimation(row, col, callback) {
    const cell = this.cells[row]?.[col];
    if (!cell) {
      if (callback) callback();
      return;
    }

    cell.classList.add('submit-animate');
    setTimeout(() => {
      cell.classList.remove('submit-animate');
      if (callback) callback();
    }, 500);
  }

  /** 清理 */
  destroy() {
    this.container.innerHTML = '';
    this.cells = [];
    this.selectedCell = null;
    this.onCellClick = null;
  }
}