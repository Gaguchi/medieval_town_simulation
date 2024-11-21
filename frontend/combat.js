class CombatUnit {
    constructor(name, stats) {
        this.name = name;
        this.stats = {
            maxHp: stats.maxHp,
            currentHp: stats.maxHp,
            strength: stats.strength,
            defense: stats.defense,
            speed: stats.speed,
            hit: stats.hit,
            avoid: stats.avoid
        };
    }

    attack(target) {
        // Calculate hit chance (Fire Emblem style)
        const hitChance = (this.stats.hit - target.stats.avoid) / 100;
        const hitRoll = Math.random();
        
        if (hitRoll <= hitChance) {
            // Calculate damage
            const damage = Math.max(this.stats.strength - target.stats.defense, 1);
            target.stats.currentHp = Math.max(0, target.stats.currentHp - damage);
            return {
                hit: true,
                damage: damage,
                critical: false
            };
        }

        return {
            hit: false,
            damage: 0,
            critical: false
        };
    }

    isDefeated() {
        return this.stats.currentHp <= 0;
    }
}

class CombatScene {
    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'combat-overlay';
        document.body.appendChild(this.overlay);
        this.combatLog = [];
        this.isAutoFighting = false;
        this.init();
    }

    init() {
        // Create combat scene HTML
        this.overlay.innerHTML = `
            <div class="combat-scene">
                <div class="combat-log">
                    <div class="log-content"></div>
                </div>
                <div class="combat-units">
                    <div class="combat-unit player-unit">
                        <div class="unit-stats">
                            <div>HP: <span class="player-hp">20/20</span></div>
                        </div>
                        <div class="unit-sprite"></div>
                        <div class="health-bar">
                            <div class="health-bar-fill player-health" style="width: 100%"></div>
                        </div>
                    </div>
                    <div class="combat-unit enemy-unit">
                        <div class="unit-stats">
                            <div>HP: <span class="enemy-hp">20/20</span></div>
                        </div>
                        <div class="unit-sprite"></div>
                        <div class="health-bar">
                            <div class="health-bar-fill enemy-health" style="width: 100%"></div>
                        </div>
                    </div>
                </div>
                <div class="combat-controls">
                    <button class="combat-button" id="attack-btn">Attack</button>
                    <button class="combat-button" id="auto-fight-btn">Auto Fight</button>
                    <button class="combat-button" id="end-combat-btn">End Combat</button>
                </div>
            </div>
        `;

        // Initialize units
        this.player = new CombatUnit('Player', {
            maxHp: 20,
            strength: 8,
            defense: 5,
            speed: 7,
            hit: 85,
            avoid: 20
        });

        this.enemy = new CombatUnit('Enemy', {
            maxHp: 20,
            strength: 6,
            defense: 4,
            speed: 5,
            hit: 75,
            avoid: 15
        });

        // Add event listeners
        document.getElementById('attack-btn').addEventListener('click', () => this.performCombatRound());
        document.getElementById('auto-fight-btn').addEventListener('click', () => this.toggleAutoFight());
        document.getElementById('end-combat-btn').addEventListener('click', () => this.hide());
    }

    logCombatAction(message) {
        this.combatLog.unshift(message);
        if (this.combatLog.length > 50) this.combatLog.pop();
        
        const logContent = document.querySelector('.log-content');
        if (logContent) {
            logContent.innerHTML = this.combatLog.map(msg => `<div class="log-entry">${msg}</div>`).join('');
        }
    }

    async performAttack(attacker, defender, isPlayer) {
        const result = attacker.attack(defender);
        const attackerName = isPlayer ? 'Player' : 'Enemy';
        
        if (result.hit) {
            this.logCombatAction(`${attackerName} hits for ${result.damage} damage!`);
            await this.showDamageNumber(defender, result.damage);
            this.updateDisplay();
            return result.damage;
        } else {
            this.logCombatAction(`${attackerName} missed!`);
            return 0;
        }
    }

    async performCombatRound() {
        if (this.player.isDefeated() || this.enemy.isDefeated()) return;

        // Disable controls during combat
        this.setControlsEnabled(false);

        // Player attacks first
        await this.performAttack(this.player, this.enemy, true);

        // Enemy counterattack if still alive
        if (!this.enemy.isDefeated()) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.performAttack(this.enemy, this.player, false);
        }

        // Check for defeat
        if (this.player.isDefeated() || this.enemy.isDefeated()) {
            const winner = this.player.isDefeated() ? 'Enemy' : 'Player';
            this.logCombatAction(`Combat ended! ${winner} is victorious!`);
            this.isAutoFighting = false;
            setTimeout(() => {
                alert(`${winner} wins!`);
                this.hide();
            }, 1000);
        } else if (this.isAutoFighting) {
            // Continue auto-fighting after a delay
            setTimeout(() => this.performCombatRound(), 1000);
        }

        this.setControlsEnabled(true);
    }

    setControlsEnabled(enabled) {
        const buttons = document.querySelectorAll('.combat-button');
        buttons.forEach(btn => {
            if (btn.id !== 'end-combat-btn') {
                btn.disabled = !enabled;
            }
        });
    }

    toggleAutoFight() {
        this.isAutoFighting = !this.isAutoFighting;
        const autoFightBtn = document.getElementById('auto-fight-btn');
        autoFightBtn.textContent = this.isAutoFighting ? 'Stop Auto' : 'Auto Fight';
        
        if (this.isAutoFighting) {
            this.logCombatAction('Auto-fight started!');
            this.performCombatRound();
        } else {
            this.logCombatAction('Auto-fight stopped.');
        }
    }

    show() {
        this.overlay.style.display = 'flex';
        this.updateDisplay();
        this.combatLog = [];
        this.logCombatAction('Combat started!');
    }

    hide() {
        this.overlay.style.display = 'none';
        this.isAutoFighting = false;
    }

    updateDisplay() {
        // Update HP displays
        document.querySelector('.player-hp').textContent = 
            `${this.player.stats.currentHp}/${this.player.stats.maxHp}`;
        document.querySelector('.enemy-hp').textContent = 
            `${this.enemy.stats.currentHp}/${this.enemy.stats.maxHp}`;

        // Update health bars
        document.querySelector('.player-health').style.width = 
            `${(this.player.stats.currentHp / this.player.stats.maxHp) * 100}%`;
        document.querySelector('.enemy-health').style.width = 
            `${(this.enemy.stats.currentHp / this.enemy.stats.maxHp) * 100}%`;
    }

    async showDamageNumber(unit, damage) {
        const unitElement = unit === this.player ? 
            document.querySelector('.player-unit') : 
            document.querySelector('.enemy-unit');
        
        const damageElement = document.createElement('div');
        damageElement.className = 'damage-number';
        damageElement.textContent = damage;
        unitElement.appendChild(damageElement);

        // Remove after animation
        setTimeout(() => damageElement.remove(), 1000);
    }
}

// Create global instance
window.combatScene = new CombatScene();
