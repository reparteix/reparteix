import { useState } from 'react'
import type { Group } from '../../domain/entities'
import { useStore } from '../../store'

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface SettlementListProps {
  group: Group
}

export function SettlementList({ group }: SettlementListProps) {
  const { payments, addPayment, deletePayment } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromId || !toId || !amount || fromId === toId) return
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return

    await addPayment({
      groupId: group.id,
      fromId,
      toId,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
    })

    setFromId('')
    setToId('')
    setAmount('')
    setShowForm(false)
  }

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-gray-500 text-center py-4">
          Afegeix almenys 2 membres per poder registrar pagaments.
        </p>
      ) : (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-4 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
            >
              + Nou pagament
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold mb-3">Nou pagament</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qui paga?
                  </label>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Selecciona...</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    A qui?
                  </label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Selecciona...</option>
                    {activeMembers
                      .filter((m) => m.id !== fromId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Import"
                    step="0.01"
                    min="0.01"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="flex items-center text-gray-500">{symbol}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                  >
                    Registrar pagament
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel·lar
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {payments.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          Encara no hi ha pagaments registrats.
        </p>
      ) : (
        <div className="space-y-2">
          {[...payments]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {getMemberName(payment.fromId)}{' '}
                    <span className="text-gray-400">→</span>{' '}
                    {getMemberName(payment.toId)}
                  </div>
                  <div className="text-sm text-gray-500">{payment.date}</div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-semibold text-emerald-600">
                    {payment.amount.toFixed(2)} {symbol}
                  </div>
                  <button
                    onClick={() => deletePayment(payment.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
