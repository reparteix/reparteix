import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useStore } from '../../store'
import { ExpenseList } from '../expenses/ExpenseList'
import { BalanceView } from '../balances/BalanceView'
import { SettlementList } from '../settlements/SettlementList'

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const {
    groups,
    expenses,
    payments,
    loadGroups,
    loadGroupData,
    addMember,
    removeMember,
    renameMember,
  } = useStore()
  const [memberName, setMemberName] = useState('')
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

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

  // expenses and payments from the store are already filtered for non-deleted items
  // (via listExpenses / listPayments), so no additional deleted check is needed here.
  const memberHasMovements = (memberId: string): boolean =>
    expenses.some(
      (e) => e.payerId === memberId || e.splitAmong.includes(memberId),
    ) ||
    payments.some((p) => p.fromId === memberId || p.toId === memberId)

  const handleStartEdit = (id: string, name: string) => {
    setEditingMemberId(id)
    setEditingName(name)
  }

  const handleCancelEdit = () => {
    setEditingMemberId(null)
    setEditingName('')
  }

  const handleRenameSubmit = async (
    e: React.FormEvent,
    memberId: string,
  ) => {
    e.preventDefault()
    if (!editingName.trim() || !groupId) return
    await renameMember(groupId, memberId, editingName.trim())
    setEditingMemberId(null)
    setEditingName('')
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          aria-label="Tornar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">{group.currency}</p>
        </div>
      </div>

      {/* Members section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Membres</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {activeMembers.map((member) => {
            const hasMovements = memberHasMovements(member.id)
            return (
              <span
                key={member.id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-white"
                style={{ backgroundColor: member.color }}
              >
                {editingMemberId === member.id ? (
                  <form
                    onSubmit={(e) => handleRenameSubmit(e, member.id)}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && handleCancelEdit()}
                      className="bg-white/20 rounded px-1 text-white placeholder:text-white/60 text-sm w-24 outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="hover:opacity-75"
                      aria-label="Confirmar nom"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="hover:opacity-75"
                      aria-label="Cancel·lar edició"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </form>
                ) : (
                  <>
                    {member.name}
                    <button
                      onClick={() => handleStartEdit(member.id, member.name)}
                      className="ml-1 hover:opacity-75"
                      aria-label={`Editar ${member.name}`}
                      title={`Editar ${member.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {!hasMovements && (
                      <button
                        onClick={() => removeMember(group.id, member.id)}
                        className="hover:opacity-75"
                        aria-label={`Eliminar ${member.name}`}
                        title={`Eliminar ${member.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </span>
            )
          })}
        </div>
        <form onSubmit={handleAddMember} className="flex gap-2">
          <Input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Nom del membre"
            className="flex-1"
          />
          <Button type="submit">
            <Plus className="h-4 w-4 mr-1" />
            Afegir
          </Button>
        </form>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses">
        <TabsList className="w-full">
          <TabsTrigger value="expenses" className="flex-1">
            Despeses
          </TabsTrigger>
          <TabsTrigger value="balances" className="flex-1">
            Balanços
          </TabsTrigger>
          <TabsTrigger value="settlements" className="flex-1">
            Pagaments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpenseList group={group} />
        </TabsContent>
        <TabsContent value="balances">
          <BalanceView group={group} />
        </TabsContent>
        <TabsContent value="settlements">
          <SettlementList group={group} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
