const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Railway 会自动设置 DATABASE_URL 环境变量
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString || 'postgresql://localhost:5432/bank'
});

// 格式化金额
const formatAmount = (amount) => parseFloat(parseFloat(amount).toFixed(2));

// 初始化数据库表
async function initDatabase() {
    console.log('正在连接数据库...');
    console.log('DATABASE_URL:', connectionString ? '已设置' : '未设置');
    
    let retries = 5;
    let client;
    
    while (retries > 0) {
        try {
            client = await pool.connect();
            console.log('数据库连接成功');
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS cards (
                    id TEXT PRIMARY KEY,
                    card_number TEXT UNIQUE NOT NULL,
                    balance DECIMAL(15, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS deposit_requests (
                    id TEXT PRIMARY KEY,
                    card_number TEXT NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP
                )
            `);
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS automation_rules (
                    id TEXT PRIMARY KEY,
                    card_number TEXT NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // 兑换码表
            await client.query(`
                CREATE TABLE IF NOT EXISTS exchange_codes (
                    id TEXT PRIMARY KEY,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    used_at TIMESTAMP,
                    used_card_number TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // 初始化测试数据
            const result = await client.query('SELECT COUNT(*) FROM cards');
            if (parseInt(result.rows[0].count) === 0) {
                await client.query(`
                    INSERT INTO cards (id, card_number, balance, created_at) VALUES
                    ($1, $2, $3, $4),
                    ($5, $6, $7, $8),
                    ($9, $10, $11, $12)
                `, [
                    uuidv4(), '6222021234567890', 10000, new Date().toISOString(),
                    uuidv4(), '6222020987654321', 5000, new Date().toISOString(),
                    uuidv4(), '6222025555666677', 25000, new Date().toISOString()
                ]);
                console.log('已初始化测试卡号数据');
            }
            
            console.log('数据库初始化完成');
            return;
        } catch (err) {
            console.error(`数据库连接失败 (剩余 ${retries} 次重试):`, err.message);
            retries--;
            if (retries > 0) {
                console.log('3秒后重试...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } finally {
            if (client) client.release();
        }
    }
    
    console.error('数据库连接失败，请检查 Railway PostgreSQL 插件是否已添加到项目');
}

// 初始化数据库
initDatabase();

// 卡片操作
const getCard = async (cardNumber) => {
    const result = await pool.query(
        'SELECT * FROM cards WHERE card_number = $1',
        [cardNumber]
    );
    return result.rows[0] || null;
};

const getAllCards = async () => {
    const result = await pool.query(
        'SELECT * FROM cards ORDER BY created_at DESC'
    );
    return result.rows;
};

const addCard = async (cardNumber, initialBalance = 0) => {
    // 检查卡号是否已存在
    const existing = await pool.query(
        'SELECT * FROM cards WHERE card_number = $1',
        [cardNumber]
    );
    if (existing.rows.length > 0) {
        throw new Error('卡号已存在');
    }
    
    const result = await pool.query(`
        INSERT INTO cards (id, card_number, balance, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [uuidv4(), cardNumber, formatAmount(initialBalance), new Date().toISOString()]);
    
    return result.rows[0];
};

const updateBalance = async (cardNumber, newBalance) => {
    const card = await getCard(cardNumber);
    if (!card) {
        return { success: false, message: '卡号不存在' };
    }
    
    const oldBalance = card.balance;
    await pool.query(
        'UPDATE cards SET balance = $1 WHERE card_number = $2',
        [formatAmount(newBalance), cardNumber]
    );
    
    return {
        success: true,
        oldBalance,
        newBalance: formatAmount(newBalance),
        difference: formatAmount(newBalance) - oldBalance
    };
};

// 存款请求操作
const createDepositRequest = async (cardNumber, amount) => {
    const result = await pool.query(`
        INSERT INTO deposit_requests (id, card_number, amount, status, created_at)
        VALUES ($1, $2, $3, 'PENDING', $4)
        RETURNING *
    `, [uuidv4(), cardNumber, formatAmount(amount), new Date().toISOString()]);
    
    return result.rows[0];
};

const getRequestById = async (id) => {
    const result = await pool.query(
        'SELECT * FROM deposit_requests WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
};

const getPendingRequests = async () => {
    const result = await pool.query(`
        SELECT dr.*, c.balance as current_balance
        FROM deposit_requests dr
        LEFT JOIN cards c ON dr.card_number = c.card_number
        WHERE dr.status = 'PENDING'
        ORDER BY dr.created_at DESC
    `);
    return result.rows;
};

const approveRequest = async (requestId) => {
    const request = await getRequestById(requestId);
    if (!request) {
        return { success: false, message: '请求不存在' };
    }
    if (request.status !== 'PENDING') {
        return { success: false, message: '请求已处理' };
    }
    
    // 更新卡片余额
    await pool.query(
        'UPDATE cards SET balance = balance + $1 WHERE card_number = $2',
        [request.amount, request.card_number]
    );
    
    // 更新请求状态
    await pool.query(`
        UPDATE deposit_requests 
        SET status = 'APPROVED', processed_at = $1 
        WHERE id = $2
    `, [new Date().toISOString(), requestId]);
    
    return {
        success: true,
        cardNumber: request.card_number,
        amount: request.amount
    };
};

const rejectRequest = async (requestId) => {
    const request = await getRequestById(requestId);
    if (!request) {
        return { success: false, message: '请求不存在' };
    }
    if (request.status !== 'PENDING') {
        return { success: false, message: '请求已处理' };
    }
    
    await pool.query(`
        UPDATE deposit_requests 
        SET status = 'REJECTED', processed_at = $1 
        WHERE id = $2
    `, [new Date().toISOString(), requestId]);
    
    return { success: true };
};

// 自动规则操作
const getAutomationRules = async () => {
    const result = await pool.query(`
        SELECT ar.*, c.balance as current_balance
        FROM automation_rules ar
        LEFT JOIN cards c ON ar.card_number = c.card_number
        WHERE ar.is_active = true
        ORDER BY ar.created_at DESC
    `);
    return result.rows;
};

const addAutomationRule = async (cardNumber, amount, description = '') => {
    // 检查卡号是否存在
    const card = await getCard(cardNumber);
    if (!card) {
        throw new Error('卡号不存在，请先添加该卡号');
    }
    
    const result = await pool.query(`
        INSERT INTO automation_rules (id, card_number, amount, description, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, $5)
        RETURNING *
    `, [uuidv4(), cardNumber, formatAmount(amount), description, new Date().toISOString()]);
    
    return result.rows[0];
};

const deleteAutomationRule = async (ruleId) => {
    await pool.query(
        'UPDATE automation_rules SET is_active = false WHERE id = $1',
        [ruleId]
    );
};

const executeDailyRules = async () => {
    const rules = await getAutomationRules();
    let count = 0;
    
    for (const rule of rules) {
        await pool.query(
            'UPDATE cards SET balance = balance + $1 WHERE card_number = $2',
            [rule.amount, rule.card_number]
        );
        count++;
    }
    
    return { count, rules };
};

// 兑换码操作
const getExchangeCode = async (code) => {
    const result = await pool.query(
        'SELECT * FROM exchange_codes WHERE code = $1 AND is_active = true',
        [code.toUpperCase()]
    );
    return result.rows[0] || null;
};

const getAllExchangeCodes = async () => {
    const result = await pool.query(
        'SELECT * FROM exchange_codes ORDER BY created_at DESC'
    );
    return result.rows;
};

const addExchangeCode = async (code, amount) => {
    const existing = await pool.query(
        'SELECT * FROM exchange_codes WHERE code = $1',
        [code.toUpperCase()]
    );
    if (existing.rows.length > 0) {
        throw new Error('兑换码已存在');
    }
    
    const result = await pool.query(`
        INSERT INTO exchange_codes (id, code, amount, is_active, created_at)
        VALUES ($1, $2, $3, true, $4)
        RETURNING *
    `, [uuidv4(), code.toUpperCase(), formatAmount(amount), new Date().toISOString()]);
    
    return result.rows[0];
};

const deleteExchangeCode = async (codeId) => {
    await pool.query(
        'UPDATE exchange_codes SET is_active = false WHERE id = $1',
        [codeId]
    );
};

// 检查卡号是否已经使用过任何兑换码
const checkCardNumberRedeemed = async (cardNumber) => {
    const result = await pool.query(
        'SELECT * FROM exchange_codes WHERE used_card_number = $1 AND used_at IS NOT NULL',
        [cardNumber]
    );
    return result.rows.length > 0;
};

const redeemExchangeCode = async (code, cardNumber) => {
    // 查找兑换码
    const exchangeCode = await getExchangeCode(code);
    if (!exchangeCode) {
        return { success: false, message: '兑换码不存在或已失效' };
    }
    if (exchangeCode.used_at) {
        return { success: false, message: '兑换码已被使用' };
    }
    
    // 查找卡号
    const card = await getCard(cardNumber);
    if (!card) {
        return { success: false, message: '银行卡号不存在' };
    }
    
    // 检查该卡号是否已经兑换过任何兑换码（每个卡号只能兑换一次）
    const hasRedeemed = await checkCardNumberRedeemed(cardNumber);
    if (hasRedeemed) {
        return { success: false, message: '该卡号已兑换过兑换码，每个卡号只能兑换一次' };
    }
    
    // 标记兑换码为已使用，并记录使用的卡号
    await pool.query(
        'UPDATE exchange_codes SET used_at = $1, used_card_number = $2 WHERE id = $3',
        [new Date().toISOString(), cardNumber, exchangeCode.id]
    );
    
    // 更新卡号余额
    await pool.query(
        'UPDATE cards SET balance = balance + $1 WHERE card_number = $2',
        [exchangeCode.amount, cardNumber]
    );
    
    return {
        success: true,
        data: {
            code: exchangeCode.code,
            amount: exchangeCode.amount,
            cardNumber: cardNumber
        }
    };
};

module.exports = {
    getCard,
    getAllCards,
    addCard,
    updateBalance,
    createDepositRequest,
    getRequestById,
    getPendingRequests,
    approveRequest,
    rejectRequest,
    getAutomationRules,
    addAutomationRule,
    deleteAutomationRule,
    executeDailyRules,
    getExchangeCode,
    getAllExchangeCodes,
    addExchangeCode,
    deleteExchangeCode,
    redeemExchangeCode
};