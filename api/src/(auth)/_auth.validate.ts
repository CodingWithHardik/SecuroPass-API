import { Static, t } from "elysia";
import { prisma } from "../../lib/prisma";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const AuthSchema = t.Object({
    authToken: t.String(),
})
export const post = {
    handler: async ({ body, request }: { body: Static<typeof AuthSchema>, request: Request }) => {
        if (process.env.UNAUTHORIZED_BYPASS_ENABLED !== "true" && request.headers.get("origin") !== process.env.MAIN_WEBSITE_URL) return new Response("Unauthorized", { status: 401 })
        const tokenparts = body.authToken.split(".")
        if (tokenparts.length !== 3) return new Response("Unauthorized1", { status: 401 })
        const tokenivsep = JSON.parse(Buffer.from(tokenparts[1], "base64").toString("utf-8")).token.split(":")
        if (tokenivsep.length !== 2) return new Response("Unauthorized2", { status: 401 })
        let devicesfetch;
        try {
            devicesfetch = await prisma.devices.findUnique({
                where: {
                    icodev: tokenivsep[1]
                }
            })
        } catch {
            return new Response("Unauthorized3", { status: 401 })
        }
        if (!devicesfetch || !devicesfetch.userId) return new Response("Unauthorized4", { status: 401 })
        let usersfetch;
        try {
            usersfetch = await prisma.user.findUnique({
                where: {
                    id: devicesfetch.userId,
                }
            })
        } catch {
            return new Response("Unauthorized5", { status: 401 })
        }
        if (!usersfetch || !usersfetch.randompwd) return new Response("Unauthorized6", { status: 401 })
        let jsondecoded;
        try {
            jsondecoded = jwt.verify(body.authToken, usersfetch.randompwd)
        } catch (err: any) {
            return new Response("Unauthorized7", { status: 401 })
        }
        if (typeof jsondecoded !== "object" || jsondecoded === null || !(jsondecoded as any).token) return new Response("Unauthorized8", { status: 401 })
        const tokensep = String((jsondecoded as any).token).split(":")
        if (tokensep.length !== 2) return new Response("Unauthorized9", { status: 401 })
        const key = new TextEncoder().encode(usersfetch.hashedpwd.split('').reverse().join('')).slice(0, 32)
        const ivcode = Buffer.from(devicesfetch.ivcode, "base64");
        const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivcode)
        let decrypted = decipher.update(tokensep[0], "hex", "utf8")
        decrypted += decipher.final("utf8")
        const decrypteddata = JSON.parse(decrypted);
        if (!decrypteddata || typeof decrypteddata !== "object") return new Response("Unauthorized10", { status: 401 })
        if (decrypteddata.tokenExpiry < Date.now()) return new Response("Unauthorized11", { status: 401 })
        if (decrypteddata.reftoken !== devicesfetch.token) return new Response("Unauthorized12", { status: 401 })
        if (decrypteddata.email !== usersfetch.email || decrypteddata.id !== usersfetch.id || decrypteddata.verified !== usersfetch.emailVerified || decrypteddata.createdAt !== usersfetch.createdAt.toISOString() || decrypteddata.passwordchangeAt !== usersfetch.passwordchangeAt?.toISOString() || decrypteddata.role !== usersfetch.platformRole) return new Response("Unauthorized13", { status: 401 })
        return new Response("Authorized", { status: 200 })
    },
    schema: {
        body: AuthSchema
    }
}