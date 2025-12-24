import { UserContext } from "../../types/users/middleware"

export default {
    get: (context: UserContext) => {
        return {
            userId: context.userId,
        }
    }
}