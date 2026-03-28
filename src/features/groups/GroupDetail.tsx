import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { ExpenseList } from '../expenses/ExpenseList'
import { BalanceView } from '../balances/BalanceView'

type Tab = 'expenses' | 'balances'

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { groups, loadGroups, loadGroupData, addMember, removeMember } = useStore()
  const [memberName, setMemberName] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('expenses')

  const group = groups.find((g) => g.id === groupId)

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (groupId) {
      loadGroupData(groupId)
    }
  }, [groupId, loadGroupData])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim() || !groupId) return
    await addMember(groupId, memberName.trim())
    setMemberName('')
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p>Carregant...</p>
      </div>
    )
  }

  const activeMembers = group.members.filter((m) => !m.deleted)

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Tornar"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-gray-500">{group.currency}</p>
        </div>
      </div>

      {/* Members section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Membres</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {activeMembers.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-white"
              style={{ backgroundColor: member.color }}
            >
              {member.name}
              <button
                onClick={() => removeMember(group.id, member.id)}
                className="ml-1 hover:opacity-75"
                aria-label={`Eliminar ${member.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={handleAddMember} className="flex gap-2">
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Nom del membre"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Afegir
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'expenses'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Despeses
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'balances'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Balanços
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'expenses' ? (
        <ExpenseList group={group} />
      ) : (
        <BalanceView group={group} />
      )}
    </div>
  )
}
