import Elysia, { Context } from "elysia"
import { validateLogin } from "../../services/auth/validateLogin"
import { UserFields } from "../../types/users/middleware"

export default {
    use: (app: Elysia) => {
        return app.derive(async (context: Context) => {
            if (process.env.UNAUTHORIZED_BYPASS_ENABLED !== "true" && context.request.headers.get("origin") !== process.env.MAIN_WEBSITE_URL) {
                context.set.status = 401;
                throw new Error("Unauthorized");
            }
            const result = await validateLogin(context)
            if (!result.device.user.emailVerified) {
                context.set.status = 401;
                throw new Error("Email not verified");
            }
            return {
                userId: result.device.user.id,
                user: result.device.user,
                device: result.device,
            } satisfies UserFields
        })
    },
}