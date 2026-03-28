import type { Group } from '../../domain/entities'
import { useStore } from '../../store'
import {
  calculateBalances,
  calculateSettlements,
} from '../../domain/services/balances'

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

interface BalanceViewProps {
  group: Group
}

export function BalanceView({ group }: BalanceViewProps) {
  const { expenses, payments, addPayment } = useStore()

  const activeMembers = group.members.filter((m) => !m.deleted)
  const memberIds = activeMembers.map((m) => m.id)
  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency

  const balances = calculateBalances(memberIds, expenses, payments)
  const settlements = calculateSettlements(balances)

  const getMemberName = (id: string) =>
    group.members.find((m) => m.id === id)?.name ?? 'Desconegut'

  const totalExpenses = expenses
    .filter((e) => !e.deleted)
    .reduce((sum, e) => sum + e.amount, 0)

  const handleRecordPayment = async (fromId: string, toId: string, amount: number) => {
    await addPayment({
      groupId: group.id,
      fromId,
      toId,
      amount,
      date: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
        <div className="text-sm text-indigo-600 font-medium">Total despeses</div>
        <div className="text-2xl font-bold text-indigo-800">
          {totalExpenses.toFixed(2)} {symbol}
        </div>
      </div>

      {/* Balances */}
      <h3 className="font-semibold mb-3">Balanç per membre</h3>
      {activeMembers.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No hi ha membres al grup.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {balances.map((balance) => {
            const member = activeMembers.find((m) => m.id === balance.memberId)
            if (!member) return null
            return (
              <div
                key={balance.memberId}
                className="flex items-center justify-between p-3 bg-white rounded-lg border"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  <span className="font-medium">{member.name}</span>
                </div>
                <span
                  className={`font-semibold ${
                    balance.total > 0
                      ? 'text-green-600'
                      : balance.total < 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                  }`}
                >
                  {balance.total > 0 ? '+' : ''}
                  {balance.total.toFixed(2)} {symbol}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Settlements */}
      <h3 className="font-semibold mb-3">Transferències suggerides</h3>
      {settlements.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          Tot està equilibrat! 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {settlements.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100"
            >
              <div>
                <span className="font-medium">{getMemberName(s.fromId)}</span>
                <span className="text-gray-500"> → </span>
                <span className="font-medium">{getMemberName(s.toId)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-700">
                  {s.amount.toFixed(2)} {symbol}
                </span>
                <button
                  onClick={() => handleRecordPayment(s.fromId, s.toId, s.amount)}
                  className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  title="Registrar aquest pagament"
                >
                  ✓ Pagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
