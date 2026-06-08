# 城市政务服务事项全流程审批与效能分析系统 - API文档

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: MongoDB
- **认证方式**: JWT
- **实时通信**: Socket.IO
- **定时任务**: node-cron
- **报表导出**: ExcelJS

## 项目结构

```
├── config/              # 配置文件
│   └── database.js      # 数据库连接配置
├── models/              # 数据模型
│   ├── User.js          # 用户模型
│   ├── Department.js    # 部门模型
│   ├── ServiceItem.js   # 服务事项模型
│   ├── Application.js   # 申请模型
│   ├── Credit.js        # 信用模型
│   ├── Certificate.js   # 电子证照模型
│   ├── Notification.js  # 通知模型
│   └── PerformanceReport.js # 效能报表模型
├── controllers/         # 控制器
│   ├── authController.js
│   ├── departmentController.js
│   ├── serviceItemController.js
│   ├── applicationController.js
│   ├── creditController.js
│   ├── certificateController.js
│   ├── notificationController.js
│   └── reportController.js
├── services/            # 服务层
│   ├── approvalEngine.js      # 审批引擎
│   ├── certificateService.js  # 证照服务
│   ├── notificationService.js # 通知服务
│   ├── performanceService.js  # 效能统计服务
│   └── schedulerService.js    # 定时任务服务
├── middleware/          # 中间件
│   └── auth.js          # 认证与权限中间件
├── routes/              # 路由
│   ├── authRoutes.js
│   ├── departmentRoutes.js
│   ├── serviceItemRoutes.js
│   ├── applicationRoutes.js
│   ├── creditRoutes.js
│   ├── certificateRoutes.js
│   ├── notificationRoutes.js
│   └── reportRoutes.js
├── utils/               # 工具函数
│   ├── constants.js     # 系统常量
│   └── helpers.js       # 辅助函数
├── scripts/             # 脚本
│   └── seedData.js      # 示例数据脚本
├── server.js            # 服务器启动文件
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并配置：

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/government-approval
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRE=30d
CLIENT_ORIGIN=http://localhost:8080
SHARING_PLATFORM_URL=https://api.example.com/share
SEAL_PRIVATE_KEY=your-seal-private-key
```

### 3. 启动MongoDB

确保MongoDB服务已启动。

### 4. 导入示例数据

```bash
npm run seed
```

### 5. 启动服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

## 用户角色说明

| 角色 | 说明 |
|------|------|
| individual | 个人用户 |
| enterprise | 企业用户 |
| approver | 审批人员 |
| supervisor | 效能监督员 |
| admin | 系统管理员 |

## 认证接口

### 注册

**POST** `/api/auth/register`

请求体：
```json
{
  "name": "张三",
  "phone": "13800138000",
  "password": "123456",
  "type": "individual",
  "idCard": "110101199001011234"
}
```

### 登录

**POST** `/api/auth/login`

请求体：
```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

响应：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "64...",
      "name": "张三",
      "phone": "13800138000",
      "type": "individual"
    }
  }
}
```

### 获取当前用户信息

**GET** `/api/auth/me`

请求头：`Authorization: Bearer {token}`

### 修改密码

**PUT** `/api/auth/update-password`

请求体：
```json
{
  "oldPassword": "123456",
  "newPassword": "654321"
}
```

### 更新个人信息

**PUT** `/api/auth/update-profile`

请求体：
```json
{
  "name": "张三",
  "email": "zhangsan@example.com"
}
```

### 登出

**POST** `/api/auth/logout`

## 部门管理接口

### 获取部门列表

**GET** `/api/departments`

查询参数：
- `level`: 部门级别
- `parent`: 父部门ID
- `page`: 页码
- `limit`: 每页数量

### 获取部门详情

**GET** `/api/departments/:id`

### 获取部门树

**GET** `/api/departments/:id/tree`

### 创建部门

**POST** `/api/departments` (需要admin权限)

请求体：
```json
{
  "name": "市场监督管理局",
  "code": "SCJGJ",
  "level": 1,
  "parent": null,
  "description": "负责市场主体登记注册",
  "address": "政务中心A区1楼",
  "contactPhone": "12315"
}
```

