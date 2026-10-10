/**
 * ============================================================
 * 存档管理器 —— 游戏进度保存与读取
 * 使用 localStorage 持久化，可替换为后端 API。
 * 迁移至 Godot 时替换为 Godot 的文件存储系统即可。
 * ============================================================
 */
class StorageManager {
  static STORAGE_KEY = 'merge_game_save';

  /**
   * 保存游戏状态
   * @param {object} gameState - 完整的游戏状态对象
   */
  static save(gameState) {
    try {
      const data = JSON.stringify(gameState);
      localStorage.setItem(StorageManager.STORAGE_KEY, data);
      return true;
    } catch (err) {
      console.error('[StorageManager] 保存失败:', err);
      return false;
    }
  }

  /**
   * 读取存档
   * @returns {object|null}
   */
  static load() {
    try {
      const data = localStorage.getItem(StorageManager.STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.error('[StorageManager] 读取存档失败:', err);
      return null;
    }
  }

  /**
   * 检查是否存在存档
   */
  static hasSave() {
    return localStorage.getItem(StorageManager.STORAGE_KEY) !== null;
  }

  /**
   * 删除存档
   */
  static deleteSave() {
    localStorage.removeItem(StorageManager.STORAGE_KEY);
  }

  /**
   * 导出存档为JSON字符串（可用于分享或备份）
   */
  static exportSave(gameState) {
    return JSON.stringify(gameState, null, 2);
  }

  /**
   * 从JSON字符串导入存档
   */
  static importSave(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.board) return null;
      localStorage.setItem(StorageManager.STORAGE_KEY, jsonString);
      return data;
    } catch (err) {
      console.error('[StorageManager] 导入存档失败:', err);
      return null;
    }
  }
}