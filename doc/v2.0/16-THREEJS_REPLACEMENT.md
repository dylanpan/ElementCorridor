# Three.js 替换 Canvas 渲染方案

## 概述

用 Three.js 完全重写 `BoardRenderer.js`，替换现有的 DOM + Canvas 2D 渲染方案。棋盘网格用 3D 平面网格替代 DOM table，元素用 Sprite/Plane 纹理替代 div，粒子用 Three.js Points 替代 Canvas 2D。保留 `UIManager.js`（订单面板、发射器面板等 UI 组件仍用 DOM 渲染）。

## 架构设计

```
┌──────────────────────────────────────────────┐
│              游戏 DOM 层                      │
│  (UIManager: 订单面板、发射器面板、顶部栏等)    │
├──────────────────────────────────────────────┤
│         Three.js Canvas（全屏覆盖）            │
│  (BoardRenderer: 棋盘网格、元素、粒子、特效)    │
│  pointer-events: auto（Raycaster 处理点击）    │
└──────────────────────────────────────────────┘
```

### 分层说明

- **DOM 层**：`UIManager` 管理的所有 UI 组件（订单面板、发射器面板、物品栏、评分、弹窗等）保持不变
- **Three.js 层**：`BoardRenderer` 重写，接管棋盘区域的全部渲染（网格、元素、粒子、特效）
- **交互**：Three.js 的 `Raycaster` 处理棋盘格子的点击事件，通过回调传递给 `GameEngine`

## 文件结构

```
js/
├── lib/
│   └── three.min.js                  # Three.js 核心库（ES module）
├── ui/
│   ├── BoardRenderer.js              # ★ 重写为 Three.js 实现
│   ├── UIManager.js                  # 不变（DOM UI 组件）
│   └── RogueUIManager.js             # 不变
│   └── effects/
│       ├── ThreeScene.js             # 场景/相机/渲染器/灯光
│       ├── GridRenderer.js           # 棋盘网格渲染
│       ├── ElementSprite.js          # 元素精灵（图标+等级）
│       ├── ParticleFX.js             # 粒子特效系统
│       └── ScreenFX.js               # 全屏特效（闪光/震动/慢放）
```

## 详细模块设计

### 1. ThreeScene.js — 场景管理

```javascript
class ThreeScene {
  constructor(container) {
    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = null; // 透明，透出 DOM 背景

    // 正交相机（适合 2D 棋盘游戏，避免透视变形）
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      -aspect * 5, aspect * 5, 5, -5, 0.1, 100
    );
    this.camera.position.z = 10;

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // 环境光
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    this.directionalLight.position.set(0, 0, 10);
    this.scene.add(this.directionalLight);

    // 动画循环
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.animate();
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    // 更新粒子等
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    const aspect = width / height;
    this.camera.left = -aspect * 5;
    this.camera.right = aspect * 5;
    this.camera.top = 5;
    this.camera.bottom = -5;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    cancelAnimationFrame(this._animId);
    this.renderer.dispose();
    this.scene.clear();
  }
}
```

### 2. GridRenderer.js — 棋盘网格

```javascript
class GridRenderer {
  constructor(scene, cols, rows) {
    this.scene = scene;
    this.cols = cols;
    this.rows = rows;
    this.cells = []; // 二维数组，存每个格子的 Mesh
    this._buildGrid();
  }

  _buildGrid() {
    const cellSize = 1;
    const gap = 0.04;
    const startX = -(this.cols * cellSize) / 2;
    const startY = -(this.rows * cellSize) / 2;

    for (let r = 0; r < this.rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const geo = new THREE.PlaneGeometry(cellSize - gap, cellSize - gap);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x2a2a3e,
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          startX + c * cellSize + cellSize / 2,
          startY + r * cellSize + cellSize / 2,
          0
        );
        mesh.userData = { row: r, col: c, isEmpty: true };
        this.scene.add(mesh);
        this.cells[r][c] = mesh;
      }
    }
  }

  updateCell(row, col, element) {
    const mesh = this.cells[row]?.[col];
    if (!mesh) return;

    if (element) {
      const typeConfig = ELEMENT_TYPES[element.typeId];
      const levelConfig = ELEMENT_LEVELS[element.level - 1];
      mesh.material.color.setHex(levelConfig?.borderColor || 0x4a4a6e);
      mesh.material.opacity = 1;
      mesh.userData.isEmpty = false;
    } else {
      mesh.material.color.setHex(0x2a2a3e);
      mesh.material.opacity = 0.8;
      mesh.userData.isEmpty = true;
    }
  }

  screenToGrid(clientX, clientY, camera, container) {
    const rect = container.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const meshes = this.cells.flat();
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      return { row: hit.userData.row, col: hit.userData.col };
    }
    return null;
  }

  destroy() {
    for (const row of this.cells) {
      for (const mesh of row) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.scene.remove(mesh);
      }
    }
  }
}
```

