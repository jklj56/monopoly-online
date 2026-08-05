import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from game import MonopolyGame

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'monopoly-secret-key-change-in-production')
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

games = {}
player_rooms = {}


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('create_room')
def on_create_room(data):
    import random
    room_id = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))
    while room_id in games:
        room_id = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))

    games[room_id] = MonopolyGame(room_id)
    player_rooms[request.sid] = room_id

    join_room(room_id)

    game = games[room_id]
    player_name = data.get('name', 'Player 1')
    game.add_player(request.sid, player_name)

    emit('room_created', {
        'room_id': room_id,
        'player_id': request.sid,
        'game': game.to_dict()
    })


@socketio.on('join_room')
def on_join_room(data):
    room_id = data.get('room_id', '').upper()
    player_name = data.get('name', 'Player')

    if room_id not in games:
        emit('error', {'message': 'Room not found!'})
        return

    game = games[room_id]
    if len(game.players) >= 4:
        emit('error', {'message': 'Room is full!'})
        return

    if game.phase != "WAITING":
        emit('error', {'message': 'Game already started!'})
        return

    player_rooms[request.sid] = room_id
    join_room(room_id)

    game.add_player(request.sid, player_name)

    emit('room_joined', {
        'room_id': room_id,
        'player_id': request.sid,
        'game': game.to_dict()
    })

    emit('player_joined', {
        'player_name': player_name,
        'game': game.to_dict()
    }, room=room_id)


@socketio.on('roll_dice')
def on_roll_dice():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]

    if game.current_player_id != request.sid:
        emit('error', {'message': 'Not your turn!'})
        return

    result = game.roll_dice()
    if result:
        emit('dice_rolled', {
            'player_id': request.sid,
            'result': result,
            'game': game.to_dict()
        }, room=room_id)

        if result.get('jail'):
            game.end_turn()
            emit('game_update', {'game': game.to_dict()}, room=room_id)
        elif 'steps' in result:
            socketio.sleep(0.8)
            game.move_player()
            emit('game_update', {'game': game.to_dict()}, room=room_id)

            winner = game.check_winner()
            if winner:
                emit('game_over', {
                    'winner': winner,
                    'game': game.to_dict()
                }, room=room_id)


@socketio.on('buy_property')
def on_buy_property():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    success = game.buy_property()
    emit('game_update', {'game': game.to_dict()}, room=room_id)

    if success:
        winner = game.check_winner()
        if winner:
            emit('game_over', {'winner': winner, 'game': game.to_dict()}, room=room_id)


@socketio.on('build_house')
def on_build_house(data):
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    prop_index = data.get('prop_index')
    if prop_index is not None:
        game.build_house(prop_index)
        emit('game_update', {'game': game.to_dict()}, room=room_id)


@socketio.on('draw_chance')
def on_draw_chance():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    result = game.draw_chance()
    if result:
        emit('chance_card', {
            'card': result,
            'game': game.to_dict()
        }, room=room_id)

        winner = game.check_winner()
        if winner:
            emit('game_over', {'winner': winner, 'game': game.to_dict()}, room=room_id)


@socketio.on('pay_jail')
def on_pay_jail():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    game.pay_jail()
    emit('game_update', {'game': game.to_dict()}, room=room_id)


@socketio.on('use_jail_card')
def on_use_jail_card():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    game.use_jail_card()
    emit('game_update', {'game': game.to_dict()}, room=room_id)


@socketio.on('trade')
def on_trade(data):
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    to_id = data.get('to_id')
    prop_index = data.get('prop_index')
    amount = data.get('amount', 0)

    if to_id and prop_index is not None:
        game.trade_property(request.sid, to_id, prop_index, amount)
        emit('game_update', {'game': game.to_dict()}, room=room_id)


@socketio.on('end_turn')
def on_end_turn():
    room_id = player_rooms.get(request.sid)
    if not room_id or room_id not in games:
        return

    game = games[room_id]
    if game.current_player_id != request.sid:
        return

    game.end_turn()
    emit('game_update', {'game': game.to_dict()}, room=room_id)


@socketio.on('disconnect')
def on_disconnect():
    room_id = player_rooms.pop(request.sid, None)
    if room_id and room_id in games:
        game = games[room_id]
        player_name = game.players.get(request.sid, type('obj', (object,), {'name': 'Unknown'})).name
        game.remove_player(request.sid)

        if len(game.players) == 0:
            del games[room_id]
        else:
            emit('player_left', {
                'player_name': player_name,
                'game': game.to_dict()
            }, room=room_id)

        leave_room(room_id)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
