import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import { router, useSegments } from "expo-router";


import * as FileSystem from 'expo-file-system';

export async function getAllRoutes() {
    try {
        // Assuming your routes are in the 'app' directory
        const appDir = FileSystem.documentDirectory + 'app/';
        const files = await FileSystem.readDirectoryAsync(appDir);

        // Process file names to generate route patterns
        const routes = files
            .filter(file => !file.startsWith('.') && (file.endsWith('.js') || file.endsWith('.tsx')))
            .map(file => '/' + file.replace(/\.(js|tsx)$/, ''));

        return routes;
    } catch (error) {
        console.error('Error scanning routes:', error);
        return [];
    }
}

export class Routing {
    public changeRoute: any;
    public goBack: any;

    constructor(public session: SessionManager) {
        this.changeRoute = this.change_route()
        this.goBack = this.go_back()
    }
    change_route() {
        return {
            name: "change_route",
            description: "This function allows you to change route to the page you want to change to,",
            parameters: {
                type: "object",
                properties: {
                    route: {
                        type: "string",
                        description:"This is the route you would navigate to the route should be mapped to and be among this list of routes, about, contact, currency,dashboard,language, scan, send, smarthedging, swap, tokeninfo"
                    }
                },
                required: ["route"],
            },
            handler: async (args: { route: string }) => {
                //@ts-expect-error
                router.push(`/${args.route}`)
                return "Welcome to this route!";
            }
        }
    }

    go_back() {
        return {
            name: "go_back",
            description: "This returns you to the previous route.",
            parameters: null,
            handler: async () => {
                router.back();
                return "Returned to previous screen successfully";
            }
        }
    }


}