### 更新部门

**PUT** `/api/departments/:id` (需要admin权限)

### 删除部门

**DELETE** `/api/departments/:id` (需要admin权限)

### 添加审批人员

**POST** `/api/departments/:id/approvers` (需要admin权限)

请求体：
```json
{
  "userId": "64...",
  "role": "approver"
}
```

### 移除审批人员

**DELETE** `/api/departments/:id/approvers/:approverId` (需要admin权限)

## 服务事项管理接口

### 获取事项列表

**GET** `/api/service-items`

查询参数：
- `itemType`: 事项类型
- `status`: 状态
- `department`: 部门ID
- `page`: 页码
- `limit`: 每页数量

### 获取已发布事项

**GET** `/api/service-items/published`

### 获取事项详情

**GET** `/api/service-items/:id`

### 根据事项编码查询

**GET** `/api/service-items/code/:itemCode`

### 创建事项

**POST** `/api/service-items` (需要admin权限)

请求体：
```json
{
  "itemCode": "QYDJ-001",
  "itemName": "有限责任公司设立登记",
  "itemType": "企业注册",
  "department": "64...",
  "description": "有限责任公司设立登记业务办理",
  "handlingTimeLimit": 3,
  "feeStandard": "免费",
  "legalBasis": "《中华人民共和国公司法》",
  "fastTrackSupported": true,
  "fastTrackSupplementDays": 7
}
```

### 发布事项

**POST** `/api/service-items/:id/publish` (需要admin权限)

### 下架事项

**POST** `/api/service-items/:id/unpublish` (需要admin权限)

### 添加材料

**POST** `/api/service-items/:id/materials` (需要admin权限)

请求体：
```json
{
  "name": "公司登记申请书",
  "code": "CL-001",
  "required": true,
  "description": "法定代表人签署的公司登记申请书",
  "format": "pdf",
  "sampleUrl": "/samples/application.pdf"
}
```

### 更新材料

**PUT** `/api/service-items/:id/materials/:materialId` (需要admin权限)

### 删除材料

**DELETE** `/api/service-items/:id/materials/:materialId` (需要admin权限)

### 添加审批步骤

**POST** `/api/service-items/:id/steps` (需要admin权限)

请求体：
```json
{
  "stepOrder": 1,
  "stepName": "材料初审",
  "type": "single",
  "department": "64...",
  "timeoutHours": 24,
  "remindHours": 2
}
```

并联审批步骤：
```json
{
  "stepOrder": 2,
  "stepName": "并联审批",
  "type": "parallel",
  "department": "64...",
  "timeoutHours": 48,
  "remindHours": 4,
  "parallelDepartments": ["64...", "64..."],
  "defaultApprovalOnTimeout": true
}
```

## 申请管理接口

### 创建申请

**POST** `/api/applications`

请求体：
```json
{
  "itemCode": "QYDJ-001",
  "applicantInfo": {
    "name": "张三",
    "idCard": "110101199001011234",
    "phone": "13800138000"
  },
  "materials": [
    {
      "materialCode": "CL-001",
      "materialName": "公司登记申请书",
      "fileUrl": "/uploads/application.pdf"
    },
    {
      "materialCode": "CL-002",
      "materialName": "公司章程",
      "fileUrl": "/uploads/articles.pdf"
    }
  ]
}
```

### 快速通道提交

**POST** `/api/applications/fast-track`

请求体同上，系统自动检查信用分并启用快速通道。

### 补充材料

**PUT** `/api/applications/:id/supplement`

请求体：
```json
{
  "materials": [
    {
      "materialCode": "CL-003",
      "materialName": "股东身份证明",
      "fileUrl": "/uploads/id.pdf"
    }
  ]
}
```

### 获取我的申请

**GET** `/api/applications/my`

查询参数：
- `status`: 申请状态
- `page`: 页码
- `limit`: 每页数量

### 获取申请详情

**GET** `/api/applications/:id`

### 获取申请时间线

**GET** `/api/applications/:id/timeline`

