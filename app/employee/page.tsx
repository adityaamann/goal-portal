'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function EmployeeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user) return null

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
        <div className="flex gap-3">
          <Button onClick={() => router.push('/employee/goals')}>Create Goal Sheet</Button>
          <Button variant="outline" onClick={() => router.push('/employee/checkin')}>Quarterly Check-in</Button>
        </div>
      </div>
    </div>
  )
}