import { useState, useEffect } from 'react'
import { supabase, BankCard, DepositRequest, TransferRule } from '../lib/supabase'
import { Lock, CreditCard, Plus, Check, X, Settings, RefreshCw, Trash2 } from 'lucide-react'

const ADMIN_PASSWORD = '20160607yY'

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'cards' | 'rules'>('requests')
  const [requests, setRequests] = useState<DepositRequest[]>([])
  const [cards, setCards] = useState<BankCard[]>([])
  const [rules, setRules] = useState<TransferRule[]>([])
  const [newCard, setNewCard] = useState('')
  const [newBalance, setNewBalance] = useState('')
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState('')
  const [ruleForm, setRuleForm] = useState({ card_number: '', daily_deposit: '', daily_deduction: '' })
  const [loading, setLoading] = useState(false)

  const login = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuth(true)
      setAuthError('')
    } else {
      setAuthError('密码错误')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    const [reqRes, cardRes, ruleRes] = await Promise.all([
      supabase.from('deposit_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('bank_cards').select('*').order('created_at', { ascending: false }),
      supabase.from('transfer_rules').select('*').order('created_at', { ascending: false })
    ])
    if (reqRes.data) setRequests(reqRes.data)
    if (cardRes.data) setCards(cardRes.data)
    if (ruleRes.data) setRules(ruleRes.data)
    setLoading(false)
  }

  useEffect(() => {
    if (isAuth) fetchData()
  }, [isAuth])

  const handleRequest = async (id: number, status: 'approved' | 'rejected') => {
    const req = requests.find(r => r.id === id)
    if (!req) return

    if (status === 'approved') {
      const card = cards.find(c => c.card_number === req.card_number)
      if (card) {
        await supabase.from('bank_cards').update({ balance: card.balance + req.amount }).eq('card_number', req.card_number)
      }
    }

    await supabase.from('deposit_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('admin_logs').insert({ action: `${status === 'approved' ? '通过' : '拒绝'}存款申请`, details: `卡号: ${req.card_number}, 金额: ${req.amount}` })
    fetchData()
  }

  const addCard = async () => {
    if (!newCard.trim()) return
    await supabase.from('bank_cards').insert({ card_number: newCard.trim(), balance: parseFloat(newBalance) || 0 })
    await supabase.from('admin_logs').insert({ action: '添加银行卡', details: `卡号: ${newCard}` })
    setNewCard('')
    setNewBalance('')
    fetchData()
  }

  const updateBalance = async (cardNumber: string) => {
    const newBal = parseFloat(editBalance)
    if (isNaN(newBal)) return
    await supabase.from('bank_cards').update({ balance: newBal }).eq('card_number', cardNumber)
    await supabase.from('admin_logs').insert({ action: '修改余额', details: `卡号: ${cardNumber}, 新余额: ${newBal}` })
    setEditingCard(null)
    fetchData()
  }

  const deleteCard = async (cardNumber: string) => {
    if (!confirm('确定删除此卡号？')) return
    await supabase.from('bank_cards').delete().eq('card_number', cardNumber)
    await supabase.from('admin_logs').insert({ action: '删除银行卡', details: `卡号: ${cardNumber}` })
    fetchData()
  }

  const addRule = async () => {
    if (!ruleForm.card_number) return
    await supabase.from('transfer_rules').insert({
      card_number: ruleForm.card_number,
      daily_deposit: parseFloat(ruleForm.daily_deposit) || 0,
      daily_deduction: parseFloat(ruleForm.daily_deduction) || 0
    })
    await supabase.from('admin_logs').insert({ action: '添加转入规则', details: `卡号: ${ruleForm.card_number}` })
    setRuleForm({ card_number: '', daily_deposit: '', daily_deduction: '' })
    fetchData()
  }

  const toggleRule = async (id: number, isActive: boolean) => {
    await supabase.from('transfer_rules').update({ is_active: !isActive }).eq('id', id)
    fetchData()
  }

  const deleteRule = async (id: number) => {
    await supabase.from('transfer_rules').delete().eq('id', id)
    fetchData()
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 w-full max-w-sm border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-6">管理员登录</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="输入管理员密码"
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 mb-4"
          />
          {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
          <button onClick={login} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
            登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">管理员控制台</h1>
          <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white transition">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 mb-6">
          {[{ key: 'requests', label: '存款审核' }, { key: 'cards', label: '卡号管理' }, { key: 'rules', label: '转入规则' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg transition ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 存款审核 */}
        {activeTab === 'requests' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">待审核申请</h3>
            {requests.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-slate-400">暂无待审核申请</p>
            ) : (
              <div className="space-y-3">
                {requests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                    <div>
                      <div className="text-white font-mono">{req.card_number}</div>
                      <div className="text-slate-400">申请金额: ¥{req.amount.toLocaleString()}</div>
                      <div className="text-slate-500 text-sm">{new Date(req.created_at).toLocaleString('zh-CN')}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRequest(req.id, 'approved')} className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition">
                        <Check className="w-5 h-5 text-white" />
                      </button>
                      <button onClick={() => handleRequest(req.id, 'rejected')} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-white font-semibold mt-8 mb-4">已处理申请</h3>
            <div className="space-y-2">
              {requests.filter(r => r.status !== 'pending').slice(0, 10).map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-300 font-mono text-sm">{req.card_number}</span>
                    <span className="text-slate-400">¥{req.amount.toLocaleString()}</span>
                  </div>
                  <span className={`text-sm ${req.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                    {req.status === 'approved' ? '已通过' : '已拒绝'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 卡号管理 */}
        {activeTab === 'cards' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">添加新卡</h3>
            <div className="flex gap-2 mb-6">
              <input
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                placeholder="卡号"
                className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <input
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="初始余额"
                type="number"
                className="w-32 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button onClick={addCard} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-white font-semibold mb-4">现有卡号</h3>
            <div className="space-y-3">
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-4">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-mono">{card.card_number}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {editingCard === card.card_number ? (
                      <>
                        <input
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          type="number"
                          className="w-32 px-3 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                          autoFocus
                        />
                        <button onClick={() => updateBalance(card.card_number)} className="text-green-400 hover:text-green-300">
                          <Check className="w-5 h-5" />
                        </button>
                        <button onClick={() => setEditingCard(null)} className="text-slate-400 hover:text-slate-300">
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-300">¥{card.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                        <button onClick={() => { setEditingCard(card.card_number); setEditBalance(card.balance.toString()) }} className="text-blue-400 hover:text-blue-300">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCard(card.card_number)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 转入规则 */}
        {activeTab === 'rules' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">添加规则</h3>
            <div className="grid grid-cols-4 gap-2 mb-6">
              <input
                value={ruleForm.card_number}
                onChange={(e) => setRuleForm({ ...ruleForm, card_number: e.target.value })}
                placeholder="卡号"
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <input
                value={ruleForm.daily_deposit}
                onChange={(e) => setRuleForm({ ...ruleForm, daily_deposit: e.target.value })}
                placeholder="每日转入"
                type="number"
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <input
                value={ruleForm.daily_deduction}
                onChange={(e) => setRuleForm({ ...ruleForm, daily_deduction: e.target.value })}
                placeholder="每日扣款"
                type="number"
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button onClick={addRule} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                添加
              </button>
            </div>

            <h3 className="text-white font-semibold mb-4">现有规则</h3>
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <div className="text-white font-mono">{rule.card_number}</div>
                    <div className="text-slate-400 text-sm">
                      每日转入: ¥{rule.daily_deposit} | 每日扣款: ¥{rule.daily_deduction}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`px-3 py-1 rounded text-sm ${rule.is_active ? 'bg-green-600/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}
                    >
                      {rule.is_active ? '启用中' : '已禁用'}
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
