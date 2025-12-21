import { Elysia } from "elysia";
import { readdirSync, statSync } from "fs"
import { join } from "path"

interface RouteHandler {
    get?: {
        handler: (context: any) => any;
        schema?: {
            params?: any;
            query?: any;
            body?: any;
            response?: any;
            headers?: any;
        }
    } | ((context: any) => any);
    post?: {
        handler: (context: any) => any;
        schema?: {
            params?: any;
            query?: any;
            body?: any;
            response?: any;
            headers?: any;
        }
    } | ((context: any) => any);
    put?: {
        handler: (context: any) => any;
        schema?: {
            params?: any;
            query?: any;
            body?: any;
            response?: any;
            headers?: any;
        }
    } | ((context: any) => any);
    patch?: {
        handler: (context: any) => any;
        schema?: {
            params?: any;
            query?: any;
            body?: any;
            response?: any;
            headers?: any;
        }
    } | ((context: any) => any);
    delete?: {
        handler: (context: any) => any;
        schema?: {
            params?: any;
            query?: any;
            body?: any;
            response?: any;
            headers?: any;
        }
    } | ((context: any) => any);
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
function removeRouteGroups(path: string): string {
    return path.replace(/\([^)]+\)\//g, '');
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
    const pathWithoutGroups = removeRouteGroups(relativePath)
    const parts = pathWithoutGroups.split('/');
    const routeData = parts.map(part => fileNameToRoute(part));
    const hasCatchAll = routeData.some(r => r.isCatchAll);
    const routeParts = routeData.map(r => r.route);
    let route = '/' + routeParts.filter(p => p !== '').join('/');
    const handler: RouteHandler = require(filePath).default || require(filePath);

    if (hasCatchAll) {
        const pathSegments = routeParts.filter(p => p !== '' && !p.startsWith('/*'));
        if (pathSegments.length > 0) {
            const prefix = `/${pathSegments.join('/')}`;
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
                const getHandler = typeof handler.get === 'function' ? handler.get : handler.get.handler;
                const getSchema = typeof handler.get === 'object' ? handler.get.schema : undefined;
                if (getSchema) {
                    app.get(`${prefix}/*`, warpHandler(getHandler), getSchema);
                } else {
                    app.get(`${prefix}/*`, warpHandler(getHandler));
                }
                console.log(`Registered GET ${prefix}/*`);
            } else if (handler.post) {
                const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
                const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
                if (postSchema) {
                    app.post(`${prefix}/*`, warpHandler(postHandler), postSchema);
                } else {
                    app.post(`${prefix}/*`, warpHandler(postHandler));
                }
                console.log(`Registered POST ${prefix}/*`);
            } else if (handler.put) {
                const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
                const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
                if (putSchema) {
                    app.put(`${prefix}/*`, warpHandler(putHandler), putSchema);
                } else {
                    app.put(`${prefix}/*`, warpHandler(putHandler));
                }
                console.log(`Registered PUT ${prefix}/*`);
            } else if (handler.patch) {
                const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
                const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
                if (patchSchema) {
                    app.patch(`${prefix}/*`, warpHandler(patchHandler), patchSchema);
                } else {
                    app.patch(`${prefix}/*`, warpHandler(patchHandler));
                }
                console.log(`Registered PATCH ${prefix}/*`);
            } else if (handler.delete) {
                const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
                const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
                if (deleteSchema) {
                    app.delete(`${prefix}/*`, warpHandler(deleteHandler), deleteSchema);
                } else {
                    app.delete(`${prefix}/*`, warpHandler(deleteHandler));
                }
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
                const getHandler = typeof handler.get === 'function' ? handler.get : handler.get.handler;
                const getSchema = typeof handler.get === 'object' ? handler.get.schema : undefined;
                if (getSchema) {
                    app.get('*', warpHandler(getHandler), getSchema);
                } else {
                    app.get('*', warpHandler(getHandler));
                }
                console.log(`Registered GET * (root catch-all)`);
            } else if (handler.post) {
                const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
                const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
                if (postSchema) {
                    app.post('*', warpHandler(postHandler), postSchema);
                } else {
                    app.post('*', warpHandler(postHandler));
                }
                console.log(`Registered POST * (root catch-all)`);
            } else if (handler.put) {
                const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
                const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
                if (putSchema) {
                    app.put('*', warpHandler(putHandler), putSchema);
                } else {
                    app.put('*', warpHandler(putHandler));
                }
                console.log(`Registered PUT * (root catch-all)`);
            } else if (handler.patch) {
                const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
                const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
                if (patchSchema) {
                    app.patch('*', warpHandler(patchHandler), patchSchema);
                } else {
                    app.patch('*', warpHandler(patchHandler));
                }
                console.log(`Registered PATCH * (root catch-all)`);
            } else if (handler.delete) {
                const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
                const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
                if (deleteSchema) {
                    app.delete('*', warpHandler(deleteHandler), deleteSchema);
                } else {
                    app.delete('*', warpHandler(deleteHandler));
                }
                console.log(`Registered DELETE * (root catch-all)`);
            }
        }
    } else {
        const routePattern = route;
        if (handler.get) {
            const getHandler = typeof handler.get === 'function' ? handler.get : handler.get.handler;
            const getSchema = typeof handler.get === 'object' ? handler.get.schema : undefined;
            if (getSchema) {
                app.get(route, getHandler, getSchema);
            } else {
                app.get(route, getHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered GET ${route}`);
        } else if (handler.post) {
            const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
            const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
            if (postSchema) {
                app.post(route, postHandler, postSchema);
            } else {
                app.post(route, postHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered POST ${route}`);
        } else if (handler.put) {
            const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
            const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
            if (putSchema) {
                app.put(route, putHandler, putSchema);
            } else {
                app.put(route, putHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered PUT ${route}`);
        } else if (handler.patch) {
            const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
            const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
            if (patchSchema) {
                app.patch(route, patchHandler, patchSchema);
            } else {
                app.patch(route, patchHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered PATCH ${route}`);
        } else if (handler.delete) {
            const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
            const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
            if (deleteSchema) {
                app.delete(route, deleteHandler, deleteSchema);
            } else {
                app.delete(route, deleteHandler);
            }
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
        hasRouteGroup: boolean;
        cleanPath: string
    }
    const exactRoutes: RouteInfo[] = [];
    const dynamicRoutes: RouteInfo[] = [];
    const catchAllRoutes: RouteInfo[] = [];

    files.forEach(file => {
        const relativePath = file.replace(routesDir, '').replace(/^\//, '');
        const hasRouteGroup = /\([^)]+\)/.test(relativePath);
        const cleanPath = removeRouteGroups(relativePath);
        const depth = (cleanPath.match(/\//g) || []).length;
        const segments = cleanPath.split('/').length;
        const routeInfo = {
            file,
            depth,
            path: relativePath,
            segments,
            hasRouteGroup,
            cleanPath
        }
        if (file.includes('[...')) {
            catchAllRoutes.push(routeInfo);
        } else if (file.includes('[') && file.includes(']')) {
            dynamicRoutes.push(routeInfo);
        } else {
            exactRoutes.push(routeInfo);
        }
    });

    const sortByPriority = (a: RouteInfo, b: RouteInfo) => {
        if (!a.hasRouteGroup && b.hasRouteGroup) return -1;
        if (a.hasRouteGroup && !b.hasRouteGroup) return 1;
        if (a.depth !== b.depth) return b.depth - a.depth;
        return b.segments - a.segments;
    };

    exactRoutes.sort(sortByPriority);
    dynamicRoutes.sort(sortByPriority);
    catchAllRoutes.sort(sortByPriority);

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