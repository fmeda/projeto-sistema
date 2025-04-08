const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const kafka = require('kafka-node');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const secretKey = 'seu-chave-secreta';
const redisClient = redis.createClient();
const kafkaClient = new kafka.KafkaClient({ kafkaHost: 'localhost:9092' });
const producer = new kafka.Producer(kafkaClient);

mongoose.connect('mongodb://localhost/delivery', { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.json()); // Suporte a JSON

// Schema do entregador
const entregadorSchema = new mongoose.Schema({
  nome: String,
  status: String,
  localizacaoAtual: { lat: Number, lng: Number },
  rota: [{ lat: Number, lng: Number }],
  geofence: { lat: Number, lng: Number, radius: Number }
});
const Entregador = mongoose.model('Entregador', entregadorSchema);

// Middleware de Autenticação JWT
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send('Token não fornecido.');
  jwt.verify(token, secretKey, (err) => {
    if (err) return res.status(401).send('Token inválido.');
    next();
  });
});

// Endpoint para listagem de entregadores
app.get('/entregadores', async (req, res) => {
  const entregadores = await Entregador.find();
  res.json(entregadores);
});

// Serviço de atualização de localização e geofencing
io.on('connection', (socket) => {
  console.log('Novo cliente conectado');

  socket.on('updateLocation', async ({ id, localizacaoAtual }) => {
    const entregador = await Entregador.findByIdAndUpdate(id, { localizacaoAtual });
    io.emit('locationUpdated', { id, localizacaoAtual });

    // Enviar dados para Kafka para análises futuras
    producer.send(
      [{ topic: 'eventos-de-localizacao', messages: JSON.stringify({ id, localizacaoAtual }) }],
      (err) => {
        if (err) console.error('Erro ao enviar dados para Kafka:', err);
      }
    );

    // Checar geofencing
    if (entregador.geofence) {
      const distance = Math.sqrt(
        Math.pow(localizacaoAtual.lat - entregador.geofence.lat, 2) +
        Math.pow(localizacaoAtual.lng - entregador.geofence.lng, 2)
      );
      if (distance > entregador.geofence.radius) {
        const alert = { id, message: 'Entregador saiu da área permitida!' };
        redisClient.lpush('notificacoes', JSON.stringify(alert));
        io.emit('geofenceAlert', alert);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

server.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
