const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const socket = io();

let playerId = null;
let roomId = null;
let gameState = null;
let isMyTurn = false;

// DOM Elements
const screens = {
    menu: document.getElementById('main-menu'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game')
};

const elements = {
    playerName: document.getElementById('player-name'),
    roomCode: document.getElementById('room-code'),
    btnCreate: document.getElementById('btn-create'),
    btnJoin: document.getElementById('btn-join'),
    btnCopy: document.getElementById('btn-copy'),
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    playersList: document.getElementById('players-list'),
    board: document.getElementById('board'),
    dice1: document.getElementById('dice1'),
    dice2: document.getElementById('dice2'),
    btnRoll: document.getElementById('btn-roll'),
    playersPanel: document.getElementById('players-panel'),
    actionButtons: document.getElementById('action-buttons'),
    tileInfo: document.getElementById('current-tile-info'),
    messageBox: document.getElementById('message-box'),
    messageText: document.getElementById('message-text'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalContent: document.getElementById('modal-content'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text')
};

// ============= SCREEN MANAGEMENT =============

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showToast(message, duration = 3000) {
    elements.toastText.textContent = message;
    elements.toast.classList.remove('hidden');
    setTimeout(() => elements.toast.classList.add('hidden'), duration);
}

function showMessage(message, duration = 3000) {
    elements.messageText.textContent = message;
    elements.messageBox.classList.remove('hidden');
    if (duration > 0) {
        setTimeout(() => elements.messageBox.classList.add('hidden'), duration);
    }
}

function showModal(content) {
    elements.modalContent.innerHTML = content;
    elements.modalOverlay.classList.remove('hidden');
}

function hideModal() {
    elements.modalOverlay.classList.add('hidden');
}

window.closeModal = hideModal;

// ============= MENU =============

elements.btnCreate.addEventListener('click', () => {
    const name = elements.playerName.value.trim() || 'Player 1';
    socket.emit('create_room', { name });
});

elements.btnJoin.addEventListener('click', () => {
    const name = elements.playerName.value.trim() || 'Player';
    const code = elements.roomCode.value.trim().toUpperCase();
    if (!code) {
        showToast('Please enter a room code!');
        return;
    }
    socket.emit('join_room', { room_id: code, name });
});

elements.btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId);
    showToast('Room code copied!');
});

elements.roomCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.btnJoin.click();
});

// ============= SOCKET EVENTS =============

socket.on('room_created', (data) => {
    playerId = data.player_id;
    roomId = data.room_id;
    gameState = data.game;
    elements.lobbyRoomCode.textContent = roomId;
    updateLobby();
    showScreen('lobby');
});

socket.on('room_joined', (data) => {
    playerId = data.player_id;
    roomId = data.room_id;
    gameState = data.game;
    elements.lobbyRoomCode.textContent = roomId;
    updateLobby();
    showScreen('lobby');
});

socket.on('player_joined', (data) => {
    gameState = data.game;
    updateLobby();
});

socket.on('player_left', (data) => {
    gameState = data.game;
    showToast(`${data.player_name} left the game`);
    updateLobby();
});

socket.on('game_update', (data) => {
    gameState = data.game;
    updateGame();
});

socket.on('dice_rolled', (data) => {
    gameState = data.game;
    animateDice(data.result.dice);
    updateGame();
});

socket.on('chance_card', (data) => {
    gameState = data.game;
    showChanceCard(data.card.text);
    updateGame();
});

socket.on('game_over', (data) => {
    gameState = data.game;
    const winner = data.winner;
    if (winner === 'draw') {
        showModal(`
            <div class="winner-screen">
                <h1>DRAW!</h1>
                <p>No winner this time!</p>
                <button class="btn btn-primary" onclick="location.reload()">Play Again</button>
            </div>
        `);
    } else {
        const winnerPlayer = gameState.players[winner];
        showModal(`
            <div class="winner-screen">
                <h1>WINNER!</h1>
                <div class="winner-name" style="color: ${winnerPlayer.color}">${winnerPlayer.name}</div>
                <div class="winner-money">$${winnerPlayer.money}</div>
                <button class="btn btn-primary" onclick="location.reload()">Play Again</button>
            </div>
        `);
    }
});

