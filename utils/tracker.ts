import { request } from "./request/db";

const tracker = {
  buttons: async (button_name: string, clicks: number) => {
    const response = await request.postJson(
      { button_name, clicks },
      `/track/button-clicks`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  tool_calls: async (tool_name: string, calls: number) => {
    const response = await request.postJson(
      { tool_name, calls },
      `/track/tool-calls`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  app_open_count: async () => {
    const response = await request.postJson({}, `/track/app-open-count`);
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  page_open_count: async (page_name: string, open_count: number) => {
    const response = await request.postJson(
      { page_name, open_count },
      `/track/page-open-count`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  token_usage: async (token_name: string, usage_count: number) => {
    const response = await request.postJson(
      { token_name, usage_count },
      `/track/token-usage`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },
};

export default tracker;
