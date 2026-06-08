const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const ServiceItem = require('../models/ServiceItem');
const Credit = require('../models/Credit');
const dotenv = require('dotenv');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 连接成功');

    await User.deleteMany({});
    await Department.deleteMany({});
    await ServiceItem.deleteMany({});
    await Credit.deleteMany({});
    console.log('已清空现有数据');

    const departments = await Department.insertMany([
      {
        code: 'SCJGJ',
        name: '市场监督管理局',
        level: 1,
        parentDepartment: null,
        description: '负责市场主体登记注册、市场秩序监管等工作',
        contact: {
          phone: '12315',
          address: '政务中心A区1楼'
        }
      },
      {
        code: 'SWJ',
        name: '税务局',
        level: 1,
        parentDepartment: null,
        description: '负责税收征收管理、税务登记等工作',
        contact: {
          phone: '12366',
          address: '政务中心A区2楼'
        }
      },
      {
        code: 'ZJJ',
        name: '住房和城乡建设局',
        level: 1,
        parentDepartment: null,
        description: '负责住房保障、城乡建设管理等工作',
        contact: {
          phone: '12319',
          address: '政务中心B区1楼'
        }
      },
      {
        code: 'RSJ',
        name: '人力资源和社会保障局',
        level: 1,
        parentDepartment: null,
        description: '负责就业服务、社会保障、人事管理等工作',
        contact: {
          phone: '12333',
          address: '政务中心B区2楼'
        }
      }
    ]);

    const subDepartments = await Department.insertMany([
      {
        code: 'SCJGJ_QYZC',
        name: '企业注册科',
        level: 2,
        parentDepartment: departments[0]._id,
        description: '负责企业注册登记、变更、注销等业务',
        contact: {
          phone: '12315-8001',
          address: '政务中心A区1楼101窗口'
        }
      },
      {
        code: 'SCJGJ_GTGS',
        name: '个体工商户科',
        level: 2,
        parentDepartment: departments[0]._id,
        description: '负责个体工商户注册登记、变更、注销等业务',
        contact: {
          phone: '12315-8002',
          address: '政务中心A区1楼102窗口'
        }
      }
    ]);

    console.log(`已创建 ${departments.length + subDepartments.length} 个部门`);

    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = [
      {
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        phone: '13800138000',
        type: 'admin',
        status: 'active'
      },
      {
        username: 'supervisor',
        password: hashedPassword,
        name: '效能监督员',
        phone: '13800138001',
        type: 'supervisor',
        status: 'active'
      },
      {
        username: 'zhangsan',
        password: hashedPassword,
        name: '张三',
        phone: '13800138002',
        idCard: '110101198001010001',
        type: 'approver',
        department: subDepartments[0]._id,
        position: '科员',
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'lisi',
        password: hashedPassword,
        name: '李四',
        phone: '13800138003',
        idCard: '110101198001010002',
        type: 'approver',
        department: subDepartments[0]._id,
        position: '科长',
        approvalLevel: 2,
        status: 'active'
      },
      {
        username: 'wangwu',
        password: hashedPassword,
        name: '王五',
        phone: '13800138004',
        idCard: '110101198001010003',
        type: 'approver',
        department: departments[1]._id,
        position: '科员',
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'zhaoliu',
        password: hashedPassword,
        name: '赵六',
        phone: '13800138005',
        idCard: '110101198001010004',
        type: 'approver',
        department: departments[2]._id,
        position: '科员',
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'qianqi',
        password: hashedPassword,
        name: '钱七',
        phone: '13800138006',
        idCard: '110101198001010005',
        type: 'approver',
        department: departments[3]._id,
        position: '科员',
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'chenxs',
        password: hashedPassword,
        name: '陈先生',
        phone: '13900139001',
        idCard: '110101199001011234',
        type: 'personal',
        fastTrackEnabled: true,
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'liuns',
        password: hashedPassword,
        name: '刘女士',
        phone: '13900139002',
        idCard: '110101199002025678',
        type: 'personal',
        fastTrackEnabled: true,
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'zhouxs',
        password: hashedPassword,
        name: '周先生',
        phone: '13900139003',
        idCard: '110101199003039012',
        type: 'personal',
        fastTrackEnabled: false,
        approvalLevel: 2,
        status: 'active'
      },
      {
        username: 'keji_company',
        password: hashedPassword,
        name: '科技有限公司',
        phone: '13900139010',
        type: 'enterprise',
        enterpriseInfo: {
          name: '科技有限公司',
          creditCode: '91110000MA001ABC12',
          legalPerson: '陈先生'
        },
        fastTrackEnabled: true,
        approvalLevel: 1,
        status: 'active'
      },
      {
        username: 'maoyi_company',
        password: hashedPassword,
        name: '贸易有限公司',
        phone: '13900139011',
        type: 'enterprise',
        enterpriseInfo: {
          name: '贸易有限公司',
          creditCode: '91110000MA002DEF34',
          legalPerson: '刘女士'
        },
        fastTrackEnabled: false,
        approvalLevel: 2,
        status: 'active'
      }
    ];

    const users = await User.insertMany(userData);

    console.log(`已创建 ${users.length} 个用户`);

    subDepartments[0].approvers = [users[2]._id, users[3]._id];
    departments[1].approvers = [users[4]._id];
    departments[2].approvers = [users[5]._id];
    departments[3].approvers = [users[6]._id];
    
    await Promise.all([
      subDepartments[0].save(),
      departments[1].save(),
      departments[2].save(),
      departments[3].save()
    ]);

    const personalUsers = users.filter(u => u.type === 'personal' || u.type === 'enterprise');
    const credits = [];
    
    for (const user of personalUsers) {
      credits.push({
        user: user._id,
        score: user.fastTrackEnabled ? 85 : 70,
        level: user.fastTrackEnabled ? 'good' : 'normal',
        approvalLevel: user.approvalLevel,
        fastTrackRestricted: !user.fastTrackEnabled,
        restrictionReason: user.fastTrackEnabled ? null : '信用分不足',
        records: [
          {
            type: 'good_behavior',
            description: '初始化信用记录',
            scoreChange: 0,
            recordedAt: new Date()
          }
        ]
      });
    }
    
    await Credit.insertMany(credits);
    console.log(`已创建 ${credits.length} 条信用记录`);

    const serviceItems = await ServiceItem.insertMany([
      {
        itemCode: 'QYDJ-001',
        itemName: '有限责任公司设立登记',
        itemType: 'administrative_license',
        category: '市场主体登记',
        description: '有限责任公司设立登记业务办理',
        legalBasis: '《中华人民共和国公司法》',
        handlingTime: 3,
        processingLocation: '政务中心A区1楼企业注册科',
        supportsFastTrack: true,
        fastTrackTimeoutDays: 7,
        requiredCreditScore: 80,
        status: 'published',
        createdBy: users[0]._id,
        materials: [
          {
            code: 'CL-001',
            name: '公司登记申请书',
            type: 'required',
            format: 'electronic',
            description: '法定代表人签署的公司登记申请书'
          },
          {
            code: 'CL-002',
            name: '公司章程',
            type: 'required',
            format: 'electronic',
            description: '全体股东签署的公司章程'
          },
          {
            code: 'CL-003',
            name: '股东身份证明',
            type: 'required',
            format: 'electronic',
            description: '股东的主体资格证明或者自然人身份证件复印件'
          },
          {
            code: 'CL-004',
            name: '董事监事经理任职文件',
            type: 'optional',
            format: 'electronic',
            description: '董事、监事、经理的任职文件及身份证明复印件'
          },
          {
            code: 'CL-005',
            name: '法定代表人任职文件',
            type: 'required',
            format: 'electronic',
            description: '法定代表人任职文件及身份证件复印件'
          },
          {
            code: 'CL-006',
            name: '住所使用证明',
            type: 'required',
            format: 'electronic',
            description: '公司住所使用证明（房产证或租赁合同）'
          },
          {
            code: 'CL-007',
            name: '企业名称预先核准通知书',
            type: 'required',
            format: 'electronic',
            description: '企业名称预先核准通知书'
          }
        ],
        approvalChain: [
          {
            stepOrder: 1,
            stepName: '材料初审',
            type: 'single',
            department: subDepartments[0]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 24,
            remindHours: 2
          },
          {
            stepOrder: 2,
            stepName: '并联审批',
            type: 'parallel',
            department: subDepartments[0]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 48,
            remindHours: 4,
            parallelDepartments: [subDepartments[0]._id, departments[1]._id],
            defaultApprovalOnTimeout: true
          },
          {
            stepOrder: 3,
            stepName: '终审',
            type: 'single',
            department: subDepartments[0]._id,
            requiredApprovalLevel: 2,
            timeoutHours: 24,
            remindHours: 2
          }
        ]
      },
      {
        itemCode: 'QYDJ-002',
        itemName: '个体工商户设立登记',
        itemType: 'administrative_license',
        category: '市场主体登记',
        description: '个体工商户设立登记业务办理',
        legalBasis: '《个体工商户条例》',
        handlingTime: 1,
        processingLocation: '政务中心A区1楼个体工商户科',
        supportsFastTrack: true,
        fastTrackTimeoutDays: 5,
        requiredCreditScore: 75,
        status: 'published',
        createdBy: users[0]._id,
        materials: [
          {
            code: 'CL-101',
            name: '个体工商户登记申请书',
            type: 'required',
            format: 'electronic',
            description: '申请人签署的个体工商户登记申请书'
          },
          {
            code: 'CL-102',
            name: '申请人身份证明',
            type: 'required',
            format: 'electronic',
            description: '申请人身份证复印件'
          },
          {
            code: 'CL-103',
            name: '经营场所证明',
            type: 'required',
            format: 'electronic',
            description: '经营场所使用证明（房产证或租赁合同）'
          }
        ],
        approvalChain: [
          {
            stepOrder: 1,
            stepName: '材料审核',
            type: 'single',
            department: subDepartments[1]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 12,
            remindHours: 2
          },
          {
            stepOrder: 2,
            stepName: '核准登记',
            type: 'single',
            department: subDepartments[1]._id,
            requiredApprovalLevel: 2,
            timeoutHours: 12,
            remindHours: 2
          }
        ]
      },
      {
        itemCode: 'SWDJ-001',
        itemName: '税务登记',
        itemType: 'administrative_license',
        category: '税务服务',
        description: '企业、个体工商户税务登记业务办理',
        legalBasis: '《中华人民共和国税收征收管理法》',
        handlingTime: 1,
        processingLocation: '政务中心A区2楼税务局',
        supportsFastTrack: false,
        requiredCreditScore: 70,
        status: 'published',
        createdBy: users[0]._id,
        materials: [
          {
            code: 'CL-201',
            name: '税务登记表',
            type: 'required',
            format: 'electronic',
            description: '税务登记表（适用单位纳税人）'
          },
          {
            code: 'CL-202',
            name: '营业执照',
            type: 'required',
            format: 'electronic',
            description: '营业执照副本复印件'
          },
          {
            code: 'CL-203',
            name: '组织机构代码证',
            type: 'required',
            format: 'electronic',
            description: '组织机构代码证书副本复印件'
          },
          {
            code: 'CL-204',
            name: '法定代表人身份证',
            type: 'required',
            format: 'electronic',
            description: '法定代表人居民身份证复印件'
          }
        ],
        approvalChain: [
          {
            stepOrder: 1,
            stepName: '资料审核',
            type: 'single',
            department: departments[1]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 8,
            remindHours: 2
          }
        ]
      },
      {
        itemCode: 'ZJJ-001',
        itemName: '房屋所有权登记',
        itemType: 'public_service',
        category: '不动产登记',
        description: '商品房、存量房等房屋所有权登记业务',
        legalBasis: '《不动产登记暂行条例》',
        handlingTime: 5,
        processingLocation: '政务中心B区1楼住建局',
        supportsFastTrack: true,
        fastTrackTimeoutDays: 10,
        requiredCreditScore: 85,
        status: 'published',
        createdBy: users[0]._id,
        materials: [
          {
            code: 'CL-301',
            name: '不动产登记申请书',
            type: 'required',
            format: 'electronic',
            description: '不动产登记申请书'
          },
          {
            code: 'CL-302',
            name: '申请人身份证明',
            type: 'required',
            format: 'electronic',
            description: '申请人身份证明材料'
          },
          {
            code: 'CL-303',
            name: '房屋买卖合同',
            type: 'required',
            format: 'electronic',
            description: '房屋买卖合同（原件）'
          },
          {
            code: 'CL-304',
            name: '房屋所有权证书',
            type: 'required',
            format: 'electronic',
            description: '原房屋所有权证书'
          },
          {
            code: 'CL-305',
            name: '完税证明',
            type: 'required',
            format: 'electronic',
            description: '契税等完税证明'
          }
        ],
        approvalChain: [
          {
            stepOrder: 1,
            stepName: '受理审核',
            type: 'single',
            department: departments[2]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 48,
            remindHours: 4
          },
          {
            stepOrder: 2,
            stepName: '并联审批',
            type: 'parallel',
            department: departments[2]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 72,
            remindHours: 6,
            parallelDepartments: [departments[2]._id, departments[1]._id],
            defaultApprovalOnTimeout: true
          },
          {
            stepOrder: 3,
            stepName: '登簿发证',
            type: 'single',
            department: departments[2]._id,
            requiredApprovalLevel: 2,
            timeoutHours: 48,
            remindHours: 4
          }
        ]
      },
      {
        itemCode: 'RSJ-001',
        itemName: '社会保险登记',
        itemType: 'public_service',
        category: '社保服务',
        description: '企业、个体工商户、灵活就业人员社会保险登记',
        legalBasis: '《中华人民共和国社会保险法》',
        handlingTime: 2,
        processingLocation: '政务中心B区2楼人社局',
        supportsFastTrack: false,
        requiredCreditScore: 70,
        status: 'published',
        createdBy: users[0]._id,
        materials: [
          {
            code: 'CL-401',
            name: '社会保险登记表',
            type: 'required',
            format: 'electronic',
            description: '社会保险登记表（单位）'
          },
          {
            code: 'CL-402',
            name: '营业执照',
            type: 'required',
            format: 'electronic',
            description: '营业执照、事业单位法人证书等批准成立证件'
          },
          {
            code: 'CL-403',
            name: '组织机构代码证',
            type: 'required',
            format: 'electronic',
            description: '组织机构代码证书'
          },
          {
            code: 'CL-404',
            name: '法定代表人身份证',
            type: 'required',
            format: 'electronic',
            description: '法定代表人或负责人身份证件'
          },
          {
            code: 'CL-405',
            name: '银行开户许可证',
            type: 'optional',
            format: 'electronic',
            description: '银行开户许可证或账户信息'
          }
        ],
        approvalChain: [
          {
            stepOrder: 1,
            stepName: '资料审核',
            type: 'single',
            department: departments[3]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 24,
            remindHours: 2
          },
          {
            stepOrder: 2,
            stepName: '信息录入',
            type: 'single',
            department: departments[3]._id,
            requiredApprovalLevel: 1,
            timeoutHours: 12,
            remindHours: 2
          }
        ]
      }
    ]);

    console.log(`已创建 ${serviceItems.length} 个服务事项`);

    console.log('\n========================================');
    console.log('示例数据导入完成！');
    console.log('========================================');
    console.log('\n管理员账户:');
    console.log('  用户名: admin, 密码: 123456, 手机号: 13800138000');
    console.log('\n监督员账户:');
    console.log('  用户名: supervisor, 密码: 123456, 手机号: 13800138001');
    console.log('\n审批人账户:');
    console.log('  张三（企业注册科科员）: zhangsan / 123456');
    console.log('  李四（企业注册科科长）: lisi / 123456');
    console.log('  王五（税务局）: wangwu / 123456');
    console.log('  赵六（住建局）: zhaoliu / 123456');
    console.log('  钱七（人社局）: qianqi / 123456');
    console.log('\n个人用户账户:');
    console.log('  陈先生（信用良好，85分）: chenxs / 123456');
    console.log('  刘女士（信用良好，85分）: liuns / 123456');
    console.log('  周先生（信用一般，70分）: zhouxs / 123456');
    console.log('\n企业用户账户:');
    console.log('  科技有限公司（信用良好）: keji_company / 123456');
    console.log('  贸易有限公司（信用一般）: maoyi_company / 123456');
    console.log('\n示例事项编码:');
    console.log('  QYDJ-001: 有限责任公司设立登记');
    console.log('  QYDJ-002: 个体工商户设立登记');
    console.log('  SWDJ-001: 税务登记');
    console.log('  ZJJ-001: 房屋所有权登记');
    console.log('  RSJ-001: 社会保险登记');
    console.log('\n========================================');

    process.exit(0);
  } catch (error) {
    console.error('种子数据创建失败:', error);
    process.exit(1);
  }
};

seedData();
