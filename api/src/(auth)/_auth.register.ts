import { Static, t } from "elysia";
import { prisma } from "../../lib/prisma";
import bycrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const UserSchema = t.Object({
    name: t.String(),
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
        if (fetchedUser !== null) return new Response("User already exists", { status: 409 })
        const hashedcwd = await bycrypt.hash(body.cwd, 12)
        const randompwd = (length: number) => {
            const characters = 'QWERT!#$YUIO$%PAS!#$%^DFGH%^JKLZX$CVBNMqwerty$%u#$%^iopasd$%^$fghj!#klzxcvbnm1234567890!#$%^'
            if (length < 6) length = 6;
            const arr = new Uint32Array(length);
            crypto.getRandomValues(arr);
            return Array.from(arr, v => characters[v % characters.length]).join('');
        }
        const buf = crypto.randomBytes(160)
        const exptoken = buf.subarray(0, 64).toString("hex")
        const icodev = buf.subarray(64, 72).toString("hex")
        const ivcode = buf.subarray(72, 88)
        let createdUser;
        try {
            createdUser = await prisma.user.create({
                data: {
                    email: body.email,
                    name: body.name,
                    hashedpwd: hashedcwd,
                    randompwd: randompwd(String(body.cwd)?.length || 19),
                    passwordchangeAt: new Date(),
                }
            })
        } catch (err: any) {
            console.error(err)
            return new Response("Internal Server Error", { status: 500 })
        }
        if (!createdUser?.id) return new Response("Internal Server Error", { status: 500 })
        let deviceCreate;
        try {
            deviceCreate = await prisma.devices.create({
                data: {
                    ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("remote-addr") || "Unknown",
                    userAgent: request.headers.get("user-agent") || "Unknown",
                    token: exptoken,
                    icodev: icodev,
                    ivcode: ivcode.toString("base64"),
                    userId: createdUser.id
                }
            })
        } catch (err: any) {
            console.error(err)
            return new Response("Internal Server Error", { status: 500 })
        }
        if (!deviceCreate?.id) return new Response("Internal Server Error", { status: 500 })
        const key = new TextEncoder().encode(createdUser.hashedpwd.split('').reverse().join('')).slice(0, 32)
        const clipher = crypto.createCipheriv("aes-256-cbc", key, ivcode)
        const data = {
            email: createdUser.email,
            id: createdUser.id,
            verified: createdUser.emailVerified,
            createdAt: createdUser.createdAt,
            passwordchangeAt: createdUser.passwordchangeAt,
            role: createdUser.platformRole,
            reftoken: exptoken,
            exp: Date.now() + 3 * 24 * 60 * 60 * 1000
        }
        let encrypted = clipher.update(JSON.stringify(data), 'utf8', 'hex')
        encrypted += clipher.final('hex');
        const token = jwt.sign(
            { token: encrypted + ":" + icodev },
            createdUser.randompwd,
            { expiresIn: "3d" }
        )
        return new Response(JSON.stringify({ token: token, refresh: exptoken }), { status: 201 })
    },
    schema: {
        body: UserSchema
    }
}