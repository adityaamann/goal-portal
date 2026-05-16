'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast, Toaster } from 'sonner'

export default function ManagerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sheets, setSheets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    const parsed = JSON.parse(u)
    setUser(parsed)
    loadSheets(parsed.id)
  }, [])

  const loadSheets = async (managerId: string) => {
    setLoading(true)
    const { data: team } = await supabase.from('users').select('id, full_name').eq('manager_id', managerId)
    if (!team || team.length === 0) { setSheets([]); setLoading(false); return }
    const teamIds = team.map(t => t.id)

    const { data } = await supabase
      .from('goal_sheets')
      .select('*, goals(*), users!goal_sheets_employee_id_fkey(full_name)')
      .in('employee_id', teamIds)
      .order('submitted_at', { ascending: false })

    setSheets(data || [])
    setLoading(false)
  }

  const decide = async (sheetId: string, newStatus: 'approved' | 'returned') => {
    const { error } = await supabase
      .from('goal_sheets')
      .update({ status: newStatus, approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', sheetId)
    if (error) return toast.error(error.message)
    toast.success(`Goal sheet ${newStatus}`)
    loadSheets(user.id)
  }

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Manager Dashboard</h1>
            <p className="text-slate-600">Welcome, {user.name}</p>
          </div>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>

        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Team Goal Sheets</h2>
          <Button variant="outline" onClick={() => router.push('/manager/checkin')}>Team Check-in</Button>
        </div>
        
        {loading ? <p>Loading...</p> : sheets.length === 0 ? <p className="text-slate-500">No submissions yet.</p> : (
          <div className="space-y-4">
            {sheets.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-semibold">{s.users.full_name}</h3>
                    <p className="text-sm text-slate-500">{s.goals.length} goals · Submitted {s.submitted_at?.split('T')[0]}</p>
                  </div>
                  <Badge variant={s.status === 'approved' ? 'default' : s.status === 'returned' ? 'destructive' : 'secondary'}>
                    {s.status}
                  </Badge>
                </div>
                <div className="space-y-2 mb-3">
                  {s.goals.map((g: any) => (
                    <div key={g.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                      <span>{g.title} <span className="text-slate-400">({g.thrust_area})</span></span>
                      <span className="font-medium">Target: {g.target} · {g.weightage}%</span>
                    </div>
                  ))}
                </div>
                {s.status === 'pending' && (
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => decide(s.id, 'returned')}>Return</Button>
                    <Button size="sm" onClick={() => decide(s.id, 'approved')}>Approve & Lock</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}