const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Для тестов. Позже можно указать конкретный домен
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,  // Чтобы соединение не рвалось
  pingTimeout: 60000
});

// Раздаём статические файлы игры
app.use(express.static(__dirname));

// Хранилище комнат
// Хранилище комнат
const rooms = {};

// Вспомогательная функция для рассылки списка комнат всем в лобби
function broadcastRooms() {
  const roomList = Object.keys(rooms).map(code => ({
    code: code,
    name: rooms[code].name,
    players: rooms[code].players.length,
    hasPassword: !!rooms[code].password,
    state: rooms[code].state
  }));
  // Отправляем список всем, кто сейчас в лобби
  io.emit('rooms_list', roomList);
}

io.on('connection', (socket) => {
  console.log('🟢 Подключился игрок:', socket.id);

  // Клиент запрашивает список комнат
  socket.on('request_rooms', () => {
    const roomList = Object.keys(rooms).map(code => ({
      code: code,
      name: rooms[code].name,
      players: rooms[code].players.length,
      hasPassword: !!rooms[code].password,
      state: rooms[code].state
    }));
    socket.emit('rooms_list', roomList);
  });

  // Создание комнаты (с паролем)
  socket.on('create_room', (data) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[code] = {
      name: data.name || `Комната ${code}`,
      password: data.password || null,
      players: [socket.id],
      state: 'waiting'
    };
    socket.join(code);
    socket.emit('room_created', { code });
    broadcastRooms(); // Обновляем список у всех
    console.log(`🏠 Комната создана: ${code}`);
  });

  // Подключение к комнате (с проверкой пароля)
  socket.on('join_room', ({ code, password }) => {
    const room = rooms[code];
    if (!room) {
      socket.emit('error_msg', 'Комната не найдена');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error_msg', 'Комната заполнена');
      return;
    }
    // Проверка пароля
    if (room.password && room.password !== password) {
      socket.emit('error_msg', 'Неверный пароль');
      return;
    }
    
    room.players.push(socket.id);
    socket.join(code);
    room.state = 'ready';
    
    io.to(code).emit('game_start', { 
      code,
      p1: room.players[0],
      p2: room.players[1]
    });
    broadcastRooms(); // Обновляем список
    console.log(`🎮 Игра началась в комнате: ${code}`);
  });

  // Передача координат (пока просто транслируем)
  socket.on('player_move', (data) => {
    socket.to(data.code).emit('opponent_move', data);
  });

  socket.on('player_shoot', (data) => {
    socket.to(data.code).emit('opponent_shoot', data);
  });

  socket.on('player_hit', (data) => {
    socket.to(data.code).emit('opponent_hit', data);
  });

  socket.on('player_dead', (data) => {
    socket.to(data.code).emit('opponent_dead');
  });

  socket.on('disconnect', () => {
    console.log('🔴 Отключился игрок:', socket.id);
    for (const code in rooms) {
      const room = rooms[code];
      const idx = room.players.indexOf(socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[code];
        } else {
          io.to(code).emit('opponent_left');
        }
      }
    }
    broadcastRooms(); // Обновляем список
  });
});

io.on('connection', (socket) => {
  console.log('🟢 Подключился игрок:', socket.id);

  // Создание комнаты
  socket.on('create_room', () => {
    // Генерируем 6-значный код
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[code] = {
      players: [socket.id],
      state: 'waiting'
    };
    socket.join(code);
    socket.emit('room_created', { code });
    console.log(`🏠 Комната создана: ${code}`);
  });

  // Подключение к комнате
  socket.on('join_room', ({ code }) => {
    const room = rooms[code];
    if (!room) {
      socket.emit('error_msg', 'Комната не найдена');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error_msg', 'Комната заполнена');
      return;
    }
    
    room.players.push(socket.id);
    socket.join(code);
    room.state = 'ready';
    
    // Сообщаем обоим игрокам, что можно начинать
    io.to(code).emit('game_start', { 
      code,
      p1: room.players[0],
      p2: room.players[1]
    });
    console.log(`🎮 Игра началась в комнате: ${code}`);
  });

  // Передача координат (пока просто транслируем)
  socket.on('player_move', (data) => {
    socket.to(data.code).emit('opponent_move', data);
  });

      socket.on('player_shoot', (data) => {
    console.log('🔥 2. СЕРВЕР ПОЛУЧИЛ ВЫСТРЕЛ И ПЕРЕСЫЛАЕТ ЕГО:', data);
    socket.to(data.code).emit('opponent_shoot', data);
  });

    socket.on('player_hit', (data) => {
    socket.to(data.code).emit('opponent_hit', data);
  });
  socket.on('player_hit', (data) => {
    socket.to(data.code).emit('opponent_hit', data);
  });

  // ⚡ НОВЫЙ ОБРАБОТЧИК: Пересылаем сигнал о смерти
  socket.on('player_dead', (data) => {
    socket.to(data.code).emit('opponent_dead');
  });
  socket.on('disconnect', () => {
    console.log('🔴 Отключился игрок:', socket.id);
    // Удаляем игрока из комнат
    for (const code in rooms) {
      const room = rooms[code];
      const idx = room.players.indexOf(socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[code];
          console.log(`🗑️ Комната удалена: ${code}`);
        } else {
          io.to(code).emit('opponent_left');
        }
      }
    }
  });
});

// Было: const PORT = 3000;
// Стало:
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
  console.log(`🌐 Для игры по сети используйте IP-адрес этого ПК и порт ${PORT}`);
});