class Simulation {
    constructor() {
        // Initialize canvas first
        this.canvas = document.getElementById('simulation-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize basic properties
        this.villagers = [];
        this.wheatAccumulated = 0;
        this.wheatRate = 0;
        this.toolsRate = 0;
        this.lastUpdate = Date.now();
        this.tradeLog = [];
        this.maxLogEntries = 100;

        // Initialize inventories
        this.townInventory = {
            wheat: 0,
            tools: 0,
            money: 1000,
            depletionRate: 1,
            maxStorage: 200
        };
        this.villageInventory = {
            wheat: 0,
            tools: 0,
            money: 500,
            depletionRate: 1,
            maxStorage: 200,
            wheatReserve: 20,  // Above this amount, trader can buy wheat
            wheatMarketOpen: false  // Market state for wheat trading
        };

        // Initialize trader
        this.trader = new Trader(200);  // Start trader with 200 money

        // Production buildings
        this.villageFarms = [
            { production: 3.0, interval: 3 }, // produces 2 wheat every 5 seconds
            { production: 2.5, interval: 2 },
            { production: 2.8, interval: 1.5 }
        ];

        this.townSmiths = [
            { production: 1.5, interval: 6 }, // produces 1.5 tools every 6 seconds
            { production: 1.2, interval: 5 },
            { production: 1.0, interval: 4 }
        ];

        // Production timers
        this.farmTimers = this.villageFarms.map(farm => 0);
        this.smithTimers = this.townSmiths.map(smith => 0);

        // Setup UI elements with error handling
        this.setupUI();
        this.setupInventoryControls();
        this.setupEventListeners();
        
        // Start price updates
        this.updatePrices();
        this.updateInterval = setInterval(() => this.updatePrices(), 2000);

        // Add this line after other initializations
        this.maxActiveVillagers = 2;  // Maximum number of concurrent villagers allowed

        // Set fixed total money in the system
        const TOTAL_MONEY = 2000;
        this.townInventory.money = TOTAL_MONEY * 0.4;  // 40% to town
        this.villageInventory.money = TOTAL_MONEY * 0.4;  // 40% to village
        this.trader.inventory.money = TOTAL_MONEY * 0.2;  // 20% to trader

        this.updateMoneyDistribution();

        // Fixed total money in the economy
        this.TOTAL_MONEY = 2000;  // Total money in the system
        
        // Population metrics
        this.townPopulation = {
            base: 50,
            current: 50,
            growthRate: 0.05,      // Reduced from 0.1
            resourceConsumption: 2, // Increased from 1
            minWealth: 0.3,        // Minimum wealth factor before severe decline
            targetWealth: 0.4      // Target wealth factor for stable population
        };
        
        this.villagePopulation = {
            base: 30,
            current: 30,
            growthRate: 0.05,      // Reduced from 0.1
            resourceConsumption: 1, // Kept at 1 (villagers consume less per capita)
            minWealth: 0.3,        // Minimum wealth factor before severe decline
            targetWealth: 0.4      // Target wealth factor for stable population
        };

        // Modified initial money distribution (now sums to TOTAL_MONEY)
        this.townInventory.money = this.TOTAL_MONEY * 0.4;    // 40% to town
        this.villageInventory.money = this.TOTAL_MONEY * 0.4; // 40% to village
        this.trader.inventory.money = this.TOTAL_MONEY * 0.2;  // 20% to trader

        // Add money verification interval
        setInterval(() => this.verifyTotalMoney(), 5000);

        // Add accounting tracking
        this.townAccounting = {
            wheatSales: 0,
            toolPurchases: 0,
            lastUpdate: Date.now(),
            history: []
        };
        
        this.villageAccounting = {
            wheatSales: 0,
            toolPurchases: 0,
            lastUpdate: Date.now(),
            history: []
        };

        this.setupAccountingLog();
    }

    setupEventListeners() {
        try {
            const sliders = ['wheat-demand', 'wheat-supply', 'tools-demand', 'tools-supply'];
            sliders.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('input', () => this.updatePrices());
                } else {
                    console.warn(`Element with id ${id} not found`);
                }
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    setupInventoryControls() {
        const wheatDepletion = document.getElementById('wheat-depletion');
        const toolsDepletion = document.getElementById('tools-depletion');

        if (wheatDepletion) {
            wheatDepletion.addEventListener('input', (e) => {
                this.townInventory.depletionRate = parseFloat(e.target.value);
            });
        }

        if (toolsDepletion) {
            toolsDepletion.addEventListener('input', (e) => {
                this.villageInventory.depletionRate = parseFloat(e.target.value);
            });
        }
    }

    async updatePrices() {
        const state = {
            wheat_demand: document.getElementById('wheat-demand').value,
            wheat_supply: document.getElementById('wheat-supply').value,
            tools_demand: document.getElementById('tools-demand').value,
            tools_supply: document.getElementById('tools-supply').value
        };

        try {
            const response = await fetch('http://127.0.0.1:8001/update_market', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(state)
            });
            const data = await response.json();
            
            document.getElementById('wheat-price').textContent = data.wheat_price.toFixed(2);
            document.getElementById('tools-price').textContent = data.tools_price.toFixed(2);
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }

    logTrade(wheatAmount, toolsAmount, wheatPrice, toolsPrice) {
        // Instead of updating trade log, just log the transaction
        const tradeValue = wheatAmount * wheatPrice;
        const toolsValue = toolsAmount * toolsPrice;
        
        // Log the transaction in the accounting system
        if (wheatAmount > 0) {
            this.logTransaction('wheat', wheatAmount, wheatPrice, true);  // Town receives wheat
        }
        if (toolsAmount > 0) {
            this.logTransaction('tools', toolsAmount, toolsPrice, false); // Village receives tools
        }
    }

    getRandomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    updateInventories(deltaTime) {
        // Deplete inventories
        this.townInventory.wheat = Math.max(0, this.townInventory.wheat - 
            (this.townInventory.depletionRate * deltaTime));
        this.villageInventory.tools = Math.max(0, this.villageInventory.tools - 
            (this.villageInventory.depletionRate * deltaTime));

        // Update all inventory displays
        const inventoryElements = {
            'town-wheat': this.townInventory.wheat,
            'town-tools': this.townInventory.tools,
            'village-wheat': this.villageInventory.wheat,
            'village-tools': this.villageInventory.tools
        };

        // Safe update of elements
        Object.entries(inventoryElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value.toFixed(1);
            }
        });

        // Calculate demand based on inventory levels
        const wheatDemand = Math.max(0, 100 - (this.townInventory.wheat));
        const toolsDemand = Math.max(0, 100 - (this.villageInventory.tools));

        // Update demand sliders
        document.getElementById('wheat-demand').value = wheatDemand;
        document.getElementById('tools-demand').value = toolsDemand;

        this.updatePrices();

        // Population-based depletion
        this.townInventory.wheat = Math.max(0, this.townInventory.wheat - 
            (this.townInventory.depletionRate * deltaTime));
        this.villageInventory.tools = Math.max(0, this.villageInventory.tools - 
            (this.villageInventory.depletionRate * deltaTime));

        // Update displays
        const displayElements = {
            'town-wheat': this.townInventory.wheat,
            'town-tools': this.townInventory.tools,
            'village-wheat': this.villageInventory.wheat,
            'village-tools': this.villageInventory.tools,
            'town-population': Math.floor(this.townPopulation.current),
            'village-population': Math.floor(this.villagePopulation.current)
        };

        // Update UI elements
        Object.entries(displayElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = typeof value === 'number' ? value.toFixed(1) : value;
            }
        });
    }

    updateProduction(deltaTime) {
        // Update farm production
        this.farmTimers = this.farmTimers.map((timer, index) => {
            const farm = this.villageFarms[index];
            timer += deltaTime;
            if (timer >= farm.interval) {
                // Check storage capacity before adding
                if (this.villageInventory.wheat < this.villageInventory.maxStorage) {
                    this.villageInventory.wheat = Math.min(
                        this.villageInventory.wheat + farm.production,
                        this.villageInventory.maxStorage
                    );
                }
                timer = 0;
            }
            return timer;
        });

        // Update smithy production
        this.smithTimers = this.smithTimers.map((timer, index) => {
            const smith = this.townSmiths[index];
            timer += deltaTime;
            if (timer >= smith.interval) {
                if (this.townInventory.tools < this.townInventory.maxStorage) {
                    this.townInventory.tools = Math.min(
                        this.townInventory.tools + smith.production,
                        this.townInventory.maxStorage
                    );
                }
                timer = 0;
            }
            return timer;
        });
    }

    update() {
        try {
            const currentTime = Date.now();
            const deltaTime = (currentTime - this.lastUpdate) / 1000; // Convert to seconds
            this.lastUpdate = currentTime;

            this.updateProduction(deltaTime);
            this.updateInventories(deltaTime);
            this.isWheatMarketOpen(); // Update market status

            // Check for villager creation - simplified
            if (this.villageInventory.wheat >= 10) {  // Only need minimum wheat for trade
                const wheatAmount = 10;  // Fixed amount
                this.createVillager(wheatAmount);
            }

            // Update villagers with error handling
            this.villagers = this.villagers.filter(villager => {
                try {
                    if (!villager.finished) {
                        villager.update();
                    }
                    return !villager.finished;
                } catch (error) {
                    console.error('Error updating villager:', error);
                    return false;
                }
            });

            if (this.trader) {
                this.trader.update(deltaTime);
            }
            this.updateLocationInfo();

            this.updateMoneyDistribution();

            this.updatePopulation(deltaTime);
            this.updateProduction(deltaTime);
            this.updateInventories(deltaTime);
            // ...rest of existing update code...

            this.updateMoneyDistribution();
            this.verifyTotalMoney();
        } catch (error) {
            console.error('Error in simulation update:', error);
        }
    }

    isWheatMarketOpen() {
        const isOpen = this.villageInventory.wheat > this.villageInventory.wheatReserve;
        if (isOpen !== this.villageInventory.wheatMarketOpen) {
            this.villageInventory.wheatMarketOpen = isOpen;
            console.log(`Village wheat market is now ${isOpen ? 'OPEN' : 'CLOSED'}`);
        }
        return isOpen;
    }

    createVillager(wheatAmount) {
        // First check if we haven't reached the maximum number of active villagers
        const activeVillagers = this.villagers.filter(v => !v.finished).length;
        if (activeVillagers >= this.maxActiveVillagers) {
            return; // Don't create new villager if we're at max capacity
        }

        // Then check if there's enough wheat
        if (this.villageInventory.wheat >= wheatAmount) {
            this.villageInventory.wheat -= wheatAmount;
            this.villagers.push(new Villager(50, 450, wheatAmount));
        }
    }

    handleTrade(villager) {
        const wheatPrice = parseFloat(document.getElementById('wheat-price').textContent);
        const toolsPrice = parseFloat(document.getElementById('tools-price').textContent);
        
        // Check if town has tools available
        const maxToolsPossible = Math.min(
            Math.floor(villager.wheatAmount * wheatPrice / toolsPrice),
            this.townInventory.tools
        );

        if (maxToolsPossible > 0) {
            // Complete the trade
            this.townInventory.wheat += villager.wheatAmount;
            this.townInventory.tools -= maxToolsPossible;
            villager.toolsAmount = maxToolsPossible;
            villager.money = villager.wheatAmount * wheatPrice;
            
            this.logTrade(
                villager.wheatAmount,
                maxToolsPossible,
                wheatPrice,
                toolsPrice
            );

            const tradeValue = villager.wheatAmount * wheatPrice;
            this.townInventory.money += tradeValue;
            this.villageInventory.money -= tradeValue;

            // Log transactions for both parties
            const wheatValue = villager.wheatAmount * wheatPrice;
            const toolsValue = maxToolsPossible * toolsPrice;
            
            this.logTransaction('wheat', villager.wheatAmount, wheatPrice, true);  // Town receives wheat
            this.logTransaction('tools', maxToolsPossible, toolsPrice, false);     // Village receives tools
        }
    }

    draw() {
        const canvas = this.canvas;
        const ctx = this.ctx;
        
        // Clear and set background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw town (adjusted positions)
        ctx.fillStyle = 'brown';
        ctx.fillRect(400, 100, 80, 80);
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.fillText('Town', 420, 140);
        
        // Draw village (adjusted positions)
        ctx.fillStyle = 'green';
        ctx.fillRect(100, 400, 60, 60);
        ctx.fillStyle = 'black';
        ctx.fillText('Village', 105, 430);
        
        // Draw villagers
        this.villagers.forEach(villager => villager.draw(ctx));
        this.trader.draw(this.ctx);

        // Draw production buildings
        this.drawBuildings(this.ctx);
    }

    drawBuildings(ctx) {
        // Draw farms
        this.villageFarms.forEach((farm, index) => {
            const x = 50 + (index * 30);
            const y = 500;
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x, y, 20, 20);
            // Draw production timer
            const progress = this.farmTimers[index] / farm.interval;
            ctx.fillStyle = '#90EE90';
            ctx.fillRect(x, y - 5, 20 * progress, 3);
        });

        // Draw smithies
        this.townSmiths.forEach((smith, index) => {
            const x = 400 + (index * 30);
            const y = 50;
            ctx.fillStyle = '#696969';
            ctx.fillRect(x, y, 20, 20);
            // Draw production timer
            const progress = this.smithTimers[index] / smith.interval;
            ctx.fillStyle = '#FFA07A';
            ctx.fillRect(x, y - 5, 20 * progress, 3);
        });
    }

    start() {
        const gameLoop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    setupUI() {
        // Setup accounting panel toggle
        const toggle = document.getElementById('accounting-log-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const panel = toggle.closest('.accounting-panel');
                panel.classList.toggle('collapsed');
                toggle.querySelector('.toggle-icon').textContent = 
                    panel.classList.contains('collapsed') ? '▼' : '▲';
            });
        }
    }

    setupAccountingLog() {
        const toggle = document.getElementById('accounting-log-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const log = toggle.parentElement;
                log.classList.toggle('collapsed');
                toggle.querySelector('.toggle-icon').textContent = 
                    log.classList.contains('collapsed') ? '▼' : '▲';
            });
        }
    }

    logTransaction(type, amount, price, isTown) {
        const accounting = isTown ? this.townAccounting : this.villageAccounting;
        const currentTime = Date.now();
        const timeElapsed = (currentTime - accounting.lastUpdate) / 1000;
        
        if (type === 'wheat') {
            accounting.wheatSales += amount * price;
        } else if (type === 'tools') {
            accounting.toolPurchases += amount * price;
        }

        // Record history entry every minute
        if (timeElapsed >= 60) {
            accounting.history.unshift({
                timestamp: new Date().toLocaleTimeString(),
                wheatSales: accounting.wheatSales,
                toolPurchases: accounting.toolPurchases,
                netFlow: accounting.wheatSales - accounting.toolPurchases
            });

            // Keep last 10 entries
            if (accounting.history.length > 10) {
                accounting.history.pop();
            }

            // Reset current period
            accounting.wheatSales = 0;
            accounting.toolPurchases = 0;
            accounting.lastUpdate = currentTime;
        }

        this.updateAccountingDisplay();
    }

    updateAccountingDisplay() {
        const townContent = document.getElementById('town-accounting');
        const villageContent = document.getElementById('village-accounting');

        if (townContent) {
            townContent.innerHTML = this.generateAccountingTable(this.townAccounting, true);
        }
        if (villageContent) {
            villageContent.innerHTML = this.generateAccountingTable(this.villageAccounting, false);
        }
    }

    generateAccountingTable(accounting, isTown) {
        const title = isTown ? 'Town' : 'Village';
        const currentPeriod = `
            <div class="accounting-current">
                <h4>Current Period</h4>
                <table>
                    <tr><td>${isTown ? 'Wheat Sales' : 'Wheat Exports'}:</td><td>+${accounting.wheatSales.toFixed(1)}</td></tr>
                    <tr><td>${isTown ? 'Tool Costs' : 'Tool Imports'}:</td><td>-${accounting.toolPurchases.toFixed(1)}</td></tr>
                    <tr class="net-flow"><td>Net Flow:</td><td class="${accounting.wheatSales - accounting.toolPurchases >= 0 ? 'positive' : 'negative'}">
                        ${(accounting.wheatSales - accounting.toolPurchases).toFixed(1)}
                    </td></tr>
                </table>
            </div>
        `;

        const history = accounting.history.length > 0 ? `
            <div class="accounting-history">
                <h4>History</h4>
                <table>
                    <tr>
                        <th>Time</th>
                        <th>${isTown ? 'Sales' : 'Exports'}</th>
                        <th>${isTown ? 'Costs' : 'Imports'}</th>
                        <th>Net</th>
                    </tr>
                    ${accounting.history.map(entry => `
                        <tr>
                            <td>${entry.timestamp}</td>
                            <td>+${entry.wheatSales.toFixed(1)}</td>
                            <td>-${entry.toolPurchases.toFixed(1)}</td>
                            <td class="${entry.netFlow >= 0 ? 'positive' : 'negative'}">${entry.netFlow.toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        ` : '';

        return `<h3>${title} Accounting</h3>${currentPeriod}${history}`;
    }

    updateLocationInfo() {
        const townInfo = document.getElementById('town-info');
        const villageInfo = document.getElementById('village-info');

        townInfo.innerHTML = `
            <strong>Town Market</strong><br>
            Population: ${Math.floor(this.townPopulation.current)} <span id="town-population-trend"></span><br>
            Money: ${this.townInventory.money.toFixed(1)}<br>
            Wheat: ${this.townInventory.wheat.toFixed(1)}<br>
            Tools: ${this.townInventory.tools.toFixed(1)}<br>
            Depletion: ${this.townInventory.depletionRate.toFixed(2)}/s
        `;

        villageInfo.innerHTML = `
            <strong>Village Market</strong><br>
            Population: ${Math.floor(this.villagePopulation.current)} <span id="village-population-trend"></span><br>
            Money: ${this.villageInventory.money.toFixed(1)}<br>
            Wheat: ${this.villageInventory.wheat.toFixed(1)}<br>
            Tools: ${this.villageInventory.tools.toFixed(1)}<br>
            Depletion: ${this.villageInventory.depletionRate.toFixed(2)}/s
        `;
    }

    villagerReturn(villager) {
        if (!villager) return;

        // Return villager's tools to village inventory
        if (villager.toolsAmount > 0) {
            this.villageInventory.tools += villager.toolsAmount;
            villager.toolsAmount = 0;
        }

        // Add money to village coffers
        if (villager.money > 0) {
            this.villageInventory.money += villager.money;
            villager.money = 0;
        }

        // Log the completed trade cycle
        this.logTrade(
            0, // No wheat traded on return
            villager.toolsAmount,
            parseFloat(document.getElementById('wheat-price').textContent),
            parseFloat(document.getElementById('tools-price').textContent)
        );
    }

    updateMoneyDistribution() {
        const moneyChart = document.getElementById('money-chart');
        const entities = [
            { name: 'Town', money: this.townInventory.money },
            { name: 'Village', money: this.villageInventory.money },
            { name: 'Trader', money: this.trader.inventory.money }
        ];

        // Sort by money amount
        entities.sort((a, b) => b.money - a.money);

        // Calculate total money for percentage
        const totalMoney = entities.reduce((sum, entity) => sum + entity.money, 0);

        // Update chart
        moneyChart.innerHTML = entities.map(entity => `
            <div class="money-bar">
                <div class="money-bar-fill" style="width: ${(entity.money / totalMoney * 100)}%">
                    <span class="money-bar-label">${entity.name}: ${entity.money.toFixed(1)} coins</span>
                </div>
            </div>
        `).join('');
    }

    verifyTotalMoney() {
        const currentTotal = (
            this.townInventory.money +
            this.villageInventory.money +
            this.trader.inventory.money +
            this.villagers.reduce((sum, v) => sum + v.money, 0)
        );

        if (Math.abs(currentTotal - this.TOTAL_MONEY) > 0.01) {
            console.error(`Money leak detected! Expected: ${this.TOTAL_MONEY}, Found: ${currentTotal}`);
            // Adjust to maintain total (proportionally)
            const ratio = this.TOTAL_MONEY / currentTotal;
            this.townInventory.money *= ratio;
            this.villageInventory.money *= ratio;
            this.trader.inventory.money *= ratio;
            this.villagers.forEach(v => v.money *= ratio);
        }
    }

    updatePopulation(deltaTime) {
        // Calculate economic health factors
        const totalMoney = this.TOTAL_MONEY;
        const townWealthFactor = this.townInventory.money / totalMoney;
        const villageWealthFactor = this.villageInventory.money / totalMoney;

        // Calculate resource factors
        const townResourceFactor = Math.min(1, this.townInventory.wheat / (this.townPopulation.current * 2));
        const villageResourceFactor = Math.min(1, this.villageInventory.tools / this.villagePopulation.current);

        // Calculate population changes with more severe penalties
        const townPopChange = this.calculatePopulationChange(
            this.townPopulation,
            townWealthFactor,
            townResourceFactor,
            deltaTime
        );

        const villagePopChange = this.calculatePopulationChange(
            this.villagePopulation,
            villageWealthFactor,
            villageResourceFactor,
            deltaTime
        );

        // Update populations with minimum thresholds
        this.townPopulation.current = Math.max(
            this.townPopulation.base * 0.1,
            Math.min(
                this.townPopulation.base * 3, // Maximum population cap
                this.townPopulation.current + townPopChange
            )
        );

        this.villagePopulation.current = Math.max(
            this.villagePopulation.base * 0.1,
            Math.min(
                this.villagePopulation.base * 3, // Maximum population cap
                this.villagePopulation.current + villagePopChange
            )
        );

        // Update depletion rates based on population and wealth
        this.updateDepletionRates();
        
        // Update population trend indicators
        this.updatePopulationTrends(townPopChange, villagePopChange);
    }

    calculatePopulationChange(population, wealthFactor, resourceFactor, deltaTime) {
        // Calculate wealth impact
        const wealthImpact = (wealthFactor - population.targetWealth) * 2;
        
        // Calculate severe decline if below minimum wealth
        if (wealthFactor < population.minWealth) {
            return -population.current * 0.1 * deltaTime; // Rapid decline
        }

        // Calculate normal population change
        const change = population.current * population.growthRate * (
            wealthImpact +         // Wealth effect
            resourceFactor - 1 +   // Resource availability effect
            (Math.random() * 0.1 - 0.05) // Random fluctuation
        ) * deltaTime;

        return change;
    }

    updateDepletionRates() {
        // Town depletion scales with population and inverse of wealth
        this.townInventory.depletionRate = (
            this.townPopulation.current * 
            this.townPopulation.resourceConsumption * 
            (1 + (0.4 - this.townInventory.money / this.TOTAL_MONEY)) * 
            0.01
        );
        
        // Village depletion scales similarly
        this.villageInventory.depletionRate = (
            this.villagePopulation.current * 
            this.villagePopulation.resourceConsumption * 
            (1 + (0.4 - this.villageInventory.money / this.TOTAL_MONEY)) * 
            0.01
        );
    }

    updatePopulationTrends(townChange, villageChange) {
        const townTrend = document.getElementById('town-population-trend');
        const villageTrend = document.getElementById('village-population-trend');
        
        if (townTrend) {
            townTrend.textContent = townChange > 0 ? '↑' : townChange < 0 ? '↓' : '→';
            townTrend.style.color = townChange > 0 ? 'green' : townChange < 0 ? 'red' : 'gray';
        }
        
        if (villageTrend) {
            villageTrend.textContent = villageChange > 0 ? '↑' : villageChange < 0 ? '↓' : '→';
            villageTrend.style.color = villageChange > 0 ? 'green' : villageChange < 0 ? 'red' : 'gray';
        }
    }

    updateLocationInfo() {
        const townInfo = document.getElementById('town-info');
        const villageInfo = document.getElementById('village-info');

        townInfo.innerHTML = `
            <strong>Town Market</strong><br>
            Population: ${Math.floor(this.townPopulation.current)} <span id="town-population-trend"></span><br>
            Money: ${this.townInventory.money.toFixed(1)}<br>
            Wheat: ${this.townInventory.wheat.toFixed(1)}<br>
            Tools: ${this.townInventory.tools.toFixed(1)}<br>
            Depletion: ${this.townInventory.depletionRate.toFixed(2)}/s
        `;

        villageInfo.innerHTML = `
            <strong>Village Market</strong><br>
            Population: ${Math.floor(this.villagePopulation.current)} <span id="village-population-trend"></span><br>
            Money: ${this.villageInventory.money.toFixed(1)}<br>
            Wheat: ${this.villageInventory.wheat.toFixed(1)}<br>
            Tools: ${this.villageInventory.tools.toFixed(1)}<br>
            Depletion: ${this.villageInventory.depletionRate.toFixed(2)}/s
        `;
    }
}

class Villager {
    constructor(x, y, wheatAmount) {
        this.x = x;
        this.y = y;
        this.finished = false;
        this.goingToTown = true;
        this.speed = this.getRandomSpeed();
        this.wheatAmount = wheatAmount;
        this.toolsAmount = 0;
        this.hasTraded = false;
        this.money = 0;
    }

    getRandomSpeed() {
        return Math.random() * 2 + 1; // Random speed between 1 and 3
    }

    update() {
        try {
            if (this.goingToTown) {
                if (this.y > 140) {
                    this.y -= this.speed;
                } else if (this.x < 400) {
                    this.x += this.speed;
                } else {
                    if (!this.hasTraded) {
                        this.hasTraded = true;
                        window.simulation.handleTrade(this);
                    }
                    this.goingToTown = false;
                }
            } else {
                if (this.x > 100) {
                    this.x -= this.speed;
                } else if (this.y < 400) {
                    this.y += this.speed;
                } else {
                    if (!this.finished) {
                        if (typeof window.simulation.villagerReturn === 'function') {
                            window.simulation.villagerReturn(this);
                        } else {
                            console.error('villagerReturn function not found');
                        }
                        this.finished = true;
                    }
                }
            }
        } catch (error) {
            console.error('Error in villager update:', error);
            this.finished = true;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Trader {
    constructor(startingMoney) {
        this.x = 400;
        this.y = 100;
        this.goingToVillage = true;
        this.speed = 1.5;
        this.inventory = {
            wheat: 0,
            tools: 0,
            capacity: 15,  // Maximum carrying capacity
            money: startingMoney
        };
        this.tradeCooldown = 0;
        this.waitingForWheat = false;
    }

    update(deltaTime) {
        if (this.tradeCooldown > 0) {
            this.tradeCooldown -= deltaTime;
        }

        // Simplified waiting condition
        if (this.waitingForWheat) {
            if (window.simulation.isWheatMarketOpen()) {
                this.waitingForWheat = false;
            } else {
                return; // Stay in place waiting for market to open
            }
        }

        // Normal movement and trading logic
        if (this.goingToVillage) {
            if (this.y < 400) {
                this.y += this.speed;
            } else if (this.x > 100) {
                this.x -= this.speed;
            } else {
                this.goingToVillage = false;
                if (this.tradeCooldown <= 0) {
                    const hasTraded = this.tradeAtVillage();
                    if (!hasTraded) {
                        this.waitingForWheat = true;
                    }
                }
            }
        } else {
            if (this.x < 400) {
                this.x += this.speed;
            } else if (this.y > 100) {
                this.y -= this.speed;
            } else {
                this.goingToVillage = true;
                if (this.tradeCooldown <= 0) {
                    this.tradeAtTown();
                }
            }
        }
    }

    tradeAtVillage() {
        const toolsPrice = parseFloat(document.getElementById('tools-price').textContent) * 1.2;
        const wheatPrice = parseFloat(document.getElementById('wheat-price').textContent) * 0.8;
        let tradeMade = false;
        
        // Sell tools first
        if (this.inventory.tools > 0) {
            const maxAffordableTools = Math.floor(window.simulation.villageInventory.money / toolsPrice);
            const toolsToSell = Math.min(this.inventory.tools, maxAffordableTools);
            
            if (toolsToSell > 0) {
                const profit = toolsToSell * toolsPrice;
                window.simulation.villageInventory.tools += toolsToSell;
                window.simulation.villageInventory.money -= profit;
                this.inventory.tools -= toolsToSell;
                this.inventory.money += profit;
                tradeMade = true;
            }
        }

        // Buy wheat only if market is open
        if (window.simulation.isWheatMarketOpen()) {
            const availableWheat = window.simulation.villageInventory.wheat - window.simulation.villageInventory.wheatReserve;
            const maxAffordableWheat = Math.floor(this.inventory.money / wheatPrice);
            const availableSpace = this.inventory.capacity - this.inventory.wheat;
            const amountToBuy = Math.min(
                maxAffordableWheat,
                availableSpace,
                availableWheat
            );

            if (amountToBuy > 0) {
                const cost = amountToBuy * wheatPrice;
                this.inventory.wheat += amountToBuy;
                this.inventory.money -= cost;
                window.simulation.villageInventory.wheat -= amountToBuy;
                window.simulation.villageInventory.money += cost;
                tradeMade = true;
            }
        }

        if (tradeMade) {
            this.tradeCooldown = 3;
        }
        return tradeMade;
    }

    tradeAtTown() {
        const wheatPrice = parseFloat(document.getElementById('wheat-price').textContent) * 1.2;
        const toolsPrice = parseFloat(document.getElementById('tools-price').textContent) * 0.8;

        // Sell wheat
        if (this.inventory.wheat > 0) {
            const profit = this.inventory.wheat * wheatPrice;
            window.simulation.townInventory.wheat += this.inventory.wheat;
            this.inventory.money += profit;
            this.inventory.wheat = 0;
        }

        // Buy tools
        const maxAffordableTools = Math.floor(this.inventory.money / toolsPrice);
        const availableSpace = this.inventory.capacity - this.inventory.tools;
        const amountToBuy = Math.min(
            maxAffordableTools,
            availableSpace,
            window.simulation.townInventory.tools
        );

        if (amountToBuy > 0) {
            const cost = amountToBuy * toolsPrice;
            this.inventory.tools += amountToBuy;
            this.inventory.money -= cost;
            window.simulation.townInventory.tools -= amountToBuy;
        }

        this.tradeCooldown = 3;
    }

    draw(ctx) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 7);
        ctx.lineTo(this.x + 7, this.y + 7);
        ctx.lineTo(this.x - 7, this.y + 7);
        ctx.closePath();
        ctx.fill();
        
        // Draw inventory status
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.fillText(`T:${this.inventory.tools.toFixed(1)} W:${this.inventory.wheat.toFixed(1)}`, this.x - 20, this.y - 10);
        ctx.fillText(`$${this.inventory.money.toFixed(1)}`, this.x - 20, this.y - 25);

        // Add waiting indicator
        if (this.waitingForWheat) {
            ctx.fillStyle = 'black';
            ctx.font = '12px Arial';
            ctx.fillText('Waiting for wheat', this.x - 30, this.y - 40);
        }
    }
}

// Modified initialization
window.onload = () => {
    window.simulation = new Simulation();
    window.simulation.start();
};
