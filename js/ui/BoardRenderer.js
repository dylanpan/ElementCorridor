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
    this.onCellClick = null;   // 回调: (row, col) => void
    this._animatingCells = new Set();
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
      const typeConfig = ELEMENT_TYPES[element.typeId];
      const levelConfig = ELEMENT_LEVELS[element.level - 1];

      cell.className = `board-cell has-element ${levelConfig?.borderClass || ''}`;

      const elDiv = document.createElement('div');
      elDiv.className = 'element-icon';
      elDiv.textContent = element.icon;
      cell.appendChild(elDiv);

      const levelBadge = document.createElement('div');
      levelBadge.className = 'element-level';
      levelBadge.textContent = `Lv.${element.level}`;
      levelBadge.style.color = typeConfig?.color || '#999';
      cell.appendChild(levelBadge);

      // 选中状态
      if (this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col) {
        cell.classList.add('selected');
      }
    } else {
      cell.className = 'board-cell empty';
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