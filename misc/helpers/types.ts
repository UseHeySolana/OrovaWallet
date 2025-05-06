export interface FunctionParams {
  name: string;
  owner?: string;
  description: string;
  parameters: any;
  handler: (args: any) => Promise<any>;
}