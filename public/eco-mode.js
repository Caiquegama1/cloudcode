(function() {
  'use strict';

  const EcoMode = {
    state: {
      level: 'off', // 'off', 'eco', 'max'
      totalTokens: 0,
      savedTokens: 0,
      messagesRouted: 0,
      sessionStart: Date.now(),
      currentModel: 'sonnet'
    },

    config: {
      toggleWidth: 200,
      toggleHeight: 40,
      knobSize: 36,
      animationDuration: 300,
      tokenSaveEco: 0.35,     // 35% savings with eco mode
      tokenSaveMax: 0.65      // 65% savings with max mode
    },

    init(containerId) {
      this.containerId = containerId;
      this.loadState();
      this.injectStyles();
      this.render();
      this.attachEventListeners();
      return this;
    },

    loadState() {
      const saved = localStorage.getItem('cloudcode_eco_mode');
      if (saved && ['off', 'eco', 'max'].includes(saved)) {
        this.state.level = saved;
      }

      const stats = localStorage.getItem('cloudcode_eco_stats');
      if (stats) {
        try {
          const parsed = JSON.parse(stats);
          this.state.totalTokens = parsed.totalTokens || 0;
          this.state.savedTokens = parsed.savedTokens || 0;
          this.state.messagesRouted = parsed.messagesRouted || 0;
        } catch (e) {
          console.warn('Failed to load eco stats:', e);
        }
      }
    },

    saveState() {
      localStorage.setItem('cloudcode_eco_mode', this.state.level);
      localStorage.setItem('cloudcode_eco_stats', JSON.stringify({
        totalTokens: this.state.totalTokens,
        savedTokens: this.state.savedTokens,
        messagesRouted: this.state.messagesRouted
      }));
    },

    injectStyles() {
      if (document.getElementById('eco-mode-styles')) return;

      const style = document.createElement('style');
      style.id = 'eco-mode-styles';
      style.textContent = `
        * {
          --eco-off-bg: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          --eco-off-text: #6b7280;
          --eco-eco-bg: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          --eco-eco-glow: rgba(34, 197, 94, 0.4);
          --eco-max-bg: linear-gradient(135deg, #10b981 0%, #059669 100%);
          --eco-max-glow: rgba(16, 185, 129, 0.6);
          --eco-transition: cubic-bezier(0.4, 0.0, 0.2, 1);
        }

        .eco-mode-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          user-select: none;
          margin: 16px 0;
        }

        .eco-mode-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: var(--surface, #ffffff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          transition: background-color 0.3s ease;
        }

        .eco-mode-wrapper.dark-mode {
          background: var(--surface, #1f2937);
          border-color: var(--border, #374151);
        }

        .eco-mode-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary, #6b7280);
          margin-bottom: 8px;
        }

        .eco-mode-toggle-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .eco-mode-toggle {
          position: relative;
          width: 200px;
          height: 40px;
          border-radius: 20px;
          background: var(--eco-off-bg);
          cursor: pointer;
          border: 1px solid rgba(0, 0, 0, 0.1);
          transition: all 0.3s var(--eco-transition);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .eco-mode-toggle.eco {
          background: var(--eco-eco-bg);
          border-color: rgba(34, 197, 94, 0.3);
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1), 0 2px 8px rgba(34, 197, 94, 0.2);
        }

        .eco-mode-toggle.max {
          background: var(--eco-max-bg);
          border-color: rgba(16, 185, 129, 0.3);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15), 0 2px 8px rgba(16, 185, 129, 0.3);
          animation: eco-pulse 2s ease-in-out infinite;
        }

        @keyframes eco-pulse {
          0%, 100% {
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15), 0 2px 8px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.1), 0 2px 12px rgba(16, 185, 129, 0.4);
          }
        }

        .eco-mode-knob {
          position: absolute;
          top: 50%;
          left: 2px;
          width: 36px;
          height: 36px;
          background: white;
          border-radius: 50%;
          transform: translateY(-50%);
          transition: left 0.3s var(--eco-transition);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .eco-mode-toggle.eco .eco-mode-knob {
          left: 82px;
        }

        .eco-mode-toggle.max .eco-mode-knob {
          left: 162px;
        }

        .eco-mode-level-text {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(0, 0, 0, 0.5);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease 0.1s;
        }

        .eco-mode-toggle.eco .eco-mode-level-text,
        .eco-mode-toggle.max .eco-mode-level-text {
          color: white;
          opacity: 1;
        }

        .eco-mode-savings-text {
          font-size: 10px;
          color: var(--text-secondary, #6b7280);
          text-align: center;
          opacity: 0;
          transition: opacity 0.3s ease 0.2s;
        }

        .eco-mode-toggle.eco .eco-mode-savings-text,
        .eco-mode-toggle.max .eco-mode-savings-text {
          opacity: 1;
          color: var(--eco-eco-glow);
        }

        .eco-mode-toggle.max .eco-mode-savings-text {
          color: var(--eco-max-glow);
        }

        .eco-mode-stats {
          background: var(--bg-secondary, #f9fafb);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          padding: 12px 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .eco-mode-wrapper.dark-mode .eco-mode-stats {
          background: var(--bg-secondary, #111827);
          border-color: var(--border, #374151);
        }

        .eco-mode-stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .eco-mode-stat-label {
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: var(--text-secondary, #9ca3af);
        }

        .eco-mode-stat-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--text, #1f2937);
          font-variant-numeric: tabular-nums;
        }

        .eco-mode-wrapper.dark-mode .eco-mode-stat-value {
          color: var(--text, #f3f4f6);
        }

        .eco-mode-stat-value.highlight {
          color: #22c55e;
        }

        .eco-mode-stat-value.highlight-max {
          color: #10b981;
        }

        .eco-mode-controls {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .eco-mode-btn {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--bg, #ffffff);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text, #1f2937);
        }

        .eco-mode-wrapper.dark-mode .eco-mode-btn {
          background: var(--bg, #1f2937);
          border-color: var(--border, #374151);
          color: var(--text, #f3f4f6);
        }

        .eco-mode-btn:hover {
          background: var(--bg-hover, #f3f4f6);
          border-color: var(--border-hover, #d1d5db);
        }

        .eco-mode-wrapper.dark-mode .eco-mode-btn:hover {
          background: var(--bg-hover, #111827);
          border-color: var(--border-hover, #4b5563);
        }

        .eco-mode-btn:active {
          transform: scale(0.98);
        }

        .eco-mode-btn.reset {
          font-size: 11px;
          color: #ef4444;
        }

        @media (max-width: 640px) {
          .eco-mode-toggle {
            width: 160px;
          }

          .eco-mode-knob {
            width: 30px;
            height: 30px;
            font-size: 16px;
          }

          .eco-mode-toggle.eco .eco-mode-knob {
            left: 65px;
          }

          .eco-mode-toggle.max .eco-mode-knob {
            left: 128px;
          }

          .eco-mode-stats {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .eco-mode-level-text {
            font-size: 10px;
          }
        }

        /* Animation for number updates */
        @keyframes eco-number-pop {
          0% {
            transform: scale(0.9);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .eco-mode-stat-value.updated {
          animation: eco-number-pop 0.4s ease-out;
        }
      `;

      document.head.appendChild(style);
    },

    render() {
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error(`Container #${this.containerId} not found`);
        return;
      }

      const isDark = this.detectDarkMode();
      const savingsPercent = this.state.level === 'off' ? 0 :
                             this.state.level === 'eco' ? 35 : 65;
      const costSaved = (this.state.savedTokens / 1000) * 0.002; // Rough estimate

      const html = `
        <div class="eco-mode-container">
          <div class="eco-mode-wrapper ${isDark ? 'dark-mode' : ''}">
            <div class="eco-mode-label">⚡ Token Efficiency</div>

            <div class="eco-mode-toggle-wrapper">
              <div class="eco-mode-toggle ${this.state.level}" id="eco-toggle">
                <div class="eco-mode-knob" id="eco-knob">
                  ${this.state.level === 'off' ? '' : '🌿'}
                </div>
                <div class="eco-mode-level-text" id="eco-level-text">
                  ${this.state.level.toUpperCase()}
                </div>
                <div class="eco-mode-savings-text" id="eco-savings-text">
                  ~${savingsPercent}% savings
                </div>
              </div>
            </div>

            <div class="eco-mode-stats">
              <div class="eco-mode-stat-item">
                <div class="eco-mode-stat-label">Tokens Saved</div>
                <div class="eco-mode-stat-value ${this.state.level !== 'off' ? 'highlight' : ''}" id="eco-stat-tokens">
                  ${this.formatNumber(this.state.savedTokens)}
                </div>
              </div>
              <div class="eco-mode-stat-item">
                <div class="eco-mode-stat-label">Est. Cost Saved</div>
                <div class="eco-mode-stat-value ${this.state.level !== 'off' ? 'highlight' : ''}" id="eco-stat-cost">
                  $${costSaved.toFixed(2)}
                </div>
              </div>
              <div class="eco-mode-stat-item">
                <div class="eco-mode-stat-label">Messages Routed</div>
                <div class="eco-mode-stat-value" id="eco-stat-messages">
                  ${this.state.messagesRouted}
                </div>
              </div>
              <div class="eco-mode-stat-item">
                <div class="eco-mode-stat-label">Total Tokens Used</div>
                <div class="eco-mode-stat-value" id="eco-stat-total">
                  ${this.formatNumber(this.state.totalTokens)}
                </div>
              </div>
            </div>

            <div class="eco-mode-controls">
              <button class="eco-mode-btn" id="eco-reset-btn">Reset Stats</button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;
    },

    attachEventListeners() {
      const toggle = document.getElementById('eco-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => this.toggle());
      }

      const resetBtn = document.getElementById('eco-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => this.resetStats());
      }
    },

    detectDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    },

    toggle() {
      const levels = ['off', 'eco', 'max'];
      const currentIndex = levels.indexOf(this.state.level);
      this.setLevel(levels[(currentIndex + 1) % levels.length]);
    },

    setLevel(level) {
      if (!['off', 'eco', 'max'].includes(level)) return;
      this.state.level = level;
      this.saveState();
      this.updateUI();
    },

    getLevel() {
      return this.state.level;
    },

    isEnabled() {
      return this.state.level !== 'off';
    },

    updateUI() {
      const toggle = document.getElementById('eco-toggle');
      const knob = document.getElementById('eco-knob');
      const levelText = document.getElementById('eco-level-text');
      const savingsText = document.getElementById('eco-savings-text');

      if (toggle) {
        toggle.classList.remove('eco', 'max');
        if (this.state.level !== 'off') {
          toggle.classList.add(this.state.level);
        }
      }

      if (knob) {
        knob.textContent = this.state.level === 'off' ? '' : '🌿';
      }

      if (levelText) {
        levelText.textContent = this.state.level.toUpperCase();
      }

      if (savingsText) {
        const percent = this.state.level === 'off' ? 0 :
                       this.state.level === 'eco' ? 35 : 65;
        savingsText.textContent = `~${percent}% savings`;
      }

      this.updateStats();
    },

    updateStats() {
      const costSaved = (this.state.savedTokens / 1000) * 0.002;

      this.updateStatElement('eco-stat-tokens', this.formatNumber(this.state.savedTokens));
      this.updateStatElement('eco-stat-cost', `$${costSaved.toFixed(2)}`);
      this.updateStatElement('eco-stat-messages', `${this.state.messagesRouted}`);
      this.updateStatElement('eco-stat-total', this.formatNumber(this.state.totalTokens));
    },

    updateStatElement(id, value) {
      const el = document.getElementById(id);
      if (el && el.textContent !== value) {
        el.textContent = value;
        el.classList.remove('updated');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 400);
      }
    },

    formatNumber(num) {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      }
      return num.toString();
    },

    trackTokens(count, model = 'sonnet') {
      this.state.totalTokens += count;

      // Calculate savings based on eco level and model routing
      let savedTokens = 0;
      if (this.state.level === 'eco') {
        // Estimate 35% savings when intelligently routing
        savedTokens = Math.floor(count * this.config.tokenSaveEco);
      } else if (this.state.level === 'max') {
        // Estimate 65% savings when aggressively routing to Haiku
        savedTokens = Math.floor(count * this.config.tokenSaveMax);
      }

      this.state.savedTokens += savedTokens;
      this.state.messagesRouted += 1;
      this.saveState();
      this.updateStats();
    },

    getSavedTokens() {
      return {
        tokens: this.state.savedTokens,
        cost: (this.state.savedTokens / 1000) * 0.002,
        messagesRouted: this.state.messagesRouted,
        percentage: this.state.level === 'off' ? 0 :
                   this.state.level === 'eco' ? 35 : 65
      };
    },

    resetStats() {
      const confirm = window.confirm('Reset all token statistics? This cannot be undone.');
      if (confirm) {
        this.state.totalTokens = 0;
        this.state.savedTokens = 0;
        this.state.messagesRouted = 0;
        this.state.sessionStart = Date.now();
        this.saveState();
        this.updateStats();
      }
    },

    getRecommendedModel(message, currentModel = 'sonnet') {
      // If eco mode is off, use current model
      if (this.state.level === 'off') {
        return currentModel;
      }

      // Analyze message complexity
      const messageLength = message.length;
      const hasCodeBlock = /```[\s\S]*?```/.test(message);
      const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
      const hasComplexKeywords = /refactor|debug|architect|optimize|analyze|review/.test(message.toLowerCase());

      let complexity = 'simple';
      if (messageLength >= 500 || hasCodeBlock || hasComplexKeywords) {
        complexity = 'complex';
      } else if (messageLength >= 100 || hasMultipleQuestions) {
        complexity = 'medium';
      }

      // Route based on eco level and complexity
      if (this.state.level === 'eco') {
        if (complexity === 'simple') return 'haiku';
        if (complexity === 'medium') return 'sonnet';
        if (complexity === 'complex') return currentModel;
      }

      if (this.state.level === 'max') {
        if (complexity === 'simple') return 'haiku';
        if (complexity === 'medium') return 'haiku';
        if (complexity === 'complex') return 'sonnet'; // Upgrade to Sonnet for complex, but never Opus
      }

      return currentModel;
    },

    setCurrentModel(model) {
      this.state.currentModel = model;
    }
  };

  // Expose to window
  window.EcoMode = EcoMode;

  // Auto-initialize if container exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const container = document.getElementById('eco-mode-container');
      if (container) {
        EcoMode.init('eco-mode-container');
      }
    });
  } else {
    const container = document.getElementById('eco-mode-container');
    if (container && !EcoMode.initialized) {
      EcoMode.init('eco-mode-container');
    }
  }
})();