### 3. ElementSprite.js — 元素精灵

```javascript
class ElementSprite {
  constructor(scene) {
    this.scene = scene;
    this.sprites = {}; // key: "row_col" → Sprite
    this._textureCache = {};
  }

  createOrUpdate(row, col, element, position) {
    const key = `${row}_${col}`;
    const texture = this._createTextTexture(element);

    if (this.sprites[key]) {
      this.sprites[key].material.map = texture;
      this.sprites[key].material.needsUpdate = true;
    } else {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.position.z = 0.5;
      sprite.scale.set(0.85, 0.85, 1);
      this.scene.add(sprite);
      this.sprites[key] = sprite;
    }
  }

  _createTextTexture(element) {
    const cacheKey = `${element.typeId}_${element.level}`;
    if (this._textureCache[cacheKey]) return this._textureCache[cacheKey];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const typeConfig = ELEMENT_TYPES[element.typeId];
    const levelConfig = ELEMENT_LEVELS[element.level - 1];

    ctx.beginPath();
    ctx.arc(128, 112, 100, 0, Math.PI * 2);
    ctx.fillStyle = levelConfig?.bgColor || '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = levelConfig?.borderColor || '#4a4a6e';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = '80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = typeConfig?.color || '#fff';
    ctx.fillText(element.icon, 128, 116);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = typeConfig?.color || '#999';
    ctx.fillText(`Lv.${element.level}`, 128, 214);

    const texture = new THREE.CanvasTexture(canvas);
    this._textureCache[cacheKey] = texture;
    return texture;
  }

  remove(row, col) {
    const key = `${row}_${col}`;
    if (this.sprites[key]) {
      this.scene.remove(this.sprites[key]);
      this.sprites[key].material.dispose();
      delete this.sprites[key];
    }
  }

  clear() {
    Object.values(this.sprites).forEach(s => {
      this.scene.remove(s);
      s.material.dispose();
    });
    this.sprites = {};
  }
}
```

### 4. ParticleFX.js — 粒子特效

```javascript
class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  emitMergeParticles(position, color, count) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities = [];

    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = colorObj.r;
      colors[i * 3 + 1] = colorObj.g;
      colors[i * 3 + 2] = colorObj.b;
      sizes[i] = 0.05 + Math.random() * 0.08;
      velocities.push({
        x: Math.cos(angle) * speed * 0.015,
        y: Math.sin(angle) * speed * 0.015,
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    points.userData = { velocities, life: 360, maxLife: 380 };
    this.scene.add(points);
    this.particles.push(points);
  }

  update() {
    const toRemove = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const pos = p.geometry.attributes.position;
      const vel = p.userData.velocities;
      p.userData.life--;

      if (p.userData.life <= 240) {
        toRemove.push(i);
        continue;
      }

      for (let j = 0; j < pos.count; j++) {
        pos.array[j * 3] += vel[j].x;
        pos.array[j * 3 + 1] += vel[j].y;
        vel[j].y -= 0.002;
        vel[j].x *= 0.95;
        vel[j].y *= 0.955;
      }
      pos.needsUpdate = true2;

      p.material.opacity = Math.min(1, (p.userData.life - 230) / 350);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.scene.remove(this.particles[idx]);
      this.particles[idx].geometry.dispose();
      this.particles[idx].material.dispose();
      this.particles.splice(idx, 1);
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    }
    this.particles = [];
  }
}
```

