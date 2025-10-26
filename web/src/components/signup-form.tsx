'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from '@/lib/auth-client'

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

const handleEmailSignup = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setLoading(true)

  if (password !== confirmPassword) {
    setError('Passwords do not match')
    setLoading(false)
    return
  }

  try {
    // First, create the user account
    const result = await authClient.signUp.email({
      email,
      password,
      name,
    })

    if (result.error) {
      setError(result.error.message || 'Signup failed')
      return
    }

    // Then, update with the handle
    const response = await fetch('/api/user/update-handle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })

    if (!response.ok) {
      setError('Failed to set handle')
      return
    }

    alert('Account created successfully!')
    router.push('/dashboard')
  } catch (err: any) {
    console.error('Signup error:', err)
    setError(err?.message || 'An unexpected error occurred')
  } finally {
    setLoading(false)
  }
}

const handleGoogleSignup = async () => {
  setError(null)
  try {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/setup-handle', 
    })
  } catch (err: any) {
    console.error('Google signup error:', err)
    setError(err?.message || 'Google sign up failed')
  }
}

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSignup}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="handle">Handle</FieldLabel>
              <Input
                id="handle"
                type="text"
                placeholder="johndoe"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
              />
              <FieldDescription>
                Your unique username. Only lowercase letters, numbers, and underscores.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FieldDescription>
                We'll use this to contact you. We will not share your email with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={handleGoogleSignup}
                  className="w-full">
                  Sign up with Google
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <a href="/auth/login" className="underline">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
          </form>
      </CardContent>
    </Card>
  )
}
