/**
 * ============================================================
 * 产出系统 —— 管理发射器产出的元素放置到棋盘
 * 负责寻找空位、触发产出动画事件等。
 * ============================================================
 */
class SpawnSystem {
  constructor(boardCols, boardRows) {
    this.boardCols = boardCols;
    this.boardRows = boardRows;
  }

  /** 更新棋盘尺寸 */
  resize(cols, rows) {
    this.boardCols = cols;
    this.boardRows = rows;
  }

  /**
   * 在棋盘上寻找第一个空位
   * @param {Array<Array<Element|null>>} grid - 棋盘二维数组
   * @returns {{row: number, col: number}|null}
   */
  findEmptyCell(grid) {
    for (let row = 0; row < this.boardRows; row++) {
      for (let col = 0; col < this.boardCols; col++) {
        if (!grid[row][col]) {
          return { row, col };
        }
      }
    }
    return null;
  }

  /**
   * 检查棋盘是否已满
   */
  isBoardFull(grid) {
    return this.findEmptyCell(grid) === null;
  }

  /**
   * 统计棋盘上的元素数量
   */
  countElements(grid) {
    let count = 0;
    for (let row = 0; row < this.boardRows; row++) {
      for (let col = 0; col < this.boardCols; col++) {
        if (grid[row][col]) count++;
      }
    }
    return count;
  }

  /**
   * 获取棋盘上所有指定类型和等级的元素位置
   */
  findElementsByTypeAndLevel(grid, typeId, level) {
    const results = [];
    for (let row = 0; row < this.boardRows; row++) {
      for (let col = 0; col < this.boardCols; col++) {
        const el = grid[row][col];
        if (el && el.typeId === typeId && el.level === level) {
          results.push({ element: el, row, col });
        }
      }
    }
    return results;
  }

  /**
   * 将元素放置到棋盘指定位置
   */
  placeElement(grid, element, row, col) {
    if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) {
      return false;
    }
    if (grid[row][col]) return false;

    grid[row][col] = element;
    element.gridRow = row;
    element.gridCol = col;
    return true;
  }

  /**
   * 从棋盘移除元素
   */
  removeElement(grid, element) {
    const { gridRow, gridCol } = element;
    if (
      gridRow >= 0 && gridRow < this.boardRows &&
      gridCol >= 0 && gridCol < this.boardCols &&
      grid[gridRow][gridCol] === element
    ) {
      grid[gridRow][gridCol] = null;
      element.gridRow = -1;
      element.gridCol = -1;
      return true;
    }
    return false;
  }

  /**
   * 移动元素到新位置
   */
  moveElement(grid, element, toRow, toCol) {
    if (toRow < 0 || toRow >= this.boardRows || toCol < 0 || toCol >= this.boardCols) {
      return false;
    }
    if (grid[toRow][toCol]) return false;

    // 从原位置移除
    if (element.gridRow >= 0 && element.gridCol >= 0) {
      grid[element.gridRow][element.gridCol] = null;
    }

    // 放到新位置
    grid[toRow][toCol] = element;
    element.gridRow = toRow;
    element.gridCol = toCol;
    return true;
  }
}