import { UserContext } from "../../types/users/middleware"

export default {
    post: (context: UserContext) => {
        return {
            userId: context.userId,
            email: context.user.email,
            name: context.user.name,
            porifleImage: context.user.profileImage,
            platformRole: context.user.platformRole,
        }
    }
}