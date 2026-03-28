import { useState } from 'react'
import type { Group } from '../../domain/entities'
import { useStore } from '../../store'

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface ExpenseListProps {
  group: Group
}

export function ExpenseList({ group }: ExpenseListProps) {
  const { expenses, addExpense, deleteExpense } = useStore()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  const [splitAmong, setSplitAmong] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)

  const activeMembers = group.members.filter((m) => !m.deleted)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount || !payerId || splitAmong.length === 0) return

    await addExpense({
      groupId: group.id,
      description: description.trim(),
      amount: parseFloat(amount),
      payerId,
      splitAmong,
      date: new Date().toISOString().split('T')[0],
    })

    setDescription('')
    setAmount('')
    setPayerId('')
    setSplitAmong([])
    setShowForm(false)
  }

  const toggleSplitMember = (memberId: string) => {
    setSplitAmong((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    )
  }

  const selectAllMembers = () => {
    setSplitAmong(activeMembers.map((m) => m.id))
  }

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  return (
    <div>
      {activeMembers.length < 2 ? (
        <p className="text-gray-500 text-center py-4">
          Afegeix almenys 2 membres per poder crear despeses.
        </p>
      ) : (
        <>
          {!showForm ? (
            <button
              onClick={() => {
                setShowForm(true)
                selectAllMembers()
              }}
              className="w-full mb-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              + Nova despesa
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold mb-3">Nova despesa</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripció (p.ex. Sopar)"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Import"
                    step="0.01"
                    min="0.01"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <span className="flex items-center text-gray-500">{symbol}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qui ha pagat?
                  </label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
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
                    Repartir entre:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleSplitMember(m.id)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          splitAmong.includes(m.id)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Afegir despesa
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

      {expenses.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          Encara no hi ha despeses.
        </p>
      ) : (
        <div className="space-y-2">
          {expenses
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium">{expense.description}</div>
                  <div className="text-sm text-gray-500">
                    {getMemberName(expense.payerId)} ha pagat · {expense.date}
                  </div>
                  <div className="text-xs text-gray-400">
                    Repartit entre: {expense.splitAmong.map(getMemberName).join(', ')}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-semibold">
                    {expense.amount.toFixed(2)} {symbol}
                  </div>
                  <button
                    onClick={() => deleteExpense(expense.id)}
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
