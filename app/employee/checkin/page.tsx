'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const fetchCheckin = async (userId: string) => {
  const { data: sheet } = await supabase
    .from('goal_sheets')
    .select('id, status, goals(*)')
    .eq('employee_id', userId)
    .eq('status', 'approved')
    .single()
  if (!sheet) return { goals: [], achievements: {} }
  const goalIds = (sheet.goals as any[]).map(g => g.id)
  const { data: ach } = await supabase.from('achievements').select('*').in('goal_id', goalIds)
  const map: Record<string, any> = {}
  ach?.forEach(a => { map[`${a.goal_id}-${a.quarter}`] = a })
  return { goals: sheet.goals as any[], achievements: map }
}

export default function Checkin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<{ goals: any[]; achievements: Record<string, any> } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [achievements, setAchievements] = useState<Record<string, any>>({})
  const [quarter, setQuarter] = useState('Q1')

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  useEffect(() => {
    if (!user) return
    const loadData = async () => {
      setIsLoading(true)
      try {
        const next = await fetchCheckin(user.id)
        setData(next)
      } catch {
        toast.error('Failed to load check-in data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user])

  useEffect(() => {
    if (data?.achievements) setAchievements(data.achievements)
  }, [data])

  const goals = data?.goals ?? []

  const updateAch = (goalId: string, field: string, value: any) => {
    const key = `${goalId}-${quarter}`
    setAchievements(prev => ({ ...prev, [key]: { ...(prev[key] || { goal_id: goalId, quarter }), [field]: value } }))
  }

  const save = async (goalId: string) => {
    const key = `${goalId}-${quarter}`
    const a = achievements[key]
    if (!a) return
    const { error } = await supabase.from('achievements').upsert({
      goal_id: goalId, quarter, actual_value: a.actual_value, status: a.status || 'not_started'
    }, { onConflict: 'goal_id,quarter' })
    if (error) return toast.error(error.message)
    toast.success('Saved')
  }

  const progress = (g: any, a: any) => {
    if (!a?.actual_value) return '-'
    const t = Number(g.target), act = Number(a.actual_value)
    if (g.uom === 'numeric_min' || g.uom === 'percent_min') return `${Math.round((act / t) * 100)}%`
    if (g.uom === 'numeric_max' || g.uom === 'percent_max') return `${Math.round((t / act) * 100)}%`
    if (g.uom === 'zero') return act === 0 ? '100%' : '0%'
    return '-'
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Quarterly Check-in</h1>
          <Button variant="outline" onClick={() => router.push('/employee')}>Back</Button>
        </div>

        {isLoading ? <p>Loading...</p> : goals.length === 0 ? (
          <Card className="p-6 text-center text-slate-500">No approved goals yet. Wait for manager approval.</Card>
        ) : (
          <Tabs value={quarter} onValueChange={setQuarter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="Q1">Q1</TabsTrigger>
              <TabsTrigger value="Q2">Q2</TabsTrigger>
              <TabsTrigger value="Q3">Q3</TabsTrigger>
              <TabsTrigger value="Q4">Q4</TabsTrigger>
            </TabsList>
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <TabsContent key={q} value={q} className="space-y-3 mt-4">
                {goals.map(g => {
                  const a = achievements[`${g.id}-${q}`]
                  return (
                    <Card key={g.id} className="p-4">
                      <div className="flex justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{g.title}</h3>
                          <p className="text-xs text-slate-500">{g.thrust_area} · Target: {g.target} · Weight: {g.weightage}%</p>
                        </div>
                        <Badge>{progress(g, a)}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="text-xs text-slate-500">Actual Achievement</label>
                          <Input type="number" value={a?.actual_value ?? ''} onChange={e => updateAch(g.id, 'actual_value', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Status</label>
                          <Select value={a?.status || 'not_started'} onValueChange={v => updateAch(g.id, 'status', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="on_track">On Track</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={() => save(g.id)}>Save</Button>
                      </div>
                      {a?.manager_comment && (
                        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                          <span className="font-medium">Manager: </span>{a.manager_comment}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  )
}
