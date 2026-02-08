import { useState, useEffect } from 'react'
import { supabase, BankCard, DepositRequest } from '../lib/supabase'
import { Search, CreditCard, Plus, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function UserPage() {
  const [cardNumber, setCardNumber] = useState('')
  const [card, setCard] = useState<BankCard | null>(null)
  const [requests, setRequests] = useState<DepositRequest[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showDeposit, setShowDeposit] = useState(false)

  const searchCard = async () => {
    if (!cardNumber.trim()) {
      setMessage({ type: 'error', text: '请输入卡号' })
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })
    
    const { data, error } = await supabase
      .from('bank_cards')
      .select('*')
      .eq('card_number', cardNumber.trim())
      .maybeSingle()
    
    if (error) {
      setMessage({ type: 'error', text: '查询失败' })
    } else if (!data) {
      setMessage({ type: 'error', text: '未找到该卡号' })
      setCard(null)
    } else {
      setCard(data)
      fetchRequests(cardNumber.trim())
    }
    setLoading(false)
  }

  const fetchRequests = async (cn: string) => {
    const { data } = await supabase
      .from('deposit_requests')
      .select('*')
      .eq('card_number', cn)
      .order('created_at', { ascending: false })
    if (data) setRequests(data)
  }

  const submitDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: '请输入有效金额' })
      return
    }
    setLoading(true)
    
    const { error } = await supabase
      .from('deposit_requests')
      .insert({ card_number: card!.card_number, amount })
    
    if (error) {
      setMessage({ type: 'error', text: '提交失败' })
    } else {
      setMessage({ type: 'success', text: '存款申请已提交' })
      setDepositAmount('')
      setShowDeposit(false)
      fetchRequests(card!.card_number)
    }
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '已通过'
      case 'rejected': return '已拒绝'
      default: return '待审核'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="text-2xl font-bold text-white text-center mb-8">银行卡管理</h1>
        
        {/* 搜索框 */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCard()}
              placeholder="输入卡号查询"
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={searchCard}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 ${message.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
            {message.text}
          </div>
        )}

        {/* 卡片信息 */}
        {card && (
          <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl p-6 mb-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-8 h-8" />
              <span className="text-lg font-mono">{card.card_number}</span>
            </div>
            <div className="text-3xl font-bold mb-4">
              ¥ {card.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              存款申请
            </button>
          </div>
        )}

        {/* 存款表单 */}
        {showDeposit && card && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">提交存款申请</h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="输入金额"
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={submitDeposit}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                提交
              </button>
            </div>
          </div>
        )}

        {/* 审核记录 */}
        {card && requests.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">转入审核记录</h3>
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div>
                    <div className="text-white font-medium">¥ {req.amount.toLocaleString()}</div>
                    <div className="text-slate-400 text-sm">{new Date(req.created_at).toLocaleString('zh-CN')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(req.status)}
                    <span className={`text-sm ${req.status === 'approved' ? 'text-green-400' : req.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {getStatusText(req.status)}
                    </span>
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
