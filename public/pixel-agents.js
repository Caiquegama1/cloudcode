/**
 * PIXEL AGENTS - Animated Pixel Art Character Visualization System
 * For CLOUDCODE Electron App
 * Inspired by PixelAgents VS Code Extension (MIT License)
 *
 * A collapsible panel rendering animated 16×24px characters performing tasks
 * in an isometric office environment with state machine behavior.
 */

(function () {
  'use strict';

  // ============================================================================
  // SPRITE DEFINITIONS
  // ============================================================================

  // Colors - used across sprite definitions
  const COLORS = {
    transparent: null,
    black: '#000000',
    darkGray: '#333333',
    gray: '#666666',
    lightGray: '#CCCCCC',
    white: '#FFFFFF',
    skin: '#F4C4A0',
    darkSkin: '#D4A080',

    // Character palettes
    purple: '#9B7FFF',
    purpleDark: '#6B4FD0',
    green: '#22C55E',
    greenDark: '#16A34A',
    blue: '#3B82F6',
    blueDark: '#1D4ED8',
    red: '#EF4444',
    redDark: '#B91C1C',
    yellow: '#F59E0B',
    yellowDark: '#D97706',
    cyan: '#06B6D4',
    cyanDark: '#0891B2',

    // UI colors
    greenMatrix: '#00FF41',
    amber: '#FCD34D',
    greenCheck: '#22C55E',
  };

  /**
   * Sprite definitions: 16×24 pixel arrays
   * Each sprite is a 2D array where each element is a color string or null (transparent)
   * Format: [y][x] where (0,0) is top-left
   */
  const SPRITES = {
    // Character 0 - Purple (CLOUDCODE accent)
    char_0: {
      idle: createCharacterSprite(COLORS.purple, COLORS.purpleDark),
      walk: [
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'walk_1'),
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'walk_2'),
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'walk_3'),
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'type_1'),
        createCharacterSprite(COLORS.purple, COLORS.purpleDark, 'type_2'),
      ],
    },
    // Character 1 - Green
    char_1: {
      idle: createCharacterSprite(COLORS.green, COLORS.greenDark),
      walk: [
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'walk_1'),
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'walk_2'),
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'walk_3'),
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'type_1'),
        createCharacterSprite(COLORS.green, COLORS.greenDark, 'type_2'),
      ],
    },
    // Character 2 - Blue
    char_2: {
      idle: createCharacterSprite(COLORS.blue, COLORS.blueDark),
      walk: [
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'walk_1'),
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'walk_2'),
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'walk_3'),
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'type_1'),
        createCharacterSprite(COLORS.blue, COLORS.blueDark, 'type_2'),
      ],
    },
    // Character 3 - Red
    char_3: {
      idle: createCharacterSprite(COLORS.red, COLORS.redDark),
      walk: [
        createCharacterSprite(COLORS.red, COLORS.redDark, 'walk_1'),
        createCharacterSprite(COLORS.red, COLORS.redDark, 'walk_2'),
        createCharacterSprite(COLORS.red, COLORS.redDark, 'walk_3'),
        createCharacterSprite(COLORS.red, COLORS.redDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.red, COLORS.redDark, 'type_1'),
        createCharacterSprite(COLORS.red, COLORS.redDark, 'type_2'),
      ],
    },
    // Character 4 - Yellow
    char_4: {
      idle: createCharacterSprite(COLORS.yellow, COLORS.yellowDark),
      walk: [
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'walk_1'),
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'walk_2'),
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'walk_3'),
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'type_1'),
        createCharacterSprite(COLORS.yellow, COLORS.yellowDark, 'type_2'),
      ],
    },
    // Character 5 - Cyan
    char_5: {
      idle: createCharacterSprite(COLORS.cyan, COLORS.cyanDark),
      walk: [
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'walk_1'),
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'walk_2'),
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'walk_3'),
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'walk_4'),
      ],
      type: [
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'type_1'),
        createCharacterSprite(COLORS.cyan, COLORS.cyanDark, 'type_2'),
      ],
    },
  };

  /**
   * Speech bubble sprites
   */
  const SPEECH_BUBBLES = {
    // "..." thinking animation (11×13)
    thinking: [
      [null, null, COLORS.amber, null, null, null, null, null, null, null, null],
      [null, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null, null, null, null],
      [COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null, null, null],
      [COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null, null],
      [COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null],
      [COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null],
      [COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null],
      [null, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null],
      [null, null, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null],
      [null, null, null, COLORS.amber, COLORS.amber, COLORS.amber, null, null, null, null, null],
      [null, null, null, null, COLORS.amber, null, null, null, null, null, null],
    ],
    // Green checkmark (11×13)
    done: [
      [null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, COLORS.greenCheck, null, null, null, null],
      [null, null, null, null, null, COLORS.greenCheck, COLORS.greenCheck, null, null, null, null],
      [COLORS.greenCheck, null, null, null, COLORS.greenCheck, COLORS.greenCheck, null, null, null, null, null],
      [COLORS.greenCheck, COLORS.greenCheck, null, COLORS.greenCheck, COLORS.greenCheck, null, null, null, null, null, null],
      [null, COLORS.greenCheck, COLORS.greenCheck, COLORS.greenCheck, null, null, null, null, null, null, null],
      [null, null, COLORS.greenCheck, COLORS.greenCheck, null, null, null, null, null, null, null],
      [null, null, null, COLORS.greenCheck, null, null, null, null, null, null, null],
    ],
  };

  /**
   * Background tile definitions
   */
  const BACKGROUND = {
    // Floor tile (16×16) - wooden pattern
    floorTile: createFloorTile(),
    // Desk (32×16) - simple rectangular desk with monitor
    desk: createDesk(),
    // Wall section (16×16)
    wall: createWall(),
  };

  // ============================================================================
  // SPRITE FACTORY FUNCTIONS
  // ============================================================================

  function createCharacterSprite(primaryColor, darkColor, pose = 'idle') {
    const sprite = Array(24)
      .fill(null)
      .map(() => Array(16).fill(null));

    // Randomize slight variations in head size for personality
    const headHeight = pose === 'idle' ? 7 : 6;

    // HEAD (rows 0-7)
    // Simple round head with eyes
    for (let y = 0; y < headHeight; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.hypot(x - 7.5, y - 3);
        if (dist < 4 && dist > 1) {
          sprite[y][x] = COLORS.skin;
        } else if (dist <= 1) {
          sprite[y][x] = COLORS.darkSkin;
        }
      }
    }

    // Eyes
    sprite[2][5] = COLORS.black;
    sprite[2][10] = COLORS.black;

    // BODY (rows 8-15)
    const bodyStart = headHeight + 1;
    const bodyEnd = bodyStart + 7;

    for (let y = bodyStart; y < bodyEnd; y++) {
      for (let x = 4; x < 12; x++) {
        sprite[y][x] = primaryColor;
      }
    }

    // ARMS
    if (pose.startsWith('walk')) {
      // Walking pose - alternating arms
      const frameNum = parseInt(pose.split('_')[1]) || 1;
      if (frameNum % 2 === 0) {
        // Left arm up
        sprite[bodyStart][3] = primaryColor;
        sprite[bodyStart + 1][3] = primaryColor;
        sprite[bodyStart + 2][3] = darkColor;
        // Right arm down
        sprite[bodyStart + 2][12] = primaryColor;
        sprite[bodyStart + 3][12] = primaryColor;
        sprite[bodyStart + 4][12] = darkColor;
      } else {
        // Left arm down
        sprite[bodyStart + 2][3] = primaryColor;
        sprite[bodyStart + 3][3] = primaryColor;
        sprite[bodyStart + 4][3] = darkColor;
        // Right arm up
        sprite[bodyStart][12] = primaryColor;
        sprite[bodyStart + 1][12] = primaryColor;
        sprite[bodyStart + 2][12] = darkColor;
      }
    } else if (pose.startsWith('type')) {
      // Typing pose - arms at keyboard
      sprite[bodyStart + 1][2] = darkColor;
      sprite[bodyStart + 2][2] = darkColor;
      sprite[bodyStart + 3][2] = darkColor;
      sprite[bodyStart + 1][13] = darkColor;
      sprite[bodyStart + 2][13] = darkColor;
      sprite[bodyStart + 3][13] = darkColor;
    } else {
      // Idle - arms at sides
      sprite[bodyStart + 1][3] = darkColor;
      sprite[bodyStart + 2][3] = darkColor;
      sprite[bodyStart + 1][12] = darkColor;
      sprite[bodyStart + 2][12] = darkColor;
    }

    // LEGS (rows 16-23)
    const legStart = bodyEnd;
    const frameNum = pose.startsWith('walk') ? parseInt(pose.split('_')[1]) : 0;

    if (pose.startsWith('walk') && frameNum % 2 === 0) {
      // Left leg forward
      for (let y = legStart; y < legStart + 4; y++) {
        sprite[y][5] = darkColor;
      }
      for (let y = legStart + 4; y < 24; y++) {
        sprite[y][5] = COLORS.black;
      }
      // Right leg back
      for (let y = legStart + 1; y < legStart + 5; y++) {
        sprite[y][10] = darkColor;
      }
      for (let y = legStart + 5; y < 24; y++) {
        sprite[y][10] = COLORS.black;
      }
    } else {
      // Both legs down (idle or walk_odd frames)
      for (let y = legStart; y < legStart + 4; y++) {
        sprite[y][5] = darkColor;
        sprite[y][10] = darkColor;
      }
      for (let y = legStart + 4; y < 24; y++) {
        sprite[y][5] = COLORS.black;
        sprite[y][10] = COLORS.black;
      }
    }

    return sprite;
  }

  function createFloorTile() {
    const tile = Array(16)
      .fill(null)
      .map(() => Array(16).fill(COLORS.lightGray));

    // Add wood grain pattern
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if ((Math.floor(x / 4) + Math.floor(y / 2)) % 2 === 0) {
          tile[y][x] = COLORS.gray;
        }
      }
    }

    return tile;
  }

  function createDesk() {
    const desk = Array(16)
      .fill(null)
      .map(() => Array(32).fill(null));

    // Desk top (brown)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 32; x++) {
        desk[y + 8][x] = COLORS.gray;
      }
    }

    // Monitor (simple rectangle)
    for (let y = 2; y < 8; y++) {
      for (let x = 10; x < 22; x++) {
        if (y === 2 || y === 7 || x === 10 || x === 21) {
          desk[y][x] = COLORS.darkGray;
        } else {
          desk[y][x] = COLORS.black;
        }
      }
    }

    // Monitor stand
    desk[8][14] = COLORS.darkGray;
    desk[8][15] = COLORS.darkGray;

    return desk;
  }

  function createWall() {
    const wall = Array(16)
      .fill(null)
      .map(() => Array(16).fill(COLORS.darkGray));

    // Wall with slight shading
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if ((x + y) % 4 === 0) {
          wall[y][x] = COLORS.gray;
        }
      }
    }

    return wall;
  }

  // ============================================================================
  // MAIN PIXEL AGENTS SYSTEM
  // ============================================================================

  class Agent {
    constructor(id, name, paletteIndex) {
      this.id = id;
      this.name = name;
      this.paletteIndex = Math.max(0, Math.min(5, paletteIndex || 0));
      this.sprites = SPRITES[`char_${this.paletteIndex}`];

      // Position (in screen pixels)
      this.x = 0;
      this.y = 0;
      this.tileX = 0;
      this.tileY = 0;
      this.desiredTileX = 0;
      this.desiredTileY = 0;

      // State
      this.state = 'idle'; // idle, active, waiting, done
      this.currentPose = 'idle';
      this.frameIndex = 0;
      this.frameDuration = 0; // Accumulated time for animation

      // Behavior
      this.spawnProgress = 0; // 0-1 for spawn animation
      this.despawnProgress = 0; // 0-1 for despawn animation
      this.isSpawning = true;
      this.isDespawning = false;
      this.idleTimer = 0;
      this.toolName = '';

      // Animation timing
      this.walkFrameTime = 0.15; // seconds per frame
      this.typeFrameTime = 0.3;
    }

    update(dt) {
      // Spawn animation
      if (this.isSpawning) {
        this.spawnProgress = Math.min(1, this.spawnProgress + dt / 0.3);
        if (this.spawnProgress >= 1) {
          this.isSpawning = false;
        }
      }

      // Despawn animation
      if (this.isDespawning) {
        this.despawnProgress = Math.min(1, this.despawnProgress + dt / 0.3);
      }

      // Movement
      if (this.tileX !== this.desiredTileX || this.tileY !== this.desiredTileY) {
        const dx = this.desiredTileX - this.tileX;
        const dy = this.desiredTileY - this.tileY;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
          const moveSpeed = 48 / 16; // pixels per second, per tile
          const moveDist = moveSpeed * dt;

          if (moveDist >= dist) {
            this.tileX = this.desiredTileX;
            this.tileY = this.desiredTileY;
            this.currentPose = this.state === 'active' ? 'type' : 'idle';
          } else {
            const ratio = moveDist / dist;
            this.tileX += dx * ratio;
            this.tileY += dy * ratio;
            this.currentPose = 'walk';
          }
        }
      }

      // Update screen position (each tile is 16 pixels, rendered at 3x zoom)
      this.x = this.tileX * 16;
      this.y = this.tileY * 16;

      // Animation frame cycling
      this.frameDuration += dt;

      if (this.currentPose === 'walk') {
        if (this.frameDuration >= this.walkFrameTime) {
          this.frameIndex = (this.frameIndex + 1) % 4;
          this.frameDuration = 0;
        }
      } else if (this.currentPose === 'type') {
        if (this.frameDuration >= this.typeFrameTime) {
          this.frameIndex = (this.frameIndex + 1) % 2;
          this.frameDuration = 0;
        }
      } else {
        this.frameIndex = 0;
        this.frameDuration = 0;
      }

      // Idle behavior
      if (this.state === 'idle' && this.currentPose === 'idle') {
        this.idleTimer += dt;
        if (this.idleTimer > 2) {
          // Occasionally change facing direction or wander
          const newTileX = Math.floor(Math.random() * 12) + 2;
          const newTileY = Math.floor(Math.random() * 3) + 2;
          this.desiredTileX = newTileX;
          this.desiredTileY = newTileY;
          this.idleTimer = 0;
        }
      }
    }

    setState(newState) {
      if (this.state === newState) return;

      this.state = newState;

      if (newState === 'active') {
        // Walk to nearest free desk
        this.desiredTileX = 8 + Math.random() * 4;
        this.desiredTileY = 3 + Math.random() * 1;
        this.currentPose = 'walk';
      } else if (newState === 'idle') {
        this.idleTimer = 0;
        this.currentPose = 'idle';
      } else if (newState === 'done') {
        // Stay typing briefly, then idle
        setTimeout(() => {
          this.setState('idle');
        }, 1000);
      }
    }

    getCurrentSprite() {
      if (this.currentPose === 'idle') {
        return this.sprites.idle;
      } else if (this.currentPose === 'walk') {
        return this.sprites.walk[this.frameIndex];
      } else if (this.currentPose === 'type') {
        return this.sprites.type[this.frameIndex];
      }
      return this.sprites.idle;
    }

    getSpeechBubble() {
      if (this.state === 'active') {
        return SPEECH_BUBBLES.thinking;
      } else if (this.state === 'done') {
        return SPEECH_BUBBLES.done;
      }
      return null;
    }
  }

  class PixelAgentsRenderer {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        console.error(`Canvas with id "${canvasId}" not found`);
        return;
      }

      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      // Configuration
      this.PIXEL_SIZE = 3; // 3x zoom
      this.SPRITE_WIDTH = 16;
      this.SPRITE_HEIGHT = 24;
      this.TILE_SIZE = 16;
      this.ROOM_WIDTH = 20; // tiles
      this.ROOM_HEIGHT = 6; // tiles

      // Canvas sizing
      this.canvas.width = this.ROOM_WIDTH * this.TILE_SIZE * this.PIXEL_SIZE;
      this.canvas.height = 180; // Fixed height for chat integration

      // Agents
      this.agents = new Map();
      this.maxAgents = 6;

      // Rendering
      this.spriteCache = new Map();
      this.dirty = true;
      this.lastFrameTime = 0;
      this.animationId = null;
      this.isVisible = localStorage.getItem('cloudcode_pixel_agents') === 'true'; // default OFF

      // Initialize background
      this.renderBackground();
    }

    renderBackground() {
      const offscreen = new OffscreenCanvas(
        this.ROOM_WIDTH * this.TILE_SIZE,
        this.ROOM_HEIGHT * this.TILE_SIZE
      );
      const octx = offscreen.getContext('2d');
      octx.imageSmoothingEnabled = false;

      // Draw floor tiles
      for (let ty = 0; ty < this.ROOM_HEIGHT; ty++) {
        for (let tx = 0; tx < this.ROOM_WIDTH; tx++) {
          this.drawPixelSprite(
            octx,
            BACKGROUND.floorTile,
            tx * this.TILE_SIZE,
            ty * this.TILE_SIZE,
            1
          );
        }
      }

      // Draw desks
      this.drawPixelSprite(octx, BACKGROUND.desk, 2 * this.TILE_SIZE, 3 * this.TILE_SIZE, 1);
      this.drawPixelSprite(octx, BACKGROUND.desk, 11 * this.TILE_SIZE, 3 * this.TILE_SIZE, 1);

      // Draw wall
      for (let tx = 0; tx < this.ROOM_WIDTH; tx++) {
        this.drawPixelSprite(octx, BACKGROUND.wall, tx * this.TILE_SIZE, 0, 1);
      }

      this.backgroundCanvas = offscreen;
    }

    drawPixelSprite(ctx, sprite, x, y, scale = 1) {
      for (let row = 0; row < sprite.length; row++) {
        for (let col = 0; col < sprite[row].length; col++) {
          const color = sprite[row][col];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
          }
        }
      }
    }

    drawPixelSpriteWithAlpha(ctx, sprite, x, y, scale = 1, alpha = 1) {
      ctx.globalAlpha = alpha;
      this.drawPixelSprite(ctx, sprite, x, y, scale);
      ctx.globalAlpha = 1;
    }

    drawMatrixTrail(ctx, sprite, x, y, scale, progress) {
      // Column-by-column reveal effect
      const cols = sprite[0].length;
      const revealCols = Math.ceil(cols * progress);

      for (let row = 0; row < sprite.length; row++) {
        for (let col = 0; col < revealCols; col++) {
          const color = sprite[row][col];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
          } else {
            // Show green matrix trail
            ctx.fillStyle = COLORS.greenMatrix;
            ctx.globalAlpha = 0.3 * (1 - progress);
            ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    render() {
      const width = this.canvas.width;
      const height = this.canvas.height;

      // Clear
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.fillRect(0, 0, width, height);

      // Draw background
      if (this.backgroundCanvas) {
        this.ctx.drawImage(
          this.backgroundCanvas,
          0,
          0,
          this.backgroundCanvas.width * this.PIXEL_SIZE,
          this.backgroundCanvas.height * this.PIXEL_SIZE
        );
      }

      // Draw agents in sorted order (top to bottom)
      const sortedAgents = Array.from(this.agents.values()).sort((a, b) => a.y - b.y);

      for (const agent of sortedAgents) {
        if (agent.isDespawning && agent.despawnProgress >= 1) {
          continue; // Skip fully despawned agents
        }

        // Agent position on screen
        const screenX = agent.x * this.PIXEL_SIZE;
        const screenY = agent.y * this.PIXEL_SIZE;

        // Get current sprite
        const sprite = agent.getCurrentSprite();

        // Draw spawn/despawn effect
        if (agent.isSpawning) {
          this.drawMatrixTrail(this.ctx, sprite, screenX, screenY, this.PIXEL_SIZE, agent.spawnProgress);
        } else if (agent.isDespawning) {
          this.drawMatrixTrail(this.ctx, sprite, screenX, screenY, this.PIXEL_SIZE, 1 - agent.despawnProgress);
        } else {
          this.drawPixelSprite(this.ctx, sprite, screenX, screenY, this.PIXEL_SIZE);
        }

        // Draw speech bubble
        const bubble = agent.getSpeechBubble();
        if (bubble) {
          const bubbleX = screenX + 5 * this.PIXEL_SIZE;
          const bubbleY = screenY - 15 * this.PIXEL_SIZE;
          this.drawPixelSprite(this.ctx, bubble, bubbleX, bubbleY, this.PIXEL_SIZE);
        }

        // Draw name label (small text)
        this.ctx.fillStyle = '#CCCCCC';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(agent.name, screenX + 24, screenY + 32);
      }
    }

    update(deltaTime) {
      // Cap delta time to prevent large jumps
      const dt = Math.min(deltaTime / 1000, 0.1);

      for (const agent of this.agents.values()) {
        agent.update(dt);
      }

      // Remove fully despawned agents
      for (const [id, agent] of this.agents) {
        if (agent.isDespawning && agent.despawnProgress >= 1) {
          this.agents.delete(id);
        }
      }

      this.dirty = true;
    }

    gameLoop(currentTime) {
      if (!this.isVisible) {
        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
        return;
      }

      if (this.lastFrameTime === 0) {
        this.lastFrameTime = currentTime;
      }

      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      this.update(deltaTime);

      if (this.dirty) {
        this.render();
        this.dirty = false;
      }

      this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    addAgent(id, name, paletteIndex) {
      if (this.agents.size >= this.maxAgents) {
        console.warn('Max agents reached');
        return false;
      }

      const agent = new Agent(id, name, paletteIndex);
      // Start at random position
      agent.tileX = Math.floor(Math.random() * (this.ROOM_WIDTH - 4)) + 2;
      agent.tileY = Math.floor(Math.random() * (this.ROOM_HEIGHT - 2)) + 2;
      agent.desiredTileX = agent.tileX;
      agent.desiredTileY = agent.tileY;

      this.agents.set(id, agent);
      this.playSound('arrive');
      this.dirty = true;
      return true;
    }

    removeAgent(id) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.isDespawning = true;
        agent.despawnProgress = 0;
        this.dirty = true;
        return true;
      }
      return false;
    }

    setAgentState(id, state) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.setState(state);
        if (state === 'done') {
          this.playSound('done');
        }
        this.dirty = true;
      }
    }

    setAgentTool(id, toolName) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.toolName = toolName;
      }
    }

    toggle() {
      this.isVisible = !this.isVisible;
      localStorage.setItem('cloudcode_pixel_agents', this.isVisible.toString());
      this.dirty = true;
    }

    isEnabled() {
      return this.isVisible;
    }

    playSound(type) {
      // Check if audio context exists and is allowed
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        if (type === 'arrive') {
          // Ascending 2-note chime
          const notes = [
            { freq: 329.63, duration: 0.18 }, // E5
            { freq: 659.25, duration: 0.18 }, // E6
          ];

          let time = audioContext.currentTime;
          for (const note of notes) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.14, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + note.duration);

            osc.start(time);
            osc.stop(time + note.duration);

            time += note.duration;
          }
        } else if (type === 'done') {
          // Descending 2-note
          const notes = [
            { freq: 659.25, duration: 0.15 }, // E6
            { freq: 329.63, duration: 0.15 }, // A5
          ];

          let time = audioContext.currentTime;
          for (const note of notes) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + note.duration);

            osc.start(time);
            osc.stop(time + note.duration);

            time += note.duration;
          }
        }
      } catch (e) {
        // Audio context not available or permission denied
      }
    }

    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      this.agents.clear();
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  let renderer = null;

  window.PixelAgents = {
    /**
     * Initialize the pixel agents system
     * @param {string} canvasId - ID of canvas element
     */
    init(canvasId) {
      if (renderer) {
        console.warn('PixelAgents already initialized');
        return;
      }

      renderer = new PixelAgentsRenderer(canvasId);

      // Start game loop
      renderer.animationId = requestAnimationFrame((t) => renderer.gameLoop(t));

      // Pause when tab is not visible
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (renderer.animationId) {
            cancelAnimationFrame(renderer.animationId);
            renderer.animationId = null;
          }
        } else {
          renderer.lastFrameTime = 0;
          renderer.animationId = requestAnimationFrame((t) => renderer.gameLoop(t));
        }
      });
    },

    /**
     * Add an agent to the scene
     * @param {string} id - Unique agent ID
     * @param {string} name - Display name
     * @param {number} palette - Color palette (0-5)
     */
    addAgent(id, name, palette) {
      if (!renderer) {
        console.error('PixelAgents not initialized');
        return false;
      }
      return renderer.addAgent(id, name, palette);
    },

    /**
     * Remove an agent with despawn animation
     * @param {string} id - Agent ID
     */
    removeAgent(id) {
      if (!renderer) return;
      renderer.removeAgent(id);
    },

    /**
     * Set agent state
     * @param {string} id - Agent ID
     * @param {string} state - 'idle', 'active', 'waiting', or 'done'
     */
    setAgentState(id, state) {
      if (!renderer) return;
      renderer.setAgentState(id, state);
    },

    /**
     * Set current tool being used by agent
     * @param {string} id - Agent ID
     * @param {string} toolName - Tool name (for future use)
     */
    setAgentTool(id, toolName) {
      if (!renderer) return;
      renderer.setAgentTool(id, toolName);
    },

    /**
     * Check if pixel agents are enabled
     * @returns {boolean}
     */
    isEnabled() {
      if (!renderer) return false;
      return renderer.isEnabled();
    },

    /**
     * Toggle pixel agents on/off
     */
    toggle() {
      if (!renderer) return;
      renderer.toggle();
    },

    /**
     * Clean up and destroy
     */
    destroy() {
      if (renderer) {
        renderer.destroy();
        renderer = null;
      }
    },
  };

  // Auto-initialize if canvas exists on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('pixel-agents-canvas')) {
        window.PixelAgents.init('pixel-agents-canvas');
      }
    });
  } else {
    if (document.getElementById('pixel-agents-canvas')) {
      window.PixelAgents.init('pixel-agents-canvas');
    }
  }
})();