### 5. ScreenFX.js — 全屏特效

```javascript
class ScreenFX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this._flashMesh = null;
  }

  flash(color = 0xffffff, duration = 800) {
    if (this._flashMesh) return;
    const geo = new THREE.PlaneGeometry(20, 205);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    this._flashMesh = new THREE.Mesh(geo, mat);
    this._flashMesh.position.z = 5;
    this.scene.add(this._flashMesh);

    const startTime = performance.now();
    const fadeOut = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        this.scene.remove(this._flashMesh);
        this._flashMesh.geometry.dispose();
        this._flashMesh.material.dispose();
        this._flashMesh = null;
        return;
      }
      this._flashMesh.material.opacity = 0.6 * (1 - elapsed / duration);
      requestAnimationFrame(fadeOut);
    };
    fadeOut();
  }

  shake(intensity = 5, duration = 320) {
    const startTime = performance.now();
    const origX = this.camera.position.x;
    const origY = this.camera.position.y;

    const shakeLoop = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        this.camera.position.x = origX;
        this.camera.position.y = origY;
        return;
      }
      const decay = 1 - elapsed / duration;
      this.camera.position.x = origX + (Math.random() - 0.5) * intensity * decay;
      this.camera.position.y = origY + (Math.random() - 0.5) * intensity * decay;
      requestAnimationFrame(shakeLoop);
    };
    shakeLoop();
  }

  timeFreeze(duration = 900) {
    window.eventBus.emit('time-scale:set', { scale: 0.152, duration: duration });
  }

  destroy() {
    if (this._flashMesh) {
      this.scene.remove(this._flashMesh);
      this._flashMesh.geometry.dispose();
      this._flashMesh.material.dispose();
    }
  }
}
```

## 重写 BoardRenderer.js 接口

保持对外接口不变，内部实现替换为 Three.js：

