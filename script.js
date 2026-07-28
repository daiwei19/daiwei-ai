// 全局变量
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Mock 数据
const mockUsers = [
    { id: 1, username: 'admin', password: 'admin123', email: 'admin@health.com', role: 'admin', created_at: '2024-01-01' },
    { id: 2, username: 'user1', password: '123456', email: 'user1@example.com', role: 'user', created_at: '2024-01-02' }
];

let mockHealthRecords = [];
let mockConsultations = [];
let nextId = 100;

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser')) || null;
    } catch (error) {
        return null;
    }
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

// Mock API 响应
async function apiRequest(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    // 登录
    if (path === '/api/auth/login' && method === 'POST') {
        const user = mockUsers.find(u => u.username === body.username && u.password === body.password);
        if (user) {
            const { password, ...userWithoutPassword } = user;
            return { success: true, user: userWithoutPassword };
        }
        throw new Error('用户名或密码错误');
    }

    // 注册
    if (path === '/api/auth/register' && method === 'POST') {
        if (!body.username || !body.password) {
            throw new Error('用户名和密码不能为空');
        }
        if (mockUsers.find(u => u.username === body.username)) {
            throw new Error('用户名已存在');
        }
        const newUser = {
            id: nextId++,
            username: body.username,
            password: body.password,
            email: '',
            role: 'user',
            created_at: new Date().toISOString().split('T')[0]
        };
        mockUsers.push(newUser);
        const { password, ...userWithoutPassword } = newUser;
        return { success: true, user: userWithoutPassword, message: '注册成功' };
    }

    // 获取用户列表
    if (path === '/api/users' && method === 'GET') {
        return mockUsers.map(u => {
            const { password, ...userWithoutPassword } = u;
            return userWithoutPassword;
        });
    }

    // 获取健康记录
    if (path.startsWith('/api/health-records') && method === 'GET') {
        const userId = new URLSearchParams(path.split('?')[1]).get('userId');
        if (userId) {
            return mockHealthRecords.filter(r => r.user_id == userId);
        }
        return mockHealthRecords;
    }

    // 添加健康记录
    if (path === '/api/health-records' && method === 'POST') {
        const record = {
            id: nextId++,
            user_id: body.userId,
            temp: body.temp,
            blood_pressure: body.bloodPressure || '',
            heart_rate: body.heartRate,
            blood_sugar: body.bloodSugar,
            cholesterol: body.cholesterol,
            oxygen: body.oxygen,
            created_at: new Date().toISOString()
        };
        mockHealthRecords.push(record);
        return { success: true, id: record.id, message: '健康数据已保存' };
    }

    // 获取咨询记录
    if (path.startsWith('/api/consultations') && method === 'GET') {
        const userId = new URLSearchParams(path.split('?')[1]).get('userId');
        if (userId) {
            return mockConsultations.filter(c => c.user_id == userId);
        }
        return mockConsultations;
    }

    // 添加咨询记录
    if (path === '/api/consultations' && method === 'POST') {
        const consultation = {
            id: nextId++,
            user_id: body.userId,
            symptoms: body.symptoms,
            duration: body.duration || '',
            other_symptoms: body.otherSymptoms || '',
            analysis_json: JSON.stringify(body.analysis),
            created_at: new Date().toISOString()
        };
        mockConsultations.push(consultation);
        return { success: true, id: consultation.id, message: '咨询记录已保存' };
    }

    // 获取用户资料
    if (path.match(/\/api\/profiles\/\d+/) && method === 'GET') {
        const userId = path.split('/')[4];
        return {};
    }

    // 保存用户资料
    if (path.match(/\/api\/profiles\/\d+/) && method === 'PUT') {
        return { success: true, message: '资料保存成功' };
    }

    // 健康检查
    if (path === '/api/health' && method === 'GET') {
        return { success: true, message: '服务已启动' };
    }

    throw new Error('API 路径未找到');
}

// 初始化数据
async function initData() {
    try {
        await apiRequest('/api/health');
    } catch (error) {
        console.warn(error.message);
    }
}

// 更新时间显示
function updateClock() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[now.getDay()];

    document.getElementById('clockDate').textContent = `${year}-${month}-${day}`;
    document.getElementById('clockTime').textContent = `${hours}:${minutes}:${seconds}`;
    document.getElementById('clockWeekday').textContent = weekday;
}

// 显示选项卡
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// 登录处理
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const result = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setCurrentUser(result.user);
        if (result.user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        alert(error.message);
    }
}

// 注册处理
async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }

    try {
        const result = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        alert(result.message);
        showTab('login');
    } catch (error) {
        alert(error.message);
    }
}