socket.on('error', (data) => {
    showToast(data.message);
});

// ============= LOBBY =============

function updateLobby() {
    let html = '';
    const playerIds = Object.keys(gameState.players);

    for (let i = 0; i < 4; i++) {
        const pid = playerIds[i];
        const player = pid ? gameState.players[pid] : null;

        if (player) {
            html += `
                <div class="player-card has-player">
                    <div class="player-color" style="background: ${player.color}"></div>
                    <div class="player-name">${player.name}</div>
                    <div class="waiting" style="color: ${player.color}">Ready!</div>
                </div>
            `;
        } else {
            html += `
                <div class="player-card">
                    <div class="player-color" style="background: #ddd"></div>
                    <div class="waiting">Waiting for player...</div>
                </div>
            `;
        }
    }

    elements.playersList.innerHTML = html;

    // Start game if enough players and game hasn't started yet
    if (gameState.phase !== "WAITING" && screens.lobby.classList.contains('active')) {
        startGame();
    }
}

function startGame() {
    showScreen('game');
    renderBoard();
    updateGame();
}

// ============= BOARD =============

function renderBoard() {
    // Simple flat layout: corner tiles are bigger, regular tiles in between
    // We'll use absolute positioning within the board
    let html = '';

    // Center area
    html += `<div class="board-center">
        <div class="center-title">MONOPOLY</div>
        <div class="center-subtitle">World Edition</div>
    </div>`;

    // Tile order around the board (clockwise from bottom-right GO)
    // Board positions: we'll lay them out in a simple border pattern
    const tilePositions = [
        // Bottom row, right to left
        { index: 0, side: 'bottom', pos: 8 },   // GO (corner)
        { index: 1, side: 'bottom', pos: 7 },
        { index: 2, side: 'bottom', pos: 6 },
        { index: 3, side: 'bottom', pos: 5 },
        { index: 4, side: 'bottom', pos: 4 },
        { index: 5, side: 'bottom', pos: 3 },
        { index: 6, side: 'bottom', pos: 2 },
        { index: 7, side: 'bottom', pos: 1 },
        { index: 8, side: 'bottom', pos: 0 },   // JAIL (corner)
        // Left column, bottom to top
        { index: 9, side: 'left', pos: 0 },     // (Jail already placed, skip or show)
        { index: 10, side: 'left', pos: 1 },
        { index: 11, side: 'left', pos: 2 },
        { index: 12, side: 'left', pos: 3 },
        { index: 13, side: 'left', pos: 4 },
        { index: 14, side: 'left', pos: 5 },
        { index: 15, side: 'left', pos: 6 },
        { index: 16, side: 'left', pos: 7 },
        { index: 17, side: 'left', pos: 8 },    // TRADE (corner)
        // Top row, left to right
        { index: 18, side: 'top', pos: 0 },     // TRADE (corner)
        { index: 19, side: 'top', pos: 1 },
        { index: 20, side: 'top', pos: 2 },
        { index: 21, side: 'top', pos: 3 },
        { index: 22, side: 'top', pos: 4 },
        { index: 23, side: 'top', pos: 5 },
        { index: 24, side: 'top', pos: 6 },
        { index: 25, side: 'top', pos: 7 },
        { index: 26, side: 'top', pos: 8 },     // CHANCE (corner)
        // Right column, top to bottom
        { index: 27, side: 'right', pos: 0 },   // CHANCE (corner)
        { index: 28, side: 'right', pos: 1 },
        { index: 29, side: 'right', pos: 2 },
        { index: 30, side: 'right', pos: 3 },
        { index: 31, side: 'right', pos: 4 },
        { index: 32, side: 'right', pos: 5 },
        { index: 33, side: 'right', pos: 6 },
        { index: 34, side: 'right', pos: 7 },
        { index: 35, side: 'right', pos: 8 },   // Back to GO area
    ];

    // Render tiles by side
    const sides = ['bottom', 'left', 'top', 'right'];

    sides.forEach(side => {
        const sideTiles = tilePositions.filter(t => t.side === side);

        sideTiles.forEach((tp, idx) => {
            const tile = gameState.tiles[tp.index];
            if (!tile) return;

            const isCorner = [0, 8, 17, 26].includes(tp.index) ||
                           (tp.index === 18 && tp.side === 'left') ||
                           (tp.index === 9 && tp.side === 'bottom') ||
                           (tp.index === 27 && tp.side === 'right');

            html += renderTile(tile, tp.index, side, tp.pos, isCorner);
        });
    });

    elements.board.innerHTML = html;
}

