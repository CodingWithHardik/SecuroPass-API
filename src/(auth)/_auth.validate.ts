import { Static, t } from "elysia";
import { prisma } from "../../lib/prisma";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const AuthSchema = t.Object({
    authToken: t.String(),
})

export default {
    post: {
        handler: async ({ body, request }: { body: Static<typeof AuthSchema>, request: Request }) => {
            if (process.env.UNAUTHORIZED_BYPASS_ENABLED !== "true" && request.headers.get("origin") !== process.env.MAIN_WEBSITE_URL) return new Response("Unauthorized", { status: 401 })
            let tokenpayload;
            try {
                tokenpayload = JSON.parse(Buffer.from(body.authToken.split(".")[1], "base64").toString("utf-8"))
            } catch {
                return new Response("Unauthorized", { status: 401 })
            }
            if (!tokenpayload?.token) return new Response("Unauthorized", { status: 401 })
            const [encryptedtoken, icodev] = String(tokenpayload.token).split(":")
            if (!encryptedtoken || !icodev) return new Response("Unauthorized", { status: 401 })
            const device = await prisma.devices.findUnique({
                where: {
                    icodev: icodev,
                },
                include: {
                    user: true
                }
            })
            if (!device || !device?.user || !device?.token) return new Response("Unauthorized", { status: 401 })
            let jsondecoded;
            try {
                jsondecoded = jwt.verify(body.authToken, device.user.randompwd)
            } catch (err: any) {
                return new Response("Unauthorized", { status: 401 })
            }
            if (typeof jsondecoded !== "object" || jsondecoded === null || !(jsondecoded as any).token) return new Response("Unauthorized", { status: 401 })
            const tokensep = String((jsondecoded as any).token).split(":")
            if (tokensep.length !== 2) return new Response("Unauthorized", { status: 401 })
            const key = new TextEncoder().encode(device.user.hashedpwd.split('').reverse().join('')).slice(0, 32)
            const ivcode = Buffer.from(device.ivcode, "base64");
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivcode)
            let decrypted = decipher.update(tokensep[0], "hex", "utf8")
            decrypted += decipher.final("utf8")
            const decrypteddata = JSON.parse(decrypted);
            if (!decrypteddata || typeof decrypteddata !== "object") return new Response("Unauthorized", { status: 401 })
            if (decrypteddata.tokenExpiry < Date.now()) return new Response("Unauthorized", { status: 401 })
            if (decrypteddata.reftoken !== device.token) return new Response("Unauthorized", { status: 401 })
            if (decrypteddata.email !== device.user.email || decrypteddata.id !== device.user.id || decrypteddata.verified !== device.user.emailVerified || decrypteddata.createdAt !== device.user.createdAt.toISOString() || decrypteddata.passwordchangeAt !== device.user.passwordchangeAt?.toISOString() || decrypteddata.role !== device.user.platformRole) return new Response("Unauthorized", { status: 401 })
            return new Response("Authorized", { status: 200 })
        },
        schema: {
            body: AuthSchema
        }
    }
}