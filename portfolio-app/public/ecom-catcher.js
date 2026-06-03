// Ecom Catcher — Mini-game engine
(function () {
  'use strict';

  // === CONFIG ===
  const GOOD_TERMS = [
    { text: 'PIM', pts: 10, debuff: 'slow', debuffMsg: 'Контент в хаосе!' },
    { text: 'CRM', pts: 10, debuff: 'shake', debuffMsg: 'Клиенты уходят!' },
    { text: 'ROAS', pts: 15, debuff: 'burn', debuffMsg: 'Бюджет горит!' },
    { text: 'A/B-тест', pts: 10, debuff: null },
    { text: 'Юнит-экономика', pts: 20, debuff: 'slow', debuffMsg: 'Убытки!' },
    { text: 'Омниканальность', pts: 15, debuff: null },
    { text: 'LTV', pts: 10, debuff: null },
    { text: 'Фулфилмент', pts: 10, debuff: 'slow', debuffMsg: 'Товар застрял!' },
    { text: 'SEO', pts: 10, debuff: 'slow', debuffMsg: 'Трафик падает!' },
    { text: 'UX-аудит', pts: 15, debuff: null },
  ];
  const BAD_TERMS = [
    { text: 'Бюрократия', pts: -15, debuff: 'slow', debuffMsg: 'Бюрократия!' },
    { text: 'Легаси', pts: -10, debuff: 'invert', debuffMsg: 'Инверсия!' },
    { text: 'Аутсорс по дешёвке', pts: -20, debuff: 'blur', debuffMsg: 'Всё мутно!' },
    { text: '«Не мой KPI»', pts: -10, debuff: 'shrink', debuffMsg: 'Сжатие!' },
    { text: 'Годовой бэклог', pts: -15, debuff: 'slow', debuffMsg: 'Завал!' },
    { text: 'Раздутый штат', pts: -10, debuff: 'grow', debuffMsg: 'Раздуло!' },
  ];

  const COLORS = {
    bg: '#0a0e1a',
    cyan: '#00f0ff',
    purple: '#c084fc',
    good: '#00ff88',
    bad: '#ff4466',
    text: '#e0e6f0',
    dim: 'rgba(255,255,255,0.4)',
    hudBg: 'rgba(10,14,26,0.85)',
  };

  const PLAYER_W = 48, PLAYER_H = 56;
  const TERM_H = 32;
  const BASE_SPEED = 1.5;
  const SPEED_INC = 0.15; // per 15s
  const SPAWN_INTERVAL_START = 1400; // ms
  const SPAWN_INTERVAL_MIN = 500;
  const DEBUFF_DURATION = 4000;

  // === GAME CLASS ===
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = 'menu'; // menu | playing | over
      this.score = 0;
      this.lives = 3;
      this.terms = [];
      this.debuffs = {};
      this.elapsed = 0;
      this.lastSpawn = 0;
      this.playerX = 0;
      this.playerW = PLAYER_W;
      this.keys = {};
      this.highScore = parseInt(localStorage.getItem('ecom_hi') || '0');
      this.resize();
      this._bindEvents();
      this._loop(0);
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.groundY = this.h - 60;
      if (this.state === 'menu') this.playerX = this.w / 2 - PLAYER_W / 2;
    }

    _bindEvents() {
      window.addEventListener('keydown', e => {
        this.keys[e.key] = true;
        if (e.key === ' ' || e.key === 'Enter') {
          if (this.state === 'menu') this.start();
          else if (this.state === 'over') this.start();
        }
      });
      window.addEventListener('keyup', e => { this.keys[e.key] = false; });
      window.addEventListener('resize', () => this.resize());

      // Touch
      let touchX = null;
      this.canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (this.state !== 'playing') { this.start(); return; }
        touchX = e.touches[0].clientX;
      }, { passive: false });
      this.canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!touchX || this.state !== 'playing') return;
        const dx = e.touches[0].clientX - touchX;
        touchX = e.touches[0].clientX;
        this.playerX += dx;
      }, { passive: false });
      this.canvas.addEventListener('touchend', () => { touchX = null; });
    }

    start() {
      this.state = 'playing';
      this.score = 0;
      this.lives = 3;
      this.terms = [];
      this.debuffs = {};
      this.elapsed = 0;
      this.lastSpawn = 0;
      this.playerX = this.w / 2 - PLAYER_W / 2;
      this.playerW = PLAYER_W;
    }

    _speed() { return BASE_SPEED + Math.floor(this.elapsed / 15000) * SPEED_INC; }
    _spawnInterval() { return Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START - Math.floor(this.elapsed / 15000) * 80); }

    _spawnTerm() {
      const isGood = Math.random() < 0.6;
      const pool = isGood ? GOOD_TERMS : BAD_TERMS;
      const tmpl = pool[Math.floor(Math.random() * pool.length)];
      this.ctx.font = 'bold 14px Inter, sans-serif';
      const tw = this.ctx.measureText(tmpl.text).width + 24;
      const x = Math.random() * (this.w - tw);
      this.terms.push({ ...tmpl, x, y: -TERM_H, w: tw, good: isGood, angle: (Math.random() - 0.5) * 0.08 });
    }

    _applyDebuff(type, msg) {
      this.debuffs[type] = { until: performance.now() + DEBUFF_DURATION, msg };
      if (type === 'shrink') this.playerW = PLAYER_W * 0.6;
      if (type === 'grow') this.playerW = PLAYER_W * 1.6;
    }

    _hasDebuff(type) {
      const d = this.debuffs[type];
      if (!d) return false;
      if (performance.now() > d.until) { delete this.debuffs[type]; this._resetSize(); return false; }
      return true;
    }

    _resetSize() {
      if (!this.debuffs.shrink && !this.debuffs.grow) this.playerW = PLAYER_W;
    }

    _update(dt, now) {
      if (this.state !== 'playing') return;
      this.elapsed += dt;

      // Player movement
      let speed = 5;
      if (this._hasDebuff('slow')) speed = 2.5;
      let dx = 0;
      if (this.keys['ArrowLeft'] || this.keys['a']) dx = -speed;
      if (this.keys['ArrowRight'] || this.keys['d']) dx = speed;
      if (this._hasDebuff('invert')) dx = -dx;
      this.playerX += dx;
      this.playerX = Math.max(0, Math.min(this.w - this.playerW, this.playerX));

      // Spawn
      if (now - this.lastSpawn > this._spawnInterval()) {
        this._spawnTerm();
        this.lastSpawn = now;
      }

      // Move terms
      const fallSpeed = this._speed();
      const toRemove = [];
      for (let i = 0; i < this.terms.length; i++) {
        const t = this.terms[i];
        t.y += fallSpeed;
        t.angle += 0.001;

        // Collision with player
        if (t.y + TERM_H >= this.groundY - PLAYER_H && t.y + TERM_H <= this.groundY + 10 &&
            t.x + t.w > this.playerX && t.x < this.playerX + this.playerW) {
          this.score += t.pts;
          if (!t.good && t.debuff) this._applyDebuff(t.debuff, t.debuffMsg);
          if (!t.good) this.lives--;
          this._spawnParticle(t.x + t.w / 2, t.y, t.good);
          toRemove.push(i);
          continue;
        }

        // Missed (fell through)
        if (t.y > this.groundY + 20) {
          if (t.good && t.debuff) {
            this._applyDebuff(t.debuff, t.debuffMsg);
            this.lives--;
          }
          toRemove.push(i);
        }
      }
      for (let i = toRemove.length - 1; i >= 0; i--) this.terms.splice(toRemove[i], 1);

      // Particles
      if (this.particles) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.y += p.vy; p.x += p.vx; p.life -= dt;
          if (p.life <= 0) this.particles.splice(i, 1);
        }
      }

      // Clean debuffs
      for (const k of Object.keys(this.debuffs)) this._hasDebuff(k);

      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'over';
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('ecom_hi', String(this.score));
        }
      }
    }

    _spawnParticle(x, y, good) {
      if (!this.particles) this.particles = [];
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3,
          life: 600, color: good ? COLORS.good : COLORS.bad
        });
      }
    }

    _draw() {
      const ctx = this.ctx;
      // BG
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, this.w, this.h);

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(0,240,255,0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < this.h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }
      for (let x = 0; x < this.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke(); }

      // Ground
      const grd = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 4);
      grd.addColorStop(0, COLORS.cyan);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, this.groundY, this.w, 4);

      if (this.state === 'menu') { this._drawMenu(); return; }
      if (this.state === 'over') { this._drawGame(); this._drawOverlay(); return; }
      this._drawGame();
    }

    _drawGame() {
      const ctx = this.ctx;

      // Debuff visual effects
      if (this._hasDebuff('blur')) {
        ctx.fillStyle = 'rgba(100,50,50,0.15)';
        ctx.fillRect(0, 0, this.w, this.h);
      }
      if (this._hasDebuff('burn')) {
        ctx.fillStyle = 'rgba(255,50,0,0.08)';
        ctx.fillRect(0, 0, this.w, this.h);
      }
      if (this._hasDebuff('shake')) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      }

      // Terms
      for (const t of this.terms) {
        ctx.save();
        ctx.translate(t.x + t.w / 2, t.y + TERM_H / 2);
        ctx.rotate(t.angle);
        const borderColor = t.good ? COLORS.good : COLORS.bad;
        ctx.fillStyle = 'rgba(10,14,26,0.9)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-t.w / 2, -TERM_H / 2, t.w, TERM_H, 6);
        ctx.fill();
        ctx.stroke();
        // Glow
        ctx.shadowColor = borderColor;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = t.good ? COLORS.good : COLORS.bad;
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }

      // Player
      const px = this.playerX, py = this.groundY - PLAYER_H;
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(px + this.playerW * 0.2, py, this.playerW * 0.6, PLAYER_H * 0.35); // head
      ctx.fillStyle = '#1a2040';
      ctx.fillRect(px + this.playerW * 0.1, py + PLAYER_H * 0.35, this.playerW * 0.8, PLAYER_H * 0.45); // body
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + this.playerW * 0.1, py + PLAYER_H * 0.35, this.playerW * 0.8, PLAYER_H * 0.45);
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(px + this.playerW * 0.15, py + PLAYER_H * 0.8, this.playerW * 0.25, PLAYER_H * 0.2); // legs
      ctx.fillRect(px + this.playerW * 0.6, py + PLAYER_H * 0.8, this.playerW * 0.25, PLAYER_H * 0.2);

      // Particles
      if (this.particles) {
        for (const p of this.particles) {
          ctx.globalAlpha = Math.max(0, p.life / 600);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      if (this._hasDebuff('shake')) ctx.restore();

      // HUD
      this._drawHUD();
    }

    _drawHUD() {
      const ctx = this.ctx;
      ctx.fillStyle = COLORS.hudBg;
      ctx.fillRect(0, 0, this.w, 44);
      ctx.fillStyle = 'rgba(0,240,255,0.1)';
      ctx.fillRect(0, 43, this.w, 1);

      // Lives
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let hearts = '';
      for (let i = 0; i < 3; i++) hearts += i < this.lives ? '❤️' : '🖤';
      ctx.fillText(hearts, 12, 22);

      // Score
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.textAlign = 'right';
      ctx.fillText('⭐ ' + this.score, this.w - 12, 22);

      // Active debuffs
      const activeDebuffs = [];
      for (const [k, v] of Object.entries(this.debuffs)) {
        const remaining = Math.ceil((v.until - performance.now()) / 1000);
        if (remaining > 0) activeDebuffs.push(v.msg + ' ' + remaining + 'с');
      }
      if (activeDebuffs.length) {
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = COLORS.bad;
        ctx.textAlign = 'center';
        ctx.fillText(activeDebuffs.join('  •  '), this.w / 2, 22);
      }
    }

    _drawMenu() {
      const ctx = this.ctx, cx = this.w / 2, cy = this.h / 2;
      // Title
      ctx.font = 'bold 32px Outfit, sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 20;
      ctx.fillText('ECOM CATCHER', cx, cy - 80);
      ctx.shadowBlur = 0;

      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('Лови полезные термины, уклоняйся от вредных!', cx, cy - 40);

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = COLORS.good;
      ctx.fillText('🟢 Зелёные = очки     ', cx - 40, cy);
      ctx.fillStyle = COLORS.bad;
      ctx.fillText('🔴 Красные = штрафы', cx + 80, cy);

      ctx.fillStyle = COLORS.dim;
      ctx.fillText('← → стрелки или A/D для управления', cx, cy + 40);

      // Start button
      const bw = 200, bh = 48, bx = cx - bw / 2, by = cy + 70;
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke();
      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Играть', cx, by + bh / 2);

      if (this.highScore > 0) {
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = COLORS.purple;
        ctx.fillText('Рекорд: ' + this.highScore, cx, by + bh + 30);
      }
    }

    _drawOverlay() {
      const ctx = this.ctx, cx = this.w / 2, cy = this.h / 2;
      ctx.fillStyle = 'rgba(10,14,26,0.85)';
      ctx.fillRect(0, 0, this.w, this.h);

      ctx.font = 'bold 28px Outfit, sans-serif';
      ctx.fillStyle = COLORS.bad;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', cx, cy - 50);

      ctx.font = 'bold 40px Outfit, sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText(this.score, cx, cy);

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('очков', cx, cy + 28);

      if (this.score >= this.highScore && this.score > 0) {
        ctx.fillStyle = COLORS.purple;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText('🏆 Новый рекорд!', cx, cy + 55);
      }

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('Нажмите Enter или Space', cx, cy + 90);
    }

    _loop(ts) {
      const dt = this._lastTs ? ts - this._lastTs : 16;
      this._lastTs = ts;
      this._update(dt, ts);
      this._draw();
      requestAnimationFrame(t => this._loop(t));
    }
  }

  // Auto-init
  window.EcomCatcher = Game;
})();
