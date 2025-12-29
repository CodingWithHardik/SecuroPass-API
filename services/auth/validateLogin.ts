import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { Context } from "elysia";
import jwt from "jsonwebtoken";

export async function validateLogin(context: Context) {
    const authHeader = context.request.headers.get.apply(context.request.headers, ['Authorization']);
    if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('No token provided');
    const token = authHeader.split(' ')[1];
    if (!token) throw new Error('No token provided');
    let tokenpayload;
    try {
        tokenpayload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"))
    } catch {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    if (!tokenpayload?.token) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    const [encryptedtoken, icodev] = String(tokenpayload.token).split(":")
    if (!encryptedtoken || !icodev) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    const device = await prisma.devices.findUnique({
        where: {
            icodev: icodev,
        },
        include: {
            user: true
        }
    })
    if (!device || !device?.user || !device?.token) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    let jsondecoded;
    try {
        jsondecoded = jwt.verify(token, device.user.randompwd)
    } catch (err: any) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    if (typeof jsondecoded !== "object" || jsondecoded === null || !(jsondecoded as any).token) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    const tokensep = String((jsondecoded as any).token).split(":")
    if (tokensep.length !== 2) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    const key = new TextEncoder().encode(device.user.hashedpwd.split('').reverse().join('')).slice(0, 32)
    const ivcode = Buffer.from(device.ivcode, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivcode)
    let decrypted = decipher.update(tokensep[0], "hex", "utf8")
    decrypted += decipher.final("utf8")
    const decrypteddata = JSON.parse(decrypted);
    if (!decrypteddata || typeof decrypteddata !== "object") {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    if (decrypteddata.tokenExpiry < Date.now()) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    if (decrypteddata.reftoken !== device.token) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    if (decrypteddata.email !== device.user.email || decrypteddata.id !== device.user.id || decrypteddata.verified !== device.user.emailVerified || decrypteddata.createdAt !== device.user.createdAt.toISOString() || decrypteddata.passwordchangeAt !== device.user.passwordchangeAt?.toISOString() || decrypteddata.role !== device.user.platformRole) {
        context.set.status = 401;
        throw new Error("Unauthorized");
    }
    return { device: device };
}