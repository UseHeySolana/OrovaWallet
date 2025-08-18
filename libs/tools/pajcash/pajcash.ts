import { request } from "../../../utils/request/db";

const pajcash = {
    getNairaRate: async (url:string,amount: number, ) => {
        const response = await request.getRan(`${url}/pub/rate/${amount}`);
        if (!response.ok) {
            const result = await response.json();
            return { status: false, message: result.message }
        }
        return { status: true, data: await response.json() };
    },
}

export {
    pajcash
}