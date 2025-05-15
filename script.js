document.addEventListener('DOMContentLoaded', () => {
    console.log("RPS SCRIPT: DOMContentLoaded event fired. V_revolution_fix_final");

    // --- DOM Elements ---
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    const addRockBtn = document.getElementById('add-rock-btn');
    const addPaperBtn = document.getElementById('add-paper-btn');
    const addScissorsBtn = document.getElementById('add-scissors-btn');
    const startPauseResumeBtn = document.getElementById('start-pause-resume-btn');
    const resetBtn = document.getElementById('reset-btn');
    const muteBtn = document.getElementById('mute-btn'); 
    const winnerAnnouncement = document.getElementById('winner-announcement');
    const winnerText = document.getElementById('winner-text');

    if (!canvas || !ctx || !gameContainer || !addRockBtn || !addPaperBtn || !addScissorsBtn || !startPauseResumeBtn || !resetBtn || !muteBtn || !winnerAnnouncement || !winnerText) {
        console.error("RPS SCRIPT FATAL ERROR: One or more critical HTML elements not found. Check IDs in index.html and script.js.");
        return; 
    }
    // console.log("RPS SCRIPT: All critical DOM elements successfully found.");

    // --- Game State & Settings ---
    let gameItems = [];
    let animationFrameId = null;
    let gameActive = false;
    let isPaused = false;
    let gameEverStarted = false;
    let isMuted = false; 

    const ITEM_SIZE = 36; 
    const MAX_SPEED_BASE = 2.9376; 
    const MAX_SPEED_VARIATION = 0.4;
    const INITIAL_SPAWN_COUNT = 10;

    const BehaviorType = { SEEK_ENEMY: 'seek', FLEE_PREDATOR: 'flee', RANDOM_WALK: 'random' };
    const BEHAVIOR_CHANCE_RANDOM_WALK = 0.15;
    const BEHAVIOR_CHANCE_FLEE_PREDATOR = 0.15;

    const SEEK_FORCE = 0.06048;
    const FLEE_FORCE = 0.07776;
    const RANDOM_DRIFT_FORCE = 0.06912;
    const RANDOM_WOBBLE_FORCE = 0.036;
    const DAMPING = 0.98;

    const STUCK_DISTANCE_THRESHOLD_SQ = (1.0 * 1.0); 
    // MODIFICATION: Revolution Loop - Break Sooner for general stuck
    const STUCK_FRAMES_THRESHOLD = 40; // Reduced from 60
    const TEMPORARY_RANDOM_WALK_FRAMES = 30; 

    const ItemType = { ROCK: 'rock', PAPER: 'paper', SCISSORS: 'scissors' };
    const EnemyMap = { [ItemType.ROCK]: ItemType.SCISSORS, [ItemType.PAPER]: ItemType.ROCK, [ItemType.SCISSORS]: ItemType.PAPER };
    const PredatorMap = { [ItemType.ROCK]: ItemType.PAPER, [ItemType.PAPER]: ItemType.SCISSORS, [ItemType.SCISSORS]: ItemType.ROCK };

    // --- Asset Loading (Copied from your working version) ---
    const images = {};
    const imageUrls = {
        [ItemType.ROCK]: 'images/rock.png',
        [ItemType.PAPER]: 'images/paper.png',
        [ItemType.SCISSORS]: 'images/scissors.png'
    };
    const totalImages = Object.keys(imageUrls).length;

    const audioElements = {}; 
    const soundPools = { rockWins: [], paperWins: [], scissorsWins: [] };
    const POOL_SIZE_PER_WIN_SOUND = 3;
    const soundUrls = {
        rockWins: 'sounds/rock_wins.mp3',
        paperWins: 'sounds/paper_wins.mp3',
        scissorsWins: 'sounds/scissors_wins.mp3',
        confetti: 'sounds/confetti.mp3'
    };
    
    let allMediaLoadedCallback = null;
    let currentMediaLoaded = 0;
    let totalMediaToLoad = 0;
    let mediaLoadTimer = null; // Added from my previous robust version

    function calculateTotalMediaToLoad() { /* ... (same as your working code) ... */ }
    calculateTotalMediaToLoad = function() {
        let soundInstanceCount = 0;
        for (const key in soundUrls) {
            if (soundPools.hasOwnProperty(key)) {
                soundInstanceCount += POOL_SIZE_PER_WIN_SOUND;
            } else { soundInstanceCount += 1; }
        }
        totalMediaToLoad = totalImages + soundInstanceCount;
        // console.log(`RPS SCRIPT: Total media items to load: ${totalMediaToLoad}`);
    };
    
    function mediaItemLoaded(assetUrl, success = true) { /* ... (same as your working code) ... */ }
    mediaItemLoaded = function(assetUrl, success = true) {
        currentMediaLoaded++;
        if (!success) console.warn(`RPS SCRIPT: Failed or error for ${assetUrl}, counted.`);
        if (currentMediaLoaded >= totalMediaToLoad) {
            if (mediaLoadTimer) clearTimeout(mediaLoadTimer);
            if (allMediaLoadedCallback) {
                // console.log("RPS SCRIPT: All media loading attempts complete via normal loading.");
                allMediaLoadedCallback();
                allMediaLoadedCallback = null; 
            }
        }
    };
    
    function forceProceedWithGameInit(reason) { // Added from my previous robust version
        console.warn(`RPS SCRIPT: ${reason}. Forcing game initialization.`);
        if (mediaLoadTimer) clearTimeout(mediaLoadTimer);
        if (allMediaLoadedCallback) {
            allMediaLoadedCallback();
            allMediaLoadedCallback = null; 
        }
    }

    function loadImages() { /* ... (same as your working code) ... */ }
    loadImages = function() {
        if (totalImages === 0) { return; }
        let loadedImgCount = 0;
        for (const type in imageUrls) {
            images[type] = new Image();
            const currentImageUrl = imageUrls[type]; 
            images[type].onload = () => { loadedImgCount++; if (loadedImgCount === totalImages) mediaItemLoaded(currentImageUrl, true);};
            images[type].onerror = () => { console.error(`RPS ERROR: Image: ${currentImageUrl}.`); loadedImgCount++; if (loadedImgCount === totalImages) mediaItemLoaded(currentImageUrl, false);};
            images[type].src = currentImageUrl;
        }
    };

    function loadSounds() { /* ... (same as your working code) ... */ }
    loadSounds = function() {
        let soundInstancesExpected = 0;
         for (const key in soundUrls) {
            if (soundPools.hasOwnProperty(key)) soundInstancesExpected += POOL_SIZE_PER_WIN_SOUND;
            else soundInstancesExpected += 1;
        }
        if (soundInstancesExpected === 0) return;

        for (const key in soundUrls) {
            const path = soundUrls[key];
            if (soundPools.hasOwnProperty(key)) {
                soundPools[key] = []; 
                for (let i = 0; i < POOL_SIZE_PER_WIN_SOUND; i++) {
                    const audio = new Audio();
                    audio.dataset.path = path; audio.dataset.key = `${key}_${i}`;
                    audio.addEventListener('canplaythrough', function h(){ mediaItemLoaded(this.dataset.path, true); audio.removeEventListener('canplaythrough', h);}, { once: true });
                    audio.addEventListener('error', function h(e){ console.error(`ERROR pool sound ${this.dataset.key}: ${this.dataset.path}`, e); mediaItemLoaded(this.dataset.path, false); audio.removeEventListener('error', h);}, { once: true });
                    audio.src = path; audio.load();
                    soundPools[key].push(audio);
                }
            } else { 
                const audio = new Audio();
                audio.dataset.path = path; audio.dataset.key = key;
                audio.addEventListener('canplaythrough', function h(){ mediaItemLoaded(this.dataset.path, true); audio.removeEventListener('canplaythrough', h);}, { once: true });
                audio.addEventListener('error', function h(e){ console.error(`ERROR single sound ${this.dataset.key}: ${this.dataset.path}`, e); mediaItemLoaded(this.dataset.path, false); audio.removeEventListener('error', h);}, { once: true });
                audio.src = path; audio.load();
                audioElements[key] = audio;
            }
        }
    };
    
    function playSound(soundKey, volume = 1.0) { /* ... (same as your working code) ... */ }
    playSound = function(soundKey, volume = 1.0) {
        if (isMuted) return; 
        const adjustedVolume = Math.max(0, Math.min(1, volume));
        if (soundKey === 'scissorsWins') { 
            console.log("RPS SCRIPT DEBUG: Attempting to play 'scissorsWins'");
        }
        if (soundPools.hasOwnProperty(soundKey)) {
            const pool = soundPools[soundKey];
            for (const audio of pool) {
                if (audio.paused || audio.ended || audio.currentTime === 0) {
                    audio.currentTime = 0; audio.volume = adjustedVolume;
                    audio.play().catch(e => console.warn(`Pooled sound ${soundKey} play failed:`, e));
                    return; 
                }
            }
        } else if (audioElements[soundKey]) {
            const sound = audioElements[soundKey];
             if (sound.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA || sound.src) {
                sound.currentTime = 0; sound.volume = adjustedVolume;
                sound.play().catch(e => console.warn(`Single sound ${soundKey} play failed:`, e));
            }
        }
    };

    function resizeCanvas() { /* ... (same as your working code) ... */ }
    resizeCanvas = function() {
        const dpr = window.devicePixelRatio || 1;
        const containerWidth = gameContainer.clientWidth;
        const containerHeight = gameContainer.clientHeight;
        canvas.width = Math.round(containerWidth * dpr);
        canvas.height = Math.round(containerHeight * dpr);
        canvas.style.width = containerWidth + 'px';
        canvas.style.height = containerHeight + 'px';
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        drawAllItems();
    };
    window.addEventListener('resize', resizeCanvas);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(gameContainer);

    class GameObject {
        constructor(type, x, y) {
            this.id = Date.now() + Math.random().toString(36).substr(2, 9);
            this.type = type;
            if (typeof type !== 'string' || type.length === 0) {
                console.error("RPS SCRIPT ERROR: GameObject created with invalid type:", type, "at x:", x, "y:", y);
            }
            this.x = x; this.y = y;
            this.dx = (Math.random() - 0.5) * 1.0; 
            this.dy = (Math.random() - 0.5) * 1.0;
            this.size = ITEM_SIZE;
            this.personalMaxSpeed = MAX_SPEED_BASE * (1 + (Math.random() - 0.5) * MAX_SPEED_VARIATION);

            const randBehavior = Math.random();
            if (randBehavior < BEHAVIOR_CHANCE_RANDOM_WALK) this.behavior = BehaviorType.RANDOM_WALK;
            else if (randBehavior < BEHAVIOR_CHANCE_RANDOM_WALK + BEHAVIOR_CHANCE_FLEE_PREDATOR) this.behavior = BehaviorType.FLEE_PREDATOR;
            else this.behavior = BehaviorType.SEEK_ENEMY;
            
            this.randomTargetDx = (Math.random() - 0.5) * 2;
            this.randomTargetDy = (Math.random() - 0.5) * 2;
            const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1;
            this.randomTargetDx /= mag; this.randomTargetDy /= mag;

            this.seekTargetId = null;
            this.framesStuckSeeking = 0;
            this.lastDistanceToTargetSq = Infinity;
            // MODIFICATION: Added for revolution loop fix (from previous thought process)
            this.temporaryBehavior = null;
            this.temporaryBehaviorFrames = 0;
        }

        update() {
            if (!gameActive || isPaused) return;
            let accelX = 0; let accelY = 0;

            // MODIFICATION: Revolution Loop - Execute temporary behavior if active
            if (this.temporaryBehaviorFrames > 0) {
                if (this.temporaryBehavior === BehaviorType.RANDOM_WALK) {
                    if (Math.random() < 0.05) { 
                        this.randomTargetDx = (Math.random() - 0.5) * 2; 
                        this.randomTargetDy = (Math.random() - 0.5) * 2;
                        const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1;
                        this.randomTargetDx /= mag; this.randomTargetDy /= mag;
                    }
                    accelX += this.randomTargetDx * RANDOM_DRIFT_FORCE * 1.2; // Forceful temp random
                    accelY += this.randomTargetDy * RANDOM_DRIFT_FORCE * 1.2;
                }
                this.temporaryBehaviorFrames--;
                if (this.temporaryBehaviorFrames <= 0) {
                    this.temporaryBehavior = null; 
                    // console.log(`Item ${this.id} reverting to normal behavior after temp.`);
                }
            } else { // Normal behavior logic
                if (this.behavior === BehaviorType.SEEK_ENEMY) {
                    const enemyType = EnemyMap[this.type];
                    let closestTarget = null; let minDistSq = Infinity;
                    for (const item of gameItems) {
                        if (item.type === enemyType && item.id !== this.id) {
                            const dSq = (item.x - this.x)**2 + (item.y - this.y)**2;
                            if (dSq < minDistSq) { minDistSq = dSq; closestTarget = item; }
                        }
                    }
                    if (closestTarget) {
                        const currentDistanceSq = minDistSq;
                        if (this.seekTargetId === closestTarget.id) {
                            if (Math.abs(currentDistanceSq - this.lastDistanceToTargetSq) < STUCK_DISTANCE_THRESHOLD_SQ) {
                                this.framesStuckSeeking++;
                            } else { this.framesStuckSeeking = 0; }

                            // MODIFICATION: STUCK_FRAMES_THRESHOLD is now 40
                            if (this.framesStuckSeeking > STUCK_FRAMES_THRESHOLD) {
                                this.temporaryBehavior = BehaviorType.RANDOM_WALK;
                                this.temporaryBehaviorFrames = TEMPORARY_RANDOM_WALK_FRAMES; // Use constant
                                this.dx = (Math.random() - 0.5) * this.personalMaxSpeed * 0.7;
                                this.dy = (Math.random() - 0.5) * this.personalMaxSpeed * 0.7;
                                this.framesStuckSeeking = 0;
                                this.seekTargetId = null; 
                                // console.log(`Item ${this.id} (type ${this.type}) stuck (generic), switching to temp RANDOM_WALK for ${this.temporaryBehaviorFrames} frames.`);
                            }
                        } else { this.seekTargetId = closestTarget.id; this.framesStuckSeeking = 0; }
                        this.lastDistanceToTargetSq = currentDistanceSq;

                        if (this.seekTargetId === closestTarget.id && this.temporaryBehavior === null) { // Only seek if not in temp behavior
                            const dirX = closestTarget.x + closestTarget.size/2 - (this.x + this.size/2);
                            const dirY = closestTarget.y + closestTarget.size/2 - (this.y + this.size/2);
                            const dist = Math.sqrt(currentDistanceSq) || 0.1;
                            accelX += (dirX / dist) * SEEK_FORCE; accelY += (dirY / dist) * SEEK_FORCE;
                        }
                    } else { 
                        this.seekTargetId = null; this.framesStuckSeeking = 0;
                        if (Math.random() < 0.02) { this.randomTargetDx = (Math.random() - 0.5) * 2; this.randomTargetDy = (Math.random() - 0.5) * 2; const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1; this.randomTargetDx /= mag; this.randomTargetDy /= mag;}
                        accelX += this.randomTargetDx * RANDOM_DRIFT_FORCE * 0.6; accelY += this.randomTargetDy * RANDOM_DRIFT_FORCE * 0.6;
                    }
                } else if (this.behavior === BehaviorType.FLEE_PREDATOR) {
                    const predatorType = PredatorMap[this.type];
                    // MODIFICATION: Flee from collective threat
                    let collectivePredatorX = 0; let collectivePredatorY = 0; let relevantPredatorCount = 0;
                    for (const item of gameItems) {
                        if (item.type === predatorType) { 
                            const dSq = (item.x - this.x)**2 + (item.y - this.y)**2;
                            if (dSq < (this.size * 12)**2) { 
                                collectivePredatorX += item.x + item.size / 2;
                                collectivePredatorY += item.y + item.size / 2;
                                relevantPredatorCount++;
                            }
                        }
                    }
                    if (relevantPredatorCount > 0) {
                        const avgPredatorX = collectivePredatorX / relevantPredatorCount;
                        const avgPredatorY = collectivePredatorY / relevantPredatorCount;
                        const dirX = (this.x + this.size/2) - avgPredatorX; 
                        const dirY = (this.y + this.size/2) - avgPredatorY;
                        const distToAvg = Math.sqrt(dirX**2 + dirY**2) || 0.1;
                        if (distToAvg < this.size * 10) { 
                           accelX += (dirX / distToAvg) * FLEE_FORCE; 
                           accelY += (dirY / distToAvg) * FLEE_FORCE;
                        } else { 
                             if (Math.random() < 0.02) { this.randomTargetDx = (Math.random() - 0.5) * 2; this.randomTargetDy = (Math.random() - 0.5) * 2; const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1; this.randomTargetDx /= mag; this.randomTargetDy /= mag;}
                             accelX += this.randomTargetDx * RANDOM_DRIFT_FORCE; accelY += this.randomTargetDy * RANDOM_DRIFT_FORCE;
                        }
                    } else { 
                        if (Math.random() < 0.02) { this.randomTargetDx = (Math.random() - 0.5) * 2; this.randomTargetDy = (Math.random() - 0.5) * 2; const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1; this.randomTargetDx /= mag; this.randomTargetDy /= mag;}
                        accelX += this.randomTargetDx * RANDOM_DRIFT_FORCE; accelY += this.randomTargetDy * RANDOM_DRIFT_FORCE;
                    }
                } else if (this.behavior === BehaviorType.RANDOM_WALK) {
                    if (Math.random() < 0.02) { 
                        this.randomTargetDx = (Math.random() - 0.5) * 2; this.randomTargetDy = (Math.random() - 0.5) * 2;
                        const mag = Math.sqrt(this.randomTargetDx**2 + this.randomTargetDy**2) || 1;
                        this.randomTargetDx /= mag; this.randomTargetDy /= mag;
                    }
                    accelX += this.randomTargetDx * RANDOM_DRIFT_FORCE; accelY += this.randomTargetDy * RANDOM_DRIFT_FORCE;
                }
            } 
            
            if (this.temporaryBehaviorFrames <= 0) {
                 accelX += (Math.random() - 0.5) * RANDOM_WOBBLE_FORCE; 
                 accelY += (Math.random() - 0.5) * RANDOM_WOBBLE_FORCE;
            }

            this.dx += accelX; this.dy += accelY;
            this.dx *= DAMPING; this.dy *= DAMPING;

            const speed = Math.sqrt(this.dx**2 + this.dy**2);
            if (speed > this.personalMaxSpeed) {
                this.dx = (this.dx / speed) * this.personalMaxSpeed;
                this.dy = (this.dy / speed) * this.personalMaxSpeed;
            }

            this.x += this.dx; this.y += this.dy;

            const logicalCanvasWidth = canvas.clientWidth; const logicalCanvasHeight = canvas.clientHeight;
            if (this.x <= 0) { this.x = 0; this.dx *= -0.6; } 
            if (this.x + this.size >= logicalCanvasWidth) { this.x = logicalCanvasWidth - this.size; this.dx *= -0.6; }
            if (this.y <= 0) { this.y = 0; this.dy *= -0.6; }
            if (this.y + this.size >= logicalCanvasHeight) { this.y = logicalCanvasHeight - this.size; this.dy *= -0.6; }

            if (this.type === ItemType.PAPER) { this.y += Math.sin(Date.now() / 450 + this.id.charCodeAt(0)) * 0.06; }
        }

        draw(ctx) { /* ... (same as your working code) ... */ }
        changeType(newType) { /* ... (same as your working code, ensure tempBehavior fields are reset) ... */ }
    }
    // Ensure prototype methods are correctly assigned using your working code's structure
    GameObject.prototype.draw = function(ctx) {
        const img = images[this.type]; const drawX = Math.round(this.x); const drawY = Math.round(this.y);
        if(img && img.complete && img.naturalWidth !== 0) { ctx.drawImage(img, drawX, drawY, this.size, this.size); }
        else { ctx.fillStyle = this.type === ItemType.ROCK ? '#7A5230':this.type === ItemType.PAPER ? '#E8E8E8':'#FFB733'; ctx.beginPath(); const cX=drawX+this.size/2; const cY=drawY+this.size/2; if(this.type===ItemType.ROCK)ctx.arc(cX,cY,this.size/2,0,Math.PI*2); else if(this.type===ItemType.PAPER)ctx.rect(drawX,drawY,this.size,this.size); else{ctx.moveTo(cX,drawY);ctx.lineTo(drawX,cY+this.size/2);ctx.lineTo(drawX+this.size,cY+this.size/2);ctx.closePath();} ctx.fill(); }
    };
    GameObject.prototype.changeType = function(newType) {
        if(typeof newType!=='string'||newType.length===0){console.error("RPS ERROR: changeType invalid:",newType);return;} this.type=newType; const rB=Math.random(); if(rB<BEHAVIOR_CHANCE_RANDOM_WALK)this.behavior=BehaviorType.RANDOM_WALK; else if(rB<BEHAVIOR_CHANCE_RANDOM_WALK+BEHAVIOR_CHANCE_FLEE_PREDATOR)this.behavior=BehaviorType.FLEE_PREDATOR; else this.behavior=BehaviorType.SEEK_ENEMY; this.randomTargetDx=(Math.random()-0.5)*2;this.randomTargetDy=(Math.random()-0.5)*2; const m=Math.sqrt(this.randomTargetDx**2+this.randomTargetDy**2)||1; this.randomTargetDx/=m;this.randomTargetDy/=m; this.dx=(Math.random()-0.5)*this.personalMaxSpeed*0.6; this.dy=(Math.random()-0.5)*this.personalMaxSpeed*0.6; this.seekTargetId=null;this.framesStuckSeeking=0;this.lastDistanceToTargetSq=Infinity; this.temporaryBehavior=null;this.temporaryBehaviorFrames=0; // MODIFICATION: Reset temp behavior
    };


    // --- Standalone Game Logic Functions (using your structure) ---
    function drawAllItems() { /* ... (ensure this is your working version) ... */ }
    function spawnItem(type) { /* ... (ensure this is your working version) ... */ }
    function populateInitialItems() { /* ... (ensure this is your working version) ... */ }
    function initiateGameStart() { /* ... (ensure this is your working version) ... */ }
    function checkBehavioralShift() { /* ... (ensure this is your working version with lone survivor logic) ... */ }
    
    // MODIFICATION: New function for 3-element cyclic chase detection
    function checkForAndBreakCyclicChases() {
        if (!gameActive || isPaused || gameItems.length < 3) return;
        const itemsInvolvedInCycleThisFrame = new Set(); // To avoid processing same item multiple times

        for (let i = 0; i < gameItems.length; i++) {
            const itemA = gameItems[i];
            if (itemsInvolvedInCycleThisFrame.has(itemA.id) || 
                itemA.behavior !== BehaviorType.SEEK_ENEMY || 
                !itemA.seekTargetId || 
                itemA.temporaryBehavior // Skip if already in a temporary behavior
            ) {
                continue;
            }

            const itemB = gameItems.find(item => item.id === itemA.seekTargetId);
            if (!itemB || itemsInvolvedInCycleThisFrame.has(itemB.id) || 
                itemB.behavior !== BehaviorType.SEEK_ENEMY || 
                !itemB.seekTargetId || 
                itemB.type === itemA.type || // Should be hunting a different type
                itemB.temporaryBehavior ||
                EnemyMap[itemA.type] !== itemB.type // A must be hunting B correctly by game rules
            ) {
                continue;
            }

            const itemC = gameItems.find(item => item.id === itemB.seekTargetId);
            if (!itemC || itemsInvolvedInCycleThisFrame.has(itemC.id) || 
                itemC.behavior !== BehaviorType.SEEK_ENEMY || 
                !itemC.seekTargetId || 
                itemC.type === itemB.type || 
                itemC.temporaryBehavior ||
                EnemyMap[itemB.type] !== itemC.type // B must be hunting C correctly
            ) {
                continue;
            }

            // Check if C is hunting A, completing the cycle according to game rules
            if (itemC.seekTargetId === itemA.id && EnemyMap[itemC.type] === itemA.type) {
                // console.log(`RPS SCRIPT: Cyclic chase detected! A(${itemA.type}) -> B(${itemB.type}) -> C(${itemC.type}) -> A. Breaking...`);
                const cycleItems = [itemA, itemB, itemC];
                cycleItems.forEach(itemInCycle => {
                    if (!itemsInvolvedInCycleThisFrame.has(itemInCycle.id)) {
                        itemInCycle.temporaryBehavior = BehaviorType.RANDOM_WALK;
                        itemInCycle.temporaryBehaviorFrames = TEMPORARY_RANDOM_WALK_FRAMES + Math.floor(Math.random() * 15); // Varied duration
                        itemInCycle.dx = (Math.random() - 0.5) * itemInCycle.personalMaxSpeed * 0.8; // Strong nudge
                        itemInCycle.dy = (Math.random() - 0.5) * itemInCycle.personalMaxSpeed * 0.8;
                        itemInCycle.framesStuckSeeking = 0; 
                        itemInCycle.seekTargetId = null;    
                        itemsInvolvedInCycleThisFrame.add(itemInCycle.id);
                    }
                });
            }
        }
    }

    function checkCollisions() { /* ... (ensure this is your working version) ... */ }
    function handleInteraction(item1, item2) { /* ... (ensure this is your working version with sound logic) ... */ }
    function checkForWinner() { /* ... (ensure this is your working version with confetti sound) ... */ }
    function resetGameValues() { /* ... (ensure this is your working version) ... */ }
    
    function gameLoop() {
        if (isPaused) {
            drawAllItems(); 
            animationFrameId = requestAnimationFrame(gameLoop);
            return;
        }
        if (!gameActive) { 
            if (gameItems.length > 0) { drawAllItems(); }
            else if (canvas.width > 0 && canvas.height > 0) {
                const dpr = window.devicePixelRatio || 1; ctx.clearRect(0, 0, canvas.width/dpr, canvas.height/dpr);
            }
            if (!gameEverStarted || startPauseResumeBtn.textContent === 'Restart') {
                 animationFrameId = requestAnimationFrame(gameLoop);
            } else { if(animationFrameId) {cancelAnimationFrame(animationFrameId); animationFrameId = null;}}
            return;
        }

        // MODIFIED: Call new cyclic chase check before updates
        if (gameActive && !isPaused) {
             checkForAndBreakCyclicChases();
        }

        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        
        for (const item of gameItems) { item.update(); } // item.update() will now check for temporaryBehavior
        
        checkCollisions();
        checkBehavioralShift(); 
        for (const item of gameItems) { item.draw(ctx); }
        checkForWinner(); 

        if (gameActive) {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else if (startPauseResumeBtn.textContent === 'Restart') { 
             drawAllItems(); 
             if (!animationFrameId) animationFrameId = requestAnimationFrame(gameLoop); 
        } else { if(animationFrameId) {cancelAnimationFrame(animationFrameId); animationFrameId = null;}}
    }

    // --- Event Listeners (ensure these call your working function names) ---
    addRockBtn.addEventListener('click', () => spawnItem(ItemType.ROCK));
    addPaperBtn.addEventListener('click', () => spawnItem(ItemType.PAPER));
    addScissorsBtn.addEventListener('click', () => spawnItem(ItemType.SCISSORS));
    startPauseResumeBtn.addEventListener('click', () => { /* ... (same as your working version, no countdown) ... */ });
    resetBtn.addEventListener('click', () => { /* ... (same as your working version) ... */ });
    muteBtn.addEventListener('click', () => { /* ... (same as your working version) ... */ });
    
    // Re-assigning the global functions based on your provided structure
    // Ensure these function bodies are the complete ones from your working script
    drawAllItems = function() { if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return; const dpr = window.devicePixelRatio || 1; ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr); for (const item of gameItems) { item.draw(ctx); } };
    spawnItem = function(type) { if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) { setTimeout(() => spawnItem(type), 100); return; } if (typeof type !== 'string' || !Object.values(ItemType).includes(type)) { console.error("ERROR: spawnItem invalid type:", type); return; } const sAW = canvas.clientWidth; const sAH = canvas.clientHeight; const x = Math.random()*(sAW-ITEM_SIZE); const y = Math.random()*(sAH-ITEM_SIZE); gameItems.push(new GameObject(type,x,y)); if (!gameActive && !isPaused) { drawAllItems(); }};
    populateInitialItems = function() { for (const tV of Object.values(ItemType)) { for (let i=0; i<INITIAL_SPAWN_COUNT; i++) { spawnItem(tV); } } };
    initiateGameStart = function() { if (gameActive && !isPaused) return; gameEverStarted=true; gameActive=true; isPaused=false; startPauseResumeBtn.textContent='Pause'; startPauseResumeBtn.disabled=false; winnerAnnouncement.classList.add('hidden'); if(animationFrameId)cancelAnimationFrame(animationFrameId); animationFrameId=requestAnimationFrame(gameLoop); };
    checkBehavioralShift = function() { if (!gameActive || isPaused) return; const iTs=[ItemType.ROCK,ItemType.PAPER,ItemType.SCISSORS]; iTs.forEach(tTe=>{const iOt=gameItems.filter(i=>i.type===tTe); if(iOt.length===0)return; const sOt=iOt.filter(i=>i.behavior===BehaviorType.SEEK_ENEMY&&!i.temporaryBehavior); if(sOt.length===0){const eTFTT=EnemyMap[tTe]; const eE=gameItems.some(i=>i.type===eTFTT); if(eE){const oTC=iOt.filter(i=>(i.behavior===BehaviorType.FLEE_PREDATOR||i.behavior===BehaviorType.RANDOM_WALK)&&!i.temporaryBehavior); oTC.forEach(iTC=>{iTC.behavior=BehaviorType.SEEK_ENEMY;iTC.dx=(Math.random()-0.5)*iTC.personalMaxSpeed*0.3;iTC.dy=(Math.random()-0.5)*iTC.personalMaxSpeed*0.3;iTC.framesStuckSeeking=0;iTC.seekTargetId=null;});}}}); gameItems.forEach(i=>{if(i.temporaryBehavior)return; const aC=gameItems.filter(o=>o.id!==i.id&&o.type===i.type).length; const sEC=gameItems.filter(o=>o.type===EnemyMap[i.type]).length; if(aC===0&&sEC===0&&i.behavior!==BehaviorType.RANDOM_WALK){i.behavior=BehaviorType.RANDOM_WALK;i.randomTargetDx=(Math.random()-0.5)*2;i.randomTargetDy=(Math.random()-0.5)*2;const m=Math.sqrt(i.randomTargetDx**2+i.randomTargetDy**2)||1;i.randomTargetDx/=m;i.randomTargetDy/=m;i.framesStuckSeeking=0;i.seekTargetId=null;}}); };
    checkCollisions = function() { if(!gameActive||isPaused)return; for(let i=0;i<gameItems.length;i++){for(let j=i+1;j<gameItems.length;j++){const i1=gameItems[i];const i2=gameItems[j]; if(!i1||!i2)continue; const dX=(i1.x+i1.size/2)-(i2.x+i2.size/2); const dY=(i1.y+i1.size/2)-(i2.y+i2.size/2); const dist=Math.sqrt(dX*dX+dY*dY); const mD=(i1.size+i2.size)/2*0.65; if(dist<mD)handleInteraction(i1,i2);}}};
    handleInteraction = function(item1,item2){const t1=item1.type;const t2=item2.type;let sTP=null;if(t1===ItemType.PAPER&&t2===ItemType.ROCK){item2.changeType(ItemType.PAPER);sTP='paperWins';}else if(t1===ItemType.ROCK&&t2===ItemType.PAPER){item1.changeType(ItemType.PAPER);sTP='paperWins';}else if(t1===ItemType.ROCK&&t2===ItemType.SCISSORS){item2.changeType(ItemType.ROCK);sTP='rockWins';}else if(t1===ItemType.SCISSORS&&t2===ItemType.ROCK){item1.changeType(ItemType.ROCK);sTP='rockWins';}else if(t1===ItemType.SCISSORS&&t2===ItemType.PAPER){item2.changeType(ItemType.SCISSORS);sTP='scissorsWins';console.log("RPS DEBUG: Scissors cuts Paper, sound:",sTP);}else if(t1===ItemType.PAPER&&t2===ItemType.SCISSORS){item1.changeType(ItemType.SCISSORS);sTP='scissorsWins';console.log("RPS DEBUG: Scissors cuts Paper, sound:",sTP);}if(sTP)playSound(sTP);};
    checkForWinner = function(){if(!gameEverStarted)return;if(!gameActive&&startPauseResumeBtn.textContent!=='Restart')return;let cMFW=false;let wMS="";if(gameItems.length===0){if(gameActive||startPauseResumeBtn.textContent==='Restart'){cMFW=true;wMS="Draw! All Eliminated!";}}else{const fI=gameItems[0];if(!fI||typeof fI.type!=='string'||fI.type.length===0){return;}const cFIT=fI.type;const aST=gameItems.every(i=>i&&typeof i.type==='string'&&i.type===cFIT);if(aST){cMFW=true;wMS=`${cFIT.charAt(0).toUpperCase()+cFIT.slice(1)}s Win!`;}}if(cMFW){gameActive=false;winnerText.textContent=wMS;winnerAnnouncement.classList.remove('hidden');startPauseResumeBtn.textContent='Restart';startPauseResumeBtn.disabled=false;if(wMS.includes("Win!")&&typeof confetti==='function'){confetti({particleCount:250,spread:180,origin:{y:0.4}});playSound('confetti',0.3);}}};
    resetGameValues = function(){gameActive=false;isPaused=false;gameEverStarted=false;if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}gameItems=[];winnerAnnouncement.classList.add('hidden');startPauseResumeBtn.textContent='Start';startPauseResumeBtn.disabled=false;if(canvas.width>0&&canvas.height>0){const dpr=window.devicePixelRatio||1;ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);}};
    // gameLoop uses the new checkForAndBreakCyclicChases
    gameLoop = function(){
        if(isPaused){drawAllItems();animationFrameId=requestAnimationFrame(gameLoop);return;}
        if(!gameActive){if(gameItems.length>0)drawAllItems();else if(canvas.width>0&&canvas.height>0){const dpr=window.devicePixelRatio||1;ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);}if(!gameEverStarted||startPauseResumeBtn.textContent==='Restart')animationFrameId=requestAnimationFrame(gameLoop);else{if(animationFrameId)cancelAnimationFrame(animationFrameId);animationFrameId=null;}return;}
        
        if (gameActive && !isPaused) { checkForAndBreakCyclicChases(); } // Moved here

        const dpr=window.devicePixelRatio||1;ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
        for(const i of gameItems)i.update(); 
        checkCollisions();checkBehavioralShift(); 
        for(const i of gameItems)i.draw(ctx); 
        checkForWinner(); 
        if(gameActive)animationFrameId=requestAnimationFrame(gameLoop);
        else if(startPauseResumeBtn.textContent==='Restart'){drawAllItems();if(!animationFrameId)animationFrameId=requestAnimationFrame(gameLoop);}
        else{if(animationFrameId)cancelAnimationFrame(animationFrameId);animationFrameId=null;}
    };

    startPauseResumeBtn.addEventListener('click', () => {
        if (startPauseResumeBtn.textContent === 'Restart') { resetGameValues(); populateInitialItems(); initiateGameStart(); }
        else if (!gameEverStarted) { if (gameItems.length === 0) populateInitialItems(); initiateGameStart(); }
        else if (gameActive && !isPaused) { isPaused = true; startPauseResumeBtn.textContent = 'Resume'; }
        else if (isPaused) { isPaused = false; gameActive = true; startPauseResumeBtn.textContent = 'Pause'; if (!animationFrameId && gameActive) animationFrameId = requestAnimationFrame(gameLoop); }
    });
    resetBtn.addEventListener('click', () => { resetGameValues(); if (!animationFrameId) animationFrameId = requestAnimationFrame(gameLoop); });
    muteBtn.addEventListener('click', () => { isMuted = !isMuted; muteBtn.textContent = isMuted ? "Unmute" : "Mute Sounds";});


    function init() {
        console.log("RPS SCRIPT: init() called.");
        allMediaLoadedCallback = () => {
            console.log("RPS SCRIPT: All media loaded callback triggered.");
            resizeCanvas(); 
            resetGameValues();
            if (!animationFrameId) animationFrameId = requestAnimationFrame(gameLoop);
        };
        
        calculateTotalMediaToLoad();
        currentMediaLoaded = 0; 

        if (totalMediaToLoad === 0) {
            allMediaLoadedCallback(); return;
        }
        
        mediaLoadTimer = setTimeout(() => { // Keep the timeout for robustness
            if (currentMediaLoaded < totalMediaToLoad && allMediaLoadedCallback) {
                forceProceedWithGameInit(`Media loading timed out. Loaded ${currentMediaLoaded}/${totalMediaToLoad}. Check console for asset errors.`);
            }
        }, 7000);

        loadImages(); 
        loadSounds();
    }

    console.log("RPS SCRIPT: Calling init() at the end of the script.");
    init();
});