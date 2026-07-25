// 全局变量
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

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

async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, { ...options, headers });
    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || '请求失败');
    }

    return data;
}

// 初始化数据
async function initData() {
    try {
        await apiRequest('/api/health');
    } catch (error) {
        console.warn(error.message);
    }
}

// 登录页面功能
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

document.addEventListener('DOMContentLoaded', function() {
    initData();
    
    // 登录表单提交
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
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
        });
    }
    
    // 注册表单提交
    if (document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }
            
            try {
                await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });
                alert('注册成功，请登录');
                showTab('login');
            } catch (error) {
                alert(error.message);
            }
        });
    }
    
    // 仪表盘页面功能
    if (window.location.pathname.includes('dashboard.html')) {
        loadDashboard();
    }
    
    // 管理员页面功能
    if (window.location.pathname.includes('admin.html')) {
        loadAdminPanel();
    }
});

// 仪表盘功能
function loadDashboard() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('welcomeText').textContent = '欢迎, ' + currentUser.username;
    
    async function loadProfile() {
        try {
            const profile = await apiRequest(`/api/profiles/${currentUser.id}`);
            document.getElementById('profileName').value = profile.name || '';
            document.getElementById('profileGender').value = profile.gender || '';
            document.getElementById('profileAge').value = profile.age || '';
            document.getElementById('profileHeight').value = profile.height || '';
            document.getElementById('profileWeight').value = profile.weight || '';
            document.getElementById('profilePhone').value = profile.phone || '';
        } catch (error) {
            console.warn(error.message);
        }
    }
    
    // 加载个人资料
    loadProfile();
    
    // 保存个人资料
    document.getElementById('profileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            await apiRequest(`/api/profiles/${currentUser.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: document.getElementById('profileName').value,
                    gender: document.getElementById('profileGender').value,
                    age: document.getElementById('profileAge').value,
                    height: document.getElementById('profileHeight').value,
                    weight: document.getElementById('profileWeight').value,
                    phone: document.getElementById('profilePhone').value
                })
            });
            alert('资料保存成功');
        } catch (error) {
            alert(error.message);
        }
    });
    
    // 提交健康数据
    document.getElementById('healthForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const healthData = {
            temp: parseFloat(document.getElementById('healthTemp').value),
            bloodPressure: document.getElementById('healthBloodPressure').value,
            heartRate: parseInt(document.getElementById('healthHeartRate').value),
            bloodSugar: parseFloat(document.getElementById('healthBloodSugar').value),
            cholesterol: parseFloat(document.getElementById('healthCholesterol').value),
            oxygen: parseInt(document.getElementById('healthOxygen').value)
        };
        
        try {
            await apiRequest('/api/health-records', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser.id,
                    ...healthData
                })
            });
            analyzeHealthData({
                ...healthData,
                date: new Date().toLocaleString()
            });
            await loadHealthHistory();
        } catch (error) {
            alert(error.message);
        }
    });
    
    // 提交咨询 - AI优先模式
    document.getElementById('consultationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const consultation = {
            symptoms: document.getElementById('consultSymptoms').value,
            duration: document.getElementById('consultDuration').value,
            otherSymptoms: document.getElementById('consultOtherSymptoms').value,
            date: new Date().toLocaleString()
        };
        
        document.getElementById('consultationResult').style.display = 'block';
        document.getElementById('consultationAnalysis').innerHTML = '<p class="loading-text">🔍 正在分析您的症状，请稍候...</p>';
        
        const analysis = analyzeConsultation(consultation);
        consultation.analysis = analysis;
        
        try {
            await apiRequest('/api/consultations', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser.id,
                    symptoms: consultation.symptoms,
                    duration: consultation.duration,
                    otherSymptoms: consultation.otherSymptoms,
                    analysis: consultation.analysis
                })
            });
            document.getElementById('consultationResult').style.display = 'block';
            document.getElementById('consultationAnalysis').innerHTML = formatConsultationResult(analysis);
            await loadConsultHistory();
        } catch (error) {
            alert(error.message);
        }
    });
    
    // 整合本地分析和AI网站分析结果
    function mergeAnalysisResults(local, online, symptoms) {
        const query = symptoms || (local && local.matchedKeywords ? local.matchedKeywords.join(' ') : '症状');
        
        // 如果网络搜索有有效结果，优先使用网络分析结果
        if (online && online.possibleCause && online.possibleCause.trim() && 
            !online.possibleCause.includes('无法准确判断') && 
            !online.possibleCause.includes('正在通过网络搜索')) {
            // 确保有AI医疗网站链接
            const result = {
                possibleCause: online.possibleCause,
                department: online.department || local?.department || '建议挂全科或普通内科',
                treatment: online.treatment || local?.treatment || '建议尽快就医',
                medicine: online.medicine || local?.medicine || '请遵医嘱用药',
                searched: true,
                searchedFrom: online.searchedFrom || 'AI医疗平台',
                confidence: online.confidence || local?.confidence || 0,
                matchedKeywords: local?.matchedKeywords || [],
                references: online.references || [],
                hasAISuggestions: true
            };
            // 确保有AI医疗网站链接
            if (!result.references || result.references.length === 0) {
                addAIMedicalLinks(result, query);
            }
            return result;
        }
        
        // 如果本地分析有结果，使用本地结果并添加AI网站链接
        if (local && local.possibleCause && local.possibleCause.trim() && !local.searched) {
            const result = {
                ...local,
                searched: true,
                searchedFrom: '本地数据库 + AI医疗平台',
                hasAISuggestions: true,
                references: []
            };
            // 添加AI医疗网站链接
            addAIMedicalLinks(result, query);
            return result;
        }
        
        // 如果AI网站有部分结果（即使不完全匹配），使用它
        if (online && online.possibleCause && online.possibleCause.trim()) {
            const result = {
                possibleCause: online.possibleCause,
                department: online.department || '建议挂全科或普通内科',
                treatment: online.treatment || '建议详细描述症状，配合医生检查',
                medicine: online.medicine || '请遵医嘱用药',
                searched: true,
                searchedFrom: online.searchedFrom || 'AI医疗平台',
                confidence: online.confidence || 0,
                matchedKeywords: [],
                references: online.references || [],
                hasAISuggestions: true
            };
            if (!result.references || result.references.length === 0) {
                addAIMedicalLinks(result, query);
            }
            return result;
        }
        
        // 如果都没有结果，返回默认结果并确保包含AI医疗网站链接
        const defaultResult = {
            possibleCause: '根据您的症状描述，暂时无法提供准确的诊断分析。建议您访问以下AI医疗网站获取专业健康咨询服务。',
            department: '建议挂全科或普通内科进行初步诊断，由医生根据检查结果确定具体科室',
            treatment: '请详细描述您的症状，配合医生进行体格检查和必要的辅助检查',
            medicine: '请在医生指导下用药，切勿自行用药',
            searched: true,
            searchedFrom: 'AI医疗平台',
            confidence: 0,
            matchedKeywords: [],
            hasAISuggestions: true,
            references: []
        };
        
        // 确保添加AI医疗网站链接
        addAIMedicalLinks(defaultResult, query);
        
        return defaultResult;
    }
    
    // 加载历史记录
    loadHealthHistory();
    loadConsultHistory();
}

function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');
}

function logout() {
    clearCurrentUser();
    window.location.href = 'index.html';
}

// 健康数据分析
function analyzeHealthData(data) {
    const results = [];
    
    // 体温分析
    if (data.temp) {
        let status = 'normal';
        let suggestion = '';
        if (data.temp < 36.0) {
            status = 'abnormal';
            suggestion = '体温偏低，建议注意保暖，适当增加衣物。';
        } else if (data.temp > 37.5) {
            status = 'abnormal';
            suggestion = '体温偏高，可能有发烧症状，建议多喝水，注意休息。';
            if (data.temp > 38.5) {
                suggestion += ' 体温超过38.5°C，建议及时就医。';
            }
        }
        results.push({ item: '体温', value: data.temp + '°C', status, suggestion });
    }
    
    // 血压分析
    if (data.bloodPressure) {
        const parts = data.bloodPressure.split('/');
        if (parts.length === 2) {
            const systolic = parseInt(parts[0]);
            const diastolic = parseInt(parts[1]);
            let status = 'normal';
            let suggestion = '';
            
            if (systolic >= 140 || diastolic >= 90) {
                status = 'abnormal';
                suggestion = '血压偏高，建议减少盐分摄入，适当运动，定期监测。';
            } else if (systolic < 90 || diastolic < 60) {
                status = 'abnormal';
                suggestion = '血压偏低，建议适当增加营养，避免突然站立。';
            }
            results.push({ item: '血压', value: data.bloodPressure + ' mmHg', status, suggestion });
        }
    }
    
    // 心率分析
    if (data.heartRate) {
        let status = 'normal';
        let suggestion = '';
        if (data.heartRate < 60) {
            status = 'abnormal';
            suggestion = '心率偏低，建议咨询医生进行心电图检查。';
        } else if (data.heartRate > 100) {
            status = 'abnormal';
            suggestion = '心率偏高，建议休息后重新测量，持续偏高请就医。';
        }
        results.push({ item: '心率', value: data.heartRate + ' 次/分钟', status, suggestion });
    }
    
    // 血糖分析
    if (data.bloodSugar) {
        let status = 'normal';
        let suggestion = '';
        if (data.bloodSugar > 7.0) {
            status = 'abnormal';
            suggestion = '血糖偏高，建议控制饮食，减少糖分摄入，定期复查。';
        } else if (data.bloodSugar < 3.9) {
            status = 'abnormal';
            suggestion = '血糖偏低，建议及时补充糖分，如糖果、饼干等。';
        }
        results.push({ item: '血糖', value: data.bloodSugar + ' mmol/L', status, suggestion });
    }
    
    // 胆固醇分析
    if (data.cholesterol) {
        let status = 'normal';
        let suggestion = '';
        if (data.cholesterol > 5.2) {
            status = 'abnormal';
            suggestion = '胆固醇偏高，建议减少高脂肪食物摄入，增加运动量。';
        }
        results.push({ item: '胆固醇', value: data.cholesterol + ' mmol/L', status, suggestion });
    }
    
    // 血氧分析
    if (data.oxygen) {
        let status = 'normal';
        let suggestion = '';
        if (data.oxygen < 95) {
            status = 'abnormal';
            suggestion = '血氧饱和度偏低，建议保持通风，必要时吸氧并就医。';
        }
        results.push({ item: '血氧饱和度', value: data.oxygen + '%', status, suggestion });
    }
    
    // 显示结果
    document.getElementById('healthResult').style.display = 'block';
    let html = '';
    results.forEach(result => {
        html += `
            <div class="health-item ${result.status}">
                <h4>${result.item}</h4>
                <span class="value">${result.value}</span>
                ${result.suggestion ? '<p class="suggestion">建议：' + result.suggestion + '</p>' : ''}
            </div>
        `;
    });
    document.getElementById('healthAnalysis').innerHTML = html;
}

