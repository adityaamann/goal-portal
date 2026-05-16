'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type TeamMember = {
  employee: { id: string; full_name: string }
  goals: any[]
  achievements: any[]
}

const fetchManagerCheckin = async (managerId: string): Promise<TeamMember[]> => {
  const { data: members } = await supabase.from('users').select('id, full_name').eq('manager_id', managerId)
  if (!members || members.length === 0) return []

  const memberIds = members.map(m => m.id)
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  const { data: sheets } = await supabase
    .from('goal_sheets')
    .select('id, employee_id, goals(*)')
    .in('employee_id', memberIds)
    .eq('status', 'approved')

  if (!sheets || sheets.length === 0) return []

  const allGoalIds = sheets.flatMap(s => (s.goals as any[]).map(g => g.id))
  const { data: ach } = await supabase.from('achievements').select('*').in('goal_id', allGoalIds)
  const achievements = ach || []

  return sheets.map(sheet => ({
    employee: memberMap[sheet.employee_id],
    goals: sheet.goals as any[],
    achievements: achievements.filter(a => (sheet.goals as any[]).some(g => g.id === a.goal_id)),
  }))
}

export default function ManagerCheckin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [quarter, setQuarter] = useState('Q1')
  const [comments, setComments] = useState<Record<string, string>>({})

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  const loadTeam = async () => {
    if (!user) return
    try {
      const next = await fetchManagerCheckin(user.id)
      setTeam(next)
    } catch {
      toast.error('Failed to load team data')
    }
  }

  useEffect(() => {
    if (!user) return
    loadTeam()
  }, [user])

  const saveComment = async (goalId: string) => {
    const key = `${goalId}-${quarter}`
    const comment = comments[key]
    if (!comment) return

    setTeam(prev => prev.map(t => {
        if (!t.goals.some(g => g.id === goalId)) return t
        const has = t.achievements.some(a => a.goal_id === goalId && a.quarter === quarter)
        return {
          ...t,
          achievements: has
            ? t.achievements.map(a => a.goal_id === goalId && a.quarter === quarter ? { ...a, manager_comment: comment } : a)
            : [...t.achievements, { goal_id: goalId, quarter, manager_comment: comment }],
        }
      }))

    const { error } = await supabase.from('achievements').upsert({
      goal_id: goalId, quarter, manager_comment: comment
    }, { onConflict: 'goal_id,quarter' })

    if (error) {
      toast.error(error.message)
      await loadTeam()
      return
    }
    toast.success('Comment saved')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team Check-in Review</h1>
          <Button variant="outline" onClick={() => router.push('/manager')}>Back</Button>
        </div>

        <Tabs value={quarter} onValueChange={setQuarter}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="Q1">Q1</TabsTrigger>
            <TabsTrigger value="Q2">Q2</TabsTrigger>
            <TabsTrigger value="Q3">Q3</TabsTrigger>
            <TabsTrigger value="Q4">Q4</TabsTrigger>
          </TabsList>
          {['Q1','Q2','Q3','Q4'].map(q => (
            <TabsContent key={q} value={q} className="space-y-6">
              {team.length === 0 ? <Card className="p-6 text-center text-slate-500">No team data yet.</Card> :
                team.map(t => (
                  <Card key={t.employee.id} className="p-4">
                    <h2 className="font-semibold mb-3">{t.employee.full_name}</h2>
                    <div className="space-y-3">
                      {t.goals.map((g: any) => {
                        const a = t.achievements.find((x: any) => x.goal_id === g.id && x.quarter === q)
                        const key = `${g.id}-${q}`
                        return (
                          <div key={g.id} className="border-l-4 border-slate-300 pl-3">
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <p className="font-medium">{g.title}</p>
                                <p className="text-xs text-slate-500">Planned: {g.target} · Actual: {a?.actual_value ?? '—'}</p>
                              </div>
                              <Badge variant="secondary">{a?.status || 'not_started'}</Badge>
                            </div>
                            <Textarea
                              placeholder="Add check-in comment..."
                              value={comments[key] ?? (a?.manager_comment || '')}
                              onChange={e => setComments(prev => ({ ...prev, [key]: e.target.value }))}
                              className="text-sm"
                              rows={2}
                            />
                            <Button size="sm" className="mt-2" onClick={() => saveComment(g.id)}>Save Comment</Button>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                ))
              }
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
