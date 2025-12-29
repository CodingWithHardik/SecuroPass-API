import { Elysia } from "elysia";
import { readdirSync, statSync } from "fs"
import { join } from "path"

interface RouteHandler {
    use?: any | any[];
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
function applyMiddleware(app: Elysia, middleware: any | any[]): Elysia {
    if (Array.isArray(middleware)) {
        middleware.forEach(mw => { app.use(mw) });
    } else {
        app.use(middleware);
    }
    return app;
}
async function collectMiddlewareChain(filePath:string, routesDir: string): Promise<any[]> {
    const middlewareChain: any[] = [];
    const relativePath = filePath.replace(routesDir, '').replace(/^\//, '');
    const pathParts = relativePath.split('/');

    for (let i = 0; i < pathParts.length - 1; i++) {
        const parentPath = pathParts.slice(0, i + 1).join('/');
        const parentDir = join(routesDir, parentPath);
        try {
            let filesInDir = readdirSync(parentDir);
            for (const file of filesInDir) {
                if (file.match(/\.(ts|js)$/) && !statSync(join(parentDir, file)).isDirectory()) {
                    const fullPath = join(parentDir, file);
                    try {
                        const fileModule = await import(fullPath);
                        const handler: RouteHandler = fileModule.default || fileModule;
                        if (handler.use) {
                            if (Array.isArray(handler.use)) {
                                middlewareChain.push(...handler.use);
                            } else {
                                middlewareChain.push(handler.use);
                            }
                        }
                    } catch (error) {
                        console.log(`Failed to load ${file}:`, error);
                    }
                }
            }
        } catch (error) {
            console.log(`Failed to read directory ${parentDir}:`);
        }
    }
    return middlewareChain;
}
async function processRoute(app: Elysia, filePath: string, routesDir: string, registeredRoutes: Set<string>, isCatchAllRoute: boolean = false): Promise<void> {
    const relativePath = filePath.replace(routesDir, '').replace(/^\//, '');
    const pathWithoutGroups = removeRouteGroups(relativePath)
    const parts = pathWithoutGroups.split('/');
    const routeData = parts.map(part => fileNameToRoute(part));
    const hasCatchAll = routeData.some(r => r.isCatchAll);
    const routeParts = routeData.map(r => r.route);
    let route = '/' + routeParts.filter(p => p !== '').join('/');
    const module = await import(filePath);
    const handler: RouteHandler = module.default || module;
    const parentMiddleware = await collectMiddlewareChain(filePath, routesDir);

    let routeApp = app;
    const allMiddleware = [...parentMiddleware];
    if (handler.use) {
        if (Array.isArray(handler.use)) {
            allMiddleware.push(...handler.use);
        } else {
            allMiddleware.push(handler.use);
        }
    }
    if (allMiddleware.length > 0) {
        routeApp = new Elysia();
        applyMiddleware(routeApp, allMiddleware);
    }

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
                    routeApp.get(`${prefix}/*`, warpHandler(getHandler), getSchema);
                } else {
                    routeApp.get(`${prefix}/*`, warpHandler(getHandler));
                }
                console.log(`Registered GET ${prefix}/* ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.post) {
                const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
                const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
                if (postSchema) {
                    routeApp.post(`${prefix}/*`, warpHandler(postHandler), postSchema);
                } else {
                    routeApp.post(`${prefix}/*`, warpHandler(postHandler));
                }
                console.log(`Registered POST ${prefix}/* ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.put) {
                const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
                const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
                if (putSchema) {
                    routeApp.put(`${prefix}/*`, warpHandler(putHandler), putSchema);
                } else {
                    routeApp.put(`${prefix}/*`, warpHandler(putHandler));
                }
                console.log(`Registered PUT ${prefix}/* ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.patch) {
                const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
                const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
                if (patchSchema) {
                    routeApp.patch(`${prefix}/*`, warpHandler(patchHandler), patchSchema);
                } else {
                    routeApp.patch(`${prefix}/*`, warpHandler(patchHandler));
                }
                console.log(`Registered PATCH ${prefix}/* ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.delete) {
                const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
                const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
                if (deleteSchema) {
                    routeApp.delete(`${prefix}/*`, warpHandler(deleteHandler), deleteSchema);
                } else {
                    routeApp.delete(`${prefix}/*`, warpHandler(deleteHandler));
                }
                console.log(`Registered DELETE ${prefix}/* ${handler.use ? '(with middleware)' : ''}`);
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
                    routeApp.get('*', warpHandler(getHandler), getSchema);
                } else {
                    routeApp.get('*', warpHandler(getHandler));
                }
                console.log(`Registered GET * (root catch-all) ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.post) {
                const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
                const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
                if (postSchema) {
                    routeApp.post('*', warpHandler(postHandler), postSchema);
                } else {
                    routeApp.post('*', warpHandler(postHandler));
                }
                console.log(`Registered POST * (root catch-all) ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.put) {
                const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
                const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
                if (putSchema) {
                    routeApp.put('*', warpHandler(putHandler), putSchema);
                } else {
                    routeApp.put('*', warpHandler(putHandler));
                }
                console.log(`Registered PUT * (root catch-all) ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.patch) {
                const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
                const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
                if (patchSchema) {
                    routeApp.patch('*', warpHandler(patchHandler), patchSchema);
                } else {
                    routeApp.patch('*', warpHandler(patchHandler));
                }
                console.log(`Registered PATCH * (root catch-all) ${handler.use ? '(with middleware)' : ''}`);
            } 
            if (handler.delete) {
                const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
                const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
                if (deleteSchema) {
                    routeApp.delete('*', warpHandler(deleteHandler), deleteSchema);
                } else {
                    routeApp.delete('*', warpHandler(deleteHandler));
                }
                console.log(`Registered DELETE * (root catch-all) ${handler.use ? '(with middleware)' : ''}`);
            }
        }
    } else {
        const routePattern = route;
        if (handler.get) {
            const getHandler = typeof handler.get === 'function' ? handler.get : handler.get.handler;
            const getSchema = typeof handler.get === 'object' ? handler.get.schema : undefined;
            if (getSchema) {
                routeApp.get(route, getHandler, getSchema);
            } else {
                routeApp.get(route, getHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered GET ${route} ${handler.use ? '(with middleware)' : ''}`);
        } 
        if (handler.post) {
            const postHandler = typeof handler.post === 'function' ? handler.post : handler.post.handler;
            const postSchema = typeof handler.post === 'object' ? handler.post.schema : undefined;
            if (postSchema) {
                routeApp.post(route, postHandler, postSchema);
            } else {
                routeApp.post(route, postHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered POST ${route} ${handler.use ? '(with middleware)' : ''}`);
        } 
        if (handler.put) {
            const putHandler = typeof handler.put === 'function' ? handler.put : handler.put.handler;
            const putSchema = typeof handler.put === 'object' ? handler.put.schema : undefined;
            if (putSchema) {
                routeApp.put(route, putHandler, putSchema);
            } else {
                routeApp.put(route, putHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered PUT ${route} ${handler.use ? '(with middleware)' : ''}`);
        } 
        if (handler.patch) {
            const patchHandler = typeof handler.patch === 'function' ? handler.patch : handler.patch.handler;
            const patchSchema = typeof handler.patch === 'object' ? handler.patch.schema : undefined;
            if (patchSchema) {
                routeApp.patch(route, patchHandler, patchSchema);
            } else {
                routeApp.patch(route, patchHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered PATCH ${route} ${handler.use ? '(with middleware)' : ''}`);
        }
        if (handler.delete) {
            const deleteHandler = typeof handler.delete === 'function' ? handler.delete : handler.delete.handler;
            const deleteSchema = typeof handler.delete === 'object' ? handler.delete.schema : undefined;
            if (deleteSchema) {
                routeApp.delete(route, deleteHandler, deleteSchema);
            } else {
                routeApp.delete(route, deleteHandler);
            }
            registeredRoutes.add(routePattern);
            console.log(`Registered DELETE ${route} ${handler.use ? '(with middleware)' : ''}`);
        }
    }
    if (allMiddleware.length > 0 && routeApp !== app) {
        app.use(routeApp);
    }
}
export async function registerFileRoutes(app: Elysia, routesDir: string): Promise<Elysia> {
    const registeredRoutes = new Set<string>();
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

    for (const { file } of exactRoutes) {
        await processRoute(app, file, routesDir, registeredRoutes);
    }
    for (const { file } of dynamicRoutes) {
        await processRoute(app, file, routesDir, registeredRoutes);
    }
    for (const { file } of catchAllRoutes) {
        await processRoute(app, file, routesDir, registeredRoutes);
    }
    
    return app;
}