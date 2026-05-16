'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const fetchSheet = (userId: string) =>
  supabase.from('goal_sheets').select('*, goals(*)').eq('employee_id', userId).maybeSingle().then(r => r.data)

export default function EmployeeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sheet, setSheet] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  useEffect(() => {
    if (!user) return
    const loadSheet = async () => {
      setIsLoading(true)
      const data = await fetchSheet(user.id)
      setSheet(data)
      setIsLoading(false)
    }
    loadSheet()
  }, [user])

  const deleteSheet = async () => {
    if (!sheet || !confirm('Delete your goal sheet? You can create a new one after.')) return
    const { error: e1 } = await supabase.from('goals').delete().eq('sheet_id', sheet.id)
    if (e1) return toast.error(e1.message)
    const { error: e2 } = await supabase.from('goal_sheets').delete().eq('id', sheet.id)
    if (e2) return toast.error(e2.message)
    toast.success('Goal sheet deleted')
    setSheet(null)
  }

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user || isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-6">
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
