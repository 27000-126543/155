require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const schedulerService = require('./services/schedulerService');
const notificationService = require('./services/notificationService');

const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const serviceItemRoutes = require('./routes/serviceItemRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const creditRoutes = require('./routes/creditRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

const { errorHandler, notFound } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`用户 ${userId} 加入房间`);
  });

  socket.on('leave', (userId) => {
    socket.leave(`user_${userId}`);
    console.log(`用户 ${userId} 离开房间`);
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

notificationService.init(io);
schedulerService.init(io);

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/service-items', serviceItemRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    schedulerStatus: schedulerService.getTaskStatus()
  });
});

app.get('/api/scheduler/status', (req, res) => {
  res.json({
    success: true,
    data: schedulerService.getTaskStatus()
  });
});

app.post('/api/scheduler/run/:taskName', async (req, res) => {
  const { taskName } = req.params;
  const result = await schedulerService.runTaskManually(taskName);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB 连接成功');

    server.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`Socket.IO 已启动`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  schedulerService.stopAll();
  server.close(() => {
    console.log('HTTP 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭...');
  schedulerService.stopAll();
  server.close(() => {
    console.log('HTTP 服务器已关闭');
    process.exit(0);
  });
});

module.exports = { app, server, io };