function renderTile(tile, index, side, pos, isCorner) {
    const playersOnTile = Object.values(gameState.players).filter(
        p => p.position === index && !p.bankrupt
    );

    let playersHtml = '';
    if (playersOnTile.length > 0) {
        playersHtml = '<div class="players-on-tile">';
        playersOnTile.forEach(p => {
            playersHtml += `<div class="player-pawn" style="background: ${p.color}"></div>`;
        });
        playersHtml += '</div>';
    }

    let ownerHtml = '';
    if (tile.owner && gameState.players[tile.owner]) {
        ownerHtml = `<div class="owner-indicator" style="background: ${gameState.players[tile.owner].color}"></div>`;
    }

    let housesHtml = '';
    if (tile.houses > 0) {
        housesHtml = '<div class="houses-display">';
        for (let i = 0; i < tile.houses; i++) {
            housesHtml += '<div class="house-marker"></div>';
        }
        housesHtml += '</div>';
    }
    if (tile.has_hotel) {
        housesHtml = '<div class="houses-display"><div class="hotel-marker"></div></div>';
    }

    const posClass = `tile-${side}-${pos}`;

    if (isCorner) {
        let cornerIcon = '';
        let cornerClass = 'tile-corner';

        if (tile.tile_type === 'start') {
            cornerIcon = '🏁<br>GO';
            cornerClass += ' corner-go';
        } else if (tile.tile_type === 'jail') {
            cornerIcon = '🔒<br>JAIL';
            cornerClass += ' corner-jail';
        } else if (tile.tile_type === 'chance') {
            cornerIcon = '❓<br>CARD';
            cornerClass += ' corner-chance';
        } else if (tile.tile_type === 'trade') {
            cornerIcon = '🤝<br>TRADE';
            cornerClass += ' corner-trade';
        }

        return `<div class="tile ${posClass} ${cornerClass}">
            <div class="corner-content">${cornerIcon}</div>
            ${playersHtml}
        </div>`;
    }

    // Regular tile
    let tileType = tile.tile_type;
    let tileContent = '';

    if (tileType === 'chance') {
        tileContent = `
            <div class="tile-chance-icon">❓</div>
            <div class="tile-name">CHANCE</div>
        `;
    } else if (tileType === 'trade') {
        tileContent = `
            <div class="tile-chance-icon">🤝</div>
            <div class="tile-name">TRADE</div>
        `;
    } else if (tileType === 'service') {
        const icons = {'Telecom':'📡','Metro':'🚇','Taxi':'🚕','Internet':'🌐','Bus':'🚌','Airport':'✈️'};
        tileContent = `
            <div class="tile-color-bar" style="background: ${tile.color}"></div>
            <div class="tile-icon">${icons[tile.name] || '🏢'}</div>
            <div class="tile-name">${tile.name}</div>
            <div class="tile-price">$${tile.price}</div>
        `;
    } else {
        // City
        tileContent = `
            <div class="tile-color-bar" style="background: ${tile.color}"></div>
            <div class="tile-name">${tile.name}</div>
            <div class="tile-price">$${tile.price}</div>
        `;
    }

    return `<div class="tile ${posClass} tile-regular">
        ${tileContent}
        ${housesHtml}
        ${ownerHtml}
        ${playersHtml}
    </div>`;
}

// ============= GAME UPDATE =============

function updateGame() {
    if (!gameState) return;

    isMyTurn = gameState.current_player === playerId;

    updatePlayersPanel();
    updateTileInfo();
    updateActionButtons();

    elements.btnRoll.disabled = !isMyTurn || gameState.phase !== 'ROLLING';

    // Update player positions on board
    updatePlayerPositions();
}