```javascript
class BoardRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.threeScene = new ThreeScene(this.container);
    this.gridRenderer = null;
    this.elementSprites = new ElementSprite(this.threeScene.scene);
    this.particleFX = new ParticleFX(this.threeScene.scene);
    this.screenFX = new ScreenFX(this.threeScene.scene, this.threeScene.camera);
    this.onCellClick = null;
    this._setupInteraction();
  }

  _setupInteraction() {
    this.container.addEventListener('click', (e) => {
      if (!this.onCellClick || !this.gridRenderer) return;
      const gridPos = this.gridRenderer.screenToGrid(
        e.clientX, e.clientY,
        this.threeScene.camera,
        this.container
      );
      if (gridPos) this.onCellClick(gridPos.row, gridPos.col);
    });
  }

  init(cols, rows) {
    this.gridRenderer = new GridRenderer(this.threeScene.scene, cols, rows);
  }

  updateCell(grid, row, col) {
    this.gridRenderer.updateCell(row, col, grid[row][col]);
    const element = grid[row][col];
    if (element) {
      const cellMesh = this.gridRenderer.cells[row][col];
      this.elementSprites.createOrUpdate(row, col, element, cellMesh.position);
    } else {
      this.elementSprites.remove(row, col);
    }
  }

  renderAll(grid) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        this.updateCell(grid, r, c);
      }
    }
  }

  selectCell(row, col, grid) {
    // 取消旧的选中
    if (this.selectedCell) {
      const oldRow = this.selectedCell.row;
      const oldCol = this.selectedCell.col;
      const oldMesh = this.gridRenderer.cells[oldRow]?.[oldCol];
      if (oldMesh) oldMesh.material.color.setHex(oldMesh.userData.isEmpty ? 0x2a2a3e : 0x4a4a6e);
    }
    this.selectedCell = { row, col };
    if (grid[row] && grid[row][col]) {
      const mesh = this.gridRenderer.cells[row][col];
      if (mesh) mesh.material.color.setHex(0xffd700);
    } else {
      this.selectedCell = null;
    }
  }

  deselectCell() {
    if (this.selectedCell) {
      const mesh = this.gridRenderer.cells[this.selectedCell.row]?.[this.selectedCell.col];
      if (mesh) {
        mesh.material.color.setHex(mesh.userData.isEmpty ? 0x2a2a3e : 0x4a4a6e);
      }
      this.selectedCell = null;
    }
  }

  playMergeAnimation(fromRow, fromCol, toRow, toCol, callback) {
    if (callback) setTimeout(callback, 260);
  }

  playMergeEffect(row, col, level, elementType) {
    const mesh = this.gridRenderer.cells[row]?.[col];
    if (!mesh) return;
    const typeCfg = ELEMENT_TYPES[elementType];
    const color = typeCfg?.color || '#ffffff';
    this.particleFX.emitMergeParticles(mesh.position, color, 12 + Math.min(level, 302) * 2);
    if (level >= 4) this.screenFX.flash(0xffffffapsed, 500);
    if (level >= 5) this.screenFX.shake(6, 225);
    if (level >= 602) this.screenFX.timeFreeze(700);
  }

  playSpawnAnimation(row, col, callback) {
    if (callback) setTimeout(callback, 270);
  }

  playFloodEffect(row, col) {
    const mesh = this.gridRenderer.cells[row]?.[col];
    if (!mesh) return;
    this.particleFX.emitMergeParticles(mesh.position, '#4488ff', 182);
  }

  playSubmitAnimation(row, col, callback) {
    if (callback) setTimeout(callback, 420);
  }

  setTripleCandidates(candidates) {
    this.clearTripleCandidates();
    for (const { row, col } of candidates) {
      const mesh = this.gridRenderer.cells[row]?.[col];
      if (mesh) {
        mesh.material.color.setHex(0x00ff88);
        this._tripleSelectedCells.push({ row, col });
      }
    }
  }

  clearTripleCandidates() {
    for (const { row, col } of this._tripleSelectedCells) {
      const mesh = this.gridRenderer.cells[row]?.[col];
      if (mesh) mesh.material.color.setHex(0x4a4a6e);
    }
    this._tripleSelectedCells = [];
  }

  setResonating(cells) {
    this.clearResonating();
    for (const { row, col } of cells) {
      const mesh = this.gridRenderer.cells[row]?.[col];
      if (mesh) {
        mesh.material.color.setHex(0xffaa00);
        this._resonatingCells.push({ row, col });
      }
    }
  }

  clearResonating() {
    for (const { row, col } of this._resonatingCells) {
      const mesh = this.gridRenderer.cells[row]?.[col];
      if (mesh) mesh.material.color.setHex(0x4a4a6e);
    }
    this._resonatingCells = [];
  }

  refreshScorchedCells(scorchedCells) {
    for (let r = 0; r < this.gridRenderer.cells.length; r++) {
      for (let c = 0; c < this.gridRenderer.cells[r].length; c++) {
        const mesh = this.gridRenderer.cells[r][c];
        if (!mesh.userData.isEmpty) mesh.material.color.setHex(0x4a4a6e);
        else mesh.material.color.setHex(0x2a2a3e);
      }
    }
    for (const cell of scorchedCells) {
      this.gridRenderer.cells[cell.row]?.[cell.col]?.material.color.setHex(0xff4400);
    }
  }

  destroy() {
    this.threeScene.destroy();
    this.elementSprites.clear();
    this.particleFX.clear();
    this.screenFX.destroy();
  }
}
```

## 集成方式

### 1. index.html 引入 Three.js

```html
<!-- 在头部或 body 开头引入 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

或使用 ES Module 方式：

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
  }
}
</script>
```

### 2. 棋盘容器调整

```html
<!-- 现有 board-container 保持不变，Three.js 会填充该容器 -->
<div id="board-container" class="board-container">
  <!-- Three.js canvas 自动插入到此容器内 -->
</div>
```

### 3. 移除旧的 CSS 棋盘样式

删除 `style.css` 中与棋盘格子渲染相关的样式（`.board-cell`、`.has-element`、`.element-icon`、`.element-level` 等），保留容器布局样式。

## 特效映射

