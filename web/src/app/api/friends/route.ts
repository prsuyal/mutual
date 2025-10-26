import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get friends - now simpler, just query one side
    const friendships = await prisma.friendship.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        user: {
          select: { id: true, handle: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get friend details by querying the friendId
    const friends = await Promise.all(
      friendships.map(async (f: any) => {
        const friend = await prisma.user.findUnique({
          where: { id: f.friendId },
          select: { id: true, handle: true, name: true, image: true },
        })
        return {
          friendshipId: f.id,
          user: friend,
          since: f.createdAt,
        }
      })
    )

    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        receiverId: session.user.id,
      },
      include: {
        sender: {
          select: { id: true, handle: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        senderId: session.user.id,
      },
      include: {
        receiver: {
          select: { id: true, handle: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({
      friends,
      pendingRequests,
      sentRequests,
    })
  } catch (error) {
    console.error('Get friends error:', error)
    return Response.json({ error: 'Failed to get friends' }, { status: 500 })
  }
}