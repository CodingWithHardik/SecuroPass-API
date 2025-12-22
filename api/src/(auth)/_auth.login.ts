import { Static, t } from "elysia";
import { prisma } from "../../lib/prisma";
import bycrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const UserSchema = t.Object({
    email: t.String(),
    cwd: t.String()
});

export const post = {
    handler: async ({ body, request }: { body: Static<typeof UserSchema>, request: Request }) => {
        if (process.env.UNAUTHORIZED_BYPASS_ENABLED !== "true" && request.headers.get("origin") !== process.env.MAIN_WEBSITE_URL) return new Response("Unauthorized", { status: 401 })
        let fetchedUser;
        try {
            fetchedUser = await prisma.user.findUnique({
                where: {
                    email: body.email
                }
            })
        } catch (err: any) {
            console.error(err)
            return new Response("Internal Server Error", { status: 500 })
        }
        if (!fetchedUser) return new Response("Please check your email or password", { status: 409 })
        const passwordCheck = await bycrypt.compare(body.cwd, fetchedUser.hashedpwd);
        if (!passwordCheck) return new Response("Please check your email or password", { status: 409 })
        const buf = crypto.randomBytes(160)
        const exptoken = buf.subarray(0, 64).toString("hex")
        const icodev = buf.subarray(64, 72).toString("hex")
        const ivcode = buf.subarray(72, 88)
        let deviceCreate;
        try {
            deviceCreate = await prisma.devices.create({
                data: {
                    ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("remote-addr") || "Unknown",
                    userAgent: request.headers.get("user-agent") || "Unknown",
                    token: exptoken,
                    icodev: icodev,
                    ivcode: ivcode.toString("base64"),
                    userId: fetchedUser.id
                }
            })
        } catch (err: any) {
            console.error(err)
            return new Response("Internal Server Error", { status: 500 })
        }
        if (!deviceCreate?.id) return new Response("Internal Server Error", { status: 500 })
        const key = new TextEncoder().encode(fetchedUser.hashedpwd.split('').reverse().join('')).slice(0, 32)
        const clipher = crypto.createCipheriv("aes-256-cbc", key, ivcode)
        const data = {
            email: fetchedUser.email,
            id: fetchedUser.id,
            verified: fetchedUser.emailVerified,
            createdAt: fetchedUser.createdAt,
            passwordchangeAt: fetchedUser.passwordchangeAt,
            role: fetchedUser.platformRole,
            reftoken: exptoken,
            exp: Date.now() + 3 * 24 * 60 * 60 * 1000
        }
        let encrypted = clipher.update(JSON.stringify(data), 'utf8', 'hex')
        encrypted += clipher.final('hex');
        const token = jwt.sign(
            { token: encrypted + ":" + icodev },
            fetchedUser.randompwd,
            { expiresIn: "3d" }
        )
        return new Response(JSON.stringify({ token: token, refresh: exptoken }), { status: 201 })
    },
    schema: {
        body: UserSchema
    }
}