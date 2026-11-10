/**
 * ============================================================
 * 无尽模式 · 商店系统
 * 管理金币获取/消费、商品刷新、商店面板交互
 * ============================================================
 */
class EndlessShopSystem {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.gold = 0;
    this.items = [];
    this._autoRefreshTimer = null;
    this._lastManualRefreshTime = 0;
    this._enabled = false;
    this._visible = false;
    this._overlay = null;
    this._dialog = null;
  }

  static SHOP_CONFIG = {
    refreshInterval: 90000,
    manualRefreshCost: 5,
    manualRefreshCD: 30000,
    normalCount: 2,
    rareCount: 1,
  };

  static NORMAL_POOL = [
    { id: 'skip_order', name: '跳过订单', icon: '⏭', price: 8,
      desc: '获得 1 个跳过订单道具', weight: 30,
      effect: 'add_item', itemId: 'skip_order' },
    { id: 'time_freeze', name: '时间停滞', icon: '⏸', price: 10,
      desc: '获得 1 个时间停滞道具', weight: 25,
      effect: 'add_item', itemId: 'time_freeze' },
    { id: 'element_storm', name: '元素风暴', icon: '🌪', price: 12,
      desc: '获得 1 个元素风暴道具', weight: 20,
      effect: 'add_item', itemId: 'element_storm' },
    { id: 'score_shield', name: '积分护盾', icon: '🛡', price: 15,
      desc: '接下来 30 秒积分不会降到 0 以下', weight: 15,
      effect: 'shield' },
    { id: 'emitter_boost', name: '发射器加速', icon: '⚡', price: 10,
      desc: '所有发射器冷却速度 x1.5，持续 20 秒', weight: 10,
      effect: 'speed_up' },
  ];

  static RARE_POOL = [
    { id: 'instant_complete', name: '立即完成', icon: '✅', price: 15,
      desc: '获得 1 个立即完成道具', weight: 30,
      effect: 'add_item', itemId: 'instant_complete' },
    { id: 'double_score', name: '双倍积分', icon: '💎', price: 20,
      desc: '获得 1 个双倍积分道具', weight: 25,
      effect: 'add_item', itemId: 'double_score' },
    { id: 'blessing_chest', name: '祝福宝箱', icon: '✨', price: 25,
      desc: '随机获得一个普通祝福', weight: 20,
      effect: 'add_boon' },
    { id: 'time_slow', name: '时间缓流', icon: '🐢', price: 18,
      desc: '所有订单倒计时速度减半，持续 15 秒', weight: 15,
      effect: 'slow_time' },
    { id: 'purify', name: '元素净化', icon: '💫', price: 22,
      desc: '清除棋盘上所有负面效果', weight: 10,
      effect: 'clear_debuffs' },
  ];

  init() {
    this.gold = 0;
    this._refreshItems();
    this._startAutoRefresh();
    this._enabled = true;
    this._updateGoldDisplay();
  }

  addGold(amount) {
    this.gold += amount;
    this._updateGoldDisplay();
    window.eventBus.emit('endless:gold-updated', this.gold);
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this._updateGoldDisplay();
    window.eventBus.emit('endless:gold-updated', this.gold);
    return true;
  }

  getGold() {
    return this.gold;
  }

  _refreshItems() {
    this.items = [];
    var cfg = EndlessShopSystem.SHOP_CONFIG;
    for (var i = 0; i < cfg.normalCount; i++) {
      this.items.push(this._pickRandomItem('normal'));
    }
    for (var j = 0; j < cfg.rareCount; j++) {
      this.items.push(this._pickRandomItem('rare'));
    }
  }

  _pickRandomItem(rarity) {
    var pool = rarity === 'rare' ? EndlessShopSystem.RARE_POOL : EndlessShopSystem.NORMAL_POOL;
    var totalWeight = 0;
    for (var k = 0; k < pool.length; k++) {
      totalWeight += pool[k].weight;
    }
    var roll = Math.random() * totalWeight;
    for (var m = 0; m < pool.length; m++) {
      roll -= pool[m].weight;
      if (roll <= 0) return Object.assign({}, pool[m], { rarity: rarity });
    }
    return Object.assign({}, pool[0], { rarity: rarity });
  }

  purchaseItem(index) {
    var item = this.items[index];
    if (!item) return false;
    if (!this.spendGold(item.price)) return false;
    this._applyPurchaseEffect(item);
    this.items.splice(index, 1);
    if (this._visible) this._renderPanel();
    return true;
  }

  _applyPurchaseEffect(item) {
    var engine = this.engine;
    switch (item.effect) {
      case 'add_item':
        if (engine.itemSystem) {
          engine.itemSystem.addItem(item.itemId, 1);
        }
        break;
      case 'shield':
        engine._bossState.shieldEndTime = Date.now() + 30000;
        break;
      case 'speed_up':
        engine._eventCtx.emitterSpeedMultiplier = 1.5;
        setTimeout(function() {
          engine._eventCtx.emitterSpeedMultiplier = 1.0;
        }, 20000);
        break;
      case 'slow_time':
        engine._endlessOrderTimeMultiplier *= 2;
        setTimeout(function() {
          engine._endlessOrderTimeMultiplier /= 2;
        }, 15000);
        break;
      case 'clear_debuffs':
        if (engine._bossState) {
          engine._bossState.scorchedCells = [];
          if (engine._bossState.frozenRows) engine._bossState.frozenRows.clear();
          if (engine._bossState.frozenCols) engine._bossState.frozenCols.clear();
          engine._bossState.sealedEmitterIds = [];
        }
        if (engine.boardRenderer && engine.boardRenderer.refreshScorchedCells) {
          engine.boardRenderer.refreshScorchedCells([]);
        }
        if (engine.boardRenderer && engine.boardRenderer.refreshFrozenRows) {
          engine.boardRenderer.refreshFrozenRows(new Set());
        }
        break;
      case 'add_boon':
        if (engine.boonSystem && engine.boonSystem.addRandomBoon) {
          engine.boonSystem.addRandomBoon();
        }
        break;
      case 'double_score':
        engine._endlessScoreMultiplier = 2;
        setTimeout(function() {
          engine._endlessScoreMultiplier = 1;
        }, 40000);
        break;
    }
  }

  manualRefresh() {
    var now = Date.now();
    var cd = EndlessShopSystem.SHOP_CONFIG.manualRefreshCD;
    if (now - this._lastManualRefreshTime < cd) {
      var remaining = Math.ceil((cd - (now - this._lastManualRefreshTime)) / 1000);
      window.eventBus.emit('notification', {
        message: '刷新冷却中，还剩 ' + remaining + ' 秒',
        type: 'info',
      });
      return false;
    }
    var cost = EndlessShopSystem.SHOP_CONFIG.manualRefreshCost;
    if (!this.spendGold(cost)) {
      window.eventBus.emit('notification', {
        message: '金币不足，无法刷新（需要 ' + cost + ' 金币）',
        type: 'warning',
      });
      return false;
    }
    this._refreshItems();
    this._lastManualRefreshTime = now;
    if (this._visible) this._renderPanel();
    return true;
  }

  getNextRefreshIn() {
    var elapsed = Date.now() % EndlessShopSystem.SHOP_CONFIG.refreshInterval;
    return Math.max(0, Math.floor((EndlessShopSystem.SHOP_CONFIG.refreshInterval - elapsed) / 1000));
  }

  _startAutoRefresh() {
    this._stopAutoRefresh();
    var self = this;
    this._autoRefreshTimer = setInterval(function() {
      self._refreshItems();
      if (self._visible) self._renderPanel();
    }, EndlessShopSystem.SHOP_CONFIG.refreshInterval);
  }

  _stopAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  }

  _updateGoldDisplay() {
    var goldEl = document.getElementById('endless-gold');
    if (goldEl) goldEl.textContent = this.gold;
  }

  toggleVisibility() {
    if (!this._enabled) return;
    this._visible = !this._visible;
    if (this._visible) {
      this._showPanel();
    } else {
      this._hidePanel();
    }
  }

  _showPanel() {
    if (this._overlay) return;
    this._visible = true;
    var overlay = document.createElement('div');
    overlay.className = 'shop-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    this._overlay = overlay;
    var dialog = document.createElement('div');
    dialog.className = 'shop-dialog';
    dialog.style.cssText = 'background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(255,215,0,0.3);border-radius:14px;padding:24px;width:420px;max-width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    this._dialog = dialog;
    this._renderPanel();
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    var self = this;
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) self._hidePanel();
    });
  }

  _renderPanel() {
    if (!this._dialog) return;
    var dialog = this._dialog;
    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<h2 style="margin:0;font-size:18px;color:#ffd700;">商店</h2>';
    html += '<button id="shop-close-btn" style="background:none;border:none;color:#aaa;font-size:22px;cursor:pointer;padding:4px 8px;">X</button>';
    html += '</div>';
    html += '<div style="text-align:center;margin-bottom:16px;font-size:15px;color:#ccc;">';
    html += '当前金币：<span style="color:#ffd700;font-weight:bold;font-size:18px;">' + this.gold + '</span>';
    html += '</div>';
    if (this.items.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#888;">暂无商品</div>';
    } else {
      html += '<div class="shop-items-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">';
      for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        var canAfford = this.gold >= item.price;
        var isRare = item.rarity === 'rare';
        html += '<div class="shop-item-card" data-index="' + i + '" style="';
        html += 'position:relative;background:' + (isRare ? 'linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,152,0,0.06))' : 'rgba(255,255,255,0.04)') + ';';
        html += 'border:1px solid ' + (isRare ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.05)') + ';';
        html += 'border-radius:10px;padding:12px;cursor:' + (canAfford ? 'pointer' : 'not-allowed') + ';';
        html += 'opacity:' + (canAfford ? '1' : '0.5') + ';';
        html += 'transition:transform 0.2s,box-shadow 0.2s;';
        html += '" ';
        if (canAfford) {
          // 悬停效果由 CSS 控制
          // 不需要内联事件处理器
        }
        html += '>';
        if (isRare) {
          html += '<div style="position:absolute;top:-6px;right:-6px;background:linear-gradient(135deg,#ffd700,#ff9800);color:#000;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:bold;">稀有</div>';
        }
        html += '<div style="font-size:24px;text-align:center;margin-bottom:6px;">' + item.icon + '</div>';
        html += '<div style="font-size:13px;font-weight:bold;color:#fff;text-align:center;margin-bottom:4px;">' + item.name + '</div>';
        html += '<div style="font-size:11px;color:#aaa;text-align:center;margin-bottom:8px;">' + item.desc + '</div>';
        html += '<div style="text-align:center;">';
        html += '<span style="background:' + (canAfford ? 'linear-gradient(135deg,#ffd700,#ff9800)' : '#555') + ';';
        html += 'color:' + (canAfford ? '#000' : '#999') + ';padding:4px 8px;border-radius:6px;font-size:12px;font-weight:bold;">';
        html += item.price + ' 购买</span>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    var nextRefresh = this.getNextRefreshIn();
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">';
    html += '<button id="shop-refresh-btn" style="background:linear-gradient(135deg,#555,#444);color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px;">刷新 5</button>';
    html += '<span style="font-size:12px;color:#888;">下次刷新: ' + nextRefresh + 's</span>';
    html += '</div>';
    dialog.innerHTML = html;
    var self = this;
    var closeBtn = dialog.querySelector('#shop-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function() { self._hidePanel(); });
    var refreshBtn = dialog.querySelector('#shop-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { self.manualRefresh(); });
    var cards = dialog.querySelectorAll('.shop-item-card');
    for (var k = 0; k < cards.length; k++) {
      (function(idx) {
        cards[idx].addEventListener('click', function() { self.purchaseItem(idx); });
      })(k);
    }
  }

  _hidePanel() {
    this._visible = false;
    if (this._overlay) {
      document.body.removeChild(this._overlay);
      this._overlay = null;
      this._dialog = null;
    }
  }

  destroy() {
    this._enabled = false;
    this._stopAutoRefresh();
    this._hidePanel();
  }
}
