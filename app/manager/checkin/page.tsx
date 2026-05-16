'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast, Toaster } from 'sonner'

export default function ManagerCheckin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [quarter, setQuarter] = useState('Q1')
  const [comments, setComments] = useState<Record<string, string>>({})

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    const parsed = JSON.parse(u)
    setUser(parsed)
    load(parsed.id)
  }, [])

  const load = async (managerId: string) => {
    const { data: members } = await supabase.from('users').select('id, full_name').eq('manager_id', managerId)
    if (!members) return
    const result = []
    for (const m of members) {
      const { data: sheet } = await supabase
        .from('goal_sheets')
        .select('id, goals(*)')
        .eq('employee_id', m.id)
        .eq('status', 'approved')
        .single()
      if (!sheet) continue
      const goalIds = sheet.goals.map((g: any) => g.id)
      const { data: ach } = await supabase.from('achievements').select('*').in('goal_id', goalIds)
      result.push({ employee: m, goals: sheet.goals, achievements: ach || [] })
    }
    setTeam(result)
  }

  const saveComment = async (goalId: string) => {
    const comment = comments[`${goalId}-${quarter}`]
    if (!comment) return
    const { error } = await supabase.from('achievements').upsert({
      goal_id: goalId, quarter, manager_comment: comment
    }, { onConflict: 'goal_id,quarter' })
    if (error) return toast.error(error.message)
    toast.success('Comment saved')
    load(user.id)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Toaster position="top-right" />
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
                              defaultValue={a?.manager_comment || ''}
                              onChange={e => setComments({ ...comments, [key]: e.target.value })}
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