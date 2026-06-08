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
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB 连接成功');

    await User.deleteMany({});
    await Department.deleteMany({});
    await ServiceItem.deleteMany({});
    await Credit.deleteMany({});

    const departments = await Department.insertMany([
      {
        name: '市场监督管理局',
        code: 'SCJGJ',
        level: 1,
        parent: null,
        description: '负责市场主体登记注册、市场秩序监管等工作',
        address: '政务中心A区1楼',
        contactPhone: '12315'
      },
      {
        name: '税务局',
        code: 'SWJ',
        level: 1,
        parent: null,
        description: '负责税收征收管理、税务登记等工作',
        address: '政务中心A区2楼',
        contactPhone: '12366'
      },
      {
        name: '住房和城乡建设局',
        code: 'ZJJ',
        level: 1,
        parent: null,
        description: '负责住房保障、城乡建设管理等工作',
        address: '政务中心B区1楼',
        contactPhone: '12319'
      },
      {
        name: '人力资源和社会保障局',
        code: 'RSJ',
        level: 1,
        parent: null,
        description: '负责就业服务、社会保障、人事管理等工作',
        address: '政务中心B区2楼',
        contactPhone: '12333'
      },
      {
        name: '企业注册科',
        code: 'SCJGJ_QYZC',
        level: 2,
        parent: null,
        description: '负责企业注册登记、变更、注销等业务',
        address: '政务中心A区1楼101窗口',
        contactPhone: '12315-8001'
      },
      {
        name: '个体工商户科',
        code: 'SCJGJ_GTGS',
        level: 2,
        parent: null,
        description: '负责个体工商户注册登记、变更、注销等业务',
        address: '政务中心A区1楼102窗口',
        contactPhone: '12315-8002'
      }
    ]);

    console.log(`已创建 ${departments.length} 个部门`);

    const password = await bcrypt.hash('123456', 10);

    const adminUser = new User({
      name: '系统管理员',
      phone: '13800138000',
      password,
      type: 'admin',
      department: departments[0]._id,
      approvalLevel: 3
    });
    await adminUser.save();

    const supervisorUser = new User({
      name: '效能监督员',
      phone: '13800138001',
      password,
      type: 'supervisor',
      department: departments[0]._id,
      approvalLevel: 3
    });
    await supervisorUser.save();

    const approvers = await User.insertMany([
      {
        name: '张三',
        phone: '13800138002',
        password,
        type: 'approver',
        department: departments[4]._id,
        approvalLevel: 1,
        isApprover: true
      },
      {
        name: '李四',
        phone: '13800138003',
        password,
        type: 'approver',
        department: departments[4]._id,
        approvalLevel: 2,
        isApprover: true
      },
      {
        name: '王五',
        phone: '13800138004',
        password,
        type: 'approver',
        department: departments[1]._id,
        approvalLevel: 1,
        isApprover: true
      },
      {
        name: '赵六',
        phone: '13800138005',
        password,
        type: 'approver',
        department: departments[2]._id,
        approvalLevel: 1,
        isApprover: true
      },
      {
        name: '钱七',
        phone: '13800138006',
        password,
        type: 'approver',
        department: departments[3]._id,
        approvalLevel: 1,
        isApprover: true
      }
    ]);

    departments[4].approvers = [
      { user: approvers[0]._id, role: 'reviewer' },
      { user: approvers[1]._id, role: 'approver' }
    ];
    departments[1].approvers = [{ user: approvers[2]._id, role: 'approver' }];
    departments[2].approvers = [{ user: approvers[3]._id, role: 'approver' }];
    departments[3].approvers = [{ user: approvers[4]._id, role: 'approver' }];
    
    departments[4].parent = departments[0]._id;
    departments[5].parent = departments[0]._id;

    await Promise.all(departments.map(d => d.save()));

    const individualUsers = await User.insertMany([
      {
        name: '陈先生',
        phone: '13900139001',
        password,
        type: 'individual',
        idCard: '110101199001011234',
        fastTrackEnabled: true,
        approvalLevel: 1
      },
      {
        name: '刘女士',
        phone: '13900139002',
        password,
        type: 'individual',
        idCard: '110101199002025678',
        fastTrackEnabled: true,
        approvalLevel: 1
      },
      {
        name: '周先生',
        phone: '13900139003',
        password,
        type: 'individual',
        idCard: '110101199003039012',
        fastTrackEnabled: false,
        approvalLevel: 2
      }
    ]);

    const enterpriseUsers = await User.insertMany([
      {
        name: '科技有限公司',
        phone: '13900139010',
        password,
        type: 'enterprise',
        enterpriseInfo: {
          enterpriseName: '科技有限公司',
          unifiedCreditCode: '91110000MA001ABC12',
          legalPerson: '陈先生',
          legalPersonIdCard: '110101199001011234'
        },
        fastTrackEnabled: true,
        approvalLevel: 1
      },
      {
        name: '贸易有限公司',
        phone: '13900139011',
        password,
        type: 'enterprise',
        enterpriseInfo: {
          enterpriseName: '贸易有限公司',
          unifiedCreditCode: '91110000MA002DEF34',
          legalPerson: '刘女士',
          legalPersonIdCard: '110101199002025678'
        },
        fastTrackEnabled: false,
        approvalLevel: 2
      }
    ]);

    console.log(`已创建 ${approvers.length + 2 + individualUsers.length + enterpriseUsers.length} 个用户`);
    console.log('  - 管理员: 1个');
    console.log('  - 监督员: 1个');
    console.log(`  - 审批人: ${approvers.length}个`);
    console.log(`  - 个人用户: ${individualUsers.length}个`);
    console.log(`  - 企业用户: ${enterpriseUsers.length}个`);

    const serviceItems = await ServiceItem.insertMany([
      {
        itemCode: 'QYDJ-001',
        itemName: '有限责任公司设立登记',
        itemType: '企业注册',
        department: departments[4]._id,
        description: '有限责任公司设立登记业务办理',
        handlingTimeLimit: 3,
        feeStandard: '免费',
        legalBasis: '《中华人民共和国公司法》',
        materials: [
          {
            name: '公司登记申请书',
            code: 'CL-001',
            required: true,
            description: '法定代表人签署的公司登记申请书',
            format: 'pdf',
            sampleUrl: '/samples/company_registration_application.pdf'
          },
          {
            name: '公司章程',
            code: 'CL-002',
            required: true,
            description: '全体股东签署的公司章程',
            format: 'pdf',
            sampleUrl: '/samples/company_articles.pdf'
          },
          {
            name: '股东身份证明',
            code: 'CL-003',
            required: true,
            description: '股东的主体资格证明或者自然人身份证件复印件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/shareholder_id.pdf'
          },
          {
            name: '董事监事经理任职文件',
            code: 'CL-004',
            required: false,
            description: '董事、监事、经理的任职文件及身份证明复印件',
            format: 'pdf',
            sampleUrl: '/samples/director_appointment.pdf'
          },
          {
            name: '法定代表人任职文件',
            code: 'CL-005',
            required: true,
            description: '法定代表人任职文件及身份证件复印件',
            format: 'pdf',
            sampleUrl: '/samples/legal_representative.pdf'
          },
          {
            name: '住所使用证明',
            code: 'CL-006',
            required: true,
            description: '公司住所使用证明（房产证或租赁合同）',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/address_proof.pdf'
          },
          {
            name: '企业名称预先核准通知书',
            code: 'CL-007',
            required: true,
            description: '企业名称预先核准通知书',
            format: 'pdf',
            sampleUrl: '/samples/name_approval.pdf'
          }
        ],
        approvalSteps: [
          {
            stepOrder: 1,
            stepName: '材料初审',
            type: 'single',
            department: departments[4]._id,
            timeoutHours: 24,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          },
          {
            stepOrder: 2,
            stepName: '并联审批',
            type: 'parallel',
            department: departments[4]._id,
            timeoutHours: 48,
            remindHours: 4,
            parallelDepartments: [departments[4]._id, departments[1]._id],
            defaultApprovalOnTimeout: true
          },
          {
            stepOrder: 3,
            stepName: '终审',
            type: 'single',
            department: departments[4]._id,
            timeoutHours: 24,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          }
        ],
        fastTrackSupported: true,
        fastTrackSupplementDays: 7,
        status: 'published',
        createdBy: adminUser._id
      },
      {
        itemCode: 'QYDJ-002',
        itemName: '个体工商户设立登记',
        itemType: '企业注册',
        department: departments[5]._id,
        description: '个体工商户设立登记业务办理',
        handlingTimeLimit: 1,
        feeStandard: '免费',
        legalBasis: '《个体工商户条例》',
        materials: [
          {
            name: '个体工商户登记申请书',
            code: 'CL-101',
            required: true,
            description: '申请人签署的个体工商户登记申请书',
            format: 'pdf',
            sampleUrl: '/samples/individual_registration.pdf'
          },
          {
            name: '申请人身份证明',
            code: 'CL-102',
            required: true,
            description: '申请人身份证复印件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/applicant_id.pdf'
          },
          {
            name: '经营场所证明',
            code: 'CL-103',
            required: true,
            description: '经营场所使用证明（房产证或租赁合同）',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/business_address.pdf'
          }
        ],
        approvalSteps: [
          {
            stepOrder: 1,
            stepName: '材料审核',
            type: 'single',
            department: departments[5]._id,
            timeoutHours: 12,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          },
          {
            stepOrder: 2,
            stepName: '核准登记',
            type: 'single',
            department: departments[5]._id,
            timeoutHours: 12,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          }
        ],
        fastTrackSupported: true,
        fastTrackSupplementDays: 5,
        status: 'published',
        createdBy: adminUser._id
      },
      {
        itemCode: 'SWDJ-001',
        itemName: '税务登记',
        itemType: '税务办理',
        department: departments[1]._id,
        description: '企业、个体工商户税务登记业务办理',
        handlingTimeLimit: 1,
        feeStandard: '免费',
        legalBasis: '《中华人民共和国税收征收管理法》',
        materials: [
          {
            name: '税务登记表',
            code: 'CL-201',
            required: true,
            description: '税务登记表（适用单位纳税人）',
            format: 'pdf',
            sampleUrl: '/samples/tax_registration.pdf'
          },
          {
            name: '营业执照',
            code: 'CL-202',
            required: true,
            description: '营业执照副本复印件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/business_license.pdf'
          },
          {
            name: '组织机构代码证',
            code: 'CL-203',
            required: true,
            description: '组织机构代码证书副本复印件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/org_code.pdf'
          },
          {
            name: '法定代表人身份证',
            code: 'CL-204',
            required: true,
            description: '法定代表人居民身份证复印件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/legal_person_id.pdf'
          }
        ],
        approvalSteps: [
          {
            stepOrder: 1,
            stepName: '资料审核',
            type: 'single',
            department: departments[1]._id,
            timeoutHours: 8,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          }
        ],
        fastTrackSupported: false,
        status: 'published',
        createdBy: adminUser._id
      },
      {
        itemCode: 'ZJJ-001',
        itemName: '房屋所有权登记',
        itemType: '住房服务',
        department: departments[2]._id,
        description: '商品房、存量房等房屋所有权登记业务',
        handlingTimeLimit: 5,
        feeStandard: '按规定收取登记费',
        legalBasis: '《不动产登记暂行条例》',
        materials: [
          {
            name: '不动产登记申请书',
            code: 'CL-301',
            required: true,
            description: '不动产登记申请书',
            format: 'pdf',
            sampleUrl: '/samples/real_estate_application.pdf'
          },
          {
            name: '申请人身份证明',
            code: 'CL-302',
            required: true,
            description: '申请人身份证明材料',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/applicant_id.pdf'
          },
          {
            name: '房屋买卖合同',
            code: 'CL-303',
            required: true,
            description: '房屋买卖合同（原件）',
            format: 'pdf',
            sampleUrl: '/samples/house_sales_contract.pdf'
          },
          {
            name: '房屋所有权证书',
            code: 'CL-304',
            required: true,
            description: '原房屋所有权证书',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/house_ownership.pdf'
          },
          {
            name: '完税证明',
            code: 'CL-305',
            required: true,
            description: '契税等完税证明',
            format: 'pdf',
            sampleUrl: '/samples/tax_payment.pdf'
          }
        ],
        approvalSteps: [
          {
            stepOrder: 1,
            stepName: '受理审核',
            type: 'single',
            department: departments[2]._id,
            timeoutHours: 48,
            remindHours: 4,
            defaultApprovalOnTimeout: false
          },
          {
            stepOrder: 2,
            stepName: '并联审批',
            type: 'parallel',
            department: departments[2]._id,
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
            timeoutHours: 48,
            remindHours: 4,
            defaultApprovalOnTimeout: false
          }
        ],
        fastTrackSupported: true,
        fastTrackSupplementDays: 10,
        status: 'published',
        createdBy: adminUser._id
      },
      {
        itemCode: 'RSJ-001',
        itemName: '社会保险登记',
        itemType: '社会保障',
        department: departments[3]._id,
        description: '企业、个体工商户、灵活就业人员社会保险登记',
        handlingTimeLimit: 2,
        feeStandard: '免费',
        legalBasis: '《中华人民共和国社会保险法》',
        materials: [
          {
            name: '社会保险登记表',
            code: 'CL-401',
            required: true,
            description: '社会保险登记表（单位）',
            format: 'pdf',
            sampleUrl: '/samples/social_insurance_registration.pdf'
          },
          {
            name: '营业执照',
            code: 'CL-402',
            required: true,
            description: '营业执照、事业单位法人证书等批准成立证件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/business_license.pdf'
          },
          {
            name: '组织机构代码证',
            code: 'CL-403',
            required: true,
            description: '组织机构代码证书',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/org_code.pdf'
          },
          {
            name: '法定代表人身份证',
            code: 'CL-404',
            required: true,
            description: '法定代表人或负责人身份证件',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/legal_person_id.pdf'
          },
          {
            name: '银行开户许可证',
            code: 'CL-405',
            required: false,
            description: '银行开户许可证或账户信息',
            format: 'pdf,jpg,png',
            sampleUrl: '/samples/bank_account.pdf'
          }
        ],
        approvalSteps: [
          {
            stepOrder: 1,
            stepName: '资料审核',
            type: 'single',
            department: departments[3]._id,
            timeoutHours: 24,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          },
          {
            stepOrder: 2,
            stepName: '信息录入',
            type: 'single',
            department: departments[3]._id,
            timeoutHours: 12,
            remindHours: 2,
            defaultApprovalOnTimeout: false
          }
        ],
        fastTrackSupported: false,
        status: 'published',
        createdBy: adminUser._id
      }
    ]);

    console.log(`已创建 ${serviceItems.length} 个服务事项`);

    const allUsers = [...individualUsers, ...enterpriseUsers];
    const credits = [];
    
    for (const user of allUsers) {
      credits.push({
        user: user._id,
        score: user.fastTrackEnabled ? 85 : 70,
        level: user.fastTrackEnabled ? 'A' : 'B',
        records: user.fastTrackEnabled ? [] : [
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

    console.log('\n=== 示例账户信息 ===');
    console.log('管理员账户:');
    console.log('  手机号: 13800138000, 密码: 123456');
    console.log('监督员账户:');
    console.log('  手机号: 13800138001, 密码: 123456');
    console.log('审批人账户:');
    console.log('  张三（企业注册科科员）: 13800138002, 密码: 123456');
    console.log('  李四（企业注册科科长）: 13800138003, 密码: 123456');
    console.log('  王五（税务局）: 13800138004, 密码: 123456');
    console.log('  赵六（住建局）: 13800138005, 密码: 123456');
    console.log('  钱七（人社局）: 13800138006, 密码: 123456');
    console.log('个人用户账户:');
    console.log('  陈先生（信用良好）: 13900139001, 密码: 123456');
    console.log('  刘女士（信用良好）: 13900139002, 密码: 123456');
    console.log('  周先生（信用一般）: 13900139003, 密码: 123456');
    console.log('企业用户账户:');
    console.log('  科技有限公司: 13900139010, 密码: 123456');
    console.log('  贸易有限公司: 13900139011, 密码: 123456');
    console.log('\n示例事项编码:');
    console.log('  QYDJ-001: 有限责任公司设立登记');
    console.log('  QYDJ-002: 个体工商户设立登记');
    console.log('  SWDJ-001: 税务登记');
    console.log('  ZJJ-001: 房屋所有权登记');
    console.log('  RSJ-001: 社会保险登记');

    process.exit(0);
  } catch (error) {
    console.error('种子数据创建失败:', error);
    process.exit(1);
  }
};

seedData();