function updatePlayerPositions() {
    // Re-render board to show updated player positions
    renderBoard();
}

function updatePlayersPanel() {
    let html = '';
    const playerOrder = gameState.player_order || Object.keys(gameState.players);

    playerOrder.forEach(pid => {
        const player = gameState.players[pid];
        if (!player) return;

        const isActive = pid === gameState.current_player;
        const isCurrentPlayer = pid === playerId;

        html += `
            <div class="panel-player ${isActive ? 'active' : ''} ${player.bankrupt ? 'bankrupt' : ''}">
                <div class="color-dot" style="background: ${player.color}"></div>
                <div class="info">
                    <div class="name">${player.name} ${isCurrentPlayer ? '(You)' : ''}</div>
                    <div class="money">$${player.money}</div>
                    <div class="properties-count">Properties: ${player.properties.length}</div>
                </div>
                ${player.in_jail ? '<span style="color: #e74c3c">🔒</span>' : ''}
                ${player.get_out_of_jail_cards > 0 ? '<span style="color: #f39c12">🎫</span>' : ''}
            </div>
        `;
    });

    elements.playersPanel.innerHTML = html;
}

function updateTileInfo() {
    const player = gameState.players[playerId];
    if (!player) return;

    const tile = gameState.tiles[player.position];
    let html = `<div class="tile-info-name">${tile.name}</div>`;

    if (tile.tile_type === 'city' || tile.tile_type === 'service') {
        html += `<div class="tile-info-price">Price: $${tile.price} | Rent: $${tile.rent}</div>`;
        if (tile.owner) {
            const owner = gameState.players[tile.owner];
            if (owner) {
                html += `<div class="tile-info-rent">Owner: ${owner.name}</div>`;
            }
        }
        if (tile.houses > 0) {
            html += `<div class="tile-info-rent">Houses: ${tile.houses}</div>`;
        }
        if (tile.has_hotel) {
            html += `<div class="tile-info-rent">Hotel!</div>`;
        }
    }

    elements.tileInfo.innerHTML = html;
}

function updateActionButtons() {
    if (!isMyTurn) {
        elements.actionButtons.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">Waiting for other players...</div>';
        return;
    }

    const player = gameState.players[playerId];
    const tile = gameState.tiles[player.position];
    let html = '';

    if (gameState.phase === 'ROLLING') {
        elements.actionButtons.innerHTML = '';
        return;
    }

    if (gameState.phase === 'ACTION') {
        if ((tile.tile_type === 'city' || tile.tile_type === 'service') && !tile.owner) {
            if (player.money >= tile.price) {
                html += `<button class="action-btn buy" onclick="buyProperty()">BUY $${tile.price}</button>`;
            }
        }

        if (player.properties.length > 0 && player.money >= 50) {
            const buildable = player.properties.filter(idx => {
                const t = gameState.tiles[idx];
                return t.tile_type === 'city' && !t.has_hotel && t.houses < 4;
            });
            if (buildable.length > 0) {
                html += `<button class="action-btn build" onclick="showBuildModal()">BUILD $50</button>`;
            }
        }

        if (tile.tile_type === 'chance') {
            html += `<button class="action-btn chance" onclick="drawChance()">DRAW CARD</button>`;
        }

        if (tile.tile_type === 'trade') {
            const otherPlayers = Object.values(gameState.players).filter(
                p => p.id !== playerId && !p.bankrupt && p.properties.length > 0
            );
            if (otherPlayers.length > 0) {
                html += `<button class="action-btn trade" onclick="showTradeModal()">TRADE</button>`;
            }
        }

        if (player.in_jail) {
            if (player.get_out_of_jail_cards > 0) {
                html += `<button class="action-btn jail" onclick="useJailCard()">USE CARD</button>`;
            }
            if (player.money >= 100) {
                html += `<button class="action-btn jail" onclick="payJail()">PAY $100</button>`;
            }
        }

        html += `<button class="action-btn end-turn" onclick="endTurn()">END TURN</button>`;
    }

    elements.actionButtons.innerHTML = html;
}

