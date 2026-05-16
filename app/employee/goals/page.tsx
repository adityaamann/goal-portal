'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

type Goal = {
  _key: number
  thrust_area: string
  title: string
  description: string
  uom: string
  target: string
  weightage: string
}

let _keySeq = 0
const newGoal = (): Goal => ({ _key: _keySeq++, thrust_area: '', title: '', description: '', uom: 'numeric_min', target: '', weightage: '' })

export default function GoalCreate() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [goals, setGoals] = useState<Goal[]>(() => [newGoal()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  const totalWeightage = goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0)
  const isValid = totalWeightage === 100 && goals.every(g => g.title && g.target && Number(g.weightage) >= 10)

  const updateGoal = (i: number, field: keyof Omit<Goal, '_key'>, value: string) => {
    const next = [...goals]
    next[i][field] = value
    setGoals(next)
  }

  const addGoal = () => {
    if (goals.length >= 8) return toast.error('Max 8 goals allowed')
    setGoals([...goals, newGoal()])
  }

  const removeGoal = (i: number) => {
    if (goals.length === 1) return
    setGoals(goals.filter((_, idx) => idx !== i))
  }

  const submit = async () => {
    if (!isValid) return toast.error('Fix validation errors first')
    setSaving(true)

    const { data: cycle } = await supabase.from('cycles').select('id').limit(1).single()

    const { data: sheet, error: e1 } = await supabase
      .from('goal_sheets')
      .insert({ employee_id: user.id, cycle_id: cycle!.id, status: 'pending', submitted_at: new Date().toISOString() })
      .select()
      .single()

    if (e1) { toast.error(e1.message); setSaving(false); return }

    const rows = goals.map(g => ({
      sheet_id: sheet.id,
      thrust_area: g.thrust_area,
      title: g.title,
      description: g.description,
      uom: g.uom,
      target: Number(g.target),
      weightage: Number(g.weightage),
    }))

    const { error: e2 } = await supabase.from('goals').insert(rows)
    if (e2) { toast.error(e2.message); setSaving(false); return }

    toast.success('Goals submitted for approval!')
    setTimeout(() => router.push('/employee'), 1000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Create Goal Sheet</h1>
          <Button variant="outline" onClick={() => router.push('/employee')}>Back</Button>
        </div>

        <Card className="p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Total Weightage: {totalWeightage}%</span>
            <span className="text-sm text-slate-500">{goals.length}/8 goals</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${totalWeightage === 100 ? 'bg-green-500' : totalWeightage > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(totalWeightage, 100)}%` }}
            />
          </div>
        </Card>

        <div className="space-y-4">
          {goals.map((g, i) => (
            <Card key={g._key} className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Goal {i + 1}</h3>
                {goals.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeGoal(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Thrust Area (e.g. Revenue)" value={g.thrust_area} onChange={e => updateGoal(i, 'thrust_area', e.target.value)} />
                <Input placeholder="Goal Title" value={g.title} onChange={e => updateGoal(i, 'title', e.target.value)} />
                <Input placeholder="Description" value={g.description} onChange={e => updateGoal(i, 'description', e.target.value)} className="col-span-2" />
                <Select value={g.uom} onValueChange={v => updateGoal(i, 'uom', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric_min">Numeric (Higher = Better)</SelectItem>
                    <SelectItem value="numeric_max">Numeric (Lower = Better)</SelectItem>
                    <SelectItem value="percent_min">Percent (Higher = Better)</SelectItem>
                    <SelectItem value="percent_max">Percent (Lower = Better)</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="zero">Zero-based</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Target" value={g.target} onChange={e => updateGoal(i, 'target', e.target.value)} />
                <Input type="number" placeholder="Weightage % (min 10)" value={g.weightage} onChange={e => updateGoal(i, 'weightage', e.target.value)} className="col-span-2" />
              </div>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={addGoal} disabled={goals.length >= 8}>
            <Plus className="w-4 h-4 mr-1" /> Add Goal
          </Button>
          <Button onClick={submit} disabled={!isValid || saving} className="ml-auto">
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </div>
  )
}