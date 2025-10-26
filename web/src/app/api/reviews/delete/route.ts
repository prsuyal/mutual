import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reviewId } = await req.json()

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    })

    if (!review) {
      return Response.json({ error: 'Review not found' }, { status: 404 })
    }

    if (review.userId !== session.user.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 })
    }

    await prisma.review.delete({
      where: { id: reviewId },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Delete review error:', error)
    return Response.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}