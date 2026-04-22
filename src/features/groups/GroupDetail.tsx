import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Pencil, Check, Settings, Archive, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useStore } from '../../store'
import { ExpenseList } from '../expenses/ExpenseList'
import { BalanceView } from '../balances/BalanceView'
import { SettlementList } from '../settlements/SettlementList'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const SyncPanel = lazy(() => import('./SyncPanel').then((m) => ({ default: m.SyncPanel })))

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
  const [showAddMember, setShowAddMember] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [isSyncClosingLocked, setIsSyncClosingLocked] = useState(false)
  const syncModalRef = useRef<HTMLDivElement>(null)

  const group = groups.find((g) => g.id === groupId)
  const isArchived = group?.archived ?? false

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
    setShowAddMember(false)
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

  const handleCancelAddMember = () => {
    setShowAddMember(false)
    setMemberName('')
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

  useEffect(() => {
    if (showSyncModal) {
      syncModalRef.current?.focus()
    }
  }, [showSyncModal])

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p>Carregant...</p>
      </div>
    )
  }

  const activeMembers = group.members.filter((m) => !m.deleted)

  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col min-h-0 px-4">
      <div className="flex items-center gap-3 pt-4 pb-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          aria-label="Tornar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {group.icon && <span className="text-2xl">{group.icon}</span>}
            <h1 className="text-2xl font-bold truncate">{group.name}</h1>
            {isArchived && (
              <Badge variant="outline" className="text-muted-foreground shrink-0 gap-1">
                <Archive className="h-3 w-3" />
                Arxivat
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground truncate">{group.description}</p>
          )}
        </div>
        {!isArchived && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSyncModal(true)}
            aria-label="Continuar en un altre dispositiu"
            title="Continuar en un altre dispositiu"
          >
            <Smartphone className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/group/${groupId}/settings`)}
          aria-label="Configuració del grup"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="mb-4 shrink-0 rounded-md bg-muted border border-border px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Archive className="h-4 w-4 shrink-0" />
          <span>Aquest grup és de només lectura. Desarxiva'l per poder fer canvis.</span>
        </div>
      )}


      {/* Members section */}
      <div className="mb-6 shrink-0">
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
                {!isArchived && editingMemberId === member.id ? (
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
                    {!isArchived && (
                      <button
                        onClick={() => handleStartEdit(member.id, member.name)}
                        className="ml-1 hover:opacity-75"
                        aria-label={`Editar ${member.name}`}
                        title={`Editar ${member.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {!isArchived && !hasMovements && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="hover:opacity-75"
                            aria-label={`Eliminar ${member.name}`}
                            title={`Eliminar ${member.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar membre</AlertDialogTitle>
                            <AlertDialogDescription>
                              Estàs segur que vols eliminar &quot;{member.name}&quot; del grup? Aquesta acció no es pot desfer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMember(group.id, member.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </span>
            )
          })}
        </div>
        {!isArchived && (
          showAddMember ? (
            <form onSubmit={handleAddMember} className="flex gap-2">
              <Input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Nom del membre"
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="sm">
                <Check className="h-4 w-4 mr-1" />
                Afegir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelAddMember}
                aria-label="Cancel·lar"
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Afegir membre
            </button>
          )
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full shrink-0">
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

        <TabsContent value="expenses" className="flex-1 overflow-y-auto min-h-0 pb-4">
          <ExpenseList group={group} />
        </TabsContent>
        <TabsContent value="balances" className="flex-1 overflow-y-auto min-h-0 pb-4">
          <BalanceView group={group} />
        </TabsContent>
        <TabsContent value="settlements" className="flex-1 overflow-y-auto min-h-0 pb-4">
          <SettlementList group={group} />
        </TabsContent>
      </Tabs>
      </div>

      {showSyncModal && !isArchived && (
        <div
          ref={syncModalRef}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Sincronitzar grup"
          tabIndex={-1}
          onClick={() => {
            if (!isSyncClosingLocked) {
              setShowSyncModal(false)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isSyncClosingLocked) {
              setShowSyncModal(false)
            }
          }}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-t-3xl border bg-background p-4 shadow-xl sm:mb-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-center sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Sincronitzar grup</h2>
                <p className="text-sm text-muted-foreground">
                  Comparteix el grup amb un altre dispositiu sense sortir d&apos;aquesta vista.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSyncModal(false)}
                aria-label="Tancar sincronització"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Suspense fallback={<p className="text-sm text-muted-foreground">Carregant sincronització…</p>}>
              <SyncPanel groupId={group.id} embedded onActiveStateChange={setIsSyncClosingLocked} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