// ============= ACTIONS =============

elements.btnRoll.addEventListener('click', () => {
    if (!isMyTurn || gameState.phase !== 'ROLLING') return;
    socket.emit('roll_dice');
    elements.btnRoll.disabled = true;
});

function animateDice(dice) {
    let count = 0;
    const interval = setInterval(() => {
        elements.dice1.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
        elements.dice2.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
        elements.dice1.classList.add('rolling');
        elements.dice2.classList.add('rolling');
        count++;
        if (count > 10) {
            clearInterval(interval);
            elements.dice1.textContent = DICE_FACES[dice[0] - 1];
            elements.dice2.textContent = DICE_FACES[dice[1] - 1];
            elements.dice1.classList.remove('rolling');
            elements.dice2.classList.remove('rolling');
        }
    }, 80);
}

window.buyProperty = function() {
    socket.emit('buy_property');
};

window.endTurn = function() {
    socket.emit('end_turn');
};

window.drawChance = function() {
    socket.emit('draw_chance');
};

window.payJail = function() {
    socket.emit('pay_jail');
};

window.useJailCard = function() {
    socket.emit('use_jail_card');
};

function showChanceCard(text) {
    showModal(`
        <div class="chance-card">
            <h3>CHANCE CARD</h3>
            <p>${text}</p>
        </div>
        <div class="modal-buttons">
            <button class="btn btn-primary" onclick="closeModal()">OK</button>
        </div>
    `);
}

function showBuildModal() {
    const player = gameState.players[playerId];
    const buildable = player.properties.filter(idx => {
        const t = gameState.tiles[idx];
        return t.tile_type === 'city' && !t.has_hotel && t.houses < 4;
    });

    let html = '<h2>Build House ($50)</h2><div style="max-height: 300px; overflow-y: auto;">';

    buildable.forEach(idx => {
        const tile = gameState.tiles[idx];
        html += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; margin: 5px 0; background: #f0f0f0; border-radius: 8px; cursor: pointer;" onclick="buildHouse(${idx})">
                <div style="width: 20px; height: 20px; background: ${tile.color}; border-radius: 4px;"></div>
                <div>
                    <div style="font-weight: 600;">${tile.name}</div>
                    <div style="font-size: 12px; color: #666;">Houses: ${tile.houses}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    html += '<div class="modal-buttons"><button class="btn btn-primary" onclick="closeModal()">Close</button></div>';

    showModal(html);
}

window.buildHouse = function(propIndex) {
    socket.emit('build_house', { prop_index: propIndex });
    hideModal();
};

function showTradeModal() {
    const otherPlayers = Object.values(gameState.players).filter(
        p => p.id !== playerId && !p.bankrupt && p.properties.length > 0
    );

    let html = '<h2>Trade Property</h2>';

    otherPlayers.forEach(other => {
        other.properties.forEach(propIdx => {
            const tile = gameState.tiles[propIdx];
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; margin: 5px 0; background: #f0f0f0; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; background: ${tile.color}; border-radius: 4px;"></div>
                        <div>
                            <div style="font-weight: 600;">${tile.name}</div>
                            <div style="font-size: 12px; color: #666;">From: ${other.name}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <input type="number" id="trade-amount-${propIdx}" value="100" min="0" style="width: 70px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        <button class="action-btn buy" onclick="executeTrade('${other.id}', ${propIdx})">BUY</button>
                    </div>
                </div>
            `;
        });
    });

    html += '<div class="modal-buttons" style="margin-top: 15px;"><button class="btn btn-primary" onclick="closeModal()">Close</button></div>';

    showModal(html);
}

window.executeTrade = function(toId, propIndex) {
    const amountInput = document.getElementById(`trade-amount-${propIndex}`);
    const amount = parseInt(amountInput.value) || 0;
    socket.emit('trade', { to_id: toId, prop_index: propIndex, amount });
    hideModal();
};

// ============= INIT =============

const urlParams = new URLSearchParams(window.location.search);
const urlRoom = urlParams.get('room');
if (urlRoom) {
    elements.roomCode.value = urlRoom;
}
