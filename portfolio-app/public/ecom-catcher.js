// Ecom Catcher v2 — Pixel art knowledge quiz arcade
(function () {
  'use strict';

  // === TERMS ===
  const GOOD = [
    'PIM','SEO','GEO','AI','OMS','CMS','CRM','ERP','CDP','WMS',
    'KPI','LTV','ROAS','A/B','UX','API','BI','NPS','CTR','CR'
  ];
  const BAD = [
    'ASAP','Legacy','TD','WISMO','SLA Breach','OOS','LTV Drop',
    'SPAM','DDoS','404','Downtime','Churn','Bug','Blocker',
    'Scope Creep','FUD'
  ];
  const GOOD_PTS = 10;
  const BAD_PTS = -15;
  const MISS_GOOD_PTS = -5;

  // === CONFIG ===
  const FIELD_W = 400;
  const FIELD_H = 650;
  const PLAYER_W = 40;
  const PLAYER_H = 56;
  const TERM_H = 28;
  const TERM_PAD = 12;
  const GROUND_Y = FIELD_H - 50;
  const BASE_FALL = 1.2;
  const FALL_INC = 0.12;
  const SPAWN_START = 1600;
  const SPAWN_MIN = 550;
  const DEBUFF_DUR = 3500;
  const MAX_LIVES = 3;
  const LEADERBOARD_SIZE = 10;
  const PIXEL_FONT = '"Press Start 2P", monospace';

  // Debuff pool for bad catches
  const DEBUFFS = ['slow','invert','blur','shake','grow'];

  // === HELPERS ===
  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function pickDebuff() { return DEBUFFS[Math.floor(Math.random() * DEBUFFS.length)]; }

  // === GAME ===
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.state = 'loading'; // loading | menu | playing | over | entering_name
      this.score = 0;
      this.lives = MAX_LIVES;
      this.terms = [];
      this.debuffs = {};
      this.particles = [];
      this.elapsed = 0;
      this.lastSpawn = 0;
      this.playerX = FIELD_W / 2 - PLAYER_W / 2;
      this.playerW = PLAYER_W;
      this.keys = {};
      this.nickname = '';
      this.flashMsg = null;
      this.flashEnd = 0;
      this._loadAssets();
      this._bindEvents();
      this._applySize();
      this._loop(0);
    }

    _loadAssets() {
      let loaded = 0;
      const done = () => { loaded++; if (loaded >= 2) this.state = 'menu'; };
      this.bgImg = new Image(); this.bgImg.onload = done; this.bgImg.onerror = done;
      this.bgImg.src = '/office-bg.png';
      this.playerImg = new Image(); this.playerImg.onload = done; this.playerImg.onerror = done;
      this.playerImg.src = '/manager.png';
      // Load pixel font
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    _applySize() {
      this.canvas.width = FIELD_W * this.dpr;
      this.canvas.height = FIELD_H * this.dpr;
      this.canvas.style.width = FIELD_W + 'px';
      this.canvas.style.height = FIELD_H + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    _bindEvents() {
      const kd = e => {
        this.keys[e.key] = true;
        if (this.state === 'entering_name') {
          e.preventDefault();
          if (e.key === 'Backspace') this.nickname = this.nickname.slice(0, -1);
          else if (e.key === 'Enter' && this.nickname.length >= 1) this._saveScore();
          else if (e.key.length === 1 && this.nickname.length < 12) this.nickname += e.key;
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (this.state === 'menu') this._start();
          else if (this.state === 'over') this._promptName();
        }
        if (e.key === 'Escape' && this.state === 'over') { this.state = 'menu'; }
      };
      const ku = e => { this.keys[e.key] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      // Touch
      let touchStartX = null;
      this.canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (this.state === 'menu') { this._start(); return; }
        if (this.state === 'over') { this._promptName(); return; }
        if (this.state !== 'playing') return;
        touchStartX = e.touches[0].clientX;
      }, { passive: false });
      this.canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (this.state !== 'playing' || touchStartX === null) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = FIELD_W / rect.width;
        const dx = (e.touches[0].clientX - touchStartX) * scaleX;
        touchStartX = e.touches[0].clientX;
        this.playerX += dx;
      }, { passive: false });
      this.canvas.addEventListener('touchend', () => { touchStartX = null; });

      // Click for menu / game over
      this.canvas.addEventListener('click', e => {
        if (this.state === 'menu') this._start();
        else if (this.state === 'over') this._promptName();
      });
    }

    _start() {
      this.state = 'playing';
      this.score = 0;
      this.lives = MAX_LIVES;
      this.terms = [];
      this.debuffs = {};
      this.particles = [];
      this.elapsed = 0;
      this.lastSpawn = 0;
      this.playerX = FIELD_W / 2 - PLAYER_W / 2;
      this.playerW = PLAYER_W;
      this.flashMsg = null;
    }

    _promptName() {
      const lb = this._getLeaderboard();
      if (lb.length < LEADERBOARD_SIZE || this.score > (lb[lb.length - 1]?.score || 0)) {
        this.state = 'entering_name';
        this.nickname = '';
      } else {
        this.state = 'menu';
      }
    }

    _saveScore() {
      const lb = this._getLeaderboard();
      lb.push({ name: this.nickname.trim() || 'Аноним', score: this.score });
      lb.sort((a, b) => b.score - a.score);
      if (lb.length > LEADERBOARD_SIZE) lb.length = LEADERBOARD_SIZE;
      localStorage.setItem('ecom_lb', JSON.stringify(lb));
      this.state = 'menu';
    }

    _getLeaderboard() {
      try { return JSON.parse(localStorage.getItem('ecom_lb') || '[]'); } catch { return []; }
    }

    _fallSpeed() { return BASE_FALL + Math.floor(this.elapsed / 15000) * FALL_INC; }
    _spawnInt() { return Math.max(SPAWN_MIN, SPAWN_START - Math.floor(this.elapsed / 15000) * 70); }

    _spawnTerm() {
      const isGood = Math.random() < 0.55;
      const pool = isGood ? GOOD : BAD;
      const text = pool[Math.floor(Math.random() * pool.length)];
      this.ctx.font = '10px ' + PIXEL_FONT;
      const tw = Math.max(this.ctx.measureText(text).width + TERM_PAD * 2, 50);
      const x = rnd(4, FIELD_W - tw - 4);
      this.terms.push({ text, x, y: -TERM_H, w: tw, good: isGood, rot: rnd(-0.06, 0.06) });
    }

    _flash(msg, color) {
      this.flashMsg = { text: msg, color };
      this.flashEnd = performance.now() + 1200;
    }

    _applyDebuff(type) {
      this.debuffs[type] = performance.now() + DEBUFF_DUR;
      if (type === 'grow') this.playerW = PLAYER_W * 1.5;
    }

    _hasDebuff(t) {
      const d = this.debuffs[t];
      if (!d) return false;
      if (performance.now() > d) {
        delete this.debuffs[t];
        if (t === 'grow') this.playerW = PLAYER_W;
        return false;
      }
      return true;
    }

    _addParticles(x, y, color) {
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x, y, vx: rnd(-2, 2), vy: rnd(-3, -0.5), life: 500, color
        });
      }
    }

    _update(dt, now) {
      if (this.state !== 'playing') return;
      this.elapsed += dt;

      // Player movement
      let spd = 4.5;
      if (this._hasDebuff('slow')) spd = 2;
      let dx = 0;
      if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) dx = -spd;
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dx = spd;
      if (this._hasDebuff('invert')) dx = -dx;
      this.playerX += dx;
      this.playerX = Math.max(0, Math.min(FIELD_W - this.playerW, this.playerX));

      // Spawn
      if (now - this.lastSpawn > this._spawnInt()) { this._spawnTerm(); this.lastSpawn = now; }

      // Terms
      const fs = this._fallSpeed();
      const rm = [];
      for (let i = 0; i < this.terms.length; i++) {
        const t = this.terms[i];
        t.y += fs;

        // Catch
        if (t.y + TERM_H >= GROUND_Y - PLAYER_H && t.y <= GROUND_Y &&
            t.x + t.w > this.playerX && t.x < this.playerX + this.playerW) {
          if (t.good) {
            this.score += GOOD_PTS;
            this._flash('+' + GOOD_PTS, '#00ff88');
            this._addParticles(t.x + t.w / 2, t.y, '#00ff88');
          } else {
            this.score += BAD_PTS;
            this.lives--;
            this._applyDebuff(pickDebuff());
            this._flash(BAD_PTS + '', '#ff4466');
            this._addParticles(t.x + t.w / 2, t.y, '#ff4466');
          }
          rm.push(i);
          continue;
        }
        // Missed
        if (t.y > GROUND_Y + 30) {
          if (t.good) {
            this.score += MISS_GOOD_PTS;
            this.lives--;
            this._flash('Пропуск! ' + MISS_GOOD_PTS, '#ffaa00');
          }
          rm.push(i);
        }
      }
      for (let i = rm.length - 1; i >= 0; i--) this.terms.splice(rm[i], 1);

      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Clean debuffs
      for (const k of Object.keys(this.debuffs)) this._hasDebuff(k);

      // Flash timeout
      if (this.flashMsg && now > this.flashEnd) this.flashMsg = null;

      if (this.lives <= 0) { this.lives = 0; this.state = 'over'; }
    }

    // === DRAW ===
    _draw(now) {
      const c = this.ctx;
      // BG
      if (this.bgImg.complete && this.bgImg.naturalWidth) {
        c.drawImage(this.bgImg, 0, 0, FIELD_W, FIELD_H);
        c.fillStyle = 'rgba(10,14,26,0.55)';
        c.fillRect(0, 0, FIELD_W, FIELD_H);
      } else {
        c.fillStyle = '#0a0e1a';
        c.fillRect(0, 0, FIELD_W, FIELD_H);
      }

      // Debuff FX
      if (this._hasDebuff('blur')) { c.fillStyle = 'rgba(80,40,40,0.2)'; c.fillRect(0, 0, FIELD_W, FIELD_H); }
      if (this._hasDebuff('shake')) { c.save(); c.translate(rnd(-3, 3), rnd(-3, 3)); }

      // Ground
      c.fillStyle = 'rgba(0,240,255,0.3)';
      c.fillRect(0, GROUND_Y, FIELD_W, 3);

      if (this.state === 'loading') { this._drawLoading(c); return; }
      if (this.state === 'menu') { this._drawMenu(c); return; }
      if (this.state === 'over') { this._drawPlay(c, now); this._drawOver(c); return; }
      if (this.state === 'entering_name') { this._drawPlay(c, now); this._drawNameInput(c); return; }
      this._drawPlay(c, now);
    }

    _drawLoading(c) {
      c.font = '10px ' + PIXEL_FONT;
      c.fillStyle = '#00f0ff';
      c.textAlign = 'center';
      c.fillText('ЗАГРУЗКА...', FIELD_W / 2, FIELD_H / 2);
    }

    _drawPlay(c, now) {
      // Terms — all look the same!
      for (const t of this.terms) {
        c.save();
        c.translate(t.x + t.w / 2, t.y + TERM_H / 2);
        c.rotate(t.rot);
        c.fillStyle = 'rgba(20,25,50,0.88)';
        c.strokeStyle = 'rgba(200,210,230,0.5)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(-t.w / 2, -TERM_H / 2, t.w, TERM_H, 4);
        c.fill(); c.stroke();
        c.fillStyle = '#dde4f0';
        c.font = '9px ' + PIXEL_FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(t.text, 0, 1);
        c.restore();
      }

      // Player
      const px = this.playerX, py = GROUND_Y - PLAYER_H;
      if (this.playerImg.complete && this.playerImg.naturalWidth) {
        c.imageSmoothingEnabled = false;
        c.drawImage(this.playerImg, px, py, this.playerW, PLAYER_H);
        c.imageSmoothingEnabled = true;
      } else {
        // Fallback pixel character
        c.fillStyle = '#5599dd';
        c.fillRect(px + this.playerW * 0.25, py, this.playerW * 0.5, PLAYER_H * 0.3);
        c.fillStyle = '#334466';
        c.fillRect(px + this.playerW * 0.15, py + PLAYER_H * 0.3, this.playerW * 0.7, PLAYER_H * 0.5);
        c.fillStyle = '#5599dd';
        c.fillRect(px + this.playerW * 0.2, py + PLAYER_H * 0.8, this.playerW * 0.2, PLAYER_H * 0.2);
        c.fillRect(px + this.playerW * 0.6, py + PLAYER_H * 0.8, this.playerW * 0.2, PLAYER_H * 0.2);
      }

      // Particles
      for (const p of this.particles) {
        c.globalAlpha = Math.max(0, p.life / 500);
        c.fillStyle = p.color;
        c.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      c.globalAlpha = 1;

      if (this._hasDebuff('shake')) c.restore();

      // HUD
      c.fillStyle = 'rgba(10,14,26,0.85)';
      c.fillRect(0, 0, FIELD_W, 36);
      c.fillStyle = 'rgba(0,240,255,0.15)';
      c.fillRect(0, 35, FIELD_W, 1);

      // Lives
      c.font = '14px sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      let hearts = '';
      for (let i = 0; i < MAX_LIVES; i++) hearts += i < this.lives ? '❤️' : '🖤';
      c.fillText(hearts, 8, 18);

      // Score
      c.font = '10px ' + PIXEL_FONT;
      c.fillStyle = '#00f0ff';
      c.textAlign = 'right';
      c.fillText(this.score + '', FIELD_W - 10, 20);

      // Active debuffs bar
      const active = [];
      if (this._hasDebuff('slow')) active.push('🐌');
      if (this._hasDebuff('invert')) active.push('🔄');
      if (this._hasDebuff('blur')) active.push('🌫️');
      if (this._hasDebuff('shake')) active.push('💥');
      if (this._hasDebuff('grow')) active.push('📏');
      if (active.length) {
        c.font = '12px sans-serif';
        c.textAlign = 'center';
        c.fillText(active.join(' '), FIELD_W / 2, GROUND_Y + 25);
      }

      // Flash message
      if (this.flashMsg) {
        c.font = 'bold 12px ' + PIXEL_FONT;
        c.fillStyle = this.flashMsg.color;
        c.textAlign = 'center';
        c.globalAlpha = Math.min(1, (this.flashEnd - performance.now()) / 600);
        c.fillText(this.flashMsg.text, FIELD_W / 2, GROUND_Y - PLAYER_H - 20);
        c.globalAlpha = 1;
      }
    }

    _drawMenu(c) {
      const cx = FIELD_W / 2, cy = FIELD_H / 2 - 30;
      c.font = '14px ' + PIXEL_FONT;
      c.fillStyle = '#00f0ff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#00f0ff'; c.shadowBlur = 12;
      c.fillText('ECOM', cx, cy - 50);
      c.fillText('CATCHER', cx, cy - 28);
      c.shadowBlur = 0;

      c.font = '8px ' + PIXEL_FONT;
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillText('Лови полезные термины', cx, cy + 10);
      c.fillText('уклоняйся от вредных!', cx, cy + 28);

      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillText('← → или A/D', cx, cy + 56);

      // Play button
      const bw = 160, bh = 36, bx = cx - bw / 2, by = cy + 80;
      c.strokeStyle = '#00f0ff'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(bx, by, bw, bh, 4); c.stroke();
      c.font = '10px ' + PIXEL_FONT;
      c.fillStyle = '#00f0ff';
      c.fillText('ИГРАТЬ', cx, by + bh / 2 + 1);

      // Leaderboard
      const lb = this._getLeaderboard();
      if (lb.length > 0) {
        const lbY = by + bh + 30;
        c.font = '8px ' + PIXEL_FONT;
        c.fillStyle = '#c084fc';
        c.fillText('— РЕКОРДЫ —', cx, lbY);
        c.font = '7px ' + PIXEL_FONT;
        for (let i = 0; i < Math.min(5, lb.length); i++) {
          const entry = lb[i];
          c.fillStyle = i === 0 ? '#ffd700' : 'rgba(255,255,255,0.5)';
          c.textAlign = 'left';
          c.fillText((i + 1) + '. ' + entry.name, cx - 90, lbY + 20 + i * 16);
          c.textAlign = 'right';
          c.fillText(entry.score + '', cx + 90, lbY + 20 + i * 16);
        }
        c.textAlign = 'center';
      }
    }

    _drawOver(c) {
      c.fillStyle = 'rgba(10,14,26,0.82)';
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      const cx = FIELD_W / 2, cy = FIELD_H / 2 - 20;
      c.font = '12px ' + PIXEL_FONT;
      c.fillStyle = '#ff4466';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('GAME OVER', cx, cy - 40);
      c.font = '20px ' + PIXEL_FONT;
      c.fillStyle = '#00f0ff';
      c.fillText(this.score + '', cx, cy);
      c.font = '8px ' + PIXEL_FONT;
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillText('очков', cx, cy + 22);

      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillText('Enter — сохранить', cx, cy + 60);
      c.fillText('Esc — в меню', cx, cy + 78);
    }

    _drawNameInput(c) {
      c.fillStyle = 'rgba(10,14,26,0.88)';
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      const cx = FIELD_W / 2, cy = FIELD_H / 2 - 20;
      c.font = '10px ' + PIXEL_FONT;
      c.fillStyle = '#c084fc';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('ВАШ НИК:', cx, cy - 30);

      // Input box
      const bw = 240, bh = 32, bx = cx - bw / 2, by = cy - 5;
      c.fillStyle = 'rgba(30,35,60,0.9)';
      c.strokeStyle = '#00f0ff'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(bx, by, bw, bh, 4); c.fill(); c.stroke();

      c.font = '10px ' + PIXEL_FONT;
      c.fillStyle = '#e0e6f0';
      c.textAlign = 'center';
      const cursor = Math.floor(performance.now() / 500) % 2 === 0 ? '▌' : '';
      c.fillText(this.nickname + cursor, cx, by + bh / 2 + 1);

      c.font = '7px ' + PIXEL_FONT;
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillText('Enter — сохранить', cx, by + bh + 24);
    }

    _loop(ts) {
      const dt = this._lastTs ? Math.min(ts - this._lastTs, 50) : 16;
      this._lastTs = ts;
      this._update(dt, ts);
      this._draw(ts);
      requestAnimationFrame(t => this._loop(t));
    }
  }

  window.EcomCatcher = Game;
})();