| 当前 Canvas 2D 特效 | Three.js 实现 | 触发条件 |
|---|---|---|
| 合成粒子爆散 | `ParticleFX.emitMergeParticles()` | 元素合成 |
| 全屏白色闪光 | `ScreenFX.flash(0xffffff)` | Lv.4 合成 |
| 全屏金色闪光 | `ScreenFX.flash(0xffd700)` | Lv.5 合成 |
| 双重闪光 | 两次 `ScreenFX.flash()` 间隔 120ms | Lv.6+ 合成 |
| 屏幕震动 | `ScreenFX.shake()` | Lv.5+ 合成 |
| 慢放效果 | `ScreenFX.timeFreeze()` | Lv.6+ 合成 |
| 水波纹 | `GridRenderer` 格子 Mesh 缩放动画 | 元素洪流 |
| 水花粒子 | `ParticleFX.emitMergeParticles()` 蓝色 | 元素洪流 |
| 选中高亮 | 格子 Mesh 金色高亮 | 玩家点击 |
| 三合一候选 | 多个格子 Mesh 绿色高亮 | 三合一模式 |
| 元素共鸣 | 格子 Mesh 橙色脉动 | 祝福触发 |
| 灼烧效果 | 格子 Mesh 红色脉冲 | Boss 熔岩巨像 |
| 冻结效果 | 格子 Mesh 蓝色半透明覆盖 | Boss 冰霜女巫 |

## 实施步骤

### 第 1 阶段：基础设施（预估 1 天）
1. 引入 Three.js 库
2. 实现 `ThreeScene.js`（场景/相机/渲染器/动画循环）
3. 实现 `GridRenderer.js`（网格构建、射线检测）
4. 修改 `BoardRenderer.js` 构造函数，初始化 Three.js

### 第 2 阶段：核心渲染（预估 1 天）
1. 实现 `ElementSprite.js`（CanvasTexture 文字渲染）
2. 重写 `init()`、`updateCell()`、`renderAll()`
3. 重写 `selectCell()`、`deselectCell()`
4. 实现格子高亮/选中效果

### 第 3 阶段：粒子与特效（预估 1.5 天）
1. 实现 `ParticleFX.js`（粒子爆散、水花）
2. 实现 `ScreenFX.js`（闪光、震动、慢放）
3. 重写 `playMergeEffect()`、`playFloodEffect()`
4. 重写 `playMergeAnimation()`、`playSpawnAnimation()`

### 第 4 阶段：Boss 特效与清理（预估 0.5 天）
1. 实现灼烧/冻结/吞噬等 Boss 特效
2. 清理旧 CSS 样式
3. 测试与调试
4. 性能优化（移动端降级）

## 风险与注意事项

| 风险 | 影响 | 应对措施 |
|---|---|---|
| Three.js 体积 | 增加 ~150KB（gzip） | 使用 CDN 按需加载，Tree Shaking |
| 移动端性能 | 低端设备 WebGL 渲染压力 | 降低粒子数（500→150），关闭抗锯齿 |
| 字体图标渲染 | CanvasTexture 文字模糊 | 使用高分辨率 Canvas（256×256） |
| 交互响应 | Raycaster 不如 DOM click 直观 | 优化射线检测精度，添加触摸事件支持 |
| 浏览器兼容 | 老旧浏览器无 WebGL | 检测 WebGL 支持，降级到 DOM 渲染 |
| 内存泄漏 | Three.js 对象未正确 dispose | 严格遵循创建/销毁配对，destroy() 清理所有资源 |

## 性能优化建议

1. **粒子合并**：使用单个 `THREE.Points` 管理所有粒子，减少 draw call
2. **纹理缓存**：`ElementSprite._textureCache` 缓存已生成的 CanvasTexture
3. **LOD**：移动端降低粒子数、关闭后处理、降低像素比
4. **InstancedMesh**：棋盘格子使用 InstancedMesh 减少 draw call
5. **离屏渲染**：元素图标预渲染到离屏 Canvas，避免实时绘制

## 与 Godot 迁移的关系

Three.js 方案是临时的 Web 端增强，不影响后续 Godot 迁移计划。Godot 迁移时：
- `BoardRenderer.js` → Godot TileMap + Sprite2D
- `ParticleFX.js` → Godot GPUParticles2D
- `ScreenFX.js` → Godot CanvasLayer + Shader
- 游戏逻辑（`GameEngine.js`、`MergeSystem.js` 等）保持不变