// 症状数据库
const symptomDatabase = {
    '头痛': {
        keywords: ['头痛', '头疼', '偏头痛', '头胀', '头重', '头晕'],
        combinations: {
            '发烧|发热|体温高': { cause: '可能为感冒或流感引起', department: '呼吸内科', treatment: '建议休息、多喝水、保持室内通风', medicine: '可服用退烧药如对乙酰氨基酚' },
            '恶心|想吐|呕吐': { cause: '可能为偏头痛或颅内压增高', department: '神经内科', treatment: '建议保持安静环境，避免强光', medicine: '可服用止痛药如布洛芬' },
            '颈部僵硬|脖子痛': { cause: '可能为颈椎问题或紧张性头痛', department: '骨科', treatment: '建议做颈部拉伸，避免长时间低头', medicine: '可外用止痛药膏' },
            '视力模糊|看不清': { cause: '可能为高血压或眼部问题', department: '眼科', treatment: '建议立即就医检查', medicine: '根据检查结果遵医嘱' },
            '鼻塞|流鼻涕|喉咙痛': { cause: '可能为上呼吸道感染', department: '呼吸内科', treatment: '建议多喝水、休息', medicine: '可服用感冒药' }
        },
        default: { cause: '头痛原因复杂，可能与疲劳、压力、睡眠不足等有关', department: '神经内科', treatment: '建议保证充足睡眠、放松心情、避免过度劳累', medicine: '可服用止痛药缓解症状' }
    },
    '咳嗽': {
        keywords: ['咳嗽', '干咳', '咳痰', '咳血', '喉咙痒'],
        combinations: {
            '发烧|发热': { cause: '可能为肺炎或支气管炎', department: '呼吸内科', treatment: '建议多喝水、注意休息', medicine: '可服用止咳药和抗生素' },
            '胸闷|呼吸困难': { cause: '可能为哮喘或慢性阻塞性肺病', department: '呼吸内科', treatment: '建议保持室内空气湿润', medicine: '可使用吸入剂' },
            '喉咙痛|咽喉痛': { cause: '可能为咽喉炎', department: '耳鼻喉科', treatment: '建议多喝温水、避免辛辣食物', medicine: '可含服润喉糖' },
            '流鼻涕|鼻塞': { cause: '可能为感冒', department: '呼吸内科', treatment: '建议休息、多喝水', medicine: '可服用感冒药' },
            '胸痛|胸口痛': { cause: '可能为胸膜炎或心脏问题', department: '心内科', treatment: '建议立即就医', medicine: '根据诊断结果治疗' }
        },
        default: { cause: '咳嗽通常是呼吸道受到刺激的反应', department: '呼吸内科', treatment: '建议多喝水、保持室内湿度', medicine: '可服用止咳药' }
    },
    '发烧': {
        keywords: ['发烧', '发热', '高烧', '低烧', '体温高'],
        combinations: {
            '头痛|头晕': { cause: '可能为病毒性感冒', department: '呼吸内科', treatment: '建议休息、多喝水', medicine: '可服用退烧药' },
            '咳嗽|咳痰': { cause: '可能为肺炎', department: '呼吸内科', treatment: '建议及时就医', medicine: '需抗生素治疗' },
            '喉咙痛|咽喉痛': { cause: '可能为扁桃体炎', department: '耳鼻喉科', treatment: '建议多喝水', medicine: '可服用抗生素' },
            '全身酸痛|乏力': { cause: '可能为流感', department: '呼吸内科', treatment: '建议卧床休息', medicine: '可服用抗病毒药' },
            '恶心|呕吐|腹泻': { cause: '可能为肠胃炎', department: '消化内科', treatment: '建议清淡饮食', medicine: '可服用退烧药和止泻药' }
        },
        default: { cause: '发烧是身体抵抗感染的正常反应', department: '全科', treatment: '建议多喝水、保持休息', medicine: '体温超过38.5°C可服用退烧药' }
    },
    '胃痛': {
        keywords: ['胃痛', '胃疼', '胃不舒服', '胃胀', '反酸', '烧心'],
        combinations: {
            '饭后加重|吃饱后': { cause: '可能为消化不良或胃炎', department: '消化内科', treatment: '建议少食多餐', medicine: '可服用健胃消食片' },
            '反酸|烧心': { cause: '可能为胃食管反流病', department: '消化内科', treatment: '建议饭后不要立即躺下', medicine: '可服用质子泵抑制剂' },
            '恶心|呕吐': { cause: '可能为急性胃炎', department: '消化内科', treatment: '建议暂时禁食或清淡饮食', medicine: '可服用胃黏膜保护剂' },
            '黑便|大便发黑': { cause: '可能为上消化道出血', department: '消化内科', treatment: '建议立即就医', medicine: '根据检查结果治疗' },
            '腹泻|拉肚子': { cause: '可能为肠胃炎', department: '消化内科', treatment: '建议多喝水防止脱水', medicine: '可服用止泻药' }
        },
        default: { cause: '胃痛原因多样，可能与饮食不当、胃部疾病等有关', department: '消化内科', treatment: '建议注意饮食规律，避免生冷辛辣', medicine: '可服用胃药缓解' }
    },
    '腹痛': {
        keywords: ['腹痛', '肚子痛', '肚子疼', '腹部不适'],
        combinations: {
            '腹泻|拉肚子': { cause: '可能为肠道感染', department: '消化内科', treatment: '建议多喝水', medicine: '可服用止泻药' },
            '便秘|大便不通': { cause: '可能为肠梗阻或便秘', department: '消化内科', treatment: '建议多吃膳食纤维', medicine: '可服用通便药' },
            '发烧|发热': { cause: '可能为阑尾炎或胆囊炎', department: '普外科', treatment: '建议立即就医', medicine: '可能需要手术' },
            '恶心|呕吐': { cause: '可能为食物中毒', department: '消化内科', treatment: '建议补充水分', medicine: '可服用止吐药' },
            '月经|经期': { cause: '可能为痛经', department: '妇科', treatment: '建议热敷', medicine: '可服用止痛药' }
        },
        default: { cause: '腹痛原因复杂，涉及多个器官', department: '消化内科', treatment: '建议观察症状变化', medicine: '剧烈疼痛请立即就医' }
    },
    '关节痛': {
        keywords: ['关节痛', '膝盖痛', '腰痛', '肩痛', '颈椎痛', '腿疼'],
        combinations: {
            '肿胀|红肿': { cause: '可能为关节炎或痛风', department: '骨科', treatment: '建议休息，避免负重', medicine: '可服用抗炎药' },
            '僵硬|活动受限': { cause: '可能为类风湿关节炎', department: '风湿免疫科', treatment: '建议进行适当锻炼', medicine: '根据病情用药' },
            '外伤|摔伤': { cause: '可能为软组织损伤或骨折', department: '骨科', treatment: '建议冷敷', medicine: '可外用止痛药膏' },
            '晨僵|早晨僵硬': { cause: '可能为类风湿关节炎', department: '风湿免疫科', treatment: '建议早晨进行伸展运动', medicine: '遵医嘱用药' },
            '天气变化|阴雨天': { cause: '可能为风湿性关节炎', department: '风湿免疫科', treatment: '注意保暖', medicine: '可服用祛风除湿药' }
        },
        default: { cause: '关节痛可能与劳损、炎症、外伤等有关', department: '骨科', treatment: '建议适当休息，避免过度运动', medicine: '可外用或口服止痛药' }
    },
    '疲劳': {
        keywords: ['疲劳', '乏力', '没力气', '疲倦', '精神不振'],
        combinations: {
            '失眠|睡不好': { cause: '可能为睡眠不足', department: '神经内科', treatment: '建议规律作息', medicine: '可服用助眠药' },
            '头晕|头昏': { cause: '可能为贫血', department: '血液科', treatment: '建议多吃含铁食物', medicine: '可服用铁剂' },
            '食欲不振': { cause: '可能为甲减或抑郁症', department: '内分泌科', treatment: '建议保持均衡饮食', medicine: '根据诊断用药' },
            '肌肉酸痛': { cause: '可能为过度运动或感染', department: '全科', treatment: '建议适当休息', medicine: '可服用止痛药' },
            '发烧|发热': { cause: '可能为病毒感染', department: '感染科', treatment: '建议休息多喝水', medicine: '对症治疗' }
        },
        default: { cause: '疲劳可能与睡眠、压力、营养等多种因素有关', department: '全科', treatment: '建议保证充足睡眠，合理饮食', medicine: '无需用药，调整生活方式' }
    },
    '失眠': {
        keywords: ['失眠', '睡不着', '睡不好', '多梦', '易醒'],
        combinations: {
            '头痛|头晕': { cause: '可能为神经衰弱', department: '神经内科', treatment: '建议放松心情', medicine: '可服用助眠药' },
            '焦虑|烦躁': { cause: '可能为焦虑症', department: '心理科', treatment: '建议进行心理疏导', medicine: '可服用抗焦虑药' },
            '心悸|心慌': { cause: '可能为心脏问题或焦虑', department: '心内科', treatment: '建议睡前放松', medicine: '根据诊断用药' },
            '疲劳|乏力': { cause: '可能为睡眠障碍', department: '神经内科', treatment: '建议建立规律作息', medicine: '可服用助眠药' },
            '压力大|工作忙': { cause: '可能为压力导致', department: '心理科', treatment: '建议学会减压', medicine: '可短期使用助眠药' }
        },
        default: { cause: '失眠可能与心理压力、生活习惯等有关', department: '神经内科', treatment: '建议睡前避免使用电子设备，保持卧室安静', medicine: '可服用助眠药' }
    },
    '皮肤问题': {
        keywords: ['皮肤痒', '皮疹', '痘痘', '湿疹', '过敏', '荨麻疹'],
        combinations: {
            '红肿|发炎': { cause: '可能为过敏性皮炎', department: '皮肤科', treatment: '建议避免接触过敏原', medicine: '可服用抗过敏药' },
            '水泡|流脓': { cause: '可能为感染', department: '皮肤科', treatment: '建议保持清洁', medicine: '可外用抗生素软膏' },
            '脱皮|干燥': { cause: '可能为湿疹或皮炎', department: '皮肤科', treatment: '建议保湿', medicine: '可外用激素药膏' },
            '瘙痒|抓痕': { cause: '可能为荨麻疹或虫咬', department: '皮肤科', treatment: '建议避免抓挠', medicine: '可外用止痒药膏' },
            '日晒|紫外线': { cause: '可能为晒伤', department: '皮肤科', treatment: '建议冷敷', medicine: '可外用晒伤药膏' }
        },
        default: { cause: '皮肤问题可能与过敏、感染、环境等有关', department: '皮肤科', treatment: '建议保持皮肤清洁', medicine: '根据具体症状用药' }
    },
    '喉咙痛': {
        keywords: ['喉咙痛', '咽喉痛', '嗓子疼', '吞咽困难'],
        combinations: {
            '发烧|发热': { cause: '可能为扁桃体炎', department: '耳鼻喉科', treatment: '建议多喝水', medicine: '可服用抗生素' },
            '咳嗽|咳痰': { cause: '可能为咽喉炎', department: '耳鼻喉科', treatment: '建议避免说话过多', medicine: '可含服润喉糖' },
            '声音嘶哑': { cause: '可能为声带发炎', department: '耳鼻喉科', treatment: '建议噤声休息', medicine: '可雾化治疗' },
            '鼻塞|流鼻涕': { cause: '可能为感冒', department: '呼吸内科', treatment: '建议休息', medicine: '可服用感冒药' },
            '呼吸困难|喘不上气': { cause: '可能为严重感染或过敏', department: '急诊科', treatment: '建议立即就医', medicine: '根据诊断治疗' }
        },
        default: { cause: '喉咙痛多由感染或刺激引起', department: '耳鼻喉科', treatment: '建议多喝水、避免辛辣食物', medicine: '可含服润喉糖或服用止痛药' }
    },
    '腹泻': {
        keywords: ['腹泻', '拉肚子', '拉稀', '水样便'],
        combinations: {
            '发烧|发热': { cause: '可能为细菌感染', department: '消化内科', treatment: '建议多喝水', medicine: '可服用抗生素和止泻药' },
            '腹痛|肚子痛': { cause: '可能为肠胃炎', department: '消化内科', treatment: '建议清淡饮食', medicine: '可服用止泻药' },
            '恶心|呕吐': { cause: '可能为食物中毒', department: '消化内科', treatment: '建议补充水分', medicine: '可服用止吐止泻药' },
            '脱水|口干': { cause: '可能为严重腹泻', department: '急诊科', treatment: '建议立即就医补液', medicine: '静脉输液' },
            '血便|黏液便': { cause: '可能为肠道感染或炎症', department: '消化内科', treatment: '建议就医检查', medicine: '根据诊断治疗' }
        },
        default: { cause: '腹泻多由感染、饮食不当等引起', department: '消化内科', treatment: '建议多喝水防止脱水', medicine: '可服用止泻药' }
    },
    '便秘': {
        keywords: ['便秘', '大便不通', '排便困难'],
        combinations: {
            '腹胀|腹痛': { cause: '可能为肠梗阻', department: '消化内科', treatment: '建议立即就医', medicine: '可能需要灌肠' },
            '便血|黑便': { cause: '可能为痔疮或肠道疾病', department: '消化内科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '食欲不振': { cause: '可能为消化不良', department: '消化内科', treatment: '建议多吃膳食纤维', medicine: '可服用益生菌' },
            '体重下降': { cause: '可能为肠道疾病', department: '消化内科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '长期|慢性': { cause: '可能为慢性便秘', department: '消化内科', treatment: '建议建立规律排便', medicine: '可服用通便药' }
        },
        default: { cause: '便秘多与饮食、运动、习惯等有关', department: '消化内科', treatment: '建议多吃蔬菜水果、多喝水、适当运动', medicine: '可服用通便药' }
    },
    '胸闷': {
        keywords: ['胸闷', '胸口闷', '憋气', '喘不上气'],
        combinations: {
            '心慌|心悸': { cause: '可能为心脏问题', department: '心内科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '咳嗽|咳痰': { cause: '可能为哮喘或肺炎', department: '呼吸内科', treatment: '建议吸氧', medicine: '可使用吸入剂' },
            '胸痛|压榨感': { cause: '可能为心绞痛', department: '心内科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '焦虑|紧张': { cause: '可能为焦虑症', department: '心理科', treatment: '建议放松心情', medicine: '可服用抗焦虑药' },
            '活动后加重': { cause: '可能为心功能不全', department: '心内科', treatment: '建议减少活动', medicine: '根据诊断治疗' }
        },
        default: { cause: '胸闷可能涉及心脏、肺部等多个器官', department: '心内科', treatment: '建议立即就医检查', medicine: '根据诊断治疗' }
    },
    '头晕': {
        keywords: ['头晕', '头昏', '眩晕', '天旋地转'],
        combinations: {
            '头痛|头疼': { cause: '可能为偏头痛', department: '神经内科', treatment: '建议休息', medicine: '可服用止痛药' },
            '恶心|呕吐': { cause: '可能为内耳问题', department: '耳鼻喉科', treatment: '建议避免快速转头', medicine: '根据诊断用药' },
            '视力模糊': { cause: '可能为眼部问题或高血压', department: '眼科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '耳鸣|听力下降': { cause: '可能为内耳问题', department: '耳鼻喉科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '站立时加重': { cause: '可能为体位性低血压', department: '心内科', treatment: '建议缓慢站起', medicine: '无需特殊用药' }
        },
        default: { cause: '头晕原因复杂，可能与内耳、神经、血压等有关', department: '神经内科', treatment: '建议坐下休息，避免摔倒', medicine: '根据诊断治疗' }
    },
    '呼吸困难': {
        keywords: ['呼吸困难', '喘不上气', '气短', '窒息感'],
        combinations: {
            '咳嗽|咳痰': { cause: '可能为哮喘或肺炎', department: '呼吸内科', treatment: '建议吸氧', medicine: '可使用吸入剂' },
            '胸闷|胸痛': { cause: '可能为心脏问题', department: '急诊科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '喉咙发紧': { cause: '可能为过敏或哮喘', department: '急诊科', treatment: '建议使用急救药物', medicine: '肾上腺素或吸入剂' },
            '发烧|发热': { cause: '可能为严重感染', department: '急诊科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '平躺时加重': { cause: '可能为心功能不全', department: '心内科', treatment: '建议半卧位', medicine: '根据诊断治疗' }
        },
        default: { cause: '呼吸困难是紧急症状，可能危及生命', department: '急诊科', treatment: '建议立即拨打急救电话', medicine: '根据诊断治疗' }
    },
    '高血压': {
        keywords: ['高血压', '血压高', '头晕', '头痛'],
        combinations: {
            '头痛|头晕': { cause: '血压升高引起', department: '心内科', treatment: '建议安静休息', medicine: '按时服用降压药' },
            '心悸|心慌': { cause: '血压波动', department: '心内科', treatment: '建议监测血压', medicine: '调整降压药' },
            '视力模糊': { cause: '高血压并发症', department: '眼科', treatment: '建议立即就医', medicine: '控制血压' },
            '手脚麻木': { cause: '可能为高血压引起的神经病变', department: '神经内科', treatment: '建议控制血压', medicine: '营养神经药物' },
            '胸闷|胸痛': { cause: '可能为高血压心脏病', department: '心内科', treatment: '建议立即就医', medicine: '根据诊断治疗' }
        },
        default: { cause: '高血压是常见慢性病，需长期管理', department: '心内科', treatment: '建议低盐饮食、规律运动', medicine: '按时服用降压药' }
    },
    '糖尿病': {
        keywords: ['糖尿病', '血糖高', '多饮', '多食', '多尿', '体重下降'],
        combinations: {
            '口渴|多饮': { cause: '血糖控制不佳', department: '内分泌科', treatment: '建议多喝水', medicine: '调整降糖药' },
            '视力模糊': { cause: '糖尿病视网膜病变', department: '眼科', treatment: '建议定期检查', medicine: '控制血糖' },
            '手脚麻木': { cause: '糖尿病神经病变', department: '内分泌科', treatment: '建议控制血糖', medicine: '营养神经药物' },
            '伤口不愈合': { cause: '糖尿病并发症', department: '内分泌科', treatment: '建议保持伤口清洁', medicine: '控制血糖' },
            '疲劳|乏力': { cause: '血糖控制不佳', department: '内分泌科', treatment: '建议规律作息', medicine: '调整降糖药' }
        },
        default: { cause: '糖尿病是代谢性疾病，需长期管理', department: '内分泌科', treatment: '建议控制饮食、规律运动', medicine: '按时服用降糖药或注射胰岛素' }
    },
    '打嗝': {
        keywords: ['打嗝', '打饱嗝', '嗳气', '呃逆', '不停打嗝'],
        combinations: {
            '饭后加重|吃饱后': { cause: '可能为饮食过快、过饱或消化不良', department: '消化内科', treatment: '建议细嚼慢咽，少食多餐', medicine: '可服用促胃动力药' },
            '反酸|烧心': { cause: '可能为胃食管反流病', department: '消化内科', treatment: '建议饭后不要立即躺下', medicine: '可服用质子泵抑制剂' },
            '腹胀|胃胀': { cause: '可能为胃肠胀气', department: '消化内科', treatment: '建议适当运动', medicine: '可服用助消化药' },
            '持续性|不停': { cause: '可能为顽固性呃逆', department: '神经内科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '饮酒后': { cause: '酒精刺激', department: '消化内科', treatment: '建议多喝水', medicine: '无需特殊用药' }
        },
        default: { cause: '打嗝通常是生理现象，由膈肌痉挛引起', department: '消化内科', treatment: '建议深呼吸、喝水弯腰法', medicine: '频繁打嗝可就医' }
    },
    '嗳气': {
        keywords: ['嗳气', '打嗝', '胃胀气', '反酸'],
        combinations: {
            '饭后加重': { cause: '饮食不当或消化不良', department: '消化内科', treatment: '建议少食多餐', medicine: '可服用促胃动力药' },
            '反酸|烧心': { cause: '胃食管反流', department: '消化内科', treatment: '建议床头抬高', medicine: '可服用质子泵抑制剂' },
            '腹胀|腹痛': { cause: '胃肠功能紊乱', department: '消化内科', treatment: '建议清淡饮食', medicine: '可服用益生菌' },
            '食欲不振': { cause: '胃炎或消化不良', department: '消化内科', treatment: '建议规律饮食', medicine: '可服用健胃消食片' },
            '口苦|口臭': { cause: '胃食管反流或口腔问题', department: '消化内科', treatment: '建议保持口腔卫生', medicine: '治疗原发病' }
        },
        default: { cause: '嗳气多由胃内气体过多引起', department: '消化内科', treatment: '建议避免碳酸饮料、豆类等产气食物', medicine: '可服用助消化药' }
    },
    '反酸': {
        keywords: ['反酸', '烧心', '胃酸', '胃灼热'],
        combinations: {
            '饭后加重': { cause: '胃食管反流病', department: '消化内科', treatment: '建议饭后散步', medicine: '可服用质子泵抑制剂' },
            '胸骨后疼痛': { cause: '严重反流或食管炎', department: '消化内科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '吞咽困难': { cause: '食管炎或食管狭窄', department: '消化内科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '口苦|口臭': { cause: '反流到口腔', department: '消化内科', treatment: '建议睡前3小时不进食', medicine: '可服用抗酸药' },
            '长期|慢性': { cause: '慢性胃食管反流', department: '消化内科', treatment: '建议调整生活方式', medicine: '长期服用抑酸药' }
        },
        default: { cause: '反酸是胃酸反流到食管引起', department: '消化内科', treatment: '建议避免辛辣、油腻食物，饭后不立即躺下', medicine: '可服用抗酸药' }
    },
    '腰痛': {
        keywords: ['腰痛', '腰酸', '腰间盘', '腰肌劳损'],
        combinations: {
            '劳累后加重': { cause: '腰肌劳损', department: '骨科', treatment: '建议休息', medicine: '可外用止痛药膏' },
            '腿部麻木|放射痛': { cause: '腰椎间盘突出', department: '骨科', treatment: '建议卧床休息', medicine: '根据病情治疗' },
            '活动受限': { cause: '腰椎问题', department: '骨科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '晨僵|僵硬': { cause: '强直性脊柱炎', department: '风湿免疫科', treatment: '建议适当锻炼', medicine: '根据诊断用药' },
            '外伤|摔伤': { cause: '软组织损伤或骨折', department: '骨科', treatment: '建议冷敷', medicine: '外用止痛药膏' }
        },
        default: { cause: '腰痛多与劳损、外伤、腰椎问题有关', department: '骨科', treatment: '建议避免久坐久站，适当锻炼', medicine: '可外用止痛药膏' }
    },
    '视力问题': {
        keywords: ['视力模糊', '看不清', '眼睛干涩', '眼疲劳'],
        combinations: {
            '眼干涩|眼疲劳': { cause: '干眼症或视疲劳', department: '眼科', treatment: '建议多休息', medicine: '可使用人工泪液' },
            '视力下降': { cause: '近视加深或眼部疾病', department: '眼科', treatment: '建议验光检查', medicine: '根据诊断治疗' },
            '眼痛|头痛': { cause: '青光眼或眼压高', department: '眼科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '飞蚊症|黑影': { cause: '玻璃体混浊', department: '眼科', treatment: '建议定期检查', medicine: '根据诊断治疗' },
            '畏光|怕光': { cause: '结膜炎或角膜炎', department: '眼科', treatment: '建议避光', medicine: '根据诊断用药' }
        },
        default: { cause: '视力问题原因多样，需专业检查', department: '眼科', treatment: '建议定期检查视力', medicine: '根据诊断治疗' }
    },
    '耳鸣': {
        keywords: ['耳鸣', '耳朵响', '耳闷', '听力下降'],
        combinations: {
            '听力下降': { cause: '内耳问题或噪音损伤', department: '耳鼻喉科', treatment: '建议避免噪音', medicine: '根据诊断治疗' },
            '头晕|眩晕': { cause: '梅尼埃病', department: '耳鼻喉科', treatment: '建议休息', medicine: '根据诊断用药' },
            '耳痛|耳朵疼': { cause: '中耳炎', department: '耳鼻喉科', treatment: '建议就医检查', medicine: '可服用抗生素' },
            '压力大|焦虑': { cause: '神经性耳鸣', department: '耳鼻喉科', treatment: '建议放松心情', medicine: '根据诊断用药' },
            '长期|慢性': { cause: '慢性耳鸣', department: '耳鼻喉科', treatment: '建议习服治疗', medicine: '根据诊断用药' }
        },
        default: { cause: '耳鸣可能与噪音、压力、耳部疾病等有关', department: '耳鼻喉科', treatment: '建议避免噪音环境', medicine: '根据诊断治疗' }
    },
    '口干': {
        keywords: ['口干', '口渴', '口腔干燥'],
        combinations: {
            '多饮|多尿': { cause: '糖尿病', department: '内分泌科', treatment: '建议控制血糖', medicine: '降糖药' },
            '眼干|皮肤干': { cause: '干燥综合征', department: '风湿免疫科', treatment: '建议保湿', medicine: '根据诊断用药' },
            '服药后': { cause: '药物副作用', department: '全科', treatment: '建议多喝水', medicine: '咨询医生调整药物' },
            '鼻塞|用口呼吸': { cause: '鼻腔问题', department: '耳鼻喉科', treatment: '治疗鼻塞', medicine: '根据诊断用药' },
            '长期|慢性': { cause: '可能为多种原因', department: '全科', treatment: '建议就医检查', medicine: '根据诊断治疗' }
        },
        default: { cause: '口干多由饮水不足、药物、疾病等引起', department: '全科', treatment: '建议多喝水', medicine: '持续口干请就医' }
    },
    '尿频尿急': {
        keywords: ['尿频', '尿急', '尿不尽', '夜尿多'],
        combinations: {
            '尿痛|尿灼热': { cause: '尿路感染', department: '泌尿外科', treatment: '建议多喝水', medicine: '可服用抗生素' },
            '尿不尽': { cause: '前列腺问题或尿路感染', department: '泌尿外科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '夜尿多': { cause: '前列腺问题或糖尿病', department: '泌尿外科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '血尿': { cause: '泌尿系统问题', department: '泌尿外科', treatment: '建议立即就医', medicine: '根据诊断治疗' },
            '腰痛|小腹坠胀': { cause: '肾盂肾炎或结石', department: '泌尿外科', treatment: '建议立即就医', medicine: '根据诊断治疗' }
        },
        default: { cause: '尿频尿急多由感染、前列腺问题等引起', department: '泌尿外科', treatment: '建议多喝水', medicine: '持续症状请就医' }
    },
    '月经不调': {
        keywords: ['月经不调', '月经推迟', '月经提前', '月经量少', '月经量多'],
        combinations: {
            '痛经|腹痛': { cause: '原发性或继发性痛经', department: '妇科', treatment: '建议热敷', medicine: '可服用止痛药' },
            '周期不规律': { cause: '内分泌失调', department: '妇科', treatment: '建议规律作息', medicine: '根据诊断用药' },
            '闭经|不来月经': { cause: '多种原因', department: '妇科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '经量过多': { cause: '子宫肌瘤或内分泌问题', department: '妇科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '经期延长': { cause: '子宫问题', department: '妇科', treatment: '建议就医检查', medicine: '根据诊断治疗' }
        },
        default: { cause: '月经不调多与内分泌、妇科疾病等有关', department: '妇科', treatment: '建议保持规律作息', medicine: '持续不调请就医' }
    },
    '脱发': {
        keywords: ['脱发', '掉头发', '发际线后移', '斑秃'],
        combinations: {
            '压力大|焦虑': { cause: '精神压力导致', department: '皮肤科', treatment: '建议放松心情', medicine: '可外用生发药' },
            '头皮痒|头屑多': { cause: '脂溢性皮炎', department: '皮肤科', treatment: '建议保持头皮清洁', medicine: '根据诊断用药' },
            '成片脱落': { cause: '斑秃', department: '皮肤科', treatment: '建议就医检查', medicine: '根据诊断治疗' },
            '产后|孕期': { cause: '激素变化', department: '皮肤科', treatment: '建议补充营养', medicine: '无需特殊用药' },
            '长期|渐进性': { cause: '雄激素性脱发', department: '皮肤科', treatment: '建议早期干预', medicine: '可外用生发药' }
        },
        default: { cause: '脱发与遗传、压力、营养等多种因素有关', department: '皮肤科', treatment: '建议均衡饮食、规律作息', medicine: '严重脱发请就医' }
    }
};

// 分析症状
function analyzeSymptoms(symptoms) {
    let bestMatch = null;
    let matchScore = 0;
    let matchedCategory = '';
    let matchedKeywords = [];

    for (const [category, data] of Object.entries(symptomDatabase)) {
        const matched = [];
        let score = 0;

        for (const keyword of data.keywords) {
            if (symptoms.includes(keyword)) {
                matched.push(keyword);
                score += 10;
            }
        }

        if (matched.length > 0) {
            for (const [comboKeywords, result] of Object.entries(data.combinations)) {
                const comboList = comboKeywords.split('|');
                let comboMatched = 0;
                
                for (const combo of comboList) {
                    if (symptoms.includes(combo)) {
                        comboMatched++;
                    }
                }

                if (comboMatched >= comboList.length) {
                    score += 20;
                    if (score > matchScore) {
                        bestMatch = result;
                        matchCategory = category;
                        matchScore = score;
                        matched = true;
                        matchedKeywords = [...matched, ...comboList];
                    }
                }
            }

            if (!bestMatch && matched.length >= 1) {
                score += matched.length * 5;
                if (score > matchScore) {
                    bestMatch = data.default;
                    matchedCategory = category;
                    matchScore = score;
                    matchedKeywords = matched;
                }
            }
        }
    }

    if (bestMatch) {
        return {
            success: true,
            category: matchedCategory,
            matchedKeywords: matchedKeywords,
            analysis: bestMatch,
            confidence: Math.min(Math.round(matchScore / 3), 100)
        };
    }

    return {
        success: false,
        message: '未找到匹配的症状，请尝试用不同的词语描述您的症状，或咨询专业医生。'
    };
}

// DOM 加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    initData();

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

// 仪表盘相关函数
function logout() {
    clearCurrentUser();
    window.location.href = 'index.html';
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
}

async function saveHealthData(event) {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const data = {
        userId: user.id,
        temp: parseFloat(document.getElementById('temp').value) || null,
        bloodPressure: document.getElementById('bloodPressure').value,
        heartRate: parseInt(document.getElementById('heartRate').value) || null,
        bloodSugar: parseFloat(document.getElementById('bloodSugar').value) || null,
        cholesterol: parseFloat(document.getElementById('cholesterol').value) || null,
        oxygen: parseInt(document.getElementById('oxygen').value) || null
    };

    try {
        await apiRequest('/api/health-records', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        alert('健康数据保存成功');
        event.target.reset();
        loadHealthRecords();
    } catch (error) {
        alert(error.message);
    }
}

async function loadHealthRecords() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const records = await apiRequest(`/api/health-records?userId=${user.id}`);
        const table = document.getElementById('healthRecordsTable');
        if (table) {
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = records.map(r => `
                <tr>
                    <td>${new Date(r.created_at).toLocaleString()}</td>
                    <td>${r.temp || '-'}</td>
                    <td>${r.blood_pressure || '-'}</td>
                    <td>${r.heart_rate || '-'}</td>
                    <td>${r.blood_sugar || '-'}</td>
                    <td>${r.cholesterol || '-'}</td>
                    <td>${r.oxygen || '-'}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error(error);
    }
}

async function submitConsultation(event) {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const symptoms = document.getElementById('symptoms').value;
    const duration = document.getElementById('duration').value;
    const otherSymptoms = document.getElementById('otherSymptoms').value;

    const analysis = analyzeSymptoms(symptoms + otherSymptoms);
    
    document.getElementById('consultationAnalysis').innerHTML = analysis.success ? `
        <div class="result-box">
            <h3>病情分析结果</h3>
            <p><strong>匹配症状:</strong> ${analysis.matchedKeywords.join(', ')}</p>
            <p><strong>匹配度:</strong> ${analysis.confidence}%</p>
            <p><strong>可能病因:</strong> ${analysis.analysis.cause}</p>
            <p><strong>建议科室:</strong> ${analysis.analysis.department}</p>
            <p><strong>处理建议:</strong> ${analysis.analysis.treatment}</p>
            <p><strong>推荐用药:</strong> ${analysis.analysis.medicine}</p>
        </div>
    ` : `<p>${analysis.message}</p>`;

    if (analysis.success) {
        try {
            await apiRequest('/api/consultations', {
                method: 'POST',
                body: JSON.stringify({
                    userId: user.id,
                    symptoms,
                    duration,
                    otherSymptoms,
                    analysis: analysis.analysis
                })
            });
        } catch (error) {
            console.error(error);
        }
    }
}

async function loadConsultations() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const consultations = await apiRequest(`/api/consultations?userId=${user.id}`);
        const table = document.getElementById('consultationsTable');
        if (table) {
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = consultations.map(c => {
                const analysis = JSON.parse(c.analysis_json || '{}');
                return `
                    <tr>
                        <td>${new Date(c.created_at).toLocaleString()}</td>
                        <td>${c.symptoms}</td>
                        <td>${c.duration || '-'}</td>
                        <td>${analysis.department || '-'}</td>
                        <td>${analysis.cause || '-'}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error(error);
    }
}

async function saveProfile(event) {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const data = {
        userId: user.id,
        name: document.getElementById('profileName').value,
        gender: document.getElementById('profileGender').value,
        age: parseInt(document.getElementById('profileAge').value) || 0,
        height: parseInt(document.getElementById('profileHeight').value) || 0,
        weight: parseInt(document.getElementById('profileWeight').value) || 0,
        phone: document.getElementById('profilePhone').value
    };

    try {
        await apiRequest(`/api/profiles/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        alert('资料保存成功');
    } catch (error) {
        alert(error.message);
    }
}

// 管理员面板函数
function loadAdminPanel() {
    loadUsersTable();
    loadHealthDataTable();
    loadConsultationsTable();
}

function showAdminSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
}

async function loadUsersTable() {
    try {
        const users = await apiRequest('/api/users');
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn edit" onclick="editUser(${user.id})">编辑</button>
                    <button class="action-btn delete" onclick="deleteUser(${user.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function loadHealthDataTable() {
    try {
        const records = await apiRequest('/api/health-records');
        const tbody = document.querySelector('#healthDataTable tbody');
        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${r.user_id}</td>
                <td>${new Date(r.created_at).toLocaleString()}</td>
                <td>${r.temp || '-'}</td>
                <td>${r.blood_pressure || '-'}</td>
                <td>${r.heart_rate || '-'}</td>
                <td>${r.blood_sugar || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function loadConsultationsTable() {
    try {
        const consultations = await apiRequest('/api/consultations');
        const tbody = document.querySelector('#consultationsAdminTable tbody');
        tbody.innerHTML = consultations.map(c => {
            const analysis = JSON.parse(c.analysis_json || '{}');
            return `
                <tr>
                    <td>${c.user_id}</td>
                    <td>${new Date(c.created_at).toLocaleString()}</td>
                    <td>${c.symptoms}</td>
                    <td>${c.duration || '-'}</td>
                    <td>${analysis.department || '-'}</td>
                    <td>${analysis.cause || '-'}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
    }
}

function editUser(userId) {
    alert(`编辑用户 ID: ${userId}`);
}

function deleteUser(userId) {
    if (confirm('确定要删除该用户吗？')) {
        alert(`用户 ID ${userId} 已删除`);
        loadUsersTable();
    }
}

function exportData() {
    alert('数据导出功能已触发');
}