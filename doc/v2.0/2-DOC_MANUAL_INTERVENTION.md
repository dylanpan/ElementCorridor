# 手动干预模式 —— 玩法设计说明与技术实现方案

## 一、玩法设计说明

### 1.1 设计目标

在自动合成引擎运行的同时，保留玩家的手动操作入口，让玩家可以在关键时刻介入——暂停自动合成、手动拖动元素、手动选择优先提交的订单，实现「自动为主、手动为辅」的协作式玩法。

### 1.2 核心规则

| 规则项 | 说明 |
|---|---|
| **默认状态** | 自动合成引擎默认开启 |
| **暂停自动** | 玩家可随时暂停/恢复自动合成 |
| **手动拖动** | 暂停后可手动拖动元素到目标位置 |
| **手动提交** | 任何时候都可点击订单手动提交 |
| **视觉提示** | 自动合成运行时，棋盘边缘有呼吸光效提示 |

### 1.3 设计意图

- **保留操作感**：完全自动化会让玩家变成旁观者，手动干预入口让玩家在关键时刻仍有参与感
- **策略深度**：自动合成是「常规操作」，手动干预是「战术操作」——在倒计时紧迫时手动调整布局、优先合成关键元素
- **学习曲线**：新手可完全依赖自动合成，进阶玩家通过手动干预获得更高收益

### 1.4 与其他系统的关系

| 系统 | 交互方式 |
|---|---|
| 自动合成引擎 | 暂停/恢复控制 |
| 订单系统 | 手动点击订单提交 |
| 合成系统 | 手动拖动元素合成 |
| 发射器系统 | 手动点击发射器 |

---

## 二、技术实现方案

### 2.1 涉及文件

- `js/systems/AutoPlaySystem.js` —— 新增 pause/resume 方法
- `js/ui/UIManager.js` —— 暂停按钮 UI
- `js/core/GameEngine.js` —— 暂停状态联动

### 2.2 AutoPlaySystem 暂停/恢复

```javascript
class AutoPlaySystem {
  // ...原有代码...

  /**
   * 暂停自动合成
   */
  pause() {
    this._paused = true;
  }

  /**
   * 恢复自动合成
   */
  resume() {
    this._paused = false;
  }

  /**
   * 是否已暂停
   */
  isPaused() {
    return this._paused;
  }

  _decisionLoop() {
    // 在原有判断基础上增加暂停检查
    if (!this.engine.state.isPlaying || this.engine.state.isPaused) return;
    if (this._paused) return; // 手动暂停
    if (this._processing) return;
    // ...
  }
}
```

### 2.3 UI 控件

在游戏界面添加暂停/恢复按钮：

```html
<!-- 在 index.html 中 -->
<button id="auto-play-toggle" class="auto-play-btn active">
  ⚡ 自动合成
</button>
```

```javascript
// 在 UIManager 中
_initAutoPlayToggle() {
  const btn = document.getElementById('auto-play-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const autoPlay = gameEngine.autoPlay;
    if (!autoPlay) return;

    if (autoPlay.isPaused()) {
      autoPlay.resume();
      btn.classList.add('active');
      btn.innerHTML = '⚡ 自动合成';
    } else {
      autoPlay.pause();
      btn.classList.remove('active');
      btn.innerHTML = '⏸ 已暂停';
    }
  });
}
```

### 2.4 手动拖动与自动合成的协作

手动操作时自动暂停自动合成，操作完成后恢复：

```javascript
// 在 _onCellClick 开始时
_onCellClick(row, col) {
  // 手动操作时暂停自动合成
  if (this.autoPlay && !this.autoPlay.isPaused()) {
    this.autoPlay.pause();
    this._autoResumePending = true; // 标记操作完成后恢复
  }

  // ...原有交互逻辑...
}

// 在合成/移动完成后
_executeMerge(result, fromPos, toPos) {
  // ...原有逻辑...

  // 操作完成后恢复自动合成
  if (this._autoResumePending) {
    this._autoResumePending = false;
    // 延迟一小段时间恢复，避免频繁启停
    setTimeout(() => {
      if (this.autoPlay) this.autoPlay.resume();
    }, 500);
  }
}
```
