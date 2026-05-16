'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast, Toaster } from 'sonner'

export default function EmployeeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sheet, setSheet] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    const parsed = JSON.parse(u)
    setUser(parsed)
    load(parsed.id)
  }, [])

  const load = async (id: string) => {
    const { data } = await supabase
      .from('goal_sheets')
      .select('*, goals(*)')
      .eq('employee_id', id)
      .maybeSingle()
    setSheet(data)
  }

  const deleteSheet = async () => {
    if (!confirm('Delete your goal sheet? You can create a new one after.')) return
    await supabase.from('goals').delete().eq('sheet_id', sheet.id)
    await supabase.from('goal_sheets').delete().eq('id', sheet.id)
    toast.success('Goal sheet deleted')
    load(user.id)
  }

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Employee Dashboard</h1>
            <p className="text-slate-600">Welcome, {user.name}</p>
          </div>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>

        <div className="flex gap-3 mb-6">
          {!sheet ? (
            <Button onClick={() => router.push('/employee/goals')}>Create Goal Sheet</Button>
          ) : (
            <Button variant="outline" onClick={() => router.push('/employee/checkin')}>Quarterly Check-in</Button>
          )}
        </div>

        {sheet && (
          <Card className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">My Goal Sheet</h2>
              <div className="flex gap-2 items-center">
                <Badge>{sheet.status}</Badge>
                {sheet.status !== 'approved' && (
                  <Button size="sm" variant="destructive" onClick={deleteSheet}>Delete</Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {sheet.goals.map((g: any) => (
                <div key={g.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                  <span>{g.title} <span className="text-slate-400">({g.thrust_area})</span></span>
                  <span className="font-medium">Target: {g.target} · {g.weightage}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}