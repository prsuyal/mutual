import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const response = await fetch(new URL('/api/user/check-handle', request.url), {
      headers: request.headers,
    })
    
    if (response.ok) {
      const data = await response.json()
      if (!data.hasHandle) {
        // Redirect to handle setup if no handle
        return NextResponse.redirect(new URL('/setup-handle', request.url))
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/dashboard/:path*',
}