import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = await req.json()

    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    })

    if (!friendRequest) {
      return Response.json({ error: 'Friend request not found' }, { status: 404 })
    }

    if (friendRequest.receiverId !== session.user.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.friendship.create({
        data: {
          userId: friendRequest.senderId,
          friendId: friendRequest.receiverId,
        },
      }),
      prisma.friendship.create({
        data: {
          userId: friendRequest.receiverId,
          friendId: friendRequest.senderId,
        },
      }),
      prisma.friendRequest.delete({
        where: { id: requestId },
      }),
    ])

    return Response.json({ success: true })
  } catch (error) {
    console.error('Accept friend request error:', error)
    return Response.json({ error: 'Failed to accept friend request' }, { status: 500 })
  }
}