// 症状数据库 - 增强版
const symptomDatabase = {
    '头痛': {
        keywords: ['头痛', '头疼', '头胀', '偏头痛', '头痛欲裂', '头部胀痛', '头部刺痛', '持续性头痛', '阵发性头痛'],
        combinations: {
            '发烧|发热|体温高': { cause: '可能为感冒、流感或其他感染引起的症状', department: '内科或急诊科', treatment: '建议休息，多喝水，保持室内通风，监测体温变化', medicine: '可考虑服用布洛芬或对乙酰氨基酚缓解症状' },
            '恶心|呕吐|想吐': { cause: '可能为偏头痛、颅内压增高或前庭功能障碍', department: '神经内科', treatment: '建议避免强光和噪音，保持安静环境，缓慢变换姿势', medicine: '可考虑服用布洛芬或曲坦类药物，遵医嘱' },
            '颈部僵硬|脖子痛|颈椎痛': { cause: '可能为颈椎病、颈椎劳损或紧张性头痛', department: '骨科或康复科', treatment: '建议减少低头时间，适当颈部运动，热敷颈部', medicine: '可考虑服用布洛芬缓解疼痛' },
            '视力模糊|眼痛|眼睛胀痛': { cause: '可能为眼压升高、青光眼或眼部疲劳', department: '眼科', treatment: '建议立即就医检查眼压，避免长时间用眼', medicine: '遵医嘱用药' },
            '鼻塞|流涕|打喷嚏': { cause: '可能为鼻窦炎或过敏性鼻炎引起的头痛', department: '耳鼻喉科', treatment: '建议保持鼻腔通畅，使用生理盐水洗鼻', medicine: '可考虑服用抗过敏药物或鼻用减充血剂' },
            '意识模糊|记忆力下降': { cause: '可能为脑血管问题或颅内病变', department: '神经内科', treatment: '建议立即就医进行脑部检查', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为紧张性头痛、偏头痛或疲劳引起', department: '神经内科', treatment: '建议放松心情，保证充足睡眠，避免精神压力', medicine: '可考虑服用布洛芬缓解疼痛' }
    },
    '头晕': {
        keywords: ['头晕', '眩晕', '头昏', '天旋地转', '头重脚轻', '站立不稳', '眩晕感'],
        combinations: {
            '高血压|血压高|血压升高': { cause: '可能为高血压引起的头晕', department: '心内科', treatment: '建议监测血压，遵医嘱服药，低盐饮食', medicine: '按医嘱服用降压药' },
            '贫血|乏力|面色苍白': { cause: '可能为贫血引起的头晕', department: '血液科', treatment: '建议补充铁质和维生素C，多吃富含铁的食物', medicine: '可服用铁剂，遵医嘱' },
            '耳鸣|听力下降|耳朵闷': { cause: '可能为梅尼埃病或耳石症', department: '耳鼻喉科', treatment: '建议低盐饮食，避免劳累，进行耳石复位', medicine: '遵医嘱用药' },
            '心慌|心悸|心跳快': { cause: '可能为心律失常或低血糖', department: '心内科或内分泌科', treatment: '建议立即休息，补充糖分，监测心率', medicine: '遵医嘱用药' },
            '颈部不适|转头时加重': { cause: '可能为颈椎问题压迫椎动脉', department: '骨科', treatment: '建议避免突然转头，进行颈椎牵引或按摩', medicine: '可考虑服用改善脑部供血的药物' },
            '眼前发黑|站立时发作': { cause: '可能为体位性低血压', department: '内科', treatment: '建议缓慢变换姿势，适当运动增强体质', medicine: '无需特殊用药，注意生活习惯' }
        },
        default: { cause: '可能为短暂性脑缺血、前庭功能障碍或低血糖', department: '神经内科', treatment: '建议缓慢变换姿势，避免突然站起，随身携带糖果', medicine: '遵医嘱用药' }
    },
    '咳嗽': {
        keywords: ['咳嗽', '咳痰', '干咳', '呛咳', '久咳', '夜咳', '剧烈咳嗽'],
        combinations: {
            '发烧|发热|体温高': { cause: '可能为支气管炎、肺炎或上呼吸道感染', department: '呼吸内科', treatment: '建议多喝水，避免吸烟和刺激性气体', medicine: '可考虑服用氨溴索祛痰，必要时使用抗生素' },
            '喘息|气短|呼吸困难': { cause: '可能为哮喘、慢性阻塞性肺病或急性喘息性支气管炎', department: '呼吸内科', treatment: '建议避免过敏原，使用支气管扩张剂', medicine: '遵医嘱使用吸入剂或口服药物' },
            '喉咙痛|咽痛|嗓子疼': { cause: '可能为咽喉炎、扁桃体炎', department: '耳鼻喉科', treatment: '建议多喝水，避免辛辣食物，温盐水漱口', medicine: '可服用润喉糖或清热解毒药物' },
            '胸闷|胸痛': { cause: '可能为胸膜炎、肺炎或心脏问题', department: '呼吸内科或心内科', treatment: '建议及时就医检查，避免剧烈咳嗽', medicine: '遵医嘱用药' },
            '痰中带血|咯血': { cause: '可能为严重肺部感染、结核或肿瘤', department: '呼吸内科', treatment: '建议立即就医，进行胸部CT检查', medicine: '遵医嘱治疗' },
            '流鼻涕|鼻塞': { cause: '可能为普通感冒或过敏性鼻炎', department: '呼吸内科或耳鼻喉科', treatment: '建议多喝水，保持室内湿度', medicine: '可服用抗组胺药或感冒药物' }
        },
        default: { cause: '可能为上呼吸道感染、过敏或环境刺激', department: '呼吸内科', treatment: '建议保持室内湿度，多喝水，避免刺激物', medicine: '可考虑服用右美沙芬止咳' }
    },
    '腹痛': {
        keywords: ['腹痛', '肚子痛', '胃痛', '腹部不适', '肚子疼', '腹部绞痛', '隐痛'],
        combinations: {
            '腹泻|拉肚子|水样便': { cause: '可能为急性肠胃炎、食物中毒或肠道感染', department: '消化内科', treatment: '建议清淡饮食，补充水分和电解质', medicine: '可考虑服用蒙脱石散止泻，益生菌调节肠道' },
            '恶心|呕吐|想吐': { cause: '可能为胃炎、胃溃疡或食物中毒', department: '消化内科', treatment: '建议规律饮食，避免辛辣油腻食物', medicine: '可考虑服用奥美拉唑或胃黏膜保护剂' },
            '便秘|大便干结': { cause: '可能为肠道功能紊乱、肠梗阻或饮食不当', department: '消化内科', treatment: '建议增加膳食纤维摄入，多喝水，适当运动', medicine: '可使用开塞露或乳果糖' },
            '右下腹痛|转移性腹痛': { cause: '可能为阑尾炎、卵巢囊肿扭转或尿路结石', department: '外科', treatment: '建议立即就医，避免延误病情', medicine: '遵医嘱用药或手术治疗' },
            '右上腹痛|恶心油腻': { cause: '可能为胆囊炎、胆结石或肝炎', department: '消化内科', treatment: '建议低脂饮食，避免暴饮暴食', medicine: '遵医嘱用药' },
            '便血|黑便': { cause: '可能为消化道出血、溃疡或肿瘤', department: '消化内科', treatment: '建议立即就医，进行胃镜检查', medicine: '遵医嘱治疗' },
            '月经推迟|停经': { cause: '可能为宫外孕或妇科问题', department: '妇科', treatment: '建议立即就医检查，排除危险情况', medicine: '遵医嘱处理' }
        },
        default: { cause: '可能为肠道功能紊乱、消化不良或腹部着凉', department: '消化内科', treatment: '建议注意饮食规律，腹部保暖', medicine: '可考虑服用益生菌或解痉药' }
    },
    '胸痛': {
        keywords: ['胸痛', '胸闷', '胸口痛', '压榨感', '闷痛', '刺痛', '心绞痛'],
        combinations: {
            '呼吸困难|喘不上气|气短': { cause: '可能为心脏病发作、肺部栓塞或气胸', department: '急诊科', treatment: '建议立即拨打急救电话，保持安静休息', medicine: '遵医嘱用药，如硝酸甘油' },
            '反酸|烧心|嗳气': { cause: '可能为胃食管反流、食管炎', department: '消化内科', treatment: '建议饭后不要立即躺下，避免辛辣食物', medicine: '可考虑服用奥美拉唑或促胃动力药' },
            '咳嗽|咳痰|发烧': { cause: '可能为胸膜炎、肺炎或支气管炎', department: '呼吸内科', treatment: '建议及时就医检查，避免剧烈活动', medicine: '遵医嘱用药' },
            '心悸|心慌|心跳不规律': { cause: '可能为心律失常、心肌缺血', department: '心内科', treatment: '建议立即休息，监测心率', medicine: '遵医嘱用药' },
            '背部放射痛|左肩痛': { cause: '可能为心肌梗死或主动脉夹层', department: '急诊科', treatment: '建议立即拨打急救电话，不要延误', medicine: '遵医嘱紧急处理' },
            '按压时疼痛加重': { cause: '可能为肋软骨炎、肌肉拉伤', department: '骨科或疼痛科', treatment: '建议休息，避免剧烈运动', medicine: '可考虑服用布洛芬' }
        },
        default: { cause: '可能为心脏问题、肺部问题或消化系统问题', department: '急诊科或心内科', treatment: '建议立即就医，不要延误', medicine: '遵医嘱用药' }
    },
    '关节痛': {
        keywords: ['关节痛', '关节肿胀', '关节僵硬', '腰痛', '膝盖痛', '肩痛', '肘痛', '腕痛', '踝痛'],
        combinations: {
            '晨僵|早晨僵硬|持续半小时以上': { cause: '可能为类风湿关节炎、强直性脊柱炎', department: '风湿免疫科', treatment: '建议保暖，适当锻炼，避免过度劳累', medicine: '遵医嘱用药' },
            '运动后加重|外伤史': { cause: '可能为运动损伤、骨关节炎或韧带损伤', department: '骨科', treatment: '建议休息，避免剧烈运动，进行康复训练', medicine: '可考虑服用布洛芬或双氯芬酸钠' },
            '红肿发热|皮温升高等': { cause: '可能为痛风、感染性关节炎或假性痛风', department: '风湿免疫科', treatment: '建议低嘌呤饮食，多喝水，卧床休息', medicine: '遵医嘱用药' },
            '多个关节痛|对称发病': { cause: '可能为类风湿关节炎或系统性红斑狼疮', department: '风湿免疫科', treatment: '建议及时就医检查自身抗体', medicine: '遵医嘱用药' },
            '腰部活动受限|下肢麻木': { cause: '可能为腰椎间盘突出、椎管狭窄', department: '骨科', treatment: '建议卧床休息，避免久坐久站', medicine: '可考虑服用甲钴胺营养神经' },
            '手指关节变形|结节': { cause: '可能为类风湿关节炎或骨关节炎', department: '风湿免疫科', treatment: '建议保护关节功能，避免过度使用', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为关节炎、肌肉劳损或运动损伤', department: '骨科或风湿免疫科', treatment: '建议休息，适当热敷或冷敷', medicine: '可考虑服用布洛芬' }
    },
    '皮肤问题': {
        keywords: ['皮疹', '瘙痒', '红肿', '水泡', '脱皮', '红斑', '丘疹', '荨麻疹', '湿疹', '皮炎'],
        combinations: {
            '过敏|接触后出现|突然发作': { cause: '可能为接触性皮炎、过敏性皮炎或荨麻疹', department: '皮肤科', treatment: '建议避免接触过敏原，保持皮肤清洁', medicine: '可使用炉甘石洗剂或抗过敏药物' },
            '水泡|流脓|感染': { cause: '可能为湿疹合并感染、脓疱疮或带状疱疹', department: '皮肤科', treatment: '建议保持皮肤清洁，避免抓挠', medicine: '遵医嘱使用抗生素药膏或抗病毒药物' },
            '红斑|鳞屑|银白色': { cause: '可能为银屑病、玫瑰糠疹', department: '皮肤科', treatment: '建议保湿护肤，避免刺激', medicine: '遵医嘱用药' },
            '瘙痒|夜间加重': { cause: '可能为疥疮、湿疹或神经性皮炎', department: '皮肤科', treatment: '建议保持皮肤干燥，避免搔抓', medicine: '可使用止痒药膏或口服抗组胺药' },
            '面部红肿|脱屑|刺痛': { cause: '可能为面部皮炎、玫瑰痤疮或激素依赖性皮炎', department: '皮肤科', treatment: '建议停用刺激性护肤品，冷敷缓解', medicine: '遵医嘱用药' },
            '蚊虫叮咬|丘疹|中心有咬点': { cause: '可能为蚊虫叮咬或虫咬皮炎', department: '皮肤科', treatment: '建议避免抓挠，保持清洁', medicine: '可使用清凉油或炉甘石洗剂' }
        },
        default: { cause: '可能为皮肤过敏、湿疹或接触性皮炎', department: '皮肤科', treatment: '建议避免抓挠，保持皮肤清洁干燥', medicine: '可考虑使用炉甘石洗剂' }
    },
    '乏力': {
        keywords: ['乏力', '疲劳', '没力气', '虚弱', '全身无力', '容易疲劳', '精神不振', '没精神', '无精打采', '提不起精神'],
        combinations: {
            '发烧|发热|感染': { cause: '可能为感染引起的全身症状', department: '内科', treatment: '建议休息，补充营养，多喝水', medicine: '对症治疗' },
            '贫血|面色苍白|头晕': { cause: '可能为贫血、缺铁或缺维生素B12', department: '血液科', treatment: '建议补充铁质和维生素，多吃动物肝脏', medicine: '可服用铁剂，遵医嘱' },
            '体重下降|食欲减退': { cause: '可能为甲状腺功能亢进、糖尿病或肿瘤', department: '内分泌科或肿瘤科', treatment: '建议检查甲状腺功能和血糖', medicine: '遵医嘱用药' },
            '睡眠不好|失眠': { cause: '可能为睡眠不足、神经衰弱或焦虑', department: '神经内科或心理科', treatment: '建议改善睡眠质量，放松心情', medicine: '可考虑服用褪黑素' },
            '肌肉酸痛|关节痛': { cause: '可能为风湿性疾病或慢性疲劳综合征', department: '风湿免疫科', treatment: '建议适当锻炼，保持良好心态', medicine: '遵医嘱用药' },
            '心慌|气短': { cause: '可能为心脏病、贫血或肺部问题', department: '心内科', treatment: '建议就医检查，避免过度劳累', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为过度劳累、睡眠不足或营养不良', department: '内科', treatment: '建议保证充足睡眠，合理饮食，适当运动', medicine: '无需特殊用药' }
    },
    '失眠': {
        keywords: ['失眠', '睡不着', '睡眠不好', '多梦', '易醒', '入睡困难', '早醒'],
        combinations: {
            '焦虑|压力大|情绪紧张': { cause: '可能为焦虑症、压力或情绪问题', department: '心理科或神经内科', treatment: '建议放松心情，睡前避免使用电子产品，进行深呼吸', medicine: '可考虑服用褪黑素，必要时遵医嘱用药' },
            '头痛|头晕': { cause: '可能为偏头痛影响睡眠或睡眠不足引起头痛', department: '神经内科', treatment: '建议治疗原发病，改善睡眠环境', medicine: '遵医嘱用药' },
            '心悸|心慌': { cause: '可能为心律失常或焦虑引起的失眠', department: '心内科或心理科', treatment: '建议睡前放松，进行冥想', medicine: '遵医嘱用药' },
            '潮热|盗汗': { cause: '可能为更年期综合征或内分泌问题', department: '妇科或内分泌科', treatment: '建议保持室内温度适宜，穿着舒适', medicine: '遵医嘱用药' },
            '腿部不适|无法安静': { cause: '可能为不宁腿综合征', department: '神经内科', treatment: '建议睡前泡脚，适当运动', medicine: '遵医嘱用药' },
            '长期熬夜|作息紊乱': { cause: '可能为生物钟紊乱', department: '神经内科', treatment: '建议建立规律作息，避免熬夜', medicine: '可考虑服用褪黑素调节生物钟' }
        },
        default: { cause: '可能为神经衰弱、作息不规律或压力过大', department: '神经内科', treatment: '建议建立规律作息，睡前放松', medicine: '可考虑服用安神补脑液或褪黑素' }
    },
    '视力问题': {
        keywords: ['视力模糊', '眼睛痛', '眼干', '眼干涩', '眼睛干涩', '眼涩', '视力下降', '视物模糊', '眼疲劳', '眼痒', '眼红'],
        combinations: {
            '头痛|眼痛|恶心': { cause: '可能为眼压升高、青光眼或偏头痛', department: '眼科', treatment: '建议立即就医检查眼压', medicine: '遵医嘱用药' },
            '眼干|异物感|烧灼感': { cause: '可能为干眼症、视疲劳或睑缘炎', department: '眼科', treatment: '建议使用人工泪液，定时休息', medicine: '可使用玻璃酸钠滴眼液' },
            '视物变形|闪光|飞蚊增多': { cause: '可能为视网膜问题、玻璃体混浊或视网膜脱离', department: '眼科', treatment: '建议立即就医，避免剧烈运动', medicine: '遵医嘱治疗' },
            '眼红|分泌物增多': { cause: '可能为结膜炎、角膜炎或麦粒肿', department: '眼科', treatment: '建议保持眼部清洁，避免揉眼', medicine: '遵医嘱使用滴眼液' },
            '视力突然下降|眼前发黑': { cause: '可能为视网膜中央动脉阻塞或视神经问题', department: '眼科', treatment: '建议立即就医，时间就是视力', medicine: '遵医嘱紧急处理' },
            '长时间用眼后加重': { cause: '可能为视疲劳、干眼症或屈光不正', department: '眼科', treatment: '建议定时休息，做眼保健操', medicine: '可使用缓解疲劳的眼药水' }
        },
        default: { cause: '可能为视疲劳、屈光不正或干眼症', department: '眼科', treatment: '建议注意用眼卫生，定时休息', medicine: '可使用缓解疲劳的眼药水' }
    },
    '呼吸困难': {
        keywords: ['呼吸困难', '喘不上气', '喘不过气', '喘气困难', '喘气', '暖气', '气短', '胸闷', '喘息', '呼吸急促'],
        combinations: {
            '咳嗽|咳痰|发烧': { cause: '可能为肺炎、支气管炎或哮喘发作', department: '呼吸内科', treatment: '建议立即就医，保持呼吸道通畅', medicine: '遵医嘱使用支气管扩张剂或抗生素' },
            '胸痛|压榨感': { cause: '可能为心脏病发作、肺部栓塞或气胸', department: '急诊科', treatment: '建议立即拨打急救电话', medicine: '遵医嘱紧急处理' },
            '喉咙发紧|声音嘶哑': { cause: '可能为急性喉炎、喉头水肿或过敏', department: '急诊科或耳鼻喉科', treatment: '建议立即就医，避免延误', medicine: '遵医嘱用药' },
            '平躺时加重|坐起缓解': { cause: '可能为心力衰竭或肺水肿', department: '心内科', treatment: '建议半卧位休息，吸氧', medicine: '遵医嘱用药' },
            '鼻塞|流涕': { cause: '可能为严重感冒、鼻窦炎或过敏性鼻炎', department: '耳鼻喉科', treatment: '建议使用鼻用减充血剂，保持鼻腔通畅', medicine: '可服用抗过敏药物' },
            '活动后加重|休息缓解': { cause: '可能为心肺功能不全或贫血', department: '心内科或呼吸内科', treatment: '建议避免剧烈运动，适当休息', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为哮喘、心肺问题或焦虑', department: '呼吸内科或急诊科', treatment: '建议立即就医，明确诊断', medicine: '遵医嘱用药' }
    },
    '恶心呕吐': {
        keywords: ['恶心', '呕吐', '想吐', '反胃', '呕血', '干呕'],
        combinations: {
            '腹痛|腹泻': { cause: '可能为急性肠胃炎、食物中毒', department: '消化内科', treatment: '建议暂时禁食或清淡饮食，补充水分', medicine: '可考虑服用甲氧氯普胺止吐' },
            '头痛|头晕': { cause: '可能为偏头痛、颅内压增高或眩晕', department: '神经内科', treatment: '建议卧床休息，保持安静', medicine: '可考虑服用止吐药' },
            '发烧|感染': { cause: '可能为全身性感染或病毒性疾病', department: '内科', treatment: '建议休息，多喝水', medicine: '对症治疗' },
            '停经|月经推迟': { cause: '可能为怀孕或宫外孕', department: '妇科', treatment: '建议进行孕检，排除宫外孕风险', medicine: '遵医嘱处理' },
            '饮酒后|药物后': { cause: '可能为酒精中毒或药物副作用', department: '急诊科', treatment: '建议多喝水促进代谢，必要时洗胃', medicine: '遵医嘱处理' },
            '呕血|黑便': { cause: '可能为上消化道出血', department: '急诊科', treatment: '建议立即就医，禁食', medicine: '遵医嘱紧急处理' }
        },
        default: { cause: '可能为消化系统问题、感染或药物副作用', department: '消化内科', treatment: '建议暂时禁食，观察症状', medicine: '可考虑服用止吐药' }
    },
    '腹泻': {
        keywords: ['腹泻', '拉肚子', '水样便', '稀便', '频繁排便'],
        combinations: {
            '腹痛|恶心': { cause: '可能为急性肠胃炎、食物中毒', department: '消化内科', treatment: '建议清淡饮食，补充水分和电解质', medicine: '可考虑服用蒙脱石散止泻' },
            '发烧|感染': { cause: '可能为肠道感染、痢疾或病毒性肠炎', department: '消化内科', treatment: '建议多喝水，避免脱水', medicine: '遵医嘱使用抗生素或抗病毒药物' },
            '便血|黏液便': { cause: '可能为细菌性痢疾、溃疡性结肠炎或感染', department: '消化内科', treatment: '建议立即就医，进行大便检查', medicine: '遵医嘱用药' },
            '旅游后|不洁饮食后': { cause: '可能为旅行者腹泻或食物中毒', department: '消化内科', treatment: '建议注意饮食卫生，多喝水', medicine: '可服用益生菌调节肠道' },
            '长期腹泻|体重下降': { cause: '可能为慢性肠炎、克罗恩病或吸收不良', department: '消化内科', treatment: '建议进行肠镜检查', medicine: '遵医嘱用药' },
            '抗生素使用后': { cause: '可能为菌群失调或艰难梭菌感染', department: '消化内科', treatment: '建议服用益生菌', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为饮食不当、消化不良或肠道感染', department: '消化内科', treatment: '建议清淡饮食，补充水分', medicine: '可考虑服用蒙脱石散' }
    },
    '便秘': {
        keywords: ['便秘', '大便干结', '排便困难', '数日无便'],
        combinations: {
            '腹痛|腹胀': { cause: '可能为肠梗阻、肠道功能紊乱或饮食不当', department: '消化内科', treatment: '建议增加膳食纤维，多喝水', medicine: '可使用开塞露或乳果糖' },
            '便血|肛门疼痛': { cause: '可能为痔疮、肛裂或肠道问题', department: '肛肠科或消化内科', treatment: '建议保持大便通畅，温水坐浴', medicine: '可使用痔疮膏' },
            '长期卧床|活动少': { cause: '可能为活动不足、肠道蠕动减慢', department: '内科', treatment: '建议适当活动，腹部按摩', medicine: '可考虑服用益生菌' },
            '饮食精细|饮水少': { cause: '可能为膳食纤维不足、水分不够', department: '内科', treatment: '建议多吃蔬菜水果，多喝水', medicine: '可考虑服用膳食纤维补充剂' },
            '药物副作用': { cause: '可能为某些药物引起的便秘', department: '内科', treatment: '建议咨询医生调整药物', medicine: '遵医嘱用药' },
            '体重下降|食欲减退': { cause: '可能为肠道肿瘤或甲状腺功能减退', department: '消化内科', treatment: '建议进行肠镜检查', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为饮食不当、缺乏运动或肠道功能紊乱', department: '消化内科', treatment: '建议增加膳食纤维，多喝水，适当运动', medicine: '可使用乳果糖或益生菌' }
    },
    '心悸': {
        keywords: ['心悸', '心慌', '心跳快', '心跳不规律', '心脏跳动明显'],
        combinations: {
            '胸闷|胸痛': { cause: '可能为心律失常、心肌缺血或心脏神经官能症', department: '心内科', treatment: '建议立即休息，避免激动', medicine: '遵医嘱用药' },
            '头晕|眩晕': { cause: '可能为心律失常、贫血或低血糖', department: '心内科', treatment: '建议坐下休息，监测脉搏', medicine: '遵医嘱用药' },
            '发烧|感染': { cause: '可能为感染引起的心率加快', department: '内科', treatment: '建议治疗原发病，多喝水', medicine: '对症治疗' },
            '焦虑|紧张': { cause: '可能为焦虑症、惊恐发作或压力过大', department: '心理科或心内科', treatment: '建议深呼吸，放松心情', medicine: '遵医嘱用药' },
            '运动后|劳累后': { cause: '可能为正常生理反应或心肺功能不足', department: '心内科', treatment: '建议适当休息，逐渐增加运动量', medicine: '无需特殊用药' },
            '夜间惊醒|呼吸困难': { cause: '可能为心力衰竭或睡眠呼吸暂停', department: '心内科', treatment: '建议就医检查', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为心律失常、焦虑或生理性心动过速', department: '心内科', treatment: '建议避免劳累，保持情绪稳定', medicine: '遵医嘱用药' }
    },
    '发烧': {
        keywords: ['发烧', '发热', '体温高', '高烧', '低烧', '发热不退', '持续发热'],
        combinations: {
            '咳嗽|咳痰': { cause: '可能为上呼吸道感染、支气管炎或肺炎', department: '呼吸内科', treatment: '建议多喝水，休息，监测体温', medicine: '可服用退烧药，必要时就医' },
            '头痛|乏力': { cause: '可能为流感、普通感冒或病毒感染', department: '内科', treatment: '建议休息，补充水分', medicine: '可服用对乙酰氨基酚或布洛芬' },
            '腹痛|腹泻': { cause: '可能为急性肠胃炎、食物中毒', department: '消化内科', treatment: '建议清淡饮食，补充电解质', medicine: '可服用蒙脱石散' },
            '寒战|发冷': { cause: '可能为细菌感染、败血症或严重感染', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱使用抗生素' },
            '皮疹|皮肤发红': { cause: '可能为病毒疹、药物过敏或猩红热', department: '皮肤科或内科', treatment: '建议保持皮肤清洁', medicine: '遵医嘱用药' },
            '喉咙痛|咽痛': { cause: '可能为咽喉炎、扁桃体炎', department: '耳鼻喉科', treatment: '建议温盐水漱口，多喝水', medicine: '可服用清热解毒药物' }
        },
        default: { cause: '可能为感染性疾病、炎症反应或免疫反应', department: '内科', treatment: '建议多喝水，休息，监测体温变化', medicine: '可考虑服用退烧药' }
    },
    '恶心呕吐': {
        keywords: ['恶心', '呕吐', '想吐', '反胃', '呕', '干呕', '呕吐不止'],
        combinations: {
            '腹痛|腹泻': { cause: '可能为急性肠胃炎、食物中毒', department: '消化内科', treatment: '建议暂时禁食，补充水分', medicine: '可服用止吐药，遵医嘱' },
            '头痛|头晕': { cause: '可能为偏头痛、颅内压增高或眩晕症', department: '神经内科', treatment: '建议休息，保持安静', medicine: '可服用止吐药' },
            '发烧|感染': { cause: '可能为全身性感染、流感或脑膜炎', department: '内科或急诊科', treatment: '建议立即就医', medicine: '对症治疗' },
            '停经|月经推迟': { cause: '可能为早孕反应', department: '妇科', treatment: '建议进行妊娠测试', medicine: '无需特殊用药' },
            '胸闷|胸痛': { cause: '可能为心肌梗死、心绞痛或胰腺炎', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱紧急处理' },
            '药物服用后': { cause: '可能为药物副作用', department: '内科', treatment: '建议咨询医生是否需要停药', medicine: '遵医嘱处理' }
        },
        default: { cause: '可能为消化系统问题、药物副作用或怀孕', department: '消化内科', treatment: '建议暂时禁食，少量多次饮水', medicine: '可服用维生素B6缓解' }
    },
    '呼吸困难': {
        keywords: ['呼吸困难', '喘不上气', '喘不过气', '喘气困难', '喘气', '暖气', '气短', '胸闷', '憋气', '呼吸急促', '喘息'],
        combinations: {
            '胸痛|心慌': { cause: '可能为心脏病发作、心肌梗死或气胸', department: '急诊科', treatment: '建议立即拨打急救电话', medicine: '遵医嘱紧急处理' },
            '咳嗽|咳痰': { cause: '可能为哮喘、慢性阻塞性肺病或肺炎', department: '呼吸内科', treatment: '建议使用支气管扩张剂', medicine: '遵医嘱用药' },
            '发烧|感染': { cause: '可能为严重肺部感染、急性呼吸窘迫综合征', department: '呼吸内科', treatment: '建议立即就医', medicine: '遵医嘱使用抗生素' },
            '喉咙发紧|声音嘶哑': { cause: '可能为急性喉炎、喉头水肿或过敏', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱使用激素' },
            '平躺时加重': { cause: '可能为心力衰竭、肺水肿', department: '心内科', treatment: '建议半卧位休息，吸氧', medicine: '遵医嘱用药' },
            '运动后加重': { cause: '可能为心肺功能不全、贫血', department: '心内科或呼吸内科', treatment: '建议避免剧烈运动', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为哮喘、心脏问题或焦虑发作', department: '急诊科或呼吸内科', treatment: '建议立即就医，不要延误', medicine: '遵医嘱用药' }
    },
    '腹泻': {
        keywords: ['腹泻', '拉肚子', '水样便', '大便稀', '频繁排便', '腹泻不止'],
        combinations: {
            '腹痛|恶心': { cause: '可能为急性肠胃炎、食物中毒', department: '消化内科', treatment: '建议清淡饮食，补充水分', medicine: '可服用蒙脱石散、益生菌' },
            '发烧|感染': { cause: '可能为肠道感染、细菌性痢疾', department: '消化内科', treatment: '建议多喝水，避免脱水', medicine: '遵医嘱使用抗生素' },
            '便血|黏液便': { cause: '可能为炎症性肠病、感染或息肉', department: '消化内科', treatment: '建议立即就医检查', medicine: '遵医嘱治疗' },
            '呕吐|脱水': { cause: '可能为严重脱水、霍乱', department: '急诊科', treatment: '建议立即就医补液', medicine: '遵医嘱治疗' },
            '旅游后出现': { cause: '可能为旅行者腹泻、水土不服', department: '消化内科', treatment: '建议注意饮食卫生', medicine: '可服用益生菌' },
            '抗生素使用后': { cause: '可能为菌群失调、艰难梭菌感染', department: '消化内科', treatment: '建议咨询医生', medicine: '遵医嘱使用益生菌' }
        },
        default: { cause: '可能为肠道感染、消化不良或药物副作用', department: '消化内科', treatment: '建议多喝水，清淡饮食', medicine: '可服用蒙脱石散' }
    },
    '便秘': {
        keywords: ['便秘', '大便干结', '排便困难', '数日无便', '大便不畅'],
        combinations: {
            '腹痛|腹胀': { cause: '可能为肠梗阻、肠道功能紊乱', department: '消化内科', treatment: '建议立即就医', medicine: '遵医嘱治疗' },
            '便血|黑便': { cause: '可能为痔疮、肛裂或肠道出血', department: '消化内科', treatment: '建议就医检查', medicine: '遵医嘱处理' },
            '体重下降|食欲差': { cause: '可能为甲状腺功能减退、肿瘤', department: '内分泌科或消化内科', treatment: '建议就医检查', medicine: '遵医嘱治疗' },
            '长期卧床|活动少': { cause: '可能为活动不足、饮食不当', department: '内科', treatment: '建议适当活动，增加膳食纤维', medicine: '可使用开塞露' },
            '药物使用后': { cause: '可能为药物副作用', department: '内科', treatment: '建议咨询医生', medicine: '遵医嘱处理' }
        },
        default: { cause: '可能为饮食不当、缺乏运动或肠道功能紊乱', department: '消化内科', treatment: '建议多喝水，增加膳食纤维，适当运动', medicine: '可使用乳果糖' }
    },
    '喉咙痛': {
        keywords: ['喉咙痛', '咽痛', '嗓子疼', '咽喉痛', '吞咽困难', '喉咙发炎'],
        combinations: {
            '发烧|咳嗽': { cause: '可能为咽喉炎、扁桃体炎或上呼吸道感染', department: '耳鼻喉科', treatment: '建议多喝水，温盐水漱口', medicine: '可服用清热解毒药物' },
            '声音嘶哑|失声': { cause: '可能为急性喉炎、声带炎', department: '耳鼻喉科', treatment: '建议少说话，多喝水', medicine: '可使用雾化吸入' },
            '呼吸困难|喘息': { cause: '可能为急性会厌炎、喉头水肿', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱使用激素' },
            '扁桃体肿大|化脓': { cause: '可能为化脓性扁桃体炎', department: '耳鼻喉科', treatment: '建议就医检查', medicine: '遵医嘱使用抗生素' },
            '鼻塞|流涕': { cause: '可能为普通感冒、流感', department: '内科', treatment: '建议休息，多喝水', medicine: '可服用感冒药' }
        },
        default: { cause: '可能为咽喉炎、扁桃体炎或感冒', department: '耳鼻喉科', treatment: '建议多喝水，避免辛辣食物', medicine: '可服用润喉糖' }
    },
    '打嗝': {
        keywords: ['打嗝', '打饱嗝', '嗳气', '呃逆', '不停打嗝'],
        combinations: {
            '饭后加重|吃饱后': { cause: '可能为饮食过快、过饱或消化不良', department: '消化内科', treatment: '建议细嚼慢咽，少食多餐', medicine: '可服用促胃动力药' },
            '反酸|烧心': { cause: '可能为胃食管反流病', department: '消化内科', treatment: '建议饭后不要立即躺下', medicine: '可服用质子泵抑制剂' },
            '持续不止|超过24小时': { cause: '可能为顽固性呃逆、神经系统问题', department: '神经内科', treatment: '建议立即就医检查', medicine: '遵医嘱用药' },
            '腹痛|腹胀': { cause: '可能为胃炎、胃溃疡或肠道胀气', department: '消化内科', treatment: '建议清淡饮食，避免产气食物', medicine: '可服用益生菌' },
            '恶心|呕吐': { cause: '可能为胃动力不足、幽门梗阻', department: '消化内科', treatment: '建议就医检查', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为饮食不当、消化不良或胃食管反流', department: '消化内科', treatment: '建议饭后散步，避免暴饮暴食', medicine: '可服用健胃消食片' }
    },
    '嗳气': {
        keywords: ['嗳气', '打饱嗝', '嗝气', '胃胀气', '气体上涌'],
        combinations: {
            '反酸|烧心': { cause: '可能为胃食管反流病、食管炎', department: '消化内科', treatment: '建议避免辛辣食物，饭后不立即躺下', medicine: '可服用奥美拉唑' },
            '腹痛|腹胀': { cause: '可能为慢性胃炎、消化性溃疡', department: '消化内科', treatment: '建议规律饮食，避免生冷食物', medicine: '可服用胃黏膜保护剂' },
            '食欲减退|体重下降': { cause: '可能为胃部肿瘤、肝胆疾病', department: '消化内科', treatment: '建议进行胃镜检查', medicine: '遵医嘱治疗' },
            '饭后加重': { cause: '可能为胃动力不足、消化不良', department: '消化内科', treatment: '建议少食多餐，适当运动', medicine: '可服用多潘立酮' },
            '口臭|口苦': { cause: '可能为幽门螺杆菌感染、胆汁反流', department: '消化内科', treatment: '建议检测幽门螺杆菌', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为消化不良、胃食管反流或饮食不当', department: '消化内科', treatment: '建议清淡饮食，饭后适当运动', medicine: '可服用促胃动力药' }
    },
    '反酸': {
        keywords: ['反酸', '烧心', '胃酸过多', '胃灼热', '胸口灼热'],
        combinations: {
            '胸痛|胸闷': { cause: '可能为胃食管反流病、心绞痛', department: '消化内科或心内科', treatment: '建议立即就医检查', medicine: '遵医嘱用药' },
            '吞咽困难|喉咙痛': { cause: '可能为食管炎、食管狭窄', department: '消化内科', treatment: '建议就医进行胃镜检查', medicine: '遵医嘱治疗' },
            '恶心|呕吐': { cause: '可能为胃炎、胃溃疡或反流性食管炎', department: '消化内科', treatment: '建议清淡饮食，避免咖啡浓茶', medicine: '可服用质子泵抑制剂' },
            '夜间加重|平躺时': { cause: '可能为严重胃食管反流', department: '消化内科', treatment: '建议抬高床头，睡前不进食', medicine: '遵医嘱用药' },
            '嗳气|腹胀': { cause: '可能为胃动力不足、慢性胃炎', department: '消化内科', treatment: '建议少食多餐，饭后散步', medicine: '可服用促胃动力药' },
            '口苦|口臭': { cause: '可能为胆汁反流、幽门螺杆菌感染', department: '消化内科', treatment: '建议检测幽门螺杆菌', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为胃食管反流病、胃炎或胃酸过多', department: '消化内科', treatment: '建议避免辛辣刺激食物，饭后不立即躺下', medicine: '可服用奥美拉唑' }
    },
    '腰痛': {
        keywords: ['腰痛', '腰酸', '腰胀', '腰部不适', '腰肌劳损', '腰椎痛'],
        combinations: {
            '下肢麻木|腿部麻木': { cause: '可能为腰椎间盘突出、椎管狭窄', department: '骨科', treatment: '建议卧床休息，避免久坐', medicine: '可服用甲钴胺' },
            '活动受限|弯腰困难': { cause: '可能为腰椎骨折、强直性脊柱炎', department: '骨科', treatment: '建议立即就医检查', medicine: '遵医嘱治疗' },
            '晨僵|早晨僵硬': { cause: '可能为强直性脊柱炎、类风湿关节炎', department: '风湿免疫科', treatment: '建议适当锻炼，保暖', medicine: '遵医嘱用药' },
            '尿频|尿急': { cause: '可能为肾结石、尿路感染或腰椎问题', department: '泌尿外科', treatment: '建议多喝水，就医检查', medicine: '遵医嘱用药' },
            '臀部疼痛|坐骨神经痛': { cause: '可能为腰椎间盘突出压迫神经', department: '骨科', treatment: '建议避免久坐，进行牵引', medicine: '可服用布洛芬' },
            '运动后加重': { cause: '可能为腰肌劳损、韧带拉伤', department: '骨科', treatment: '建议休息，热敷', medicine: '可外用止痛药膏' }
        },
        default: { cause: '可能为腰肌劳损、腰椎间盘突出或肾虚', department: '骨科', treatment: '建议避免久坐，适当锻炼', medicine: '可服用腰痛宁' }
    },
    '视力问题': {
        keywords: ['视力模糊', '视力下降', '视物不清', '眼睛模糊', '视力减退', '眼干', '眼干涩', '眼睛干涩', '眼涩'],
        combinations: {
            '眼痛|眼胀': { cause: '可能为青光眼、眼压升高', department: '眼科', treatment: '建议立即就医检查眼压', medicine: '遵医嘱用药' },
            '头痛|头晕': { cause: '可能为屈光不正、视疲劳或青光眼', department: '眼科', treatment: '建议验光配镜，休息眼睛', medicine: '可使用人工泪液' },
            '眼睛发红|分泌物增多': { cause: '可能为结膜炎、角膜炎', department: '眼科', treatment: '建议保持眼部清洁', medicine: '遵医嘱使用眼药水' },
            '夜间视力差': { cause: '可能为夜盲症、视网膜色素变性', department: '眼科', treatment: '建议补充维生素A', medicine: '遵医嘱治疗' },
            '视野缺损|看东西变形': { cause: '可能为黄斑病变、视网膜脱离', department: '眼科', treatment: '建议立即就医', medicine: '遵医嘱治疗' },
            '糖尿病史': { cause: '可能为糖尿病视网膜病变', department: '眼科', treatment: '建议定期检查眼底', medicine: '控制血糖' }
        },
        default: { cause: '可能为屈光不正、视疲劳或眼部疾病', department: '眼科', treatment: '建议注意用眼卫生，定期检查视力', medicine: '可使用缓解视疲劳的眼药水' }
    },
    '耳鸣': {
        keywords: ['耳鸣', '耳朵响', '耳内嗡嗡声', '耳内鸣响', '蝉鸣声'],
        combinations: {
            '听力下降|听不清楚': { cause: '可能为神经性耳聋、梅尼埃病', department: '耳鼻喉科', treatment: '建议避免噪音环境', medicine: '遵医嘱用药' },
            '头晕|眩晕': { cause: '可能为梅尼埃病、耳石症', department: '耳鼻喉科', treatment: '建议低盐饮食，进行耳石复位', medicine: '遵医嘱用药' },
            '耳朵痛|耳闷': { cause: '可能为中耳炎、外耳道炎', department: '耳鼻喉科', treatment: '建议保持耳道干燥', medicine: '遵医嘱使用滴耳液' },
            '噪音暴露后': { cause: '可能为噪音性听力损伤', department: '耳鼻喉科', treatment: '建议避免噪音，佩戴耳塞', medicine: '遵医嘱治疗' },
            '高血压|血压高': { cause: '可能为高血压引起的耳鸣', department: '心内科', treatment: '建议控制血压', medicine: '遵医嘱服用降压药' }
        },
        default: { cause: '可能为神经性耳鸣、耳部疾病或噪音暴露', department: '耳鼻喉科', treatment: '建议避免噪音，保持心情舒畅', medicine: '可服用改善微循环的药物' }
    },
    '口干': {
        keywords: ['口干', '口干舌燥', '口渴', '口腔干燥', '嘴唇干裂'],
        combinations: {
            '眼干|眼涩': { cause: '可能为干燥综合征、自身免疫病', department: '风湿免疫科', treatment: '建议多喝水，使用人工泪液', medicine: '遵医嘱用药' },
            '多饮|多尿': { cause: '可能为糖尿病、尿崩症', department: '内分泌科', treatment: '建议检查血糖', medicine: '控制血糖' },
            '口苦|口臭': { cause: '可能为口腔感染、肝胆问题', department: '口腔科', treatment: '建议保持口腔清洁', medicine: '遵医嘱治疗' },
            '服药后': { cause: '可能为药物副作用', department: '内科', treatment: '建议咨询医生', medicine: '遵医嘱处理' },
            '咽喉痛|吞咽困难': { cause: '可能为咽喉炎、干燥性咽炎', department: '耳鼻喉科', treatment: '建议多喝水，使用加湿器', medicine: '可服用润喉糖' }
        },
        default: { cause: '可能为饮水不足、干燥综合征或药物副作用', department: '内科', treatment: '建议多喝水，使用加湿器', medicine: '可使用人工唾液' }
    },
    '尿频尿急': {
        keywords: ['尿频', '尿急', '尿多', '频繁排尿', '憋不住尿'],
        combinations: {
            '尿痛|尿灼热': { cause: '可能为尿路感染、膀胱炎', department: '泌尿外科', treatment: '建议多喝水，就医检查', medicine: '遵医嘱使用抗生素' },
            '血尿|尿液发红': { cause: '可能为尿路感染、结石或肿瘤', department: '泌尿外科', treatment: '建议立即就医', medicine: '遵医嘱治疗' },
            '腰痛|下腹痛': { cause: '可能为肾结石、肾盂肾炎', department: '泌尿外科', treatment: '建议多喝水，就医检查', medicine: '遵医嘱用药' },
            '夜尿增多': { cause: '可能为前列腺增生、糖尿病', department: '泌尿外科', treatment: '建议就医检查', medicine: '遵医嘱治疗' },
            '尿失禁|漏尿': { cause: '可能为盆底肌松弛、尿路感染', department: '泌尿外科', treatment: '建议进行盆底肌训练', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为尿路感染、前列腺问题或饮水过多', department: '泌尿外科', treatment: '建议多喝水，注意个人卫生', medicine: '遵医嘱用药' }
    },
    '月经不调': {
        keywords: ['月经不调', '月经紊乱', '月经推迟', '月经提前', '月经量少', '月经量多'],
        combinations: {
            '腹痛|痛经': { cause: '可能为子宫内膜异位症、盆腔炎', department: '妇科', treatment: '建议热敷，避免生冷', medicine: '可服用布洛芬' },
            '闭经|停经': { cause: '可能为多囊卵巢综合征、怀孕', department: '妇科', treatment: '建议进行妊娠测试', medicine: '遵医嘱治疗' },
            '不规则出血': { cause: '可能为子宫肌瘤、子宫内膜息肉', department: '妇科', treatment: '建议进行B超检查', medicine: '遵医嘱治疗' },
            '经前综合征': { cause: '可能为激素水平变化', department: '妇科', treatment: '建议放松心情，适当运动', medicine: '可服用维生素B6' },
            '更年期症状': { cause: '可能为围绝经期、卵巢功能减退', department: '妇科', treatment: '建议保持良好心态', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为内分泌失调、压力过大或妇科疾病', department: '妇科', treatment: '建议规律作息，减轻压力', medicine: '遵医嘱用药' }
    },
    '脱发': {
        keywords: ['脱发', '掉头发', '头发稀疏', '斑秃', '发际线后移'],
        combinations: {
            '头皮瘙痒|头屑多': { cause: '可能为脂溢性皮炎、真菌感染', department: '皮肤科', treatment: '建议保持头皮清洁', medicine: '可使用酮康唑洗剂' },
            '头发油腻': { cause: '可能为脂溢性脱发', department: '皮肤科', treatment: '建议清淡饮食，规律作息', medicine: '可使用米诺地尔' },
            '压力大|焦虑': { cause: '可能为休止期脱发、精神因素', department: '皮肤科', treatment: '建议放松心情，保证睡眠', medicine: '可补充维生素B族' },
            '家族遗传史': { cause: '可能为雄激素性脱发', department: '皮肤科', treatment: '建议早期干预', medicine: '可使用米诺地尔或非那雄胺' },
            '身体消瘦|营养不良': { cause: '可能为营养不良、缺乏蛋白质', department: '内科', treatment: '建议均衡饮食，补充营养', medicine: '补充多种维生素' }
        },
        default: { cause: '可能为遗传、压力过大、营养不良或激素变化', department: '皮肤科', treatment: '建议保持头皮清洁，规律作息', medicine: '可使用米诺地尔' }
    },
    '疲劳乏力': {
        keywords: ['疲劳', '乏力', '没力气', '全身无力', '精神不振', '容易疲倦'],
        combinations: {
            '发烧|感染': { cause: '可能为感染性疾病、流感', department: '内科', treatment: '建议休息，多喝水', medicine: '对症治疗' },
            '贫血|头晕': { cause: '可能为缺铁性贫血、营养不良', department: '血液科', treatment: '建议补充铁质', medicine: '可服用铁剂' },
            '睡眠不好|失眠': { cause: '可能为睡眠不足、神经衰弱', department: '神经内科', treatment: '建议改善睡眠', medicine: '可服用褪黑素' },
            '体重下降|食欲差': { cause: '可能为甲亢、糖尿病或肿瘤', department: '内分泌科', treatment: '建议检查甲功和血糖', medicine: '遵医嘱治疗' },
            '肌肉酸痛|关节痛': { cause: '可能为风湿性疾病、慢性疲劳综合征', department: '风湿免疫科', treatment: '建议适当锻炼', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为过度劳累、睡眠不足、贫血或甲状腺功能减退', department: '内科', treatment: '建议保证充足睡眠，均衡饮食', medicine: '可补充复合维生素' }
    },
    '口腔溃疡': {
        keywords: ['口腔溃疡', '口疮', '嘴巴溃疡', '嘴里疼', '舌头溃疡', '口内破', '溃疡'],
        combinations: {
            '发烧|咽痛': { cause: '可能为病毒感染或上呼吸道感染', department: '耳鼻喉科', treatment: '建议保持口腔清洁，多喝水', medicine: '可使用口腔溃疡喷剂' },
            '精神压力|熬夜': { cause: '可能为压力或睡眠不足引起', department: '内科', treatment: '建议调整作息，减少精神压力', medicine: '可使用维生素B族' },
            '胃酸|反酸': { cause: '可能为胃酸刺激或胃肠道问题', department: '消化内科', treatment: '建议避免辛辣刺激食物', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为上火、精神压力、营养缺乏或局部刺激', department: '口腔科', treatment: '建议保持口腔清洁，避免辛辣和过烫食物', medicine: '可使用口腔溃疡药膏' }
    },
    '牙痛': {
        keywords: ['牙痛', '牙龈痛', '蛀牙', '牙龈肿', '牙齿疼', '牙龈出血', '牙龈肿胀'],
        combinations: {
            '发烧|脸肿': { cause: '可能为牙髓炎或牙周脓肿', department: '口腔科', treatment: '建议及时就医，避免自行处理', medicine: '遵医嘱使用抗感染药物' },
            '咬合疼|冷热刺激': { cause: '可能为龋齿或牙齿敏感', department: '口腔科', treatment: '建议尽早补牙，避免继续磨损', medicine: '可使用脱敏牙膏' },
            '牙龈红肿|流脓': { cause: '可能为牙周炎或牙周脓肿', department: '口腔科', treatment: '建议尽快复诊，进行牙周处理', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为龋齿、牙周炎或牙齿敏感', department: '口腔科', treatment: '建议尽早就医，避免拖延', medicine: '遵医嘱治疗' }
    },
    '鼻塞流涕': {
        keywords: ['鼻塞', '流鼻涕', '鼻子堵', '鼻痒', '打喷嚏', '鼻炎', '鼻腔不通'],
        combinations: {
            '发烧|咽痛': { cause: '可能为普通感冒或流感', department: '耳鼻喉科', treatment: '建议多休息，多喝水', medicine: '可服用感冒药或抗组胺药' },
            '眼痒|流眼泪': { cause: '可能为过敏性鼻炎', department: '耳鼻喉科', treatment: '建议避免过敏原，保持室内清洁', medicine: '可用抗组胺药' },
            '头痛|面痛': { cause: '可能为鼻窦炎', department: '耳鼻喉科', treatment: '建议使用生理盐水冲洗鼻腔', medicine: '可遵医嘱使用鼻用激素' }
        },
        default: { cause: '可能为感冒、过敏性鼻炎或鼻窦炎', department: '耳鼻喉科', treatment: '建议保持鼻腔通畅，避免刺激', medicine: '可使用生理盐水和抗过敏药物' }
    },
    '鼻出血': {
        keywords: ['鼻出血', '流鼻血', '鼻子出血', '血从鼻子流出来'],
        combinations: {
            '头痛|头晕': { cause: '可能为鼻腔干燥、鼻部损伤或高血压', department: '耳鼻喉科', treatment: '建议坐直，头稍前倾，按压鼻翼', medicine: '遵医嘱治疗' },
            '咳嗽|痰中带血': { cause: '可能为鼻腔黏膜损伤或呼吸道疾病', department: '耳鼻喉科', treatment: '建议尽快就医检查', medicine: '遵医嘱用药' },
            '高血压|血压高': { cause: '可能为高血压诱发鼻出血', department: '心内科', treatment: '建议控制血压', medicine: '按医嘱服降压药' }
        },
        default: { cause: '可能为鼻腔干燥、外伤或血压异常', department: '耳鼻喉科', treatment: '建议按压鼻翼，避免用力擤鼻', medicine: '遵医嘱处理' }
    },
    '嗓子沙哑': {
        keywords: ['嗓子沙哑', '声音嘶哑', '失声', '喉咙干', '说话费力'],
        combinations: {
            '咽痛|发烧': { cause: '可能为急性喉炎或上呼吸道感染', department: '耳鼻喉科', treatment: '建议少说话，多喝水', medicine: '可使用雾化吸入' },
            '长期熬夜|大声说话': { cause: '可能为声带疲劳', department: '耳鼻喉科', treatment: '建议减少长时间说话', medicine: '可使用润喉剂' },
            '呼吸困难|喉咙发紧': { cause: '可能为喉头水肿或严重炎症', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为声带疲劳、炎症或过度用嗓', department: '耳鼻喉科', treatment: '建议减少用嗓，保持喉部湿润', medicine: '可使用润喉糖' }
    },
    '口苦口臭': {
        keywords: ['口苦', '口臭', '嘴苦', '舌苔厚', '嘴里发臭', '口气重'],
        combinations: {
            '胃痛|反酸': { cause: '可能为胃食管反流、胃炎', department: '消化内科', treatment: '建议规律饮食，避免辛辣', medicine: '可服用胃黏膜保护剂' },
            '舌苔黄|便秘': { cause: '可能为消化不良或湿热内蕴', department: '中医内科', treatment: '建议清淡饮食，保持规律作息', medicine: '遵医嘱治疗' },
            '牙龈肿|口腔溃疡': { cause: '可能为口腔疾病或细菌感染', department: '口腔科', treatment: '建议保持口腔清洁', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为消化不良、口腔卫生差或胃酸问题', department: '口腔科或消化内科', treatment: '建议保持口腔清洁，规律饮食', medicine: '可使用口腔清洁用品' }
    },
    '黄疸': {
        keywords: ['黄疸', '皮肤发黄', '眼白发黄', '尿黄', '黄染', '眼黄'],
        combinations: {
            '右上腹痛|恶心': { cause: '可能为肝胆疾病或胆囊问题', department: '消化内科', treatment: '建议立即就医检查肝功能', medicine: '遵医嘱治疗' },
            '发热|乏力': { cause: '可能为病毒性肝炎', department: '感染科', treatment: '建议休息，多饮水，尽快检查肝功能', medicine: '遵医嘱用药' },
            '瘙痒|皮肤痒': { cause: '可能为胆汁淤积或肝病', department: '消化内科', treatment: '建议避免刺激性食物', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为肝胆疾病、胆道梗阻或黄疸性疾病', department: '消化内科', treatment: '建议尽快就医进行肝功能和超声检查', medicine: '遵医嘱治疗' }
    },
    '浮肿': {
        keywords: ['浮肿', '水肿', '脚肿', '腿肿', '脸肿', '眼睑肿'],
        combinations: {
            '尿少|尿黄': { cause: '可能为肾脏问题或肾功能异常', department: '肾内科', treatment: '建议及时就医检查肾功能', medicine: '遵医嘱用药' },
            '心慌|气短': { cause: '可能为心力衰竭', department: '心内科', treatment: '建议立即就医', medicine: '遵医嘱用药' },
            '睡眠不足|熬夜': { cause: '可能为睡眠不足或饮食过咸', department: '内科', treatment: '建议控制盐分摄入，保证休息', medicine: '无特殊用药' }
        },
        default: { cause: '可能为水钠潴留、肾脏疾病或心脏疾病', department: '内科', treatment: '建议控制盐分和液体摄入，观察是否伴随其他症状', medicine: '遵医嘱处理' }
    },
    '麻木发凉': {
        keywords: ['麻木', '发麻', '手脚麻木', '手麻', '脚麻', '腿麻', '手脚发凉', '脚冷', '手冷', '冰凉'],
        combinations: {
            '头晕|心悸': { cause: '可能为贫血、低血糖或循环问题', department: '内科', treatment: '建议观察血压和心率', medicine: '遵医嘱用药' },
            '颈肩痛|脖子僵': { cause: '可能为颈椎问题压迫神经', department: '骨科', treatment: '建议避免久低头', medicine: '可颈部热敷' },
            '糖尿病|血糖高': { cause: '可能为糖尿病周围神经病变', department: '内分泌科', treatment: '建议控制血糖', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为局部循环差、神经压迫或末梢神经问题', department: '内科', treatment: '建议注意保暖，避免长时间保持同一姿势', medicine: '遵医嘱治疗' }
    },
    '淋巴结肿大': {
        keywords: ['淋巴结肿大', '脖子淋巴结', '腋下肿块', '颈部结节', '淋巴结痛'],
        combinations: {
            '发热|咽痛': { cause: '可能为感染性淋巴结炎', department: '耳鼻喉科', treatment: '建议观察是否伴随感染症状', medicine: '遵医嘱用药' },
            '体重下降|夜间盗汗': { cause: '可能为肿瘤或恶性病变', department: '肿瘤科', treatment: '建议尽快就医检查', medicine: '遵医嘱治疗' },
            '皮肤红肿|疼痛': { cause: '可能为局部感染', department: '皮肤科', treatment: '建议保持清洁，避免挤压', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为感染性疾病或局部炎症', department: '内科', treatment: '建议观察伴随症状并尽快就医', medicine: '遵医嘱处理' }
    },
    '乳房胀痛': {
        keywords: ['乳房胀痛', '乳腺痛', '胸部胀痛', '乳房肿块'],
        combinations: {
            '月经前|经前': { cause: '可能为经前乳房胀痛', department: '妇科', treatment: '建议适当休息，保持情绪稳定', medicine: '可遵医嘱使用缓解药物' },
            '发热|红肿': { cause: '可能为乳腺炎', department: '妇科', treatment: '建议及时就医，避免延误', medicine: '遵医嘱使用抗生素' },
            '肿块|皮肤凹陷': { cause: '可能为乳腺结节或肿瘤', department: '乳腺外科', treatment: '建议尽快检查超声或钼靶', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为乳腺增生、经期变化或炎症', department: '妇科', treatment: '建议观察并进行乳腺检查', medicine: '遵医嘱处理' }
    },
    '白带异常': {
        keywords: ['白带异常', '白带多', '白带异味', '白带发黄', '阴道瘙痒', '阴道出血', '下腹坠痛'],
        combinations: {
            '瘙痒|灼热': { cause: '可能为阴道炎、霉菌感染', department: '妇科', treatment: '建议保持外阴清洁干燥', medicine: '遵医嘱使用抗真菌药物' },
            '异味|发黄': { cause: '可能为细菌性阴道病或滴虫感染', department: '妇科', treatment: '建议尽快就医检查', medicine: '遵医嘱治疗' },
            '腹痛|停经': { cause: '可能为妇科炎症或怀孕相关问题', department: '妇科', treatment: '建议进行妊娠检测或妇科检查', medicine: '遵医嘱处理' }
        },
        default: { cause: '可能为阴道炎、宫颈问题或妇科炎症', department: '妇科', treatment: '建议保持外阴清洁，及时就医检查', medicine: '遵医嘱用药' }
    },
    '尿血': {
        keywords: ['尿血', '血尿', '尿里有血', '排尿疼', '尿痛', '尿道刺痛'],
        combinations: {
            '腰痛|发热': { cause: '可能为肾结石、肾盂肾炎或尿路感染', department: '泌尿外科', treatment: '建议多喝水并尽快就医', medicine: '遵医嘱用药' },
            '下腹痛|尿频': { cause: '可能为膀胱炎、尿路感染', department: '泌尿外科', treatment: '建议多喝水，注意个人卫生', medicine: '遵医嘱使用抗生素' },
            '排尿困难|尿不尽': { cause: '可能为前列腺问题或尿路梗阻', department: '泌尿外科', treatment: '建议就医检查前列腺或泌尿系统', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为尿路感染、结石或泌尿系统疾病', department: '泌尿外科', treatment: '建议尽快就医，避免自行延误', medicine: '遵医嘱处理' }
    },
    '性功能问题': {
        keywords: ['早泄', '阳痿', '勃起困难', '性欲低下', '性功能下降', '阴茎痛'],
        combinations: {
            '焦虑|压力大': { cause: '可能为心理性或功能性问题', department: '泌尿外科或心理科', treatment: '建议放松心情，避免熬夜', medicine: '遵医嘱治疗' },
            '糖尿病|高血压': { cause: '可能为慢性病导致的血管神经损伤', department: '泌尿外科', treatment: '建议控制基础疾病', medicine: '遵医嘱用药' },
            '疼痛|尿道灼热': { cause: '可能为尿路感染或前列腺炎', department: '泌尿外科', treatment: '建议就医检查', medicine: '遵医嘱治疗' }
        },
        default: { cause: '可能为心理因素、血管神经问题或前列腺/泌尿系统疾病', department: '泌尿外科', treatment: '建议结合基础病管理和生活方式调整', medicine: '遵医嘱治疗' }
    },
    '腿脚无力': {
        keywords: ['腿脚无力', '腿脚没力', '腿脚发软', '腿软', '下肢无力', '双腿无力', '走路没劲', '走路不稳', '站不住', '脚下无力', '下肢乏力'],
        combinations: {
            '单侧|一侧|半边': { cause: '可能为脑血管疾病或神经受压', department: '急诊科或神经内科', treatment: '如为突然出现，建议立即就医，记录发作时间', medicine: '不可自行用药' },
            '麻木|刺痛|腰痛': { cause: '可能为腰椎间盘突出、椎管狭窄或周围神经受压', department: '骨科或神经内科', treatment: '建议避免负重和久坐，尽快检查', medicine: '遵医嘱治疗' },
            '头晕|心慌|出汗': { cause: '可能为低血糖、贫血或血压异常', department: '内科或急诊科', treatment: '建议立即坐下休息，必要时测量血糖和血压', medicine: '遵医嘱处理' },
            '发热|肌肉酸痛': { cause: '可能为感染或全身性炎症反应', department: '内科', treatment: '建议休息、补充水分并监测体温', medicine: '遵医嘱用药' }
        },
        default: { cause: '可能为疲劳、贫血、神经受压、肌肉问题或循环异常', department: '内科或神经内科', treatment: '建议避免剧烈运动，观察是否突然发生或持续加重', medicine: '请勿自行服用激素或止痛药，遵医嘱治疗' }
    }
};

// 病情分析 - 增强版
function normalizeSymptomText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[“”"‘’']/g, '')
        .replace(/[，。！？、；：,.!?;:\s]+/g, '')
        .trim();
}

function analyzeConsultation(consultation) {
    const symptoms = normalizeSymptomText(consultation.symptoms);
    const duration = consultation.duration || '';
    const otherSymptoms = normalizeSymptomText(consultation.otherSymptoms);
    
    const analysis = {
        possibleCause: '',
        department: '',
        treatment: '',
        medicine: '',
        searched: false,
        confidence: 0,
        matchedKeywords: []
    };
    
    const allSymptoms = normalizeSymptomText(symptoms + ' ' + otherSymptoms);
    
    // 首先尝试本地数据库匹配
    let matched = false;
    let bestMatch = null;
    let matchScore = 0;
    let matchedCategory = '';
    
    for (const [category, data] of Object.entries(symptomDatabase)) {
        // 统计匹配的关键词数量
        const matchedKeywords = data.keywords.filter(keyword => allSymptoms.includes(normalizeSymptomText(keyword)));
        
        if (matchedKeywords.length > 0) {
            // 计算匹配分数
            let score = matchedKeywords.length * 10;
            
            // 检查组合症状，组合匹配得分更高
            for (const [comboPattern, result] of Object.entries(data.combinations)) {
                const comboKeywords = comboPattern.split('|').map(normalizeSymptomText);
                if (comboKeywords.some(keyword => allSymptoms.includes(keyword))) {
                    score += 20; // 组合匹配加分
                    bestMatch = result;
                    matchedCategory = category;
                    matchScore = score;
                    matched = true;
                    analysis.matchedKeywords = [...matchedKeywords, ...comboKeywords.filter(keyword => allSymptoms.includes(keyword))];
                    break;
                }
            }
            
            // 如果没有匹配到组合，但关键词匹配，使用默认结果
            if (!bestMatch && matchedKeywords.length >= 1) {
                score += matchedKeywords.length * 5;
                if (score > matchScore) {
                    bestMatch = data.default;
                    matchedCategory = category;
                    matchScore = score;
                    matched = true;
                    analysis.matchedKeywords = matchedKeywords;
                }
            }
            
            // 如果只有一个关键词匹配，但关键词比较特殊（如危及生命的症状）
            if (!bestMatch && matchedKeywords.length === 1) {
                const criticalKeywords = ['胸痛', '呼吸困难', '心跳停止', '意识模糊', '呕血', '咯血', '便血', '高烧', '昏迷'];
                if (matchedKeywords.some(kw => criticalKeywords.includes(kw))) {
                    score += 15;
                    if (score > matchScore) {
                        bestMatch = data.default;
                        matchedCategory = category;
                        matchScore = score;
                        matched = true;
                        analysis.matchedKeywords = matchedKeywords;
                    }
                }
            }
        }
    }
    
    // 设置分析结果
    if (bestMatch) {
        analysis.possibleCause = bestMatch.cause;
        analysis.department = bestMatch.department;
        analysis.treatment = bestMatch.treatment;
        analysis.medicine = bestMatch.medicine;
        analysis.confidence = Math.min(100, matchScore);
        
        // 根据持续时间调整建议
        if (duration && duration.includes('2周以上')) {
            analysis.treatment = '症状持续时间较长，' + analysis.treatment;
        }
    }
    
    // 如果本地数据库没有匹配到，显示友好提示
    if (!matched) {
        analysis.possibleCause = '根据您的症状描述，暂时无法从本地数据库中找到匹配的病因信息。建议您详细描述症状或咨询专业医生。';
        analysis.department = '建议挂全科或普通内科进行初步诊断';
        analysis.treatment = '建议详细描述症状，配合医生进行体格检查和必要的辅助检查';
        analysis.medicine = '请遵医嘱用药，不可自行用药';
        analysis.searched = false;
        analysis.confidence = 0;
    }
    
    return analysis;
}

// 从症状描述中提取关键词用于搜索
function extractSearchKeywords(symptoms) {
    const commonWords = ['的', '了', '是', '我', '有', '和', '在', '不', '人', '都', '一',
        '很', '也', '还', '要', '没有', '感觉', '觉得', '有点', '一些', '然后', '而且',
        '但是', '所以', '因为', '这个', '那个', '什么', '怎么', '怎样', '非常', '比较',
        '可能', '应该', '可以', '需要', '已经', '一直', '最近', '今天', '昨天', '现在'];
    const words = symptoms.split(/[,，。！？\s]+/);
    return words.filter(w => w.length > 1 && !commonWords.includes(w)).join(' ');
}

// 通过 Wikipedia API 搜索医学信息
async function searchWikipedia(keywords) {
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keywords + ' medical condition symptoms')}&format=json&origin=*&srlimit=5`;
        const searchResp = await fetch(searchUrl);
        const searchData = await searchResp.json();
        
        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
            return null;
        }

        const topResult = searchData.query.search[0];
        const pageTitle = topResult.title;

        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
        const extractResp = await fetch(extractUrl);
        const extractData = await extractResp.json();
        const pages = extractData.query.pages;
        const page = pages[Object.keys(pages)[0]];
        const extract = page.extract ? page.extract.substring(0, 600) : '';

        return {
            title: pageTitle,
            extract: extract,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
            searchResults: searchData.query.search.map(r => ({
                title: r.title,
                snippet: r.snippet ? r.snippet.replace(/<[^>]+>/g, '') : '',
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`
            }))
        };
    } catch (error) {
        return null;
    }
}

// 通过 DuckDuckGo API 搜索即时答案
async function searchDuckDuckGo(keywords) {
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(keywords + ' symptoms')}&format=json&no_html=1&skip_disambig=1`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.AbstractText && data.AbstractText.length > 0) {
            return {
                title: data.Heading || '搜索结果',
                extract: data.AbstractText,
                url: data.AbstractURL || '',
                source: data.AbstractSource || 'DuckDuckGo'
            };
        }

        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const first = data.RelatedTopics[0];
            if (first.Text) {
                return {
                    title: first.FirstURL ? first.FirstURL.split('/').pop().replace(/_/g, ' ') : '相关信息',
                    extract: first.Text,
                    url: first.FirstURL || '',
                    source: 'DuckDuckGo'
                };
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

// 从搜索结果中提取医疗建议
function extractMedicalInfo(wikiData, ddgData, keywords) {
    const result = {
        possibleCause: '',
        department: '',
        treatment: '',
        medicine: '',
        references: [],
        searchedFrom: ''
    };

    const combinedText = (wikiData ? wikiData.extract + ' ' + wikiData.title : '') +
        (ddgData ? ddgData.extract + ' ' + ddgData.title : '');

    const text = combinedText.toLowerCase();

    // 科室匹配表
    const deptMap = [
        { keywords: ['heart', 'cardiac', 'chest', '心脏', '胸痛', '心'], dept: '心内科' },
        { keywords: ['brain', 'nerve', 'neurol', 'headache', 'migraine', '神经', '头痛', '脑'], dept: '神经内科' },
        { keywords: ['lung', 'respiratory', 'breath', 'cough', 'pneumonia', '呼吸', '咳嗽', '肺'], dept: '呼吸内科' },
        { keywords: ['stomach', 'gastric', 'digest', 'abdomen', 'liver', 'intestin', '消化', '胃', '肠', '肝', '腹痛'], dept: '消化内科' },
        { keywords: ['bone', 'joint', 'arthritis', 'fracture', 'orthop', '骨', '关节', '腰椎', '颈椎'], dept: '骨科' },
        { keywords: ['skin', 'dermat', 'rash', 'eczema', '皮肤', '皮疹', '湿疹'], dept: '皮肤科' },
        { keywords: ['eye', 'ophthal', 'vision', '眼睛', '视力', '眼'], dept: '眼科' },
        { keywords: ['ear', 'nose', 'throat', 'ent', '耳', '鼻', '喉', '咽'], dept: '耳鼻喉科' },
        { keywords: ['kidney', 'renal', 'urinary', '肾', '泌尿'], dept: '肾内科或泌尿外科' },
        { keywords: ['diabetes', 'thyroid', 'hormone', 'endocrin', '糖尿病', '甲状腺', '内分泌'], dept: '内分泌科' },
        { keywords: ['infect', 'fever', 'virus', 'bacteria', '感染', '发烧', '发热', '病毒'], dept: '感染科或内科' },
        { keywords: ['cancer', 'tumor', 'malignan', '肿瘤', '癌'], dept: '肿瘤科' },
        { keywords: ['mental', 'anxiety', 'depress', 'sleep', '心理', '焦虑', '抑郁', '失眠'], dept: '心理科或精神科' },
        { keywords: ['rheumat', 'autoimmun', 'lupus', '风湿', '免疫'], dept: '风湿免疫科' },
        { keywords: ['pregnan', 'gynecol', 'women', '妇', '孕', '月经'], dept: '妇科' },
        { keywords: ['emergency', 'urgent', 'severe', '急救', '急诊', '紧急'], dept: '急诊科' }
    ];

    let matchedDept = '';
    for (const entry of deptMap) {
        if (entry.keywords.some(kw => text.includes(kw))) {
            matchedDept = entry.dept;
            break;
        }
    }

    // 构建病因分析
    if (wikiData && wikiData.extract) {
        const sentences = wikiData.extract.split('. ');
        result.possibleCause = sentences.slice(0, 2).join('. ') + '。';
        if (result.possibleCause.length > 200) {
            result.possibleCause = result.possibleCause.substring(0, 200) + '...';
        }
    } else if (ddgData && ddgData.extract) {
        result.possibleCause = ddgData.extract.substring(0, 200);
        if (ddgData.extract.length > 200) result.possibleCause += '...';
    } else {
        result.possibleCause = '根据网络搜索，未能找到与该症状描述完全匹配的医学信息。';
    }

    result.department = matchedDept || '建议挂全科或普通内科进行初步诊断，由医生根据检查结果确定具体科室';
    result.treatment = '建议尽快就医，由专业医生进行诊断和治疗。网络信息仅供参考，不可替代专业医疗诊断。';
    result.medicine = '请在医生指导下用药，切勿自行用药。不同病因需要不同的治疗方案。';

    // 收集引用来源
    if (wikiData) {
        result.references.push({
            title: wikiData.title,
            url: wikiData.url,
            source: 'Wikipedia'
        });
        if (wikiData.searchResults) {
            wikiData.searchResults.slice(1, 3).forEach(r => {
                result.references.push({
                    title: r.title,
                    url: r.url,
                    source: 'Wikipedia'
                });
            });
        }
    }
    if (ddgData && ddgData.url) {
        result.references.push({
            title: ddgData.title || 'DuckDuckGo 搜索结果',
            url: ddgData.url,
            source: ddgData.source || 'DuckDuckGo'
        });
    }

    if (wikiData) result.searchedFrom = 'Wikipedia';
    if (ddgData) result.searchedFrom += (result.searchedFrom ? ' + ' : '') + 'DuckDuckGo';

    return result;
}

// AI医疗网站链接配置
const aiMedicalSites = [
    {
        name: '丁香医生',
        url: 'https://dxy.com/',
        searchUrl: 'https://dxy.com/search?keyword={query}',
        description: '专业的医疗健康服务平台'
    },
    {
        name: '好大夫在线',
        url: 'https://www.haodf.com/',
        searchUrl: 'https://www.haodf.com/search?kw={query}',
        description: '在线问诊和专家咨询平台'
    },
    {
        name: '阿里健康',
        url: 'https://www.alihealth.com/',
        searchUrl: 'https://www.alihealth.com/search/index.htm?keyword={query}',
        description: '阿里巴巴旗下医疗健康平台'
    },
    {
        name: '腾讯医典',
        url: 'https://h5.baike.qq.com/',
        searchUrl: 'https://h5.baike.qq.com/search?query={query}',
        description: '腾讯旗下权威医学科普平台'
    },
    {
        name: 'MedlinePlus',
        url: 'https://medlineplus.gov/',
        searchUrl: 'https://medlineplus.gov/search.html?query={query}',
        description: '美国国立卫生研究院医学数据库'
    }
];



// 添加AI医疗网站链接到结果
function addAIMedicalLinks(result, query) {
    const encodedQuery = encodeURIComponent(query);
    
    aiMedicalSites.forEach(site => {
        const searchUrl = site.searchUrl.replace('{query}', encodedQuery);
        result.references.push({
            title: `在${site.name}搜索「${query}」`,
            url: searchUrl,
            source: site.name,
            description: site.description
        });
    });
}

// 生成无搜索结果时的响应
function generateNoResultResponse(symptoms, query) {
    const encodedSymptoms = encodeURIComponent(symptoms);
    const encodedQuery = encodeURIComponent(query);
    
    const references = [
        {
            title: '在百度搜索相关症状',
            url: `https://www.baidu.com/s?wd=${encodedSymptoms}+症状+病因`,
            source: '百度'
        },
        {
            title: '在维基百科搜索相关医学信息',
            url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}+medical`,
            source: 'Wikipedia'
        }
    ];

    // 添加AI医疗网站链接
    aiMedicalSites.forEach(site => {
        const searchUrl = site.searchUrl.replace('{query}', encodedQuery);
        references.push({
            title: `在${site.name}搜索「${query}」`,
            url: searchUrl,
            source: site.name,
            description: site.description
        });
    });

    return {
        possibleCause: '根据描述，暂时无法准确判断病因。建议您点击下方AI医疗网站链接，获取更专业的健康咨询服务。',
        department: '建议挂全科或普通内科进行初步诊断',
        treatment: '建议详细描述症状，配合医生进行体格检查和必要的辅助检查',
        medicine: '请遵医嘱用药，不可自行用药',
        references: references,
        searchedFrom: 'AI医疗网站',
        hasAISuggestions: true
    };
}

function formatConsultationResult(analysis) {
    let html = `
        <p><strong>病因分析：</strong>${analysis.possibleCause}</p>
        <p><strong>科室建议：</strong>${analysis.department}</p>
        <p><strong>治疗建议：</strong>${analysis.treatment}</p>
        <p><strong>用药建议：</strong>${analysis.medicine}</p>
    `;

    // 显示置信度
    if (analysis.confidence > 0) {
        const confidenceColor = analysis.confidence >= 70 ? '#28a745' : analysis.confidence >= 40 ? '#ffc107' : '#dc3545';
        html += `<p style="margin-top: 10px;"><strong>匹配置信度：</strong><span style="color: ${confidenceColor}; font-weight: bold;">${analysis.confidence}%</span></p>`;
    }

    // 显示匹配的关键词
    if (analysis.matchedKeywords && analysis.matchedKeywords.length > 0) {
        html += `<p style="margin-top: 5px;"><strong>匹配关键词：</strong>${analysis.matchedKeywords.join('、')}</p>`;
    }

    if (analysis.searchedFrom) {
        html += `<p style="color: #667eea; margin-top: 10px;"><strong>数据来源：</strong>${analysis.searchedFrom}</p>`;
    }

    // 区分普通参考链接和AI医疗网站链接
    if (analysis.references && analysis.references.length > 0) {
        const aiLinks = analysis.references.filter(ref => aiMedicalSites.some(site => site.name === ref.source));
        const otherLinks = analysis.references.filter(ref => !aiMedicalSites.some(site => site.name === ref.source));

        // 显示普通参考链接
        if (otherLinks.length > 0) {
            html += '<div style="margin-top: 15px;"><strong>参考资料：</strong><ul style="padding-left: 20px; margin-top: 8px;">';
            otherLinks.forEach(ref => {
                html += `<li><a href="${ref.url}" target="_blank" rel="noopener" style="color: #667eea;">${ref.title}</a> <span style="color: #999; font-size: 12px;">(${ref.source})</span></li>`;
            });
            html += '</ul></div>';
        }

        // 显示AI医疗网站链接
        if (aiLinks.length > 0) {
            html += '<div style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">';
            html += '<strong style="color: white;">💡 AI医疗咨询推荐：</strong>';
            html += '<p style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 8px;">如需更专业的健康咨询，可访问以下医疗网站：</p>';
            html += '<ul style="padding-left: 20px; margin-top: 8px;">';
            aiLinks.forEach((ref) => {
                const description = ref.description ? ` - ${ref.description}` : '';
                html += `<li style="color: white;"><a href="${ref.url}" target="_blank" rel="noopener" style="color: #ffd700; text-decoration: underline;">${ref.title}</a><span style="color: rgba(255,255,255,0.8); font-size: 12px;">${description}</span></li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
    }

    html += `<p style="color: #dc3545; margin-top: 15px; font-size: 14px;"><strong>⚠️ 重要提示：</strong>以上信息仅供参考，不能替代专业医疗诊断。如有不适请及时就医。</p>`;

    return html;
}

// 历史记录
function showHistoryTab(tabName) {
    document.querySelectorAll('.history-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.history-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function loadHealthHistory() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return;
    }

    return apiRequest(`/api/health-records?userId=${currentUser.id}`)
        .then(records => {
            const tbody = document.getElementById('healthHistoryBody');
            tbody.innerHTML = '';
            
            if (records.length === 0) {
                document.getElementById('noHealthHistory').style.display = 'block';
                return;
            }
            
            document.getElementById('noHealthHistory').style.display = 'none';
            
            records.forEach((record, index) => {
                const status = record.temp && Number(record.temp) > 37.5 ? 'abnormal' : 'normal';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</td>
                    <td>${record.temp || '-'}</td>
                    <td>${record.blood_pressure || '-'}</td>
                    <td>${record.heart_rate || '-'}</td>
                    <td>${record.blood_sugar || '-'}</td>
                    <td><span class="status-${status}">${status === 'normal' ? '正常' : '异常'}</span></td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => {
            console.warn(error.message);
        });
}

function loadConsultHistory() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return;
    }

    return apiRequest(`/api/consultations?userId=${currentUser.id}`)
        .then(records => {
            const tbody = document.getElementById('consultHistoryBody');
            tbody.innerHTML = '';
            
            if (records.length === 0) {
                document.getElementById('noConsultHistory').style.display = 'block';
                return;
            }
            
            document.getElementById('noConsultHistory').style.display = 'none';
            
            records.forEach((record, index) => {
                let analysis = {};
                try {
                    analysis = record.analysis_json ? JSON.parse(record.analysis_json) : {};
                } catch (error) {
                    analysis = {};
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</td>
                    <td>${record.symptoms.substring(0, 30)}${record.symptoms.length > 30 ? '...' : ''}</td>
                    <td>${analysis.department || '-'}</td>
                    <td>${analysis.treatment?.substring(0, 20) || '-'}${analysis.treatment?.length > 20 ? '...' : ''}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => {
            console.warn(error.message);
        });
}

// 管理员面板功能
async function loadAdminPanel() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    await loadUsersTable();
    await loadHealthDataTable();
    await loadConsultationsTable();
    
    // 编辑表单提交
    document.getElementById('editForm').onsubmit = async function(e) {
        e.preventDefault();
        const userId = parseInt(document.getElementById('editUserId').value);
        
        try {
            await apiRequest(`/api/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    username: document.getElementById('editUsername').value,
                    email: document.getElementById('editEmail').value
                })
            });
            await apiRequest(`/api/profiles/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: document.getElementById('editName').value,
                    gender: document.getElementById('editGender').value,
                    age: document.getElementById('editAge').value
                })
            });
            closeEditModal();
            await loadUsersTable();
            alert('修改成功');
        } catch (error) {
            alert(error.message);
        }
    };
}

function showAdminSection(sectionName) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');
}

async function loadUsersTable() {
    const users = await apiRequest('/api/users');
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    const profileMap = {};
    for (const user of users) {
        if (user.role !== 'admin') {
            profileMap[user.id] = await apiRequest(`/api/profiles/${user.id}`);
        }
    }
    
    users.forEach(user => {
        const profile = profileMap[user.id] || {};
        if (user.role !== 'admin') {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${profile.name || '-'}</td>
                <td>${profile.gender || '-'}</td>
                <td>${profile.age || '-'}</td>
                <td>
                    <button class="action-btn edit" onclick="editUser(${user.id})">编辑</button>
                    <button class="action-btn delete" onclick="deleteUser(${user.id})">删除</button>
                </td>
            `;
            tbody.appendChild(row);
        }
    });
}

async function editUser(userId) {
    const user = (await apiRequest('/api/users')).find(u => u.id === userId);
    const profile = await apiRequest(`/api/profiles/${userId}`);
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editName').value = profile.name || '';
    document.getElementById('editGender').value = profile.gender || '';
    document.getElementById('editAge').value = profile.age || '';
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function deleteUser(userId) {
    if (confirm('确定要删除该用户吗？')) {
        try {
            await apiRequest(`/api/users/${userId}`, { method: 'DELETE' });
            await loadUsersTable();
            await loadHealthDataTable();
            await loadConsultationsTable();
            alert('删除成功');
        } catch (error) {
            alert(error.message);
        }
    }
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const username = row.children[1].textContent.toLowerCase();
        row.style.display = username.includes(searchTerm) ? '' : 'none';
    });
}

async function loadHealthDataTable() {
    const [healthRecords, users] = await Promise.all([
        apiRequest('/api/health-records'),
        apiRequest('/api/users')
    ]);
    const tbody = document.getElementById('healthDataTableBody');
    tbody.innerHTML = '';
    
    const filter = document.getElementById('healthUserFilter');
    filter.innerHTML = '<option value="">全部用户</option>';
    users.filter(u => u.role !== 'admin').forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        filter.appendChild(option);
    });
    
    let id = 1;
    healthRecords.forEach(record => {
        const user = users.find(u => u.id === record.user_id);
        if (!user || user.role === 'admin') {
            return;
        }
        const status = record.temp && Number(record.temp) > 37.5 ? 'abnormal' : 'normal';
        const row = document.createElement('tr');
        row.dataset.userId = record.user_id;
        row.innerHTML = `
            <td>${id++}</td>
            <td>${user.username}</td>
            <td>${record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</td>
            <td>${record.temp || '-'}</td>
            <td>${record.blood_pressure || '-'}</td>
            <td>${record.heart_rate || '-'}</td>
            <td>${record.blood_sugar || '-'}</td>
            <td><span class="status-${status}">${status === 'normal' ? '正常' : '异常'}</span></td>
            <td><button class="action-btn delete" onclick="deleteHealthRecord(${record.id}, this)">删除</button></td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteHealthRecord(recordId, btn) {
    if (confirm('确定要删除该健康记录吗？')) {
        try {
            await apiRequest(`/api/health-records/${recordId}`, { method: 'DELETE' });
            btn.parentElement.parentElement.remove();
        } catch (error) {
            alert(error.message);
        }
    }
}

function filterHealthData() {
    const userId = document.getElementById('healthUserFilter').value;
    const rows = document.querySelectorAll('#healthDataTableBody tr');
    
    rows.forEach(row => {
        if (!userId || row.dataset.userId === userId) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatConsultationCell(value, maxLength = 120) {
    const text = value == null || value === '' ? '-' : String(value);
    const safeText = escapeHtml(text).replace(/\n/g, '<br>');
    if (safeText.length <= maxLength) {
        return safeText;
    }
    return `${safeText.slice(0, maxLength)}...`;
}

async function loadConsultationsTable() {
    const [consultations, users] = await Promise.all([
        apiRequest('/api/consultations'),
        apiRequest('/api/users')
    ]);
    const tbody = document.getElementById('consultationsTableBody');
    tbody.innerHTML = '';
    
    const filter = document.getElementById('consultUserFilter');
    filter.innerHTML = '<option value="">全部用户</option>';
    users.filter(u => u.role !== 'admin').forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        filter.appendChild(option);
    });
    
    let id = 1;
    consultations.forEach(record => {
        const user = users.find(u => u.id === record.user_id);
        if (!user || user.role === 'admin') {
            return;
        }
        let analysis = {};
        try {
            analysis = record.analysis_json ? JSON.parse(record.analysis_json) : {};
        } catch (error) {
            analysis = {};
        }
        const row = document.createElement('tr');
        row.dataset.userId = record.user_id;
        row.innerHTML = `
            <td>${id++}</td>
            <td>${escapeHtml(user.username)}</td>
            <td>${record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</td>
            <td>${formatConsultationCell(record.symptoms, 180)}</td>
            <td>${formatConsultationCell(record.duration, 80)}</td>
            <td>${formatConsultationCell(record.other_symptoms, 180)}</td>
            <td>${formatConsultationCell(analysis.department, 120)}</td>
            <td>${formatConsultationCell(analysis.treatment, 120)}</td>
            <td>${formatConsultationCell(analysis.medicine, 120)}</td>
            <td><button class="action-btn delete" onclick="deleteConsultation(${record.id}, this)">删除</button></td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteConsultation(recordId, btn) {
    if (confirm('确定要删除该咨询记录吗？')) {
        try {
            await apiRequest(`/api/consultations/${recordId}`, { method: 'DELETE' });
            btn.parentElement.parentElement.remove();
        } catch (error) {
            alert(error.message);
        }
    }
}

function filterConsultations() {
    const userId = document.getElementById('consultUserFilter').value;
    const rows = document.querySelectorAll('#consultationsTableBody tr');
    
    rows.forEach(row => {
        if (!userId || row.dataset.userId === userId) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// 导出功能
async function exportUsers() {
    const users = await apiRequest('/api/users');
    const exportData = [];
    for (const user of users.filter(u => u.role !== 'admin')) {
        const profile = await apiRequest(`/api/profiles/${user.id}`);
        exportData.push({
            ID: user.id,
            用户名: user.username,
            邮箱: user.email,
            姓名: profile.name || '-',
            性别: profile.gender || '-',
            年龄: profile.age || '-'
        });
    }
    
    downloadCSV(exportData, '用户数据.csv');
}

async function exportHealthData() {
    const [healthRecords, users] = await Promise.all([
        apiRequest('/api/health-records'),
        apiRequest('/api/users')
    ]);
    
    const exportData = [];
    healthRecords.forEach(record => {
        const user = users.find(u => u.id === record.user_id);
        if (!user || user.role === 'admin') {
            return;
        }
        exportData.push({
            用户: user.username,
            日期: record.created_at ? new Date(record.created_at).toLocaleString() : '-',
            体温: record.temp || '-',
            血压: record.blood_pressure || '-',
            心率: record.heart_rate || '-',
            血糖: record.blood_sugar || '-',
            胆固醇: record.cholesterol || '-',
            血氧饱和度: record.oxygen || '-'
        });
    });
    
    downloadCSV(exportData, '健康数据.csv');
}

async function exportConsultations() {
    const [consultations, users] = await Promise.all([
        apiRequest('/api/consultations'),
        apiRequest('/api/users')
    ]);
    
    const exportData = [];
    consultations.forEach(record => {
        const user = users.find(u => u.id === record.user_id);
        if (!user || user.role === 'admin') {
            return;
        }
        let analysis = {};
        try {
            analysis = record.analysis_json ? JSON.parse(record.analysis_json) : {};
        } catch (error) {
            analysis = {};
        }
        exportData.push({
            用户: user.username,
            日期: record.created_at ? new Date(record.created_at).toLocaleString() : '-',
            症状描述: record.symptoms,
            持续时间: record.duration || '-',
            其他症状: record.other_symptoms || '-',
            科室建议: analysis.department || '-',
            治疗建议: analysis.treatment || '-',
            用药建议: analysis.medicine || '-'
        });
    });
    
    downloadCSV(exportData, '咨询记录.csv');
}

function downloadCSV(data, filename) {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ======== 症状数据库扩展（覆盖重复条目 + 新增类别） ========
// 覆盖重复条目 - 合并更完整的版本
symptomDatabase['恶心呕吐'] = {
    keywords: ['恶心', '呕吐', '想吐', '反胃', '呕', '干呕', '呕吐不止', '晨吐', '呕血'],
    combinations: {
        '腹痛|腹泻': { cause: '可能为急性肠胃炎、食物中毒或肠道感染', department: '消化内科', treatment: '建议暂时禁食或清淡饮食，补充水分和电解质', medicine: '可服用甲氧氯普胺止吐，蒙脱石散止泻' },
        '头痛|头晕|眩晕': { cause: '可能为偏头痛、颅内压增高、眩晕症或前庭功能障碍', department: '神经内科', treatment: '建议卧床休息，保持安静环境，避免强光刺激', medicine: '可服用止吐药，遵医嘱治疗原发病' },
        '发烧|发热|感染': { cause: '可能为全身性感染、流感、脑膜炎或病毒性疾病', department: '内科或急诊科', treatment: '建议立即就医检查，多喝水，监测体温', medicine: '对症治疗，遵医嘱用药' },
        '停经|月经推迟|怀孕可能': { cause: '可能为早孕反应或宫外孕', department: '妇科', treatment: '建议进行妊娠测试，排除宫外孕风险', medicine: '无需特殊用药，严重者就医' },
        '胸闷|胸痛|压榨感': { cause: '可能为心肌梗死、心绞痛或急性胰腺炎', department: '急诊科', treatment: '建议立即拨打急救电话，不要延误', medicine: '遵医嘱紧急处理，不可自行用药' },
        '服药后|饮酒后': { cause: '可能为药物副作用、酒精中毒或药物过量', department: '急诊科', treatment: '建议立即停药/停酒，多喝水促进代谢，必要时洗胃', medicine: '遵医嘱处理' },
        '呕血|咖啡色呕吐物|黑便': { cause: '可能为上消化道出血、胃溃疡出血或食管静脉曲张破裂', department: '急诊科或消化内科', treatment: '建议立即就医，禁食禁水', medicine: '遵医嘱紧急止血治疗' },
        '右上腹痛|油腻食物后': { cause: '可能为胆囊炎、胆结石或胰腺炎', department: '消化内科或肝胆外科', treatment: '建议低脂饮食，避免暴饮暴食', medicine: '遵医嘱用药' }
    },
    default: { cause: '可能为消化系统问题、药物副作用、怀孕或感染性疾病', department: '消化内科', treatment: '建议暂时禁食，少量多次饮水，观察症状变化', medicine: '可服用维生素B6或甲氧氯普胺缓解' }
};

symptomDatabase['呼吸困难'] = {
    keywords: ['呼吸困难', '喘不上气', '喘不过气', '喘气困难', '憋气', '气短', '喘息', '呼吸急促', '呼吸不畅', '胸闷气短'],
    combinations: {
        '胸痛|压榨感|心慌': { cause: '可能为心脏病发作、心肌梗死、肺栓塞或气胸', department: '急诊科或心内科', treatment: '建议立即拨打急救电话，保持安静半卧位', medicine: '遵医嘱紧急处理' },
        '咳嗽|咳痰|发烧': { cause: '可能为肺炎、支气管炎、哮喘急性发作或慢性阻塞性肺病急性加重', department: '呼吸内科', treatment: '建议立即就医，保持呼吸道通畅', medicine: '遵医嘱使用支气管扩张剂、抗生素或激素' },
        '喉咙发紧|声音嘶哑|喉痛': { cause: '可能为急性喉炎、喉头水肿、会厌炎或严重过敏反应', department: '急诊科或耳鼻喉科', treatment: '建议立即就医，保持气道通畅', medicine: '遵医嘱使用激素或抗过敏药物' },
        '平躺加重|坐起缓解|夜间发作': { cause: '可能为心力衰竭、肺水肿或睡眠呼吸暂停', department: '心内科或呼吸内科', treatment: '建议半卧位休息，吸氧，限盐限水', medicine: '遵医嘱使用利尿剂或强心药物' },
        '鼻塞|流涕|打喷嚏': { cause: '可能为严重感冒、鼻窦炎、过敏性鼻炎或鼻息肉', department: '耳鼻喉科', treatment: '建议使用鼻用减充血剂，保持鼻腔通畅', medicine: '可服用抗组胺药或使用鼻用激素喷雾' },
        '活动后加重|休息缓解': { cause: '可能为心肺功能不全、贫血或体质虚弱', department: '心内科或呼吸内科', treatment: '建议避免剧烈运动，适当锻炼增强心肺功能', medicine: '遵医嘱用药治疗原发病' },
        '过敏|接触过敏原后|皮疹': { cause: '可能为严重过敏反应、过敏性休克或哮喘发作', department: '急诊科', treatment: '建议立即脱离过敏原，拨打急救电话', medicine: '遵医嘱使用肾上腺素或抗过敏药物' },
        '焦虑|紧张|恐惧感': { cause: '可能为惊恐发作、焦虑症或过度换气综合征', department: '心理科或急诊科', treatment: '建议做深呼吸练习，用纸袋呼吸法缓解', medicine: '遵医嘱使用抗焦虑药物' }
    },
    default: { cause: '可能为哮喘、心肺疾病、贫血、焦虑或过敏反应', department: '急诊科或呼吸内科', treatment: '建议立即就医明确诊断，不要延误', medicine: '遵医嘱用药' }
};

symptomDatabase['腹泻'] = {
    keywords: ['腹泻', '拉肚子', '水样便', '稀便', '频繁排便', '腹泻不止', '大便稀溏'],
    combinations: {
        '腹痛|恶心|呕吐': { cause: '可能为急性肠胃炎、食物中毒或肠道感染', department: '消化内科', treatment: '建议清淡饮食，补充水分和电解质（口服补液盐）', medicine: '可服用蒙脱石散止泻，益生菌调节肠道' },
        '发烧|感染|寒战': { cause: '可能为细菌性痢疾、肠道感染或病毒性肠炎', department: '消化内科或感染科', treatment: '建议多喝水，避免脱水，就医检查大便常规', medicine: '遵医嘱使用抗生素或抗病毒药物' },
        '便血|黏液便|脓血便': { cause: '可能为细菌性痢疾、溃疡性结肠炎、克罗恩病或结直肠肿瘤', department: '消化内科', treatment: '建议立即就医进行大便检查和肠镜检查', medicine: '遵医嘱用药，不可自行使用止泻药' },
        '旅游后|不洁饮食后|外出就餐后': { cause: '可能为旅行者腹泻、细菌或寄生虫感染', department: '消化内科', treatment: '建议注意饮食卫生，多喝水', medicine: '可服用益生菌，严重时就医' },
        '长期反复|体重下降|消瘦': { cause: '可能为慢性肠炎、克罗恩病、肠易激综合征或吸收不良综合征', department: '消化内科', treatment: '建议进行肠镜及相关检查明确诊断', medicine: '遵医嘱用药' },
        '抗生素使用后|住院期间': { cause: '可能为菌群失调、艰难梭菌感染或抗生素相关性腹泻', department: '消化内科', treatment: '建议咨询医生是否需要调整抗生素', medicine: '遵医嘱使用益生菌或甲硝唑' },
        '进食牛奶后|乳制品后': { cause: '可能为乳糖不耐受', department: '消化内科', treatment: '建议避免或减少乳制品摄入', medicine: '可服用乳糖酶补充剂' },
        '精神紧张|考试前|压力大时': { cause: '可能为肠易激综合征或功能性腹泻', department: '消化内科', treatment: '建议放松心情，规律作息', medicine: '可服用益生菌调节' }
    },
    default: { cause: '可能为肠道感染、消化不良、食物中毒或肠易激综合征', department: '消化内科', treatment: '建议清淡饮食，多喝水补充电解质', medicine: '可服用蒙脱石散和益生菌' }
};

symptomDatabase['便秘'] = {
    keywords: ['便秘', '大便干结', '排便困难', '数日无便', '大便不畅', '排便费力', '大便硬'],
    combinations: {
        '腹痛|腹胀|腹部不适': { cause: '可能为肠梗阻、肠道功能紊乱或粪石性肠梗阻', department: '消化内科', treatment: '建议立即就医排除肠梗阻', medicine: '遵医嘱治疗' },
        '便血|肛门疼痛|排便时痛': { cause: '可能为痔疮、肛裂或直肠息肉', department: '肛肠科或消化内科', treatment: '建议温水坐浴，保持大便通畅', medicine: '可使用痔疮膏或栓剂' },
        '体重下降|食欲减退|贫血': { cause: '可能为结直肠肿瘤、甲状腺功能减退或慢性疾病', department: '消化内科或内分泌科', treatment: '建议尽快进行肠镜和相关检查', medicine: '遵医嘱治疗' },
        '长期卧床|活动很少|手术后': { cause: '可能为肠蠕动减慢、活动不足', department: '内科', treatment: '建议在允许范围内适当活动，腹部顺时针按摩', medicine: '可使用乳果糖或开塞露' },
        '饮食精细|蔬菜少吃|饮水少': { cause: '可能为膳食纤维和水分摄入不足', department: '内科', treatment: '建议多吃蔬菜水果粗粮，每天饮水1500-2000ml', medicine: '可服用膳食纤维补充剂' },
        '药物使用后|服用止痛药': { cause: '可能为药物副作用（如阿片类、钙通道阻滞剂等）', department: '内科', treatment: '建议咨询医生是否需要调整用药', medicine: '遵医嘱处理' },
        '老年人|孕妇': { cause: '可能为生理性便秘或激素变化引起', department: '内科或妇科', treatment: '建议适当运动，多吃高纤维食物', medicine: '孕妇需遵医嘱用药' },
        '一周排便少于3次|长期依赖泻药': { cause: '可能为慢性便秘或泻药依赖性便秘', department: '消化内科', treatment: '建议逐步停用泻药，建立规律排便习惯', medicine: '遵医嘱使用温和通便药' }
    },
    default: { cause: '可能为饮食纤维不足、饮水不够、缺乏运动或肠道功能紊乱', department: '消化内科', treatment: '建议增加膳食纤维摄入，多喝水，适当运动，建立规律排便习惯', medicine: '可使用乳果糖或益生菌' }
};

symptomDatabase['视力问题'] = {
    keywords: ['视力模糊', '视力下降', '视物不清', '眼睛模糊', '视力减退', '眼干', '眼干涩', '眼睛干涩', '看东西模糊', '视物变形'],
    combinations: {
        '眼痛|眼胀|头痛|恶心': { cause: '可能为青光眼、眼压升高或视神经病变', department: '眼科', treatment: '建议立即就医检查眼压，急性闭角型青光眼需急诊处理', medicine: '遵医嘱使用降眼压药物' },
        '眼干|异物感|烧灼感|畏光': { cause: '可能为干眼症、视疲劳或角结膜炎', department: '眼科', treatment: '建议使用人工泪液，减少用眼时间', medicine: '可使用玻璃酸钠滴眼液' },
        '眼前黑影漂浮|闪光感|飞蚊症': { cause: '可能为玻璃体混浊、视网膜脱离或玻璃体出血', department: '眼科', treatment: '建议立即就医散瞳检查眼底', medicine: '遵医嘱治疗' },
        '眼红|分泌物增多|眼痒': { cause: '可能为结膜炎、角膜炎、麦粒肿或过敏', department: '眼科', treatment: '建议保持眼部清洁，避免揉眼', medicine: '遵医嘱使用抗生素或抗过敏滴眼液' },
        '视力突然下降|眼前发黑|视野缺损': { cause: '可能为视网膜中央动脉阻塞、视神经炎或脑卒中', department: '眼科或急诊科', treatment: '建议立即就医，黄金抢救时间很短', medicine: '遵医嘱紧急处理' },
        '长时间用眼后加重|电脑手机': { cause: '可能为视疲劳、干眼症或屈光不正未矫正', department: '眼科', treatment: '建议定时休息（20-20-20法则），做眼保健操', medicine: '可使用缓解疲劳的眼药水' },
        '夜间视力差|天黑看不清': { cause: '可能为夜盲症、视网膜色素变性或维生素A缺乏', department: '眼科', treatment: '建议补充维生素A，避免夜间驾驶', medicine: '遵医嘱治疗' },
        '糖尿病史|高血压史': { cause: '可能为糖尿病视网膜病变或高血压视网膜病变', department: '眼科', treatment: '建议控制血糖血压，定期检查眼底', medicine: '遵医嘱治疗原发病' },
        '复视|看东西重影': { cause: '可能为眼肌问题、颅神经麻痹或脑部病变', department: '眼科或神经内科', treatment: '建议立即就医检查', medicine: '遵医嘱治疗' }
    },
    default: { cause: '可能为屈光不正（近视/远视/散光）、视疲劳、干眼症或眼部疾病', department: '眼科', treatment: '建议注意用眼卫生，定期检查视力，减少长时间用眼', medicine: '可使用人工泪液缓解' }
};

symptomDatabase['乏力'] = {
    keywords: ['乏力', '疲劳', '没力气', '虚弱', '全身无力', '容易疲劳', '精神不振', '没精神', '无精打采', '提不起精神', '困倦', '嗜睡', '疲倦'],
    combinations: {
        '发烧|发热|感染|咳嗽': { cause: '可能为感染性疾病、流感、COVID-19或慢性感染', department: '内科或感染科', treatment: '建议休息，补充营养，多喝水', medicine: '对症治疗原发病' },
        '贫血|头晕|面色苍白|心悸': { cause: '可能为缺铁性贫血、巨幼细胞性贫血或慢性病贫血', department: '血液科', treatment: '建议补充铁质和维生素B12，多吃动物肝脏、绿叶蔬菜', medicine: '可服用铁剂或维生素B族' },
        '体重下降|食欲减退|消瘦': { cause: '可能为甲状腺功能亢进、糖尿病、结核或恶性肿瘤', department: '内分泌科或肿瘤科', treatment: '建议检查甲状腺功能、血糖和相关肿瘤标志物', medicine: '遵医嘱治疗原发病' },
        '睡眠不好|失眠|多梦|易醒': { cause: '可能为睡眠不足、睡眠呼吸暂停、神经衰弱或焦虑抑郁', department: '神经内科或心理科', treatment: '建议改善睡眠质量，保持规律作息', medicine: '可服用褪黑素或遵医嘱用药' },
        '肌肉酸痛|关节痛|晨僵': { cause: '可能为风湿性疾病、慢性疲劳综合征或纤维肌痛', department: '风湿免疫科', treatment: '建议适当锻炼，保持良好心态', medicine: '遵医嘱用药' },
        '心慌|气短|活动后加重': { cause: '可能为心脏病、贫血、甲状腺功能减退或肺部疾病', department: '心内科', treatment: '建议就医检查心脏和肺部功能', medicine: '遵医嘱治疗原发病' },
        '怕冷|畏寒|皮肤干燥|脱发': { cause: '可能为甲状腺功能减退', department: '内分泌科', treatment: '建议检查甲状腺功能（TSH等）', medicine: '遵医嘱补充甲状腺素' },
        '长期压力|工作过劳|精神紧张': { cause: '可能为慢性疲劳综合征、神经衰弱或 burnout', department: '内科或心理科', treatment: '建议调整工作节奏，保证休息，适当运动', medicine: '可补充复合维生素B族' }
    },
    default: { cause: '可能为过度劳累、睡眠不足、营养不良、贫血或甲状腺功能减退', department: '内科', treatment: '建议保证充足睡眠（7-8小时），均衡饮食，适当运动', medicine: '可补充复合维生素，必要时就医检查' }
};

// ======== 新增症状类别 ========
// --- 心血管系统 ---
symptomDatabase['心跳过速'] = {
    keywords: ['心跳过快', '心动过速', '心跳加速', '心慌', '心悸', '心跳快', '心脏乱跳', '心跳剧烈'],
    combinations: {
        '发热|发烧|感染': { cause: '可能为发热引起的代偿性心动过速或感染性心肌炎', department: '心内科或内科', treatment: '建议治疗原发病，监测体温和心率', medicine: '遵医嘱用药' },
        '贫血|头晕|乏力': { cause: '可能为贫血引起的心脏代偿性加快', department: '血液科或心内科', treatment: '建议检查血常规，补充铁质', medicine: '遵医嘱补充铁剂' },
        '甲亢|消瘦|手抖|怕热': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '焦虑|紧张|压力大|失眠': { cause: '可能为焦虑症、惊恐发作或自主神经功能紊乱', department: '心内科或心理科', treatment: '建议深呼吸放松，避免咖啡因和浓茶', medicine: '遵医嘱使用β受体阻滞剂或抗焦虑药物' },
        '运动后|劳累后': { cause: '可能为生理性心动过速或心肺功能不足', department: '心内科', treatment: '建议适当控制运动强度，逐渐增加运动量', medicine: '无需特殊用药' },
        '饮酒后|咖啡后|浓茶后': { cause: '可能为刺激性物质引起的心率加快', department: '心内科', treatment: '建议减少或避免咖啡因和酒精摄入', medicine: '无需特殊用药' },
        '突发突止|阵发性': { cause: '可能为阵发性室上性心动过速或房颤', department: '心内科', treatment: '建议做心电图或动态心电图检查', medicine: '遵医嘱使用抗心律失常药物' }
    },
    default: { cause: '可能为生理性心动过速（运动/情绪）、贫血、甲亢、焦虑或心律失常', department: '心内科', treatment: '建议做心电图检查，避免刺激性食物和饮品', medicine: '遵医嘱用药' }
};

symptomDatabase['心跳过缓'] = {
    keywords: ['心跳过慢', '心动过缓', '心率慢', '心跳慢', '心脏跳得慢'],
    combinations: {
        '头晕|乏力|眼前发黑': { cause: '可能为病态窦房结综合征、房室传导阻滞', department: '心内科', treatment: '建议做心电图和动态心电图检查', medicine: '严重者需安装起搏器' },
        '晕厥|昏倒|意识丧失': { cause: '可能为心源性晕厥、阿斯综合征', department: '心内科或急诊科', treatment: '建议立即就医', medicine: '遵医嘱安装心脏起搏器' },
        '胸闷|胸痛|活动后加重': { cause: '可能为冠心病、心肌缺血', department: '心内科', treatment: '建议做冠脉CT或造影检查', medicine: '遵医嘱用药' },
        '运动员|长期锻炼': { cause: '可能为运动员心脏（生理性窦性心动过缓）', department: '心内科', treatment: '如无症状一般无需特殊处理', medicine: '无需用药，定期复查' },
        '服用药物后|β受体阻滞剂': { cause: '可能为药物引起的窦性心动过缓', department: '心内科', treatment: '建议咨询医生是否需要调整药物剂量', medicine: '遵医嘱调整用药' },
        '甲减|怕冷|乏力|体重增加': { cause: '可能为甲状腺功能减退引起的心率减慢', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' }
    },
    default: { cause: '可能为生理性心动过缓（如运动员）、药物影响、甲状腺功能减退或心脏传导系统疾病', department: '心内科', treatment: '建议做心电图检查，严重者需安装起搏器', medicine: '遵医嘱治疗原发病' }
};

// --- 消化系统 ---
symptomDatabase['消化不良'] = {
    keywords: ['消化不良', '胃胀', '腹胀', '胃不舒服', '消化不好', '饭后腹胀', '不消化', '积食', '食欲不振'],
    combinations: {
        '反酸|烧心|嗳气': { cause: '可能为功能性消化不良、胃食管反流病或慢性胃炎', department: '消化内科', treatment: '建议少食多餐，避免辛辣油腻食物', medicine: '可服用促胃动力药（多潘立酮）' },
        '腹痛|胃痛|上腹部不适': { cause: '可能为慢性胃炎、胃溃疡或十二指肠溃疡', department: '消化内科', treatment: '建议规律饮食，避免生冷刺激食物', medicine: '可服用胃黏膜保护剂' },
        '恶心|想吐|食欲差': { cause: '可能为急性胃肠炎或胃动力不足', department: '消化内科', treatment: '建议清淡饮食，暂时减轻肠胃负担', medicine: '可服用健胃消食片' },
        '精神紧张|压力大|焦虑': { cause: '可能为功能性消化不良（与情绪相关）', department: '消化内科', treatment: '建议放松心情，饭前饭后散步', medicine: '可服用促胃动力药' },
        '暴饮暴食|饮食不规律|吃太快': { cause: '可能为饮食不当引起的急性消化不良', department: '消化内科', treatment: '建议细嚼慢咽，规律饮食，七分饱', medicine: '可服用消化酶制剂' },
        '油腻食物后|荤食后': { cause: '可能为胆囊或胰腺功能不全', department: '消化内科', treatment: '建议低脂饮食', medicine: '可服用复方消化酶' }
    },
    default: { cause: '可能为功能性消化不良、慢性胃炎、饮食不当或精神因素', department: '消化内科', treatment: '建议规律饮食，细嚼慢咽，避免暴饮暴食', medicine: '可服用健胃消食片或多潘立酮' }
};

symptomDatabase['食欲不振'] = {
    keywords: ['食欲不振', '不想吃饭', '没胃口', '厌食', '吃不下', '食欲减退'],
    combinations: {
        '恶心|呕吐|腹痛': { cause: '可能为急性或慢性胃肠炎、消化性溃疡', department: '消化内科', treatment: '建议食用易消化流食，少食多餐', medicine: '可服用促胃动力药' },
        '乏力|体重下降|贫血': { cause: '可能为慢性消耗性疾病、恶性肿瘤或结核', department: '内科或肿瘤科', treatment: '建议尽快就医全面检查', medicine: '遵医嘱治疗原发病' },
        '厌油腻|右上腹痛|黄疸': { cause: '可能为肝炎、胆囊炎或胰腺疾病', department: '消化内科或肝胆外科', treatment: '建议检查肝功能和腹部B超', medicine: '遵医嘱用药' },
        '情绪低落|焦虑|抑郁': { cause: '可能为抑郁症、焦虑症或神经性厌食', department: '心理科或精神科', treatment: '建议心理疏导，必要时药物治疗', medicine: '遵医嘱使用抗抑郁药物' },
        '发烧|感染|长期服药': { cause: '可能为感染性疾病或药物副作用', department: '内科', treatment: '建议治疗原发病，适当调整用药', medicine: '遵医嘱调整药物' }
    },
    default: { cause: '可能为消化系统疾病、情绪问题、药物副作用或全身性疾病', department: '消化内科', treatment: '建议清淡饮食，少食多餐', medicine: '可服用健胃消食片或维生素B族' }
};

symptomDatabase['吞咽困难'] = {
    keywords: ['吞咽困难', '吞东西费劲', '咽食物困难', '吃东西噎', '吞咽疼痛', '进食呛咳'],
    combinations: {
        '喉咙痛|发烧|声音嘶哑': { cause: '可能为急性咽喉炎、扁桃体炎或会厌炎', department: '耳鼻喉科', treatment: '建议流质饮食，多喝水', medicine: '遵医嘱使用抗生素或抗炎药物' },
        '反酸|烧心|胸骨后痛': { cause: '可能为胃食管反流病、食管炎或食管溃疡', department: '消化内科', treatment: '建议抬高床头，避免睡前进食', medicine: '可服用质子泵抑制剂（奥美拉唑）' },
        '进行性加重|体重下降': { cause: '可能为食管癌、贲门癌或食管良性狭窄', department: '消化内科或胸外科', treatment: '建议尽快进行胃镜检查', medicine: '遵医嘱治疗' },
        '饮水呛咳|说话不清|肢体无力': { cause: '可能为脑卒中、延髓麻痹或神经系统疾病', department: '神经内科或急诊科', treatment: '建议立即就医', medicine: '遵医嘱治疗' },
        '进食后咳嗽|反复肺炎': { cause: '可能为误吸、食管气管瘘或吞咽功能障碍', department: '消化内科或呼吸内科', treatment: '建议进行吞咽功能评估', medicine: '遵医嘱治疗' }
    },
    default: { cause: '可能为咽喉炎、食管疾病、神经系统疾病或心理因素', department: '耳鼻喉科或消化内科', treatment: '建议流质或软食，避免干硬食物，及时就医检查', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['痔疮'] = {
    keywords: ['痔疮', '便血', '肛门痛', '肛门坠胀', '肛门口有肉球', '大便带血', '肛门瘙痒', '排便出血'],
    combinations: {
        '便秘|大便干结|排便用力': { cause: '可能为内痔、外痔或混合痔', department: '肛肠科', treatment: '建议多吃蔬菜水果，保持大便通畅，温水坐浴', medicine: '可使用痔疮膏或痔疮栓' },
        '肛门疼痛|坐立不安': { cause: '可能为血栓性外痔、肛裂或肛周脓肿', department: '肛肠科', treatment: '建议温水坐浴，避免久坐', medicine: '可服用止痛药，使用痔疮膏' },
        '便血|鲜红色血|滴血': { cause: '可能为内痔出血、肛裂或直肠息肉', department: '肛肠科', treatment: '建议尽快就医做肛门指检或肠镜检查', medicine: '遵医嘱治疗' },
        '贫血|头晕|乏力': { cause: '可能为长期痔疮出血导致贫血', department: '肛肠科或血液科', treatment: '建议治疗痔疮，补充铁质', medicine: '可服用铁剂' },
        '腹泻|频繁排便': { cause: '可能为腹泻刺激肛周引起痔疮加重', department: '肛肠科', treatment: '建议治疗腹泻，保持肛周清洁', medicine: '遵医嘱用药' },
        '孕妇|产后': { cause: '可能为妊娠期或产后痔疮', department: '肛肠科', treatment: '建议温水坐浴，左侧卧位休息', medicine: '遵医嘱使用孕妇安全药物' }
    },
    default: { cause: '可能为痔疮、肛裂或直肠疾病', department: '肛肠科', treatment: '建议保持大便通畅，避免久坐，温水坐浴', medicine: '可使用痔疮膏或痔疮栓' }
};

// --- 神经系统 ---
symptomDatabase['晕厥'] = {
    keywords: ['晕厥', '昏倒', '晕倒', '昏迷', '意识丧失', '不省人事', '晕过去'],
    combinations: {
        '心脏不适|心慌|胸闷': { cause: '可能为心源性晕厥（心律失常、心肌梗死等）', department: '心内科或急诊科', treatment: '建议立即拨打急救电话', medicine: '遵医嘱紧急处理' },
        '抽搐|口吐白沫|牙关紧闭': { cause: '可能为癫痫发作', department: '神经内科或急诊科', treatment: '建议保持侧卧位，防止舌咬伤，就医', medicine: '遵医嘱使用抗癫痫药物' },
        '头晕|恶心|出汗|站立时': { cause: '可能为血管迷走性晕厥或体位性低血压', department: '心内科或神经内科', treatment: '建议立即平卧，抬高下肢', medicine: '无需特殊用药' },
        '饥饿|没吃饭|心慌手抖': { cause: '可能为低血糖昏迷', department: '内分泌科或急诊科', treatment: '建议立即补充糖分（糖果、糖水）', medicine: '严重者静脉输注葡萄糖' },
        '剧烈头痛|喷射性呕吐': { cause: '可能为脑出血、蛛网膜下腔出血或颅内高压', department: '神经内科或急诊科', treatment: '建议立即拨打急救电话', medicine: '遵医嘱紧急处理' },
        '老年人|起身时|排尿后': { cause: '可能为体位性低血压或排尿性晕厥', department: '心内科', treatment: '建议缓慢变换姿势', medicine: '无需特殊用药，注意生活细节' }
    },
    default: { cause: '可能为心源性、神经源性、低血糖、体位性低血压或血管迷走性晕厥', department: '急诊科或神经内科', treatment: '建议立即就医，明确病因', medicine: '遵医嘱治疗' }
};

symptomDatabase['记忆力减退'] = {
    keywords: ['记忆力减退', '健忘', '记不住事情', '记忆力下降', '忘性大', '丢三落四'],
    combinations: {
        '失眠|睡眠差|多梦': { cause: '可能为睡眠不足引起的记忆力下降', department: '神经内科', treatment: '建议改善睡眠质量，保证充足睡眠', medicine: '可服用褪黑素改善睡眠' },
        '头痛|头晕|头部外伤史': { cause: '可能为脑外伤后遗症、脑震荡或慢性硬膜下血肿', department: '神经内科', treatment: '建议就医进行脑部检查', medicine: '遵医嘱使用营养神经药物' },
        '情绪低落|焦虑|抑郁': { cause: '可能为抑郁症或焦虑症引起的认知功能下降', department: '心理科或神经内科', treatment: '建议心理治疗，必要时药物干预', medicine: '遵医嘱使用抗抑郁药物' },
        '注意力不集中|工作效率低': { cause: '可能为成人ADHD、神经衰弱或过度疲劳', department: '神经内科', treatment: '建议劳逸结合，适当运动', medicine: '遵医嘱治疗' },
        '老年人|进行性加重|性格改变': { cause: '可能为阿尔茨海默病、血管性痴呆或额颞叶痴呆', department: '神经内科', treatment: '建议尽早就医进行认知功能评估', medicine: '遵医嘱使用改善认知的药物' },
        '长期饮酒|酒精依赖': { cause: '可能为酒精性脑病或维生素B1缺乏', department: '神经内科', treatment: '建议戒酒，补充B族维生素', medicine: '遵医嘱补充维生素B1' },
        '甲减|怕冷|乏力|体重增加': { cause: '可能为甲状腺功能减退引起的认知功能下降', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' }
    },
    default: { cause: '可能为睡眠不足、过度疲劳、神经衰弱、抑郁症或脑部疾病', department: '神经内科', treatment: '建议改善睡眠，减轻压力，补充B族维生素', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['抽筋'] = {
    keywords: ['抽筋', '肌肉抽搐', '腿抽筋', '肌肉痉挛', '脚抽筋', '夜间抽筋'],
    combinations: {
        '夜间发作|睡眠中': { cause: '可能为低钙血症、低镁血症或受凉引起', department: '内科', treatment: '建议注意保暖，睡前拉伸', medicine: '可补充钙剂和镁剂' },
        '运动后|大量出汗后': { cause: '可能为电解质流失过多或肌肉疲劳', department: '内科', treatment: '建议运动后补充电解质水，适当拉伸', medicine: '可补充钙镁片或电解质饮料' },
        '孕妇|孕中期|孕晚期': { cause: '可能为妊娠期缺钙引起的腿抽筋', department: '妇产科', treatment: '建议适当补钙，腿部保暖', medicine: '遵医嘱补充钙剂' },
        '老年人|骨质疏松': { cause: '可能为缺钙、缺维生素D或动脉硬化', department: '内科或骨科', treatment: '建议补充钙和维生素D，适当日晒', medicine: '遵医嘱补充钙剂' },
        '肢体麻木|发凉|刺痛': { cause: '可能为周围神经病变、糖尿病或腰椎问题', department: '神经内科或内分泌科', treatment: '建议检查血糖和腰椎', medicine: '遵医嘱治疗原发病' },
        '持续痉挛|无法缓解|意识改变': { cause: '可能为破伤风、中毒或电解质严重紊乱', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱紧急处理' }
    },
    default: { cause: '可能为缺钙、缺镁、受凉、肌肉疲劳或电解质紊乱', department: '内科', treatment: '建议腿部保暖，睡前拉伸，补充钙镁', medicine: '可服用钙镁片' }
};

symptomDatabase['手抖'] = {
    keywords: ['手抖', '手发抖', '双手颤抖', '手震颤', '拿东西不稳', '手哆嗦'],
    combinations: {
        '焦虑|紧张|激动时加重': { cause: '可能为生理性震颤或焦虑引起的震颤', department: '神经内科', treatment: '建议放松心情，避免咖啡因', medicine: '遵医嘱使用β受体阻滞剂' },
        '甲亢|怕热|多汗|消瘦': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '静止时明显|活动时减轻': { cause: '可能为帕金森病（静止性震颤）', department: '神经内科', treatment: '建议尽早就医进行神经系统检查', medicine: '遵医嘱使用左旋多巴或多巴胺受体激动剂' },
        '活动时明显|拿东西时': { cause: '可能为特发性震颤或小脑病变', department: '神经内科', treatment: '建议就医检查', medicine: '遵医嘱使用β受体阻滞剂' },
        '饮酒后减轻|酒精依赖': { cause: '可能为酒精性震颤或酒精戒断综合征', department: '神经内科', treatment: '建议戒酒，寻求专业帮助', medicine: '遵医嘱治疗' },
        '低血糖|饥饿|出冷汗': { cause: '可能为低血糖引起的震颤', department: '内分泌科', treatment: '建议立即补充糖分', medicine: '调整饮食和用药' },
        '长期服药后|药物副作用': { cause: '可能为药物引起的震颤（如锂盐、丙戊酸等）', department: '神经内科', treatment: '建议咨询医生是否需要调整用药', medicine: '遵医嘱调整用药' }
    },
    default: { cause: '可能为生理性震颤、特发性震颤、甲亢、焦虑或神经系统疾病', department: '神经内科', treatment: '建议避免咖啡因和酒精，就医明确诊断', medicine: '遵医嘱用药' }
};

// --- 运动系统 ---
symptomDatabase['颈肩痛'] = {
    keywords: ['颈肩痛', '脖子痛', '肩颈痛', '颈椎痛', '颈痛', '肩膀痛', '肩背痛', '脖子僵硬', '肩周炎'],
    combinations: {
        '手臂麻木|手指麻木|上肢无力': { cause: '可能为颈椎病（神经根型）压迫神经', department: '骨科或神经内科', treatment: '建议做颈椎磁共振检查，避免长时间低头', medicine: '可服用甲钴胺营养神经' },
        '头晕|恶心|转头加重': { cause: '可能为颈椎病（椎动脉型）压迫血管', department: '骨科', treatment: '建议避免突然转头，做颈椎牵引', medicine: '可服用改善脑部供血药物' },
        '头痛|后脑勺痛|头顶痛': { cause: '可能为紧张性头痛、颈椎源性头痛', department: '骨科或神经内科', treatment: '建议热敷颈部，适当按摩', medicine: '可服用布洛芬' },
        '肩膀活动受限|抬不起来': { cause: '可能为肩周炎（五十肩、冻结肩）', department: '骨科', treatment: '建议进行爬墙运动等康复训练，避免粘连加重', medicine: '可外用止痛膏药或局部封闭治疗' },
        '长期低头|办公桌|手机族': { cause: '可能为颈肌劳损、颈椎生理曲度变直', department: '骨科或康复科', treatment: '建议调整坐姿，定时起身活动', medicine: '可颈部热敷，外用止痛贴' },
        '外伤后|车祸后|跌倒后': { cause: '可能为颈椎损伤、韧带拉伤或骨折', department: '骨科或急诊科', treatment: '建议立即就医做影像检查', medicine: '遵医嘱治疗' },
        '发烧|颈部淋巴结肿大': { cause: '可能为颈部淋巴结炎、咽喉感染或结核性淋巴结炎', department: '耳鼻喉科或感染科', treatment: '建议就医检查', medicine: '遵医嘱使用抗生素或抗结核药物' }
    },
    default: { cause: '可能为颈椎病、颈肌劳损、肩周炎或不良姿势', department: '骨科', treatment: '建议避免长时间低头，定时活动颈部，做颈椎保健操', medicine: '可外用止痛膏药或服用布洛芬' }
};

symptomDatabase['背痛'] = {
    keywords: ['背痛', '背部痛', '后背痛', '背酸', '上背痛', '下背痛', '背部僵硬'],
    combinations: {
        '长期久坐|姿势不良|弯腰工作': { cause: '可能为背肌劳损、筋膜炎或韧带拉伤', department: '骨科', treatment: '建议改善坐姿，定时起身活动', medicine: '可外用止痛药膏或热敷' },
        '下肢麻木|腿麻|行走困难': { cause: '可能为腰椎间盘突出、椎管狭窄', department: '骨科', treatment: '建议做腰椎磁共振检查', medicine: '可服用甲钴胺和布洛芬' },
        '胸痛|呼吸困难|咳嗽': { cause: '可能为胸膜炎、肺炎或气胸', department: '呼吸内科', treatment: '建议做胸部CT检查', medicine: '遵医嘱用药' },
        '发烧|发冷|夜间盗汗': { cause: '可能为脊柱结核、感染或肿瘤', department: '骨科或感染科', treatment: '建议立即就医', medicine: '遵医嘱治疗' },
        '早上僵硬|活动后好转': { cause: '可能为强直性脊柱炎', department: '风湿免疫科', treatment: '建议做HLA-B27和骶髂关节影像检查', medicine: '遵医嘱使用抗炎药物或生物制剂' },
        '外伤后|搬重物后|摔倒后': { cause: '可能为脊柱骨折、椎体压缩骨折或韧带损伤', department: '骨科或急诊科', treatment: '建议立即就医做影像检查', medicine: '遵医嘱治疗' },
        '心慌|胸闷|情绪紧张': { cause: '可能为心脏神经官能症或焦虑引起的躯体症状', department: '心内科或心理科', treatment: '建议放松心情，就医排查', medicine: '遵医嘱用药' }
    },
    default: { cause: '可能为背肌劳损、姿势不良、腰椎问题或内脏疾病放射痛', department: '骨科', treatment: '建议改善坐姿，适当运动，避免久坐', medicine: '可外用止痛贴膏或热敷' }
};

symptomDatabase['肌肉酸痛'] = {
    keywords: ['肌肉酸痛', '浑身疼', '全身酸痛', '肌肉痛', '肌肉疼', '四肢酸痛', '肌肉紧张'],
    combinations: {
        '发烧|感冒|流感|感染': { cause: '可能为病毒感染引起的全身肌肉疼痛（流感、COVID-19等）', department: '内科或感染科', treatment: '建议休息，多喝水，服用退热药物', medicine: '可服用布洛芬或对乙酰氨基酚' },
        '运动后|运动过量|不常运动': { cause: '可能为运动后延迟性肌肉酸痛（DOMS）', department: '运动医学科或骨科', treatment: '建议适当拉伸，冷热交替敷', medicine: '可外用止痛药膏' },
        '乏力|疲劳|精神不振': { cause: '可能为慢性疲劳综合征、纤维肌痛症', department: '风湿免疫科', treatment: '建议适当运动，改善睡眠', medicine: '遵医嘱使用止痛药或抗抑郁药物' },
        '关节痛|晨僵|对称性': { cause: '可能为类风湿关节炎、系统性红斑狼疮等风湿免疫病', department: '风湿免疫科', treatment: '建议就医检查自身抗体', medicine: '遵医嘱使用抗风湿药物' },
        '药物使用后|他汀类药物': { cause: '可能为药物引起的肌肉损伤（横纹肌溶解等）', department: '内科', treatment: '建议立即咨询医生，检查肌酶', medicine: '遵医嘱调整用药' },
        '甲状腺功能减退|怕冷|乏力': { cause: '可能为甲减引起的肌肉酸痛', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' }
    },
    default: { cause: '可能为病毒感染、运动过度、慢性疲劳综合征或风湿免疫疾病', department: '内科', treatment: '建议休息，适当按摩，多喝水', medicine: '可服用布洛芬缓解症状' }
};

// --- 全身症状 ---
symptomDatabase['寒战'] = {
    keywords: ['寒战', '发冷', '打寒战', '怕冷', '畏寒', '全身发冷', '冷得发抖', '打冷颤'],
    combinations: {
        '发烧|发热|体温升高': { cause: '可能为感染引起的体温上升期（细菌性感染多见）', department: '内科或急诊科', treatment: '建议测量体温，适当保暖，多喝水', medicine: '遵医嘱使用退烧药或抗生素' },
        '尿频|尿急|尿痛|腰痛': { cause: '可能为肾盂肾炎、尿路感染', department: '泌尿外科', treatment: '建议多喝水，就医检查尿常规', medicine: '遵医嘱使用抗生素' },
        '咳嗽|咳痰|胸痛': { cause: '可能为肺炎、支气管炎或脓胸', department: '呼吸内科', treatment: '建议做胸部影像检查', medicine: '遵医嘱使用抗生素' },
        '腹痛|腹泻|恶心': { cause: '可能为急性肠胃炎、胆囊炎或胰腺炎', department: '消化内科', treatment: '建议就医检查', medicine: '遵医嘱用药' },
        '手术后|伤口红肿': { cause: '可能为术后感染或败血症', department: '外科或急诊科', treatment: '建议立即就医', medicine: '遵医嘱使用抗生素' },
        '反复发作|盗汗|体重下降': { cause: '可能为结核病或恶性肿瘤', department: '感染科或肿瘤科', treatment: '建议就医进行全面检查', medicine: '遵医嘱治疗' }
    },
    default: { cause: '可能为感染性疾病（细菌或病毒）、体温上升期或全身炎症反应', department: '内科', treatment: '建议测量体温，注意保暖，多喝水', medicine: '遵医嘱用药' }
};

symptomDatabase['盗汗'] = {
    keywords: ['盗汗', '夜间出汗', '睡觉出汗', '睡着后出汗', '冷汗'],
    combinations: {
        '咳嗽|咳痰|胸痛|发热': { cause: '可能为结核病（肺结核多见）', department: '感染科或呼吸内科', treatment: '建议做胸部CT和结核菌素试验', medicine: '遵医嘱抗结核治疗' },
        '体重下降|消瘦|食欲好': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '低血糖|糖尿病|服药后': { cause: '可能为低血糖引起的夜间出汗', department: '内分泌科', treatment: '建议监测睡前血糖，调整用药', medicine: '遵医嘱调整降糖方案' },
        '失眠|焦虑|压力大': { cause: '可能为更年期综合征或自主神经功能紊乱', department: '内科或心理科', treatment: '建议放松心情，改善睡眠环境', medicine: '可服用谷维素或遵医嘱用药' },
        '发烧|感染|寒战': { cause: '可能为感染性疾病恢复期或慢性感染', department: '内科', treatment: '建议就医检查', medicine: '遵医嘱治疗原发病' },
        '潮热|月经不规律|年龄45-55': { cause: '可能为女性更年期综合征', department: '妇科', treatment: '建议保持良好心态，适当运动', medicine: '必要时遵医嘱进行激素替代治疗' }
    },
    default: { cause: '可能为结核病、甲亢、糖尿病低血糖、更年期综合征或自主神经功能紊乱', department: '内科', treatment: '建议保持卧室通风，更换透气睡衣，就医检查明确病因', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['体重下降'] = {
    keywords: ['体重下降', '消瘦', '变瘦', '瘦了', '体重减轻', '没胖反瘦'],
    combinations: {
        '多食|易饥|怕热|手抖|心慌': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '多饮|多尿|视物模糊': { cause: '可能为糖尿病（1型或2型）', department: '内分泌科', treatment: '建议检查血糖和糖化血红蛋白', medicine: '遵医嘱使用降糖药物或胰岛素' },
        '食欲不振|厌食|呕吐': { cause: '可能为消化系统疾病、慢性胃炎或恶性肿瘤', department: '消化内科', treatment: '建议做胃镜及腹部CT检查', medicine: '遵医嘱治疗原发病' },
        '咳嗽|胸痛|咳痰|盗汗': { cause: '可能为肺结核或肺部肿瘤', department: '呼吸内科', treatment: '建议做胸部CT检查', medicine: '遵医嘱治疗' },
        '发热|乏力|夜间盗汗': { cause: '可能为慢性感染、结核病或恶性肿瘤', department: '内科或肿瘤科', treatment: '建议尽快就医进行全面检查', medicine: '遵医嘱治疗' },
        '腹泻|便血|腹痛': { cause: '可能为炎症性肠病、慢性肠炎或结直肠肿瘤', department: '消化内科', treatment: '建议做肠镜检查', medicine: '遵医嘱治疗' },
        '抑郁|焦虑|不想吃饭': { cause: '可能为抑郁症、焦虑症或神经性厌食', department: '心理科或精神科', treatment: '建议心理治疗和营养支持', medicine: '遵医嘱用药' }
    },
    default: { cause: '可能为甲亢、糖尿病、恶性肿瘤、慢性感染或消化系统疾病', department: '内分泌科或内科', treatment: '建议就医进行全面检查，明确病因', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['体重增加'] = {
    keywords: ['体重增加', '发胖', '肥胖', '体重上升', '变胖', '增重'],
    combinations: {
        '怕冷|乏力|皮肤干燥|脱发': { cause: '可能为甲状腺功能减退症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' },
        '食欲不振|腹胀|便秘': { cause: '可能为甲减或代谢综合征', department: '内分泌科', treatment: '建议内分泌科就诊', medicine: '遵医嘱治疗' },
        '月经不调|多毛|痤疮': { cause: '可能为多囊卵巢综合征（PCOS）', department: '妇科或内分泌科', treatment: '建议检查性激素和卵巢B超', medicine: '遵医嘱调节内分泌' },
        '服用药物后|激素类药物': { cause: '可能为药物副作用（如糖皮质激素、抗抑郁药等）', department: '内科', treatment: '建议咨询医生是否需要调整用药', medicine: '遵医嘱调整用药方案' },
        '饮食增多|运动减少': { cause: '可能为单纯性肥胖或代谢下降', department: '内分泌科或营养科', treatment: '建议控制饮食，增加运动', medicine: '无需特定药物' },
        '水肿|浮肿|按压后凹陷': { cause: '可能为肾脏疾病、心力衰竭或淋巴水肿', department: '肾内科或心内科', treatment: '建议检查肾功能和心脏功能', medicine: '遵医嘱使用利尿剂' }
    },
    default: { cause: '可能为单纯性肥胖、甲状腺功能减退、多囊卵巢综合征或药物副作用', department: '内分泌科', treatment: '建议控制饮食，增加运动，就医检查', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['口渴多饮'] = {
    keywords: ['口渴', '口干', '想喝水', '总喝水', '口干舌燥', '多饮', '喝不够'],
    combinations: {
        '多尿|尿多|夜尿多|体重下降': { cause: '可能为糖尿病（典型三多一少症状）', department: '内分泌科', treatment: '建议检查血糖和糖化血红蛋白', medicine: '遵医嘱降糖治疗' },
        '眼干|眼涩|关节痛': { cause: '可能为干燥综合征、自身免疫性疾病', department: '风湿免疫科', treatment: '建议检查自身抗体', medicine: '遵医嘱使用免疫抑制剂' },
        '尿崩|大量清水样尿': { cause: '可能为尿崩症（中枢性或肾性）', department: '内分泌科', treatment: '建议做禁水试验', medicine: '遵医嘱使用去氨加压素' },
        '服用药物后|抗过敏药': { cause: '可能为药物副作用（抗组胺药、抗抑郁药等）', department: '内科', treatment: '建议多喝水，咨询医生', medicine: '遵医嘱调整用药' },
        '口腔溃疡|扁桃体炎|发热': { cause: '可能为发热或口腔感染引起的口渴', department: '内科', treatment: '建议多喝水，治疗原发病', medicine: '对症治疗' }
    },
    default: { cause: '可能为糖尿病、干燥综合征、尿崩症、药物副作用或单纯饮水不足', department: '内分泌科', treatment: '建议多喝水，就医检查血糖', medicine: '遵医嘱治疗原发病' }
};

// --- 精神心理 ---
symptomDatabase['焦虑'] = {
    keywords: ['焦虑', '紧张', '不安', '担心', '恐惧', '坐立不安', '心神不宁', '恐慌', '惊恐'],
    combinations: {
        '心慌|心悸|胸闷|气短': { cause: '可能为焦虑症或惊恐发作引起的自主神经症状', department: '心理科或心内科', treatment: '建议深呼吸练习，排除心脏疾病', medicine: '遵医嘱使用抗焦虑药物' },
        '失眠|入睡困难|噩梦': { cause: '可能为焦虑性失眠', department: '心理科或神经内科', treatment: '建议建立规律作息，睡前放松', medicine: '可短期使用助眠药物' },
        '手抖|出汗|肌肉紧张': { cause: '可能为广泛性焦虑障碍的躯体症状', department: '心理科', treatment: '建议进行放松训练，正念冥想', medicine: '遵医嘱使用SSRI类药物' },
        '社交回避|害怕人多的场合': { cause: '可能为社交焦虑症', department: '心理科', treatment: '建议逐步暴露疗法，认知行为治疗', medicine: '遵医嘱用药' },
        '反复检查|洁癖|强迫行为': { cause: '可能为强迫症（OCD）', department: '心理科', treatment: '建议专业心理治疗', medicine: '遵医嘱使用SSRI类药物' },
        '甲亢|消瘦|怕热|手抖': { cause: '可能为甲状腺功能亢进引起的焦虑症状', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱治疗甲亢' }
    },
    default: { cause: '可能为焦虑症、应激反应、甲状腺功能亢进或惊恐发作', department: '心理科或神经内科', treatment: '建议放松训练，深呼吸，适当运动', medicine: '遵医嘱使用抗焦虑药物' }
};

symptomDatabase['情绪低落'] = {
    keywords: ['情绪低落', '抑郁', '不开心', '很难过', '提不起兴趣', '没意思', '想哭', '心情压抑', '消极'],
    combinations: {
        '失眠|早醒|睡眠过多': { cause: '可能为抑郁症的睡眠障碍表现', department: '心理科或精神科', treatment: '建议规律作息，白天适当运动', medicine: '遵医嘱使用抗抑郁药物' },
        '食欲不振|体重下降|没胃口': { cause: '可能为抑郁症的躯体症状', department: '心理科或精神科', treatment: '建议少食多餐，保证营养', medicine: '遵医嘱使用抗抑郁药物' },
        '乏力|没精神|不想动': { cause: '可能为抑郁症的精神运动性迟滞', department: '心理科或精神科', treatment: '建议逐步增加活动量', medicine: '遵医嘱使用抗抑郁药物' },
        '自责|无价值感|想自杀': { cause: '可能为重度抑郁症（有自杀风险）', department: '精神科或急诊科', treatment: '建议立即寻求专业心理帮助，拨打心理援助热线', medicine: '遵医嘱急需抗抑郁治疗' },
        '产后|怀孕后': { cause: '可能为产后抑郁症或妊娠期抑郁', department: '心理科或妇产科', treatment: '建议家人支持，专业心理治疗', medicine: '遵医嘱使用哺乳期安全的抗抑郁药物' },
        '更年期|月经前|激素变化': { cause: '可能为经前综合征或更年期情绪障碍', department: '妇科或心理科', treatment: '建议规律作息，适当运动', medicine: '遵医嘱调节激素或抗抑郁治疗' }
    },
    default: { cause: '可能为抑郁症、情绪障碍、应激反应或激素变化', department: '心理科或精神科', treatment: '建议寻求心理咨询，保持社交活动，适当运动', medicine: '遵医嘱使用抗抑郁药物' }
};

symptomDatabase['烦躁易怒'] = {
    keywords: ['烦躁', '易怒', '脾气大', '爱发火', '烦躁不安', '急脾气', '不耐烦'],
    combinations: {
        '失眠|睡不好|疲劳': { cause: '可能为睡眠不足或疲劳引起的情绪不稳', department: '神经内科或心理科', treatment: '建议保证充足睡眠', medicine: '可服用谷维素' },
        '潮热|出汗|月经不规律': { cause: '可能为更年期综合征', department: '妇科', treatment: '建议保持良好心态，适当运动', medicine: '遵医嘱进行激素替代治疗' },
        '头痛|头晕|耳鸣': { cause: '可能为高血压、偏头痛或自主神经功能紊乱', department: '内科或神经内科', treatment: '建议监测血压，治疗原发病', medicine: '遵医嘱用药' },
        '甲亢|怕热|手抖|消瘦': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '经前|月经前|产后': { cause: '可能为经前综合征（PMS）或产后情绪波动', department: '妇科', treatment: '建议规律作息，限盐限咖啡因', medicine: '可补充维生素B6和钙剂' },
        '压力大|工作紧张|生活变故': { cause: '可能为应激反应或适应障碍', department: '心理科', treatment: '建议减压，寻求社会支持', medicine: '可短期使用抗焦虑药物' }
    },
    default: { cause: '可能为睡眠不足、压力过大、更年期综合征、甲亢或情绪障碍', department: '内科或心理科', treatment: '建议保证睡眠，减压，适当运动', medicine: '可服用谷维素调节' }
};

// --- 眼科补充 ---
symptomDatabase['眼红'] = {
    keywords: ['眼红', '眼睛红', '红眼', '结膜充血', '白眼球红', '眼出血'],
    combinations: {
        '眼痛|异物感|分泌物增多': { cause: '可能为结膜炎、角膜炎或虹膜炎', department: '眼科', treatment: '建议保持眼部清洁，避免揉眼', medicine: '遵医嘱使用抗感染滴眼液' },
        '视力下降|眼痛|头痛': { cause: '可能为角膜炎、虹膜睫状体炎或青光眼', department: '眼科', treatment: '建议立即就医', medicine: '遵医嘱用药' },
        '眼痒|打喷嚏|过敏性鼻炎': { cause: '可能为过敏性结膜炎', department: '眼科', treatment: '建议避免过敏原，冷敷眼部', medicine: '遵医嘱使用抗过敏滴眼液' },
        '眼干|眼涩|长时间用眼': { cause: '可能为干眼症或视疲劳', department: '眼科', treatment: '建议使用人工泪液', medicine: '可使用玻璃酸钠滴眼液' },
        '眼外伤|碰撞后|眼内异物': { cause: '可能为结膜下出血、眼内异物或眼球挫伤', department: '眼科', treatment: '建议立即就医检查', medicine: '遵医嘱治疗' },
        '单眼|无痛|片状出血': { cause: '可能为球结膜下出血（多与揉眼、用力、高血压有关）', department: '眼科', treatment: '建议冷敷，避免揉眼', medicine: '一般可自行吸收' }
    },
    default: { cause: '可能为结膜炎、角膜炎、过敏、干眼症或结膜下出血', department: '眼科', treatment: '建议保持眼部清洁，就医明确诊断', medicine: '遵医嘱用药' }
};

symptomDatabase['听力下降'] = {
    keywords: ['听力下降', '听不见', '听不清楚', '耳背', '耳聋', '听力减退'],
    combinations: {
        '耳鸣|头晕|眩晕': { cause: '可能为突发性耳聋、梅尼埃病或老年性耳聋', department: '耳鼻喉科', treatment: '建议立即就医（突发性耳聋需在72小时内治疗）', medicine: '遵医嘱使用改善循环及营养神经药物' },
        '耳痛|耳朵流脓|耳朵闷': { cause: '可能为中耳炎、鼓膜穿孔或胆脂瘤', department: '耳鼻喉科', treatment: '建议保持耳道干燥，避免进水', medicine: '遵医嘱使用抗生素滴耳液' },
        '耵聍|耳屎|耳朵堵': { cause: '可能为耵聍栓塞堵塞外耳道', department: '耳鼻喉科', treatment: '建议就医取出耵聍', medicine: '可使用碳酸氢钠滴耳液软化' },
        '噪音暴露|长期戴耳机': { cause: '可能为噪音性耳聋或声创伤', department: '耳鼻喉科', treatment: '建议避免噪音环境，佩戴耳塞', medicine: '遵医嘱使用神经营养药物' },
        '老年人|逐渐下降': { cause: '可能为老年性耳聋（耳蜗退行性变）', department: '耳鼻喉科', treatment: '建议佩戴助听器', medicine: '可使用神经营养药物' },
        '药物使用后|链霉素|庆大霉素': { cause: '可能为药物性耳聋（耳毒性药物）', department: '耳鼻喉科', treatment: '建议立即停用相关药物', medicine: '遵医嘱治疗' }
    },
    default: { cause: '可能为突发性耳聋、中耳炎、老年性耳聋、噪音损伤或耵聍栓塞', department: '耳鼻喉科', treatment: '建议及时就医做听力检查', medicine: '遵医嘱治疗' }
};

// --- 口腔科补充 ---
symptomDatabase['牙龈出血'] = {
    keywords: ['牙龈出血', '刷牙出血', '牙肉出血', '牙龈红肿', '牙龈萎缩'],
    combinations: {
        '牙结石|牙菌斑|口腔卫生差': { cause: '可能为牙龈炎或牙周炎', department: '口腔科', treatment: '建议定期洗牙（牙周洁治），正确刷牙', medicine: '可使用漱口水' },
        '牙痛|牙齿松动|口臭': { cause: '可能为牙周炎或牙龈脓肿', department: '口腔科', treatment: '建议尽快就医，进行牙周治疗', medicine: '遵医嘱使用抗生素' },
        '刷牙用力|刷毛硬': { cause: '可能为机械性损伤', department: '口腔科', treatment: '建议使用软毛牙刷，轻柔刷牙', medicine: '无需特殊用药' },
        '怀孕|孕期': { cause: '可能为妊娠期牙龈炎（激素变化引起）', department: '口腔科', treatment: '建议加强口腔护理，产后可恢复', medicine: '可使用孕妇安全的漱口水' },
        '血小板减少|瘀伤|不明原因出血': { cause: '可能为血液系统疾病、血小板减少或凝血功能障碍', department: '血液科', treatment: '建议立即检查血常规和凝血功能', medicine: '遵医嘱治疗' },
        '服用抗凝血药物|阿司匹林': { cause: '可能为抗凝药物引起的牙龈易出血', department: '口腔科或心内科', treatment: '建议咨询医生是否需要调整抗凝方案', medicine: '遵医嘱调整用药' }
    },
    default: { cause: '可能为牙龈炎、牙周炎、刷牙不当或血液系统疾病', department: '口腔科', treatment: '建议正确刷牙，使用牙线，定期洗牙', medicine: '可使用漱口水，就医检查' }
};

symptomDatabase['牙齿敏感'] = {
    keywords: ['牙齿敏感', '牙酸', '牙过敏', '冷热刺激痛', '吃酸的牙疼', '喝凉水牙疼'],
    combinations: {
        '刷牙楔状缺损|横着刷牙': { cause: '可能为牙颈部楔状缺损导致牙本质暴露', department: '口腔科', treatment: '建议改用竖刷法，使用软毛牙刷', medicine: '可使用脱敏牙膏' },
        '龋齿|蛀牙|牙洞': { cause: '可能为龋齿（蛀牙）发展到牙本质层', department: '口腔科', treatment: '建议尽早就医补牙', medicine: '遵医嘱治疗' },
        '牙结石|牙龈萎缩|牙根暴露': { cause: '可能为牙周病引起的牙根暴露', department: '口腔科', treatment: '建议牙周治疗，脱敏处理', medicine: '可使用脱敏牙膏' },
        '牙齿磨耗|夜磨牙|咬合过度': { cause: '可能为牙釉质过度磨耗', department: '口腔科', treatment: '建议使用咬合垫', medicine: '可使用脱敏牙膏' },
        '牙齿漂白|洗牙后': { cause: '可能为短期敏感，通常可自行缓解', department: '口腔科', treatment: '建议使用脱敏牙膏，避免过冷过热刺激', medicine: '可使用脱敏牙膏' }
    },
    default: { cause: '可能为牙本质敏感、龋齿、牙根暴露或牙釉质磨耗', department: '口腔科', treatment: '建议使用脱敏牙膏，及时就医检查', medicine: '脱敏治疗或补牙' }
};

symptomDatabase['口角炎'] = {
    keywords: ['口角炎', '嘴角烂', '嘴角裂', '口角糜烂', '嘴角破', '烂嘴角'],
    combinations: {
        '舔嘴唇|流口水|口角干燥': { cause: '可能为感染性口角炎（念珠菌或细菌）', department: '口腔科', treatment: '建议避免舔嘴角，涂抹润唇膏', medicine: '可使用抗真菌或抗生素药膏' },
        '缺乏维生素B族|饮食不均衡': { cause: '可能为营养缺乏性口角炎（缺乏B族维生素）', department: '口腔科', treatment: '建议多吃富含B族维生素食物（粗粮、豆类、动物肝脏）', medicine: '可补充B族维生素' },
        '发烧后|感冒后|免疫力低下': { cause: '可能为病毒性口角炎（单纯疱疹病毒）', department: '口腔科或皮肤科', treatment: '建议保持口角清洁干燥', medicine: '可使用阿昔洛韦乳膏' },
        '老年|假牙|牙齿缺失': { cause: '可能为机械性口角炎（因口腔结构改变）', department: '口腔科', treatment: '建议就医修复牙体', medicine: '遵医嘱治疗' },
        '儿童|流口水|经常舔嘴角': { cause: '可能为儿童口角炎', department: '口腔科', treatment: '建议教育儿童不要舔嘴角，涂抹润肤露', medicine: '可使用维生素B族' }
    },
    default: { cause: '可能为感染（细菌/真菌/病毒）、营养缺乏（B族维生素）或机械刺激', department: '口腔科', treatment: '建议保持口角清洁干燥，补充B族维生素', medicine: '外用抗感染药膏，口服B族维生素' }
};

// --- 皮肤科补充 ---
symptomDatabase['痤疮'] = {
    keywords: ['痤疮', '青春痘', '粉刺', '痘痘', '暗疮', '满脸痘', '黑头', '白头'],
    combinations: {
        '月经前加重|女性': { cause: '可能为激素相关性痤疮', department: '皮肤科', treatment: '建议保持面部清洁，不挤压痘痘', medicine: '遵医嘱使用外用或口服药物' },
        '油性皮肤|毛孔粗大': { cause: '可能为寻常痤疮', department: '皮肤科', treatment: '建议使用控油洁面产品，饮食清淡', medicine: '可外用维A酸类或过氧化苯甲酰' },
        '吃辣后|吃甜食后|喝牛奶后': { cause: '可能为饮食诱发的痤疮', department: '皮肤科', treatment: '建议减少辛辣、甜食和奶制品摄入', medicine: '遵医嘱用药' },
        '大量出汗|运动后|口罩佩戴': { cause: '可能为机械性痤疮或闷热引起', department: '皮肤科', treatment: '建议保持皮肤干爽，勤换口罩', medicine: '做好皮肤清洁' },
        '囊肿|结节|疼|感染': { cause: '可能为重度痤疮（囊肿性或结节性）', department: '皮肤科', treatment: '建议尽早就医，避免留疤', medicine: '遵医嘱使用口服抗生素或异维A酸' },
        '青春期|青少年': { cause: '可能为青春期痤疮', department: '皮肤科', treatment: '建议保持面部清洁，不挤压', medicine: '可使用外用药膏' }
    },
    default: { cause: '可能为寻常痤疮、激素水平变化或细菌感染', department: '皮肤科', treatment: '建议保持面部清洁，清淡饮食，不挤压痘痘', medicine: '可外用维A酸乳膏或过氧化苯甲酰' }
};

symptomDatabase['脱发'] = {
    keywords: ['脱发', '掉头发', '头发稀疏', '斑秃', '发际线后移', '秃顶', '发际线高', '头发少'],
    combinations: {
        '头皮瘙痒|头屑多|出油多': { cause: '可能为脂溢性皮炎引起的脱发或雄激素性脱发', department: '皮肤科', treatment: '建议保持头皮清洁，使用温和洗发水', medicine: '可使用酮康唑洗剂或米诺地尔' },
        '熬夜|压力大|焦虑': { cause: '可能为休止期脱发（精神因素导致）', department: '皮肤科', treatment: '建议放松心情，保证睡眠', medicine: '可补充维生素B族' },
        '家族遗传|父亲秃顶': { cause: '可能为雄激素性脱发（男性型脱发）', department: '皮肤科', treatment: '建议早期干预效果更好', medicine: '可使用米诺地尔，男性可口服非那雄胺' },
        '产后|大手术后|重病后': { cause: '可能为休止期脱发（生理应激后）', department: '皮肤科', treatment: '建议补充营养，多数可自行恢复', medicine: '无需特殊用药' },
        '圆形脱发|斑块|无自觉症状': { cause: '可能为斑秃（俗称鬼剃头）', department: '皮肤科', treatment: '建议就医治疗，多数可恢复', medicine: '遵医嘱外用或局部注射激素' },
        '贫血|乏力|面色苍白': { cause: '可能为缺铁性贫血引起的脱发', department: '血液科或皮肤科', treatment: '建议补充铁质和蛋白质', medicine: '可服用铁剂' },
        '体重快速下降|节食|营养不良': { cause: '可能为营养性脱发', department: '皮肤科或营养科', treatment: '建议均衡饮食，补充蛋白质和微量元素', medicine: '可补充复合维生素' },
        '甲状腺疾病|甲亢|甲减': { cause: '可能为甲状腺功能异常引起的脱发', department: '内分泌科或皮肤科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱治疗甲状腺疾病' }
    },
    default: { cause: '可能为雄激素性脱发、休止期脱发、斑秃、营养缺乏或内分泌失调', department: '皮肤科', treatment: '建议保持生活规律，减少压力，均衡营养', medicine: '可使用米诺地尔，就医明确类型' }
};

// --- 女性健康 ---
symptomDatabase['更年期症状'] = {
    keywords: ['更年期', '潮热', '盗汗', '月经紊乱', '烦躁', '失眠', '阴道干涩', '情绪波动'],
    combinations: {
        '潮热|出汗|面红': { cause: '可能为更年期血管舒缩症状', department: '妇科', treatment: '建议保持室内凉爽，穿着透气', medicine: '遵医嘱进行激素替代治疗' },
        '失眠|烦躁|情绪波动': { cause: '可能为更年期神经精神症状', department: '妇科或心理科', treatment: '建议规律作息，适当运动', medicine: '可服用谷维素或遵医嘱用药' },
        '月经不调|停经|月经稀少': { cause: '可能为围绝经期正常生理变化', department: '妇科', treatment: '建议定期做妇科检查', medicine: '遵医嘱治疗' },
        '阴道干涩|性交痛': { cause: '可能为更年期泌尿生殖系统症状', department: '妇科', treatment: '可使用阴道润滑剂', medicine: '遵医嘱局部使用雌激素软膏' },
        '心悸|心慌|胸闷': { cause: '可能为更年期心血管症状', department: '妇科或心内科', treatment: '建议排除心脏疾病', medicine: '遵医嘱用药' },
        '骨质疏松|腰背痛': { cause: '可能为更年期骨量减少', department: '妇科或骨科', treatment: '建议补充钙和维生素D，适当负重运动', medicine: '遵医嘱补充钙剂' }
    },
    default: { cause: '可能为围绝经期综合征（雌激素水平波动或下降引起）', department: '妇科', treatment: '建议保持良好心态，健康饮食，适当运动', medicine: '必要时遵医嘱进行激素替代治疗' }
};

symptomDatabase['盆腔疼痛'] = {
    keywords: ['盆腔痛', '下腹痛', '小腹痛', '附件痛', '宫腔痛', '盆腔坠胀'],
    combinations: {
        '发热|白带异常|异味': { cause: '可能为盆腔炎性疾病或附件炎', department: '妇科', treatment: '建议立即就医，避免性生活', medicine: '遵医嘱使用抗生素' },
        '月经期加重|月经前': { cause: '可能为子宫内膜异位症或腺肌症', department: '妇科', treatment: '建议做妇科B超检查', medicine: '遵医嘱使用止痛药或激素治疗' },
        '同房后加重|接触性出血': { cause: '可能为宫颈炎、盆腔炎或宫颈病变', department: '妇科', treatment: '建议做宫颈TCT和HPV检查', medicine: '遵医嘱治疗' },
        '停经|怀孕可能|阴道出血': { cause: '可能为宫外孕或先兆流产', department: '妇科或急诊科', treatment: '建议立即就医检查', medicine: '遵医嘱紧急处理' },
        '恶心|呕吐|肛门坠胀': { cause: '可能为卵巢囊肿扭转或破裂', department: '妇科或急诊科', treatment: '建议立即就医', medicine: '遵医嘱手术治疗' }
    },
    default: { cause: '可能为盆腔炎、子宫内膜异位症、卵巢问题或泌尿系统疾病', department: '妇科', treatment: '建议就医做妇科检查和B超', medicine: '遵医嘱用药' }
};

// --- 男性健康 ---
symptomDatabase['前列腺问题'] = {
    keywords: ['前列腺', '排尿困难', '尿等待', '尿不尽', '尿频', '夜尿多', '尿线细', '会阴胀痛'],
    combinations: {
        '尿频|尿急|尿痛|尿道灼热': { cause: '可能为急性或慢性前列腺炎', department: '泌尿外科', treatment: '建议多喝水，避免久坐，禁酒', medicine: '遵医嘱使用抗生素或α受体阻滞剂' },
        '夜尿增多|排尿费力|尿线变细': { cause: '可能为良性前列腺增生（BPH）', department: '泌尿外科', treatment: '建议减少夜间饮水，避免憋尿', medicine: '遵医嘱使用α受体阻滞剂或5α-还原酶抑制剂' },
        '血尿|尿痛|体重下降': { cause: '可能为前列腺癌或严重前列腺疾病', department: '泌尿外科', treatment: '建议立即抽血查PSA', medicine: '遵医嘱治疗' },
        '会阴部疼痛|小腹坠胀|久坐加重': { cause: '可能为慢性盆腔疼痛综合征', department: '泌尿外科', treatment: '建议温水坐浴，规律排精', medicine: '遵医嘱用药' },
        '发热|寒战|乏力': { cause: '可能为急性细菌性前列腺炎', department: '泌尿外科', treatment: '建议立即就医', medicine: '遵医嘱使用抗生素' },
        '50岁以上|排尿困难': { cause: '可能为前列腺增生或前列腺癌', department: '泌尿外科', treatment: '建议定期检查PSA', medicine: '遵医嘱用药' }
    },
    default: { cause: '可能为前列腺炎、前列腺增生或前列腺癌', department: '泌尿外科', treatment: '建议多喝水，避免久坐，定期检查PSA', medicine: '遵医嘱用药' }
};

// --- 过敏与免疫 ---
symptomDatabase['过敏'] = {
    keywords: ['过敏', '过敏性', '荨麻疹', '风团', '皮肤红肿', '过敏反应', '药疹', '食物过敏'],
    combinations: {
        '皮疹|瘙痒|红斑|风团': { cause: '可能为荨麻疹、过敏性皮炎或药疹', department: '皮肤科', treatment: '建议避免接触过敏原，冷敷止痒', medicine: '可服用抗组胺药（氯雷他定或西替利嗪）' },
        '喘息|呼吸困难|喉咙发紧': { cause: '可能为严重过敏反应或过敏性休克', department: '急诊科', treatment: '建议立即拨打急救电话', medicine: '遵医嘱使用肾上腺素' },
        '打喷嚏|流清涕|眼痒|鼻塞': { cause: '可能为过敏性鼻炎或花粉症', department: '耳鼻喉科', treatment: '建议避免过敏原，戴口罩', medicine: '可使用鼻用激素喷剂或口服抗组胺药' },
        '食物后|海鲜后|药物后': { cause: '可能为食物过敏或药物过敏', department: '急诊科或皮肤科', treatment: '建议立即停用可疑食物或药物', medicine: '可服用抗组胺药，严重者就医' },
        '嘴唇肿胀|眼睑肿胀|喉头水肿': { cause: '可能为血管性水肿或严重过敏反应', department: '急诊科', treatment: '建议立即就医', medicine: '遵医嘱使用抗组胺药或激素' },
        '季节性发作|春季|秋季': { cause: '可能为季节性过敏性鼻炎或花粉症', department: '耳鼻喉科', treatment: '建议提前预防用药', medicine: '鼻用激素或抗组胺药' }
    },
    default: { cause: '可能为过敏性皮炎、荨麻疹、过敏性鼻炎或食物/药物过敏', department: '皮肤科或耳鼻喉科', treatment: '建议避免接触过敏原，保持环境清洁', medicine: '可服用抗组胺药（氯雷他定）' }
};

// --- 其他常见症状 ---
symptomDatabase['多梦'] = {
    keywords: ['多梦', '做梦多', '整夜做梦', '噩梦', '梦魇', '梦多', '睡不踏实'],
    combinations: {
        '失眠|入睡困难|易醒': { cause: '可能为睡眠障碍（快速眼动睡眠异常）', department: '神经内科', treatment: '建议规律作息，避免睡前使用电子产品', medicine: '可服用褪黑素' },
        '焦虑|压力大|紧张': { cause: '可能为精神压力引起的多梦', department: '心理科或神经内科', treatment: '建议睡前放松，听轻音乐', medicine: '可选用安神类中成药' },
        '饱食后|睡前吃东西|饮酒': { cause: '可能为饮食因素引起的多梦', department: '内科', treatment: '建议睡前2小时不进食', medicine: '无需特殊用药' },
        '更年期|月经期|激素变化': { cause: '可能为激素波动引起的睡眠质量下降', department: '妇科', treatment: '建议调节生活方式', medicine: '遵医嘱调理' },
        '发热|生病|身体不适': { cause: '可能为疾病引起的睡眠不安', department: '内科', treatment: '建议治疗原发病', medicine: '对症治疗' },
        '噩梦|惊醒|恐惧|心跳加速': { cause: '可能为梦魇障碍或创伤后应激障碍', department: '心理科或神经内科', treatment: '建议心理疏导', medicine: '遵医嘱用药' }
    },
    default: { cause: '可能为精神压力、睡眠环境不佳、生活不规律或情绪问题', department: '神经内科', treatment: '建议规律作息，睡前放松，避免咖啡茶酒', medicine: '可服用褪黑素或安神药物' }
};

symptomDatabase['白天嗜睡'] = {
    keywords: ['白天嗜睡', '白天困', '总想睡觉', '坐着就睡着', '嗜睡', '犯困', '白天没精神'],
    combinations: {
        '打鼾|夜间呼吸暂停|肥胖': { cause: '可能为阻塞性睡眠呼吸暂停综合征（OSA）', department: '呼吸内科或睡眠医学科', treatment: '建议做睡眠监测，侧卧位睡眠', medicine: '遵医嘱使用CPAP呼吸机' },
        '晚上睡够了|还是困|发作性': { cause: '可能为发作性睡病', department: '神经内科', treatment: '建议做睡眠监测', medicine: '遵医嘱使用莫达非尼' },
        '乏力|贫血|头晕|面色苍白': { cause: '可能为贫血、低血压或甲状腺功能减退', department: '内科', treatment: '建议检查血常规和甲状腺功能', medicine: '遵医嘱治疗原发病' },
        '肥胖|打呼噜|高血压': { cause: '可能为睡眠呼吸暂停综合征', department: '呼吸内科', treatment: '建议减肥，侧卧睡眠', medicine: '遵医嘱治疗' },
        '糖尿病|血糖控制差': { cause: '可能为糖尿病引起的疲劳和嗜睡', department: '内分泌科', treatment: '建议控制血糖', medicine: '遵医嘱降糖治疗' },
        '抑郁症|情绪低落|没兴趣': { cause: '可能为抑郁症的非典型症状（嗜睡型）', department: '心理科或精神科', treatment: '建议心理治疗', medicine: '遵医嘱使用抗抑郁药物' },
        '甲减|怕冷|便秘|体重增加': { cause: '可能为甲状腺功能减退症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' }
    },
    default: { cause: '可能为睡眠不足、睡眠呼吸暂停、贫血、甲减或发作性睡病', department: '内科或神经内科', treatment: '建议保证夜间睡眠，就医检查明确病因', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['怕热'] = {
    keywords: ['怕热', '怕热不怕冷', '怕热多汗', '怕热喜凉', '不耐热'],
    combinations: {
        '多汗|手抖|心慌|消瘦': { cause: '可能为甲状腺功能亢进症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱使用抗甲状腺药物' },
        '食量大|易饥饿|体重下降': { cause: '可能为甲亢或糖尿病', department: '内分泌科', treatment: '建议检查甲功和血糖', medicine: '遵医嘱治疗' },
        '更年期|潮热|出汗|月经乱': { cause: '可能为更年期综合征', department: '妇科', treatment: '建议保持凉爽环境', medicine: '必要时激素替代治疗' },
        '烦躁|易怒|失眠': { cause: '可能为焦虑症、甲亢或更年期', department: '内科或心理科', treatment: '建议放松心情，就医检查', medicine: '遵医嘱用药' },
        '低烧|长期低热|感染': { cause: '可能为慢性感染或炎症性疾病', department: '内科', treatment: '建议就医检查', medicine: '遵医嘱治疗' }
    },
    default: { cause: '可能为甲状腺功能亢进、更年期综合征、焦虑症或感染性疾病', department: '内分泌科', treatment: '建议检查甲状腺功能，保持凉爽', medicine: '遵医嘱治疗原发病' }
};

symptomDatabase['手脚冰凉'] = {
    keywords: ['手脚冰凉', '手脚冷', '手冷', '脚冷', '四肢发凉', '怕冷手脚'],
    combinations: {
        '怕冷|乏力|面色苍白|甲减': { cause: '可能为甲状腺功能减退症', department: '内分泌科', treatment: '建议检查甲状腺功能', medicine: '遵医嘱补充甲状腺素' },
        '贫血|头晕|心悸|乏力': { cause: '可能为缺铁性贫血', department: '血液科或内科', treatment: '建议多吃含铁食物（红肉、动物肝脏）', medicine: '可补充铁剂' },
        '双手变白变紫|遇冷加重|手指痛': { cause: '可能为雷诺现象或雷诺病', department: '风湿免疫科', treatment: '建议注意保暖，避免寒冷刺激', medicine: '遵医嘱使用血管扩张剂' },
        '血压低|站起头晕|体质弱': { cause: '可能为低血压或体质虚寒', department: '内科', treatment: '建议适当运动增强体质', medicine: '中医调理' },
        '糖尿病|糖尿病史': { cause: '可能为糖尿病周围血管病变', department: '内分泌科', treatment: '建议控制血糖，注意足部保暖', medicine: '遵医嘱治疗' },
        '女性|经期|末梢循环差': { cause: '可能为末梢循环不良', department: '内科', treatment: '建议睡前热水泡脚，适当运动', medicine: '无需特殊用药' }
    },
    default: { cause: '可能为末梢循环不良、贫血、甲状腺功能减退、低血压或体质因素', department: '内科', treatment: '建议适度运动，睡前泡脚，注意保暖', medicine: '可中医调理' }
};

// ======== 面瘫（面部神经麻痹） ========
symptomDatabase['面瘫'] = {
    keywords: ['面瘫', '面部麻痹', '嘴歪', '眼歪', '口眼歪斜', '面部歪斜', '面部僵硬', '面神经麻痹', '脸歪', '嘴巴歪', '眼睛闭不上', '面部麻木', '半边脸不能动'],
    combinations: {
        '突然发病|晨起发现|受凉|风吹': { cause: '可能为周围性面神经麻痹（贝尔氏面瘫），多因受凉、病毒感染或免疫力下降引起', department: '神经内科', treatment: '建议立即就医，72小时内为黄金治疗期，注意面部保暖', medicine: '遵医嘱使用糖皮质激素和抗病毒药物' },
        '耳后疼痛|耳朵痛|耳前痛': { cause: '可能为亨特综合征（带状疱疹病毒侵犯面神经）或急性面神经炎', department: '神经内科或耳鼻喉科', treatment: '建议立即就医，止痛治疗，保护角膜', medicine: '遵医嘱使用抗病毒药物和糖皮质激素' },
        '听力下降|耳鸣|耳内疱疹': { cause: '可能为亨特综合征（Ramsay Hunt综合征），较贝尔氏面瘫更严重', department: '神经内科或耳鼻喉科', treatment: '建议立即就医进行抗病毒治疗', medicine: '遵医嘱使用阿昔洛韦等抗病毒药物' },
        '眼睛干涩|眼睛无法闭合|畏光': { cause: '可能为面瘫引起的眼睑闭合不全，需保护角膜', department: '神经内科或眼科', treatment: '建议使用人工泪液和眼膏，必要时戴眼罩保护', medicine: '可使用人工泪液、红霉素眼膏保护角膜' },
        '口角流涎|漏水|鼓腮漏气': { cause: '可能为面瘫引起的口轮匝肌功能障碍', department: '神经内科', treatment: '建议进行面部肌肉康复训练，针灸理疗', medicine: '遵医嘱使用营养神经药物（甲钴胺、维生素B1）' },
        '说话含糊|进食困难|食物残留': { cause: '可能为面瘫影响口腔肌肉功能', department: '神经内科', treatment: '建议进食软食，避免呛咳，进行康复训练', medicine: '遵医嘱使用神经营养药物' },
        '高血压|糖尿病|高血脂': { cause: '可能为脑血管疾病（脑卒中/中风）引起的中枢性面瘫', department: '神经内科或急诊科', treatment: '建议立即就医做头颅CT或MRI，排除脑卒中', medicine: '遵医嘱治疗原发病及溶栓或抗血小板治疗' },
        '肢体无力|半身麻木|语言不清': { cause: '可能为脑卒中（中风）引起的中枢性面瘫，病情危重', department: '神经内科或急诊科', treatment: '建议立即拨打急救电话，不要延误', medicine: '遵医嘱紧急处理，不可自行用药' },
        '反复发作|同侧|家族史': { cause: '可能为复发性面神经麻痹或家族性面神经麻痹', department: '神经内科', treatment: '建议做头颅MRI排除占位性病变', medicine: '遵医嘱治疗' },
        '儿童|接种疫苗后|病毒感染': { cause: '可能为儿童面神经麻痹，多与病毒感染相关', department: '儿科或神经内科', treatment: '建议尽早治疗，预后一般较好', medicine: '遵医嘱使用抗病毒和神经营养药物' }
    },
    default: { cause: '可能为周围性面神经麻痹（贝尔氏面瘫）、亨特综合征或中枢性面瘫（脑卒中）', department: '神经内科', treatment: '建议立即就医，72小时内为黄金治疗期，注意休息和面部保暖', medicine: '遵医嘱使用糖皮质激素、抗病毒药物和神经营养药物' }
};

// ============================================
// 全局时钟功能
// ============================================
function updateClock() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[now.getDay()];
    
    const dateStr = `${year}年${month}月${day}日`;
    const timeStr = `${hours}:${minutes}:${seconds}`;
    
    const dateEl = document.getElementById('clockDate');
    const timeEl = document.getElementById('clockTime');
    const weekdayEl = document.getElementById('clockWeekday');
    
    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;
    if (weekdayEl) weekdayEl.textContent = `星期${weekday}`;
}

function initClock() {
    // 如果页面没有时钟栏则不初始化
    if (!document.getElementById('clockDate')) return;
    updateClock();
    setInterval(updateClock, 1000);
    document.body.classList.add('has-clock-bar');
}

// 在DOMContentLoaded时也初始化时钟
document.addEventListener('DOMContentLoaded', function() {
    initClock();
});
