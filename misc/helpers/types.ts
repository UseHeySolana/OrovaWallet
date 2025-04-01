export interface FunctionParams {
  name: string;
  description: string;
  parameters: any;
  handler: (args:any)=>Promise<any>;   
}