### 获取待处理审批（审批人）

**GET** `/api/applications/approver/pending`

### 处理审批

**PUT** `/api/applications/:id/approve` (需要approver权限)

请求体：
```json
{
  "decision": "approve",
  "remark": "材料齐全，同意通过"
}
```

`decision` 可选值：`approve`（通过）、`reject`（驳回）、`return`（退回补正）

### 核验材料真伪

**PUT** `/api/applications/:id/verify-material` (需要approver/admin权限)

请求体：
```json
{
  "materialId": "64...",
  "isAuthentic": false,
  "remark": "身份证复印件存在伪造嫌疑"
}
```

### 检查快速通道资格

**GET** `/api/applications/fast-track/eligibility?itemCode=QYDJ-001`

### 撤销申请

**PUT** `/api/applications/:id/cancel`

## 信用管理接口

### 获取我的信用

**GET** `/api/credits/me`

### 获取我的信用记录

**GET** `/api/credits/me/records`

### 获取所有用户信用（admin）

**GET** `/api/credits` (需要admin权限)

### 获取信用统计（admin）

**GET** `/api/credits/statistics` (需要admin权限)

### 获取用户信用详情（admin）

**GET** `/api/credits/:userId` (需要admin权限)

### 添加信用记录（admin）

**POST** `/api/credits/record` (需要admin权限)

请求体：
```json
{
  "userId": "64...",
  "type": "material_fraud",
  "description": "材料造假",
  "applicationId": "64...",
  "scoreChange": -20
}
```

信用记录类型：
- `application_submitted`: 提交申请
- `material_verified`: 材料核验通过
- `material_fraud`: 材料造假
- `approval_approved`: 审批通过
- `approval_rejected`: 审批驳回
- `timeout_application`: 申请超时
- `late_material_submission`: 材料补交逾期
- `good_behavior`: 良好行为
- `voluntary_correction`: 主动纠正

### 调整信用分（admin）

**PUT** `/api/credits/adjust` (需要admin权限)

请求体：
```json
{
  "userId": "64...",
  "scoreChange": 10,
  "reason": "良好表现奖励"
}
```

### 限制快速通道（admin）

**POST** `/api/credits/restrict` (需要admin权限)

请求体：
```json
{
  "userId": "64...",
  "reason": "多次材料造假",
  "restrictionDays": 90
}
```

### 解除快速通道限制（admin）

**POST** `/api/credits/unrestrict` (需要admin权限)

### 检查过期限制（admin）

**POST** `/api/credits/check-expired` (需要admin权限)

## 电子证照管理接口

### 生成证照

**POST** `/api/certificates` (需要admin权限)

请求体：
```json
{
  "applicationId": "64..."
}
```

### 获取我的证照

**GET** `/api/certificates/my`

### 获取所有证照（admin）

**GET** `/api/certificates` (需要admin权限)

### 获取证照详情

**GET** `/api/certificates/:id`

### 下载证照

**GET** `/api/certificates/:id/download`

### 验证证照

**GET** `/api/certificates/verify/:certificateNo?verificationCode=ABC123`

或

**POST** `/api/certificates/verify`

请求体：
```json
{
  "certificateNo": "CERT202401010001",
  "verificationCode": "ABC123"
}
```

### 撤销证照（admin）

**PUT** `/api/certificates/:id/revoke` (需要admin权限)

请求体：
```json
{
  "reason": "申请材料造假"
}
```

### 重试同步（admin）

**POST** `/api/certificates/:id/retry-sync` (需要admin权限)

### 获取同步状态（admin）

**GET** `/api/certificates/sync/status` (需要admin权限)

### 获取待同步列表（admin）

**GET** `/api/certificates/sync/pending` (需要admin权限)

## 通知管理接口

### 获取我的通知

**GET** `/api/notifications`

查询参数：
- `unreadOnly`: true/false，是否只看未读
- `type`: 通知类型
- `page`: 页码
- `limit`: 每页数量

### 获取未读数量

**GET** `/api/notifications/unread-count`

### 获取通知类型

