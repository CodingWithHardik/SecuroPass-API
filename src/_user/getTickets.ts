import { prisma } from "../../lib/prisma"
import { UserContext } from "../../types/users/middleware"

export default {
    post: async (context: UserContext) => {
        const getData = await prisma.passes.findMany({
            where: {
                assignedToId: String(context.userId),
            },
        })
        return getData
    }
}