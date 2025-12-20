import { Elysia } from "elysia";
import { readdirSync, statSync } from "fs"
import { join } from "path"

interface RouteHandler {
    get?: (context: any) => any;
    post?: (context: any) => any;
    put?: (context: any) => any;
    patch?: (context: any) => any;
    delete?: (context: any) => any;
}

function fileNameToRoute(fileName: string): { route: string, isCatchAll: boolean } {
    let route = fileName.replace(/\.(ts|js)$/, '');
    if (route === 'index') {
        return { route: '', isCatchAll: false };
    }
    const isCatchAll = /\[\.\.\.([^\]]+)\]/.test(route);

    if (isCatchAll) {
        const match = route.match(/\[\.\.\.([^\]]+)\]/);
        return { route: `/*${match ? match[1] : 'slug'}`, isCatchAll: true };
    }
    route = route.replace(/\[([^\]]+)\]/g, ':$1');
    return { route, isCatchAll: false };
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = readdirSync(dirPath);

    files.forEach(file => {
        const filePath = join(dirPath, file);
        if (statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
        } else if (file.match(/\.(ts|js)$/)) {
            arrayOfFiles.push(filePath);
        }
    })
    return arrayOfFiles;
}

const registeredRoutes = new Set<string>();

function matchesPattern(path: string, pattern: string): boolean {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) continue;
        if (patternParts[i] !== pathParts[i]) return false;
    }
    return true;
}

function processRoute(app: Elysia, filePath: string, routesDir: string, isCatchAllRoute: boolean = false): void {
    const relativePath = filePath.replace(routesDir, '').replace(/^\//, '');
    const parts = relativePath.split('/');
    const routeData = parts.map(part => fileNameToRoute(part));
    const hasCatchAll = routeData.some(r => r.isCatchAll);
    const routeParts = routeData.map(r => r.route);
    let route = '/' + routeParts.filter(p => p !== '').join('/');
    const handler: RouteHandler = require(filePath).default || require(filePath);

    if (hasCatchAll) {
        const pathSegments = routeParts.filter(p => p !== '' && !p.startsWith('/*'));
        if (pathSegments.length > 0) {
            const prefix = `${pathSegments.join('/')}`;
            const warpHandler = (originalHandler: any) => {
                return (context: any) => {
                    const requestPath = context.path;
                    for (const registeredPattern of registeredRoutes) {
                        if (matchesPattern(requestPath, registeredPattern)) {
                            return;
                        }
                    }
                    return originalHandler(context);
                }
            }
            if (handler.get) {
                app.get(`${prefix}/*`, warpHandler(handler.get));
                console.log(`Registered GET ${prefix}/*`);
            } else if (handler.post) {
                app.post(`${prefix}/*`, warpHandler(handler.post));
                console.log(`Registered POST ${prefix}/*`);
            } else if (handler.put) {
                app.put(`${prefix}/*`, warpHandler(handler.put));
                console.log(`Registered PUT ${prefix}/*`);
            } else if (handler.patch) {
                app.patch(`${prefix}/*`, warpHandler(handler.patch));
                console.log(`Registered PATCH ${prefix}/*`);
            } else if (handler.delete) {
                app.delete(`${prefix}/*`, warpHandler(handler.delete));
                console.log(`Registered DELETE ${prefix}/*`);
            }
        } else {
            const warpHandler = (originalHandler: any) => {
                return (context: any) => {
                    const requestPath = context.path;
                    for (const registeredPattern of registeredRoutes) {
                        if (matchesPattern(requestPath, registeredPattern)) {
                            return;
                        }
                    }
                    return originalHandler(context);
                }
            }
            if (handler.get) {
                app.get('*', warpHandler(handler.get));
                console.log(`Registered GET * (root catch-all)`);
            } else if (handler.post) {
                app.post('*', warpHandler(handler.post));
                console.log(`Registered POST * (root catch-all)`);
            } else if (handler.put) {
                app.put('*', warpHandler(handler.put));
                console.log(`Registered PUT * (root catch-all)`);
            } else if (handler.patch) {
                app.patch('*', warpHandler(handler.patch));
                console.log(`Registered PATCH * (root catch-all)`);
            } else if (handler.delete) {
                app.delete('*', warpHandler(handler.delete));
                console.log(`Registered DELETE * (root catch-all)`);
            }
        }
    } else {
        const routePattern = route;
        if (handler.get) {
            app.get(route, handler.get);
            registeredRoutes.add(routePattern);
            console.log(`Registered GET ${route}`);
        } else if (handler.post) {
            app.post(route, handler.post);
            registeredRoutes.add(routePattern);
            console.log(`Registered POST ${route}`);
        } else if (handler.put) {
            app.put(route, handler.put);
            registeredRoutes.add(routePattern);
            console.log(`Registered PUT ${route}`);
        } else if (handler.patch) {
            app.patch(route, handler.patch);
            registeredRoutes.add(routePattern);
            console.log(`Registered PATCH ${route}`);
        } else if (handler.delete) {
            app.delete(route, handler.delete);
            registeredRoutes.add(routePattern);
            console.log(`Registered DELETE ${route}`);
        }
    }
}

export function registerFileRoutes(app: Elysia, routesDir: string): Elysia {
    const files = getAllFiles(routesDir);
    interface RouteInfo {
        file: string;
        depth: number;
        path: string;
        segments: number;
    }
    const exactRoutes: RouteInfo[] = [];
    const dynamicRoutes: RouteInfo[] = [];
    const catchAllRoutes: RouteInfo[] = [];

    files.forEach(file => {
        const relativePath = file.replace(routesDir, '').replace(/^\//, '');
        const depth = (relativePath.match(/\//g) || []).length;
        const segments = relativePath.split('/').length;
        if (file.includes('[...')) {
            catchAllRoutes.push({ file, depth, path: relativePath, segments });
        } else if (file.includes('[') && file.includes(']')) {
            dynamicRoutes.push({ file, depth, path: relativePath, segments });
        } else {
            exactRoutes.push({ file, depth, path: relativePath, segments });
        }
    });

    const sortByDepthAndSegments = (a: RouteInfo, b: RouteInfo) => {
        if (a.depth !== b.depth) return b.depth - a.depth;
        return b.segments - a.segments;
    };

    exactRoutes.sort(sortByDepthAndSegments);
    dynamicRoutes.sort(sortByDepthAndSegments);
    catchAllRoutes.sort(sortByDepthAndSegments);

    exactRoutes.forEach(({ file }) => {
        processRoute(app, file, routesDir);
    })
    dynamicRoutes.forEach(({ file }) => {
        processRoute(app, file, routesDir);
    })
    catchAllRoutes.forEach(({ file }) => {
        processRoute(app, file, routesDir);
    });
    return app;
}