**GET** `/api/notifications/types`

### 标记为已读

**PUT** `/api/notifications/:id/read`

### 全部标记为已读

**PUT** `/api/notifications/read-all`

### 获取通知详情

**GET** `/api/notifications/:id`

### 删除通知

**DELETE** `/api/notifications/:id`

### 发送通知（admin）

**POST** `/api/notifications` (需要admin权限)

请求体：
```json
{
  "type": "system",
  "title": "系统通知",
  "content": "系统将于今晚维护",
  "userIds": ["64...", "64..."]
}
```

### 推送消息（admin）

**POST** `/api/notifications/push` (需要admin权限)

请求体：
```json
{
  "userId": "64...",
  "event": "approval_status_change",
  "data": {
    "applicationId": "64...",
    "status": "approved"
  }
}
```

## 效能报表接口

### 获取快速统计

**GET** `/api/reports/quick-stats`

### 获取实时统计

**GET** `/api/reports/realtime`

### 获取效能趋势

**GET** `/api/reports/trend?months=6`

### 获取审批人排名

**GET** `/api/reports/ranking?limit=10`

### 获取部门排行榜

**GET** `/api/reports/top-departments?sortBy=onTimeRate&limit=10`

### 获取部门倒数榜

**GET** `/api/reports/bottom-departments?sortBy=timeoutRate&limit=10`

### 获取部门效能

**GET** `/api/reports/department?departmentId=64...&startDate=2024-01-01&endDate=2024-01-31`

### 获取事项类型效能

**GET** `/api/reports/item-type?itemType=企业注册&startDate=2024-01-01&endDate=2024-01-31`

### 生成月度报表

**POST** `/api/reports/monthly` (需要admin/supervisor权限)

请求体：
```json
{
  "year": 2024,
  "month": 1
}
```

### 生成自定义报表

**POST** `/api/reports/custom` (需要admin/supervisor权限)

请求体：
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-15",
  "name": "1月上半月报表"
}
```

### 获取报表列表

**GET** `/api/reports` (需要admin/supervisor权限)

### 获取报表详情

**GET** `/api/reports/:id` (需要admin/supervisor权限)

### 导出报表Excel

**GET** `/api/reports/:id/export` (需要admin/supervisor权限)

### 按时间段导出

**GET** `/api/reports/export/by-period?startDate=2024-01-01&endDate=2024-01-31` (需要admin/supervisor权限)

### 删除报表

**DELETE** `/api/reports/:id` (需要admin/supervisor权限)

## 定时任务接口

### 获取任务状态

**GET** `/api/scheduler/status`

### 手动执行任务

**POST** `/api/scheduler/run/:taskName`

可用任务：
- `timeoutCheck`: 超时检查
- `monthlyReport`: 月度报表
- `fastTrackCheck`: 快速通道检查
- `certificateSync`: 证照同步
- `creditRestrictionCheck`: 信用限制检查

## Socket.IO实时通信

### 连接

```javascript
const socket = io('http://localhost:3000');

// 加入用户房间
socket.emit('join', userId);

// 监听通知
socket.on('notification', (data) => {
  console.log('收到通知:', data);
});

// 监听审批状态变更
socket.on('approval_status_change', (data) => {
  console.log('审批状态变更:', data);
});

