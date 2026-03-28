import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useNavigate } from 'react-router-dom'

export function GroupList() {
  const { groups, loadGroups, addGroup, deleteGroup } = useStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const navigate = useNavigate()

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const group = await addGroup(name.trim(), currency)
    setName('')
    setCurrency('EUR')
    navigate(`/group/${group.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">🧾 Reparteix</h1>
      <p className="text-gray-600 mb-8">
        Gestiona despeses compartides de forma local i privada.
      </p>

      <form onSubmit={handleCreate} className="mb-8 p-4 bg-gray-50 rounded-lg border">
        <h2 className="text-lg font-semibold mb-3">Nou grup</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom del grup"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
            <option value="GBP">GBP £</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Crear
          </button>
        </div>
      </form>

      {groups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Encara no tens cap grup. Crea&apos;n un per començar!
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow"
            >
              <button
                onClick={() => navigate(`/group/${group.id}`)}
                className="flex-1 text-left"
              >
                <h3 className="font-medium">{group.name}</h3>
                <p className="text-sm text-gray-500">
                  {group.members.filter((m) => !m.deleted).length} membres · {group.currency}
                </p>
              </button>
              <button
                onClick={() => deleteGroup(group.id)}
                className="ml-2 p-2 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Eliminar grup"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