// 离开房间
socket.emit('leave', userId);
```

### 推送事件

| 事件名称 | 说明 |
|---------|------|
| `notification` | 通用通知 |
| `approval_status_change` | 审批状态变更 |
| `material_missing` | 材料缺失提醒 |
| `approval_reminder` | 审批催办 |
| `approval_timeout` | 审批超时 |
| `certificate_generated` | 证照生成 |
| `credit_updated` | 信用更新 |

## 示例账户

### 管理员
- 手机号: 13800138000
- 密码: 123456

### 监督员
- 手机号: 13800138001
- 密码: 123456

### 审批人
- 张三（企业注册科科员）: 13800138002 / 123456
- 李四（企业注册科科长）: 13800138003 / 123456
- 王五（税务局）: 13800138004 / 123456
- 赵六（住建局）: 13800138005 / 123456
- 钱七（人社局）: 13800138006 / 123456

### 个人用户
- 陈先生（信用良好）: 13900139001 / 123456
- 刘女士（信用良好）: 13900139002 / 123456
- 周先生（信用一般）: 13900139003 / 123456

### 企业用户
- 科技有限公司: 13900139010 / 123456
- 贸易有限公司: 13900139011 / 123456

## 示例事项编码

- `QYDJ-001`: 有限责任公司设立登记
- `QYDJ-002`: 个体工商户设立登记
- `SWDJ-001`: 税务登记
- `ZJJ-001`: 房屋所有权登记
- `RSJ-001`: 社会保险登记

## 申请状态说明

| 状态 | 说明 |
|------|------|
| pending | 待受理 |
| material_missing | 材料缺失 |
| in_progress | 审批中 |
| parallel_approval | 并联审批中 |
| approved | 审批通过 |
| rejected | 审批驳回 |
| returned | 退回补正 |
| revoked | 已撤销 |
| certificate_generated | 证照已生成 |

## 审批决定说明

| 决定 | 说明 |
|------|------|
| approve | 通过 |
| reject | 驳回 |
| return | 退回补正 |

## 信用等级说明

| 等级 | 分数范围 | 说明 |
|------|---------|------|
| S | 95-100 | 优秀，可享最高优先级快速通道 |
| A | 85-94 | 良好，可使用快速通道 |
| B | 70-84 | 一般，正常审批 |
| C | 60-69 | 较低，需重点审核 |
| D | 0-59 | 差，限制快速通道 |

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 核心业务流程

### 1. 申请提交流程

```
用户提交申请
    ↓
根据事项编码获取审批链条
    ↓
校验材料完整性
    ├─ 材料缺失 → 返回缺失材料清单 → 用户补充
    └─ 材料齐全 → 进入下一步
    ↓
检查信用分（如使用快速通道）
    ├─ 信用良好 → 启用快速通道，先审批后补材料
    └─ 信用一般 → 正常审批流程
    ↓
自动分配到首个审批岗
    ↓
发送通知给申请人和审批人
    ↓
进入审批流程
```

### 2. 审批流程

```
审批人接收通知
    ↓
审批处理
    ├─ 通过 → 检查是否有下一个审批步骤
    │       ├─ 有下一个步骤 → 分配到下一个审批岗
    │       └─ 无下一个步骤 → 审批通过 → 生成电子证照
    ├─ 驳回 → 流程结束 → 通知申请人
    └─ 退回 → 通知申请人补充材料 → 重新进入审批
    ↓
并联审批步骤
    ├─ 分发至各联办单位
    ├─ 各单位独立审批
    ├─ 超时未反馈默认同意
    └─ 合并意见 → 进入下一步
```

### 3. 超时处理流程

```
定时任务每30分钟检查
    ↓
审批超过2小时未处理
    ↓
发送催办通知
    ↓
审批超过24小时未处理
    ↓
自动转交上级审批人
    ↓
标记为超时
    ↓
记录信用扣分
```

### 4. 快速通道流程

```
信用良好用户提交申请
    ↓
启用快速通道
    ↓
先进行审批（后补材料）
    ↓
设置材料补交截止日期（7-10天）
    ↓
审批通过后自动跟踪补交
    ├─ 到期前3天提醒用户
    └─ 逾期未补 → 自动撤销审批 → 信用扣分
```

## 安全说明

1. 所有接口（除注册登录外）都需要携带JWT Token
2. 密码使用bcrypt加密存储
3. 敏感信息（身份证号等）脱敏返回
4. 启用helmet安全头防护
5. 登录接口限流：15分钟最多5次
6. 所有删除操作为软删除，保留操作痕迹
7. 所有状态变更记录操作人和时间

## 健康检查

**GET** `/api/health`

响应：
```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "schedulerStatus": {
    "isRunning": true,
    "tasks": [
      { "name": "timeoutCheck", "scheduled": true },
      { "name": "monthlyReport", "scheduled": true }
    ]
  }
}